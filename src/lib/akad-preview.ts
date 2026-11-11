import JSZip from 'jszip'

// ---------------------------------------------------------------------------
// Geometry (twips -> pt). Source: template sectPr / pgSz / pgMar / header / footer.
// ---------------------------------------------------------------------------
const TW = 1 / 20
const PAGE_W_PT = 11906 * TW // 595.3
const PAGE_H_PT = 16838 * TW // 841.9
const MARGIN_TOP_PT = 2000 * TW // 100
const MARGIN_RIGHT_PT = 1134 * TW // 56.7
const MARGIN_BOTTOM_PT = 1500 * TW // 75
const MARGIN_LEFT_PT = 1134 * TW // 56.7
const HEADER_TOP_PT = 300 * TW // 15
const FOOTER_BOTTOM_PT = 400 * TW // 20
const CONTENT_W_PT = 9638 * TW // 481.9
const CONTENT_H_PT = 13338 * TW // 666.9

// Word "auto" line spacing = multiple * natural single spacing of the font.
// Measured on the reference render: 276 auto for 10pt Raleway -> 13.5pt.
const NATURAL_LINE_FACTOR = 1.174

// ---------------------------------------------------------------------------
// Minimal XML tree parser (namespace-prefix agnostic by local name).
// ---------------------------------------------------------------------------
type XmlEl = {
  name: string
  attrs: Record<string, string>
  children: XmlEl[]
}

const decodeXml = (value: string) =>
  value.replace(/&(amp|lt|gt|quot|apos);|#(\d+);|#x([0-9a-fA-F]+);/g, (m, ent, dec, hex) => {
    if (ent === 'amp') return '&'
    if (ent === 'lt') return '<'
    if (ent === 'gt') return '>'
    if (ent === 'quot') return '"'
    if (ent === 'apos') return "'"
    if (dec) return String.fromCodePoint(Number(dec))
    if (hex) return String.fromCodePoint(parseInt(hex, 16))
    return m
  })

export const parseXml = (src: string): XmlEl => {
  const root: XmlEl = { name: '#root', attrs: {}, children: [] }
  const stack: XmlEl[] = [root]
  const len = src.length
  let i = 0

  const addText = (text: string) => {
    if (!text) return
    const parent = stack[stack.length - 1]
    const last = parent.children[parent.children.length - 1]
    if (last && last.name === '#text') {
      last.attrs['#text'] = decodeXml(last.attrs['#text'] + text)
    } else {
      parent.children.push({ name: '#text', attrs: { '#text': decodeXml(text) }, children: [] })
    }
  }

  while (i < len) {
    const lt = src.indexOf('<', i)
    if (lt < 0) {
      addText(src.slice(i))
      break
    }
    if (lt > i) addText(src.slice(i, lt))
    if (src.startsWith('<?', lt)) {
      const end = src.indexOf('?>', lt)
      i = end < 0 ? len : end + 2
      continue
    }
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt)
      i = end < 0 ? len : end + 3
      continue
    }
    if (src.startsWith('<!', lt)) {
      const end = src.indexOf('>', lt)
      i = end < 0 ? len : end + 1
      continue
    }
    if (src.startsWith('</', lt)) {
      const end = src.indexOf('>', lt)
      if (stack.length > 1) stack.pop()
      i = end < 0 ? len : end + 1
      continue
    }

    let j = lt + 1
    let nameEnd = j
    while (nameEnd < len && !/[\s/>]/.test(src[nameEnd])) nameEnd++
    const name = src.slice(j, nameEnd)
    j = nameEnd

    const attrs: Record<string, string> = {}
    let selfClose = false
    while (j < len) {
      while (j < len && /\s/.test(src[j])) j++
      if (src[j] === '>') {
        j++
        break
      }
      if (src[j] === '/' && src[j + 1] === '>') {
        selfClose = true
        j += 2
        break
      }
      let attrEnd = j
      while (attrEnd < len && !/[\s=>]/.test(src[attrEnd])) attrEnd++
      const attrName = src.slice(j, attrEnd)
      let eq = attrEnd
      while (eq < len && /\s/.test(src[eq])) eq++
      let value = ''
      if (src[eq] === '=') {
        eq++
        while (eq < len && /\s/.test(src[eq])) eq++
        const quote = src[eq]
        if (quote === '"' || quote === "'") {
          const close = src.indexOf(quote, eq + 1)
          value = src.slice(eq + 1, close < 0 ? len : close)
          eq = close < 0 ? len : close + 1
        } else {
          let valueEnd = eq
          while (valueEnd < len && !/\s/.test(src[valueEnd])) valueEnd++
          value = src.slice(eq, valueEnd)
          eq = valueEnd
        }
      }
      attrs[attrName] = decodeXml(value)
      j = eq
    }

    const el: XmlEl = { name, attrs, children: [] }
    stack[stack.length - 1].children.push(el)
    if (!selfClose) stack.push(el)
    i = j
  }

  return root
}

const localName = (name: string) => {
  const idx = name.indexOf(':')
  return idx >= 0 ? name.slice(idx + 1) : name
}

const kidsOf = (el: XmlEl, name: string) =>
  el.children.filter((child) => localName(child.name) === name)
const kidOf = (el: XmlEl, name: string) => kidsOf(el, name)[0]

const attrOf = (el: XmlEl, name: string): string | undefined => {
  if (name in el.attrs) return el.attrs[name]
  for (const key of Object.keys(el.attrs)) {
    if (localName(key) === name) return el.attrs[key]
  }
  return undefined
}

const numAttr = (el: XmlEl, name: string): number | undefined => {
  const raw = attrOf(el, name)
  if (raw === undefined) return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

const onOff = (el: XmlEl | undefined): boolean | undefined => {
  if (!el) return undefined
  const raw = attrOf(el, 'val')
  if (raw === undefined) return true
  return raw === 'true' || raw === 'on' || raw === '1'
}

const textOf = (el: XmlEl): string => {
  let out = ''
  const walk = (node: XmlEl) => {
    if (node.name === '#text') {
      out += node.attrs['#text'] ?? ''
      return
    }
    for (const child of node.children) walk(child)
  }
  walk(el)
  return out
}

// ---------------------------------------------------------------------------
// Format structures + merge semantics (direct overrides style overrides default)
// ---------------------------------------------------------------------------
type Indent = {
  left?: number
  right?: number
  firstLine?: number
  hanging?: number
}

type Border = { val: string; sz?: number; color?: string }

type ParaFmt = {
  styleId?: string
  jc?: string
  before?: number
  after?: number
  line?: number
  lineRule?: string
  ind?: Indent
  shd?: string
  borders?: Record<string, Border>
  keepNext?: boolean
  pageBreakBefore?: boolean
  numId?: number
  ilvl?: number
  tabs?: number[]
}

type RunFmt = {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  color?: string
  size?: number // half-points
}

const mergeIndent = (base: Indent | undefined, over: Indent | undefined): Indent | undefined => {
  if (!base && !over) return undefined
  return { ...(base ?? {}), ...(over ?? {}) }
}

const mergePara = (base: ParaFmt, over: ParaFmt): ParaFmt => ({
  ...base,
  ...over,
  ind: mergeIndent(base.ind, over.ind),
  borders: over.borders ?? base.borders,
  tabs: over.tabs ?? base.tabs,
})

const mergeRun = (base: RunFmt, over: RunFmt): RunFmt => ({ ...base, ...over })

const parseIndent = (ppr: XmlEl): Indent | undefined => {
  const ind = kidOf(ppr, 'ind')
  if (!ind) return undefined
  const out: Indent = {}
  const left = numAttr(ind, 'left')
  const right = numAttr(ind, 'right')
  const firstLine = numAttr(ind, 'firstLine')
  const hanging = numAttr(ind, 'hanging')
  if (left !== undefined) out.left = left
  if (right !== undefined) out.right = right
  if (firstLine !== undefined) out.firstLine = firstLine
  if (hanging !== undefined) out.hanging = hanging
  return out
}

const parseBorders = (ppr: XmlEl): Record<string, Border> | undefined => {
  const container = kidOf(ppr, 'pBdr')
  if (!container) return undefined
  const out: Record<string, Border> = {}
  for (const side of ['top', 'left', 'bottom', 'right']) {
    const el = kidOf(container, side)
    if (!el) continue
    out[side] = {
      val: attrOf(el, 'val') ?? 'single',
      sz: numAttr(el, 'sz'),
      color: attrOf(el, 'color'),
    }
  }
  return Object.keys(out).length ? out : undefined
}

const parseParaFmt = (ppr: XmlEl | undefined): ParaFmt => {
  const out: ParaFmt = {}
  if (!ppr) return out

  const style = kidOf(ppr, 'pStyle')
  if (style) out.styleId = attrOf(style, 'val')

  const jc = kidOf(ppr, 'jc')
  if (jc) out.jc = attrOf(jc, 'val')

  const spacing = kidOf(ppr, 'spacing')
  if (spacing) {
    const before = numAttr(spacing, 'before')
    const after = numAttr(spacing, 'after')
    const line = numAttr(spacing, 'line')
    const lineRule = attrOf(spacing, 'lineRule')
    if (before !== undefined) out.before = before
    if (after !== undefined) out.after = after
    if (line !== undefined) out.line = line
    if (lineRule !== undefined) out.lineRule = lineRule
  }

  const ind = parseIndent(ppr)
  if (ind) out.ind = ind

  const shd = kidOf(ppr, 'shd')
  if (shd && (attrOf(shd, 'val') ?? 'clear') !== 'nil') {
    const fill = attrOf(shd, 'fill')
    if (fill && fill !== 'auto') out.shd = fill
  }

  const borders = parseBorders(ppr)
  if (borders) out.borders = borders

  const keepNext = onOff(kidOf(ppr, 'keepNext'))
  if (keepNext !== undefined) out.keepNext = keepNext

  const pageBreak = onOff(kidOf(ppr, 'pageBreakBefore'))
  if (pageBreak !== undefined) out.pageBreakBefore = pageBreak

  const numPr = kidOf(ppr, 'numPr')
  if (numPr) {
    const numId = kidOf(numPr, 'numId')
    const ilvl = kidOf(numPr, 'ilvl')
    if (numId) out.numId = numAttr(numId, 'val')
    if (ilvl) out.ilvl = numAttr(ilvl, 'val')
  }

  const tabsEl = kidOf(ppr, 'tabs')
  if (tabsEl) {
    const stops: number[] = []
    for (const tab of kidsOf(tabsEl, 'tab')) {
      if ((attrOf(tab, 'val') ?? 'left') !== 'left') continue
      const pos = numAttr(tab, 'pos')
      if (pos !== undefined) stops.push(pos)
    }
    if (stops.length) out.tabs = stops.sort((a, b) => a - b)
  }

  return out
}

const parseRunFmt = (rpr: XmlEl | undefined): RunFmt => {
  const out: RunFmt = {}
  if (!rpr) return out
  const bold = onOff(kidOf(rpr, 'b'))
  if (bold !== undefined) out.bold = bold
  const italic = onOff(kidOf(rpr, 'i'))
  if (italic !== undefined) out.italic = italic
  const underline = kidOf(rpr, 'u')
  if (underline) {
    const val = attrOf(underline, 'val')
    out.underline = val === undefined || (val !== 'none' && val !== '0' && val !== 'false')
  }
  const color = kidOf(rpr, 'color')
  if (color) {
    const val = attrOf(color, 'val')
    if (val && val !== 'auto') out.color = val
  }
  const size = kidOf(rpr, 'sz')
  if (size) {
    const val = numAttr(size, 'val')
    if (val !== undefined) out.size = val
  }
  return out
}

// ---------------------------------------------------------------------------
// Styles + numbering
// ---------------------------------------------------------------------------
type DocStyle = {
  id: string
  basedOn?: string
  pPr?: ParaFmt
  rPr?: RunFmt
}

type NumberLevel = {
  start: number
  numFmt: string
  lvlText: string
  ind?: Indent
}

type DocContext = {
  docPP: ParaFmt
  docRP: RunFmt
  styles: Map<string, DocStyle>
  stylePPCache: Map<string, ParaFmt>
  styleRPCache: Map<string, RunFmt>
  abstracts: Map<number, NumberLevel[]>
  nums: Map<number, number>
  numberingCounters: Map<number, number[]>
  images: Map<string, string> // rId -> data URI
  body: XmlEl
}

const resolveStylePP = (ctx: DocContext, styleId: string | undefined): ParaFmt => {
  if (!styleId) return {}
  const cached = ctx.stylePPCache.get(styleId)
  if (cached) return cached
  const style = ctx.styles.get(styleId)
  let result: ParaFmt = {}
  if (style) {
    result = mergePara(resolveStylePP(ctx, style.basedOn), style.pPr ?? {})
  }
  ctx.stylePPCache.set(styleId, result)
  return result
}

const resolveStyleRP = (ctx: DocContext, styleId: string | undefined): RunFmt => {
  if (!styleId) return {}
  const cached = ctx.styleRPCache.get(styleId)
  if (cached) return cached
  const style = ctx.styles.get(styleId)
  let result: RunFmt = {}
  if (style) {
    result = mergeRun(resolveStyleRP(ctx, style.basedOn), style.rPr ?? {})
  }
  ctx.styleRPCache.set(styleId, result)
  return result
}

// ---------------------------------------------------------------------------
// HTML escaping / CSS helpers
// ---------------------------------------------------------------------------
const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const hexColor = (value: string | undefined, fallback?: string): string | undefined => {
  if (!value) return fallback
  const raw = value.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toUpperCase()}`
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw
      .split('')
      .map((ch) => ch + ch)
      .join('')
      .toUpperCase()}`
  }
  return fallback
}

const pt = (twips: number) => {
  const value = twips * TW
  return `${Math.round(value * 1000) / 1000}pt`
}

const emuPt = (emu: number) => {
  const value = emu / 12700
  return `${Math.round(value * 1000) / 1000}pt`
}

const borderCss = (border: Border | undefined): string | undefined => {
  if (!border) return undefined
  if (border.val === 'none' || border.val === 'nil') return 'none'
  if (border.val === 'dashed') {
    const width = border.sz ? `${border.sz / 8}pt` : '0.5pt'
    return `${width} dashed ${hexColor(border.color, '#000000')}`
  }
  if (border.val === 'dotted') {
    const width = border.sz ? `${border.sz / 8}pt` : '0.5pt'
    return `${width} dotted ${hexColor(border.color, '#000000')}`
  }
  const width = border.sz ? `${border.sz / 8}pt` : '0.5pt'
  return `${width} solid ${hexColor(border.color, '#000000')}`
}

const jcCss = (jc: string | undefined): string => {
  switch (jc) {
    case 'center':
      return 'center'
    case 'right':
      return 'right'
    case 'both':
    case 'distribute':
      return 'justify'
    default:
      return 'left'
  }
}

// ---------------------------------------------------------------------------
// Numbering markers (computed server side, emitted as data-marker)
// ---------------------------------------------------------------------------
const formatMarker = (numFmt: string, lvlText: string, counters: number[]): string => {
  return lvlText.replace(/%(\d+)/g, (_match, digit: string) => {
    const level = Number(digit) - 1
    const value = counters[level] ?? 1
    if (numFmt === 'lowerLetter') {
      return String.fromCharCode(96 + (((value - 1) % 26) + 1))
    }
    if (numFmt === 'upperLetter') {
      return String.fromCharCode(64 + (((value - 1) % 26) + 1))
    }
    if (numFmt === 'lowerRoman') {
      return toRoman(value).toLowerCase()
    }
    if (numFmt === 'upperRoman') {
      return toRoman(value)
    }
    return String(value)
  })
}

const toRoman = (value: number): string => {
  const table: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let rest = Math.max(1, Math.floor(value))
  let out = ''
  for (const [amount, token] of table) {
    while (rest >= amount) {
      out += token
      rest -= amount
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Run / paragraph rendering
// ---------------------------------------------------------------------------
const runCss = (fmt: RunFmt, baseSizePt: number): string => {
  const parts: string[] = []
  if (fmt.bold) parts.push('font-weight:700')
  if (fmt.italic) parts.push('font-style:italic')
  if (fmt.underline) parts.push('text-decoration:underline')
  const color = hexColor(fmt.color)
  if (color) parts.push(`color:${color}`)
  if (fmt.size !== undefined) parts.push(`font-size:${fmt.size / 2}pt`)
  else if (baseSizePt !== 10) parts.push(`font-size:${baseSizePt}pt`)
  return parts.join(';')
}

const renderRunText = (raw: string): string => {
  let out = ''
  for (const ch of raw) {
    if (ch === '\t') out += '<span class="tab"></span>'
    else if (ch === '\n') out += '<br />'
    else out += escapeHtml(ch)
  }
  return out
}

type ParagraphParts = {
  html: string
  maxFontPt: number
}

const renderRuns = (
  ctx: DocContext,
  p: XmlEl,
  baseFmt: RunFmt,
  baseSizePt: number,
): ParagraphParts => {
  const baseCss = runCss(baseFmt, baseSizePt)
  let html = ''
  let maxFontPt = baseSizePt

  const emitRun = (run: XmlEl) => {
    const fmt = mergeRun(baseFmt, parseRunFmt(kidOf(run, 'rPr')))
    if (fmt.size !== undefined) maxFontPt = Math.max(maxFontPt, fmt.size / 2)
    const css = runCss(fmt, baseSizePt)
    let buffer = ''
    for (const child of run.children) {
      const name = localName(child.name)
      if (name === 't') buffer += renderRunText(textOf(child))
      else if (name === 'tab') buffer += '<span class="tab"></span>'
      else if (name === 'br') buffer += '<br />'
      else if (name === 'noBreakHyphen') buffer += '‐'
      else if (name === 'softHyphen') buffer += '­'
    }
    if (!buffer) return
    if (css === baseCss) html += buffer
    else html += `<span style="${css}">${buffer}</span>`
  }

  const walk = (node: XmlEl) => {
    for (const child of node.children) {
      const name = localName(child.name)
      if (name === 'r') emitRun(child)
      else if (
        name === 'hyperlink' ||
        name === 'ins' ||
        name === 'smartTag' ||
        name === 'sdt' ||
        name === 'sdtContent'
      ) {
        walk(child)
      }
    }
  }

  walk(p)
  return { html, maxFontPt }
}

const paragraphLineHeightPt = (fmt: ParaFmt, maxFontPt: number): number => {
  const line = fmt.line ?? 276
  const rule = fmt.lineRule ?? 'auto'
  if (rule === 'exact' || rule === 'atLeast') return line * TW
  // rule === 'auto': multiple of the font's natural single spacing
  return Math.round((line / 240) * NATURAL_LINE_FACTOR * maxFontPt * 1000) / 1000
}

const renderParagraph = (
  ctx: DocContext,
  p: XmlEl,
  options: { inTable?: boolean } = {},
): string => {
  const direct = parseParaFmt(kidOf(p, 'pPr'))
  const styleId = direct.styleId
  const stylePP = resolveStylePP(ctx, styleId)
  const styleRP = resolveStyleRP(ctx, styleId)

  // Precedence: direct > numbering level > style > document default.
  let marker: string | null = null
  let markerHanging: number | null = null
  let levelInd: Indent | undefined
  if (direct.numId !== undefined) {
    const levels = ctx.abstracts.get(ctx.nums.get(direct.numId) ?? -1)
    const level = levels?.[direct.ilvl ?? 0]
    if (level) {
      const counters = ctx.numberingCounters.get(direct.numId) ?? []
      const ilvl = direct.ilvl ?? 0
      counters.length = Math.max(counters.length, ilvl + 1)
      counters[ilvl] = (counters[ilvl] ?? 0) + 1
      for (let deeper = ilvl + 1; deeper < counters.length; deeper++) counters[deeper] = 0
      ctx.numberingCounters.set(direct.numId, counters)
      marker = formatMarker(level.numFmt, level.lvlText, counters)
      markerHanging = level.ind?.hanging ?? null
      levelInd = level.ind
    }
  }

  const fmt = mergePara(
    mergePara(mergePara(ctx.docPP, stylePP), levelInd ? { ind: levelInd } : {}),
    direct,
  )

  const baseFmt = mergeRun(ctx.docRP, styleRP)
  const baseSizePt = (baseFmt.size ?? 20) / 2
  const runs = renderRuns(ctx, p, baseFmt, baseSizePt)
  const lineHeight = paragraphLineHeightPt(fmt, runs.maxFontPt)

  const styles: string[] = []
  styles.push(`font-size:${baseSizePt}pt`)
  const baseColor = hexColor(baseFmt.color)
  if (baseColor) styles.push(`color:${baseColor}`)
  if (baseFmt.bold) styles.push('font-weight:700')
  if (baseFmt.italic) styles.push('font-style:italic')
  styles.push(`text-align:${jcCss(fmt.jc)}`)
  styles.push(`line-height:${lineHeight}pt`)
  styles.push(`margin-top:${fmt.before ? pt(fmt.before) : '0pt'}`)
  styles.push(`margin-bottom:${fmt.after ? pt(fmt.after) : '0pt'}`)

  const ind = fmt.ind
  if (ind) {
    if (ind.left !== undefined) styles.push(`margin-left:${pt(ind.left)}`)
    if (ind.right !== undefined) styles.push(`margin-right:${pt(ind.right)}`)
    if (marker !== null && markerHanging !== null) {
      styles.push(`text-indent:${pt(-markerHanging)}`)
    } else if (ind.hanging !== undefined) {
      styles.push(`text-indent:${pt(-ind.hanging)}`)
    } else if (ind.firstLine !== undefined) {
      styles.push(`text-indent:${pt(ind.firstLine)}`)
    }
  }

  if (fmt.shd) styles.push(`background-color:#${fmt.shd.toUpperCase()}`)

  if (fmt.borders) {
    for (const side of ['top', 'left', 'bottom', 'right']) {
      const border = fmt.borders[side]
      if (!border) continue
      const css = borderCss(border)
      if (!css) continue
      styles.push(`border-${side}:${css}`)
    }
  }

  if (marker !== null && markerHanging !== null) styles.push(`--marker-w:${markerHanging * TW}pt`)

  const attrs: string[] = []
  const classes: string[] = []
  if (marker !== null) classes.push('np')
  if (classes.length) attrs.push(`class="${classes.join(' ')}"`)
  attrs.push(`style="${styles.join(';')}"`)
  if (fmt.keepNext) attrs.push('data-keep="1"')
  if (fmt.pageBreakBefore) attrs.push('data-break="page"')
  if (fmt.tabs?.length) attrs.push(`data-stops="${fmt.tabs.map((stop) => stop * TW).join(',')}"`)
  if (marker !== null) attrs.push(`data-marker="${escapeHtml(marker)}"`)

  const inner = runs.html || '&nbsp;'
  const tag =
    styleId === 'Heading1' ? 'h1' : styleId === 'Heading2' ? 'h2' : options.inTable ? 'p' : 'p'
  return `<${tag} ${attrs.join(' ')}>${inner}</${tag}>`
}

// ---------------------------------------------------------------------------
// Table rendering
// ---------------------------------------------------------------------------
type CellEdgeCtx = {
  tableBorders: Record<string, Border>
  isFirstRow: boolean
  isLastRow: boolean
  isFirstCol: boolean
  isLastCol: boolean
}

const cellBorderCss = (
  tcBorders: Record<string, Border> | undefined,
  ctx: CellEdgeCtx,
): string[] => {
  const resolve = (side: 'top' | 'left' | 'bottom' | 'right'): Border | undefined => {
    const own = tcBorders?.[side]
    if (own) return own
    if (side === 'top') return ctx.isFirstRow ? ctx.tableBorders.top : ctx.tableBorders.insideH
    if (side === 'bottom') return ctx.isLastRow ? ctx.tableBorders.bottom : ctx.tableBorders.insideH
    if (side === 'left') return ctx.isFirstCol ? ctx.tableBorders.left : ctx.tableBorders.insideV
    return ctx.isLastCol ? ctx.tableBorders.right : ctx.tableBorders.insideV
  }
  const out: string[] = []
  for (const side of ['top', 'left', 'bottom', 'right'] as const) {
    const css = borderCss(resolve(side))
    if (!css) continue
    out.push(`border-${side}:${css}`)
  }
  return out
}

const parseTableBorders = (tblPr: XmlEl | undefined): Record<string, Border> => {
  const out: Record<string, Border> = {}
  if (!tblPr) return out
  const container = kidOf(tblPr, 'tblBorders')
  if (!container) return out
  for (const side of ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']) {
    const el = kidOf(container, side)
    if (!el) continue
    out[side] = {
      val: attrOf(el, 'val') ?? 'single',
      sz: numAttr(el, 'sz'),
      color: attrOf(el, 'color'),
    }
  }
  return out
}

const parseCellBorders = (tcPr: XmlEl | undefined): Record<string, Border> | undefined => {
  if (!tcPr) return undefined
  const container = kidOf(tcPr, 'tcBorders')
  if (!container) return undefined
  const out: Record<string, Border> = {}
  for (const side of ['top', 'left', 'bottom', 'right']) {
    const el = kidOf(container, side)
    if (!el) continue
    out[side] = {
      val: attrOf(el, 'val') ?? 'single',
      sz: numAttr(el, 'sz'),
      color: attrOf(el, 'color'),
    }
  }
  return Object.keys(out).length ? out : undefined
}

const defaultCellMargin = { top: 0, right: 115, bottom: 0, left: 115 }

const parseCellMargin = (tcPr: XmlEl | undefined): typeof defaultCellMargin => {
  const out = { ...defaultCellMargin }
  if (!tcPr) return out
  const tcMar = kidOf(tcPr, 'tcMar')
  if (!tcMar) return out
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    const el = kidOf(tcMar, side)
    if (!el) continue
    const value = numAttr(el, 'w')
    if (value !== undefined) out[side] = value
  }
  return out
}

const renderTableCell = (
  ctx: DocContext,
  tc: XmlEl,
  edge: CellEdgeCtx,
  isFirstCol: boolean,
  isLastCol: boolean,
): string => {
  const tcPr = kidOf(tc, 'tcPr')
  const span = tcPr ? (numAttr(kidOf(tcPr, 'gridSpan') ?? { attrs: {} }, 'val') ?? 1) : 1
  const styles: string[] = []

  const tcBorders = parseCellBorders(tcPr)
  styles.push(...cellBorderCss(tcBorders, { ...edge, isFirstCol, isLastCol }))

  const shd = tcPr ? kidOf(tcPr, 'shd') : undefined
  if (shd && (attrOf(shd, 'val') ?? 'clear') !== 'nil') {
    const fill = attrOf(shd, 'fill')
    if (fill && fill !== 'auto') styles.push(`background-color:#${fill.toUpperCase()}`)
  }

  const margin = parseCellMargin(tcPr)
  styles.push(
    `padding:${margin.top * TW}pt ${margin.right * TW}pt ${margin.bottom * TW}pt ${margin.left * TW}pt`,
  )

  const vAlign = tcPr ? attrOf(kidOf(tcPr, 'vAlign') ?? { attrs: {} }, 'val') : undefined
  styles.push(
    `vertical-align:${vAlign === 'center' ? 'center' : vAlign === 'bottom' ? 'bottom' : 'top'}`,
  )

  const attrs: string[] = []
  attrs.push(`style="${styles.join(';')}"`)
  if (span > 1) attrs.push(`colspan="${span}"`)

  const content = tc.children
    .filter((child) => localName(child.name) === 'p')
    .map((p) => renderParagraph(ctx, p, { inTable: true }))
    .join('')

  return `<td ${attrs.join(' ')}>${content || '<p style="margin:0">&nbsp;</p>'}</td>`
}

const renderTable = (ctx: DocContext, tbl: XmlEl): string => {
  const tblPr = kidOf(tbl, 'tblPr')
  const tableBorders = parseTableBorders(tblPr)

  const styles: string[] = ['border-collapse:collapse', 'table-layout:fixed']

  const tblW = tblPr ? kidOf(tblPr, 'tblW') : undefined
  const widthTwips = tblW && attrOf(tblW, 'type') !== 'pct' ? numAttr(tblW, 'w') : undefined

  const grid = kidOf(tbl, 'tblGrid')
  const cols = grid ? kidsOf(grid, 'gridCol') : []
  const gridTwips = cols.map((col) => numAttr(col, 'w') ?? 0)
  const totalGrid = gridTwips.reduce((sum, value) => sum + value, 0)

  const tableWidth = widthTwips ?? totalGrid
  styles.push(`width:${pt(tableWidth)}`)

  const tblInd = tblPr ? kidOf(tblPr, 'tblInd') : undefined
  const indent = tblInd ? numAttr(tblInd, 'w') : undefined
  if (indent) styles.push(`margin-left:${pt(indent)}`)

  const jc = tblPr ? attrOf(kidOf(tblPr, 'jc') ?? { attrs: {} }, 'val') : undefined
  if (jc === 'right') styles.push('margin-left:auto')
  else if (jc === 'center') styles.push('margin-left:auto;margin-right:auto')

  const colgroup = gridTwips.length
    ? `<colgroup>${gridTwips.map((width) => `<col style="width:${pt(width)}" />`).join('')}</colgroup>`
    : ''

  const rows = tbl.children.filter((child) => localName(child.name) === 'tr')
  const rowCount = rows.length

  const renderedRows = rows
    .map((tr, rowIndex) => {
      const trPr = kidOf(tr, 'trPr')
      const isHeader = trPr ? onOff(kidOf(trPr, 'tblHeader')) === true : false
      const rowStyles: string[] = []
      const trHeight = trPr ? kidOf(trPr, 'trHeight') : undefined
      if (trHeight) {
        const value = numAttr(trHeight, 'val')
        if (value !== undefined) rowStyles.push(`height:${pt(value)}`)
      }
      const rowAttrs: string[] = []
      if (rowStyles.length) rowAttrs.push(`style="${rowStyles.join(';')}"`)
      if (isHeader) rowAttrs.push('data-hdr="1"')

      const cells = tr.children.filter((child) => localName(child.name) === 'tc')
      const cellHtml = cells
        .map((tc, cellIndex) =>
          renderTableCell(
            ctx,
            tc,
            {
              tableBorders,
              isFirstRow: rowIndex === 0,
              isLastRow: rowIndex === rowCount - 1,
              isFirstCol: cellIndex === 0,
              isLastCol: cellIndex === cells.length - 1,
            },
            cellIndex === 0,
            cellIndex === cells.length - 1,
          ),
        )
        .join('')

      return rowAttrs.length ? `<tr ${rowAttrs.join(' ')}>${cellHtml}</tr>` : `<tr>${cellHtml}</tr>`
    })
    .join('')

  return `<table style="${styles.join(';')}">${colgroup}<tbody>${renderedRows}</tbody></table>`
}

// ---------------------------------------------------------------------------
// Header / footer / watermark
// ---------------------------------------------------------------------------
type PartRels = Map<string, string>

const parseRels = (xml: string): PartRels => {
  const out: PartRels = new Map()
  const root = parseXml(xml)
  const walk = (node: XmlEl) => {
    if (localName(node.name) === 'Relationship') {
      const id = attrOf(node, 'Id')
      const target = attrOf(node, 'Target')
      if (id && target) out.set(id, target)
    }
    for (const child of node.children) walk(child)
  }
  walk(root)
  return out
}

type PartRender = {
  blocks: string
  watermark: string | null
}

const renderHeaderFooterPart = async (
  ctx: DocContext,
  zip: JSZip,
  xmlPath: string,
  relsPath: string,
  kind: 'header' | 'footer',
): Promise<PartRender> => {
  const file = await zip.file(xmlPath)
  if (!file) return { blocks: '', watermark: null }
  const xml = await file.async('string')
  const root = parseXml(xml)
  const partEl = findDescendant(root, kind === 'header' ? 'hdr' : 'ftr') ?? root

  let rels: PartRels = new Map()
  const relsFile = await zip.file(relsPath)
  if (relsFile) rels = parseRels(await relsFile.async('string'))

  const mediaCache = new Map<string, string>()
  const resolveImage = async (rId: string): Promise<string | null> => {
    const target = rels.get(rId)
    if (!target) return null
    const path = `word/${target.replace(/^\.\//, '')}`
    const cached = mediaCache.get(path)
    if (cached) return cached
    const mediaFile = await zip.file(path)
    if (!mediaFile) return null
    const base64 = await mediaFile.async('base64')
    const lower = path.toLowerCase()
    const mime = lower.endsWith('.png')
      ? 'image/png'
      : lower.endsWith('.jpg') || lower.endsWith('.jpeg')
        ? 'image/jpeg'
        : 'image/png'
    const uri = `data:${mime};base64,${base64}`
    mediaCache.set(path, uri)
    return uri
  }

  const blocks: string[] = []
  for (const node of partEl.children) {
    if (localName(node.name) === 'tbl') {
      blocks.push(renderTable(ctx, node))
      continue
    }
    if (localName(node.name) !== 'p') continue

    let rendered = false
    for (const run of node.children.filter((child) => localName(child.name) === 'r')) {
      const drawing = kidOf(run, 'drawing')
      if (!drawing) continue
      const inline = kidOf(drawing, 'inline')
      if (!inline) continue // anchored image = watermark, handled below
      const extent = kidOf(inline, 'extent')
      const blip = findDescendant(inline, 'blip')
      const embed = blip ? attrOf(blip, 'embed') : undefined
      if (!extent || !embed) continue
      const cx = numAttr(extent, 'cx')
      const cy = numAttr(extent, 'cy')
      const src = await resolveImage(embed)
      if (!src || cx === undefined || cy === undefined) continue
      rendered = true
      const direct = parseParaFmt(kidOf(node, 'pPr'))
      const style: string[] = [`line-height:${paragraphLineHeightPt(direct, 10)}pt`, 'margin:0']
      if (direct.ind?.left !== undefined) style.push(`margin-left:${pt(direct.ind.left)}`)
      blocks.push(
        `<p style="${style.join(';')}"><img src="${src}" alt="" style="display:block;width:${emuPt(cx)};height:${emuPt(cy)}" /></p>`,
      )
    }
    if (rendered) continue
    if (findDescendant(node, 'anchor')) continue

    blocks.push(renderParagraph(ctx, node))
  }

  const watermark = kind === 'header' ? await renderWatermark(root, resolveImage) : null
  return { blocks: blocks.join(''), watermark }
}

const findDescendant = (el: XmlEl, name: string): XmlEl | null => {
  for (const child of el.children) {
    if (localName(child.name) === name) return child
    const nested = findDescendant(child, name)
    if (nested) return nested
  }
  return null
}

const renderWatermark = async (
  root: XmlEl,
  resolveImage: (rId: string) => Promise<string | null>,
): Promise<string | null> => {
  const anchor = findDescendant(root, 'anchor')
  if (!anchor) return null
  const extent = kidOf(anchor, 'extent')
  const blip = findDescendant(anchor, 'blip')
  const embed = blip ? attrOf(blip, 'embed') : undefined
  if (!extent || !embed) return null
  const cx = numAttr(extent, 'cx')
  const cy = numAttr(extent, 'cy')
  const src = await resolveImage(embed)
  if (!src || cx === undefined || cy === undefined) return null
  return `<img src="${src}" alt="" style="width:${emuPt(cx)};height:${emuPt(cy)}" />`
}

// ---------------------------------------------------------------------------
// Body assembly
// ---------------------------------------------------------------------------
const renderBody = (ctx: DocContext): string => {
  const blocks: string[] = []
  for (const node of ctx.body.children) {
    const name = localName(node.name)
    if (name === 'p') blocks.push(renderParagraph(ctx, node))
    else if (name === 'tbl') blocks.push(renderTable(ctx, node))
    else if (name === 'sdt') {
      const content = findDescendant(node, 'sdtContent')
      if (content) {
        for (const inner of content.children) {
          const innerName = localName(inner.name)
          if (innerName === 'p') blocks.push(renderParagraph(ctx, inner))
          else if (innerName === 'tbl') blocks.push(renderTable(ctx, inner))
        }
      }
    }
  }
  return blocks.join('\n')
}

// ---------------------------------------------------------------------------
// Styles / numbering / document parsing
// ---------------------------------------------------------------------------
const parseStyles = (xml: string) => {
  const root = parseXml(xml)
  const stylesEl = findDescendant(root, 'styles') ?? root
  const styles = new Map<string, DocStyle>()
  let docPP: ParaFmt = {}
  let docRP: RunFmt = {}

  const docDefaults = kidOf(stylesEl, 'docDefaults')
  if (docDefaults) {
    const rPrDefault = kidOf(docDefaults, 'rPrDefault')
    const pPrDefault = kidOf(docDefaults, 'pPrDefault')
    if (rPrDefault) docRP = parseRunFmt(kidOf(rPrDefault, 'rPr'))
    if (pPrDefault) docPP = parseParaFmt(kidOf(pPrDefault, 'pPr'))
  }

  for (const style of kidsOf(stylesEl, 'style')) {
    const id = attrOf(style, 'styleId')
    if (!id) continue
    const basedOn = kidOf(style, 'basedOn')
    styles.set(id, {
      id,
      basedOn: basedOn ? attrOf(basedOn, 'val') : undefined,
      pPr: parseParaFmt(kidOf(style, 'pPr')),
      rPr: parseRunFmt(kidOf(style, 'rPr')),
    })
  }

  return { styles, docPP, docRP }
}

const parseNumbering = (xml: string) => {
  const root = parseXml(xml)
  const numberingEl = findDescendant(root, 'numbering') ?? root
  const abstracts = new Map<number, NumberLevel[]>()
  const nums = new Map<number, number>()

  for (const abstractNum of kidsOf(numberingEl, 'abstractNum')) {
    const id = numAttr(abstractNum, 'abstractNumId')
    if (id === undefined) continue
    const levels: NumberLevel[] = []
    for (const lvl of kidsOf(abstractNum, 'lvl')) {
      const ilvl = numAttr(lvl, 'ilvl') ?? levels.length
      const start = kidOf(lvl, 'start')
      const numFmt = kidOf(lvl, 'numFmt')
      const lvlText = kidOf(lvl, 'lvlText')
      const pPr = kidOf(lvl, 'pPr')
      levels[ilvl] = {
        start: start ? (numAttr(start, 'val') ?? 1) : 1,
        numFmt: numFmt ? (attrOf(numFmt, 'val') ?? 'decimal') : 'decimal',
        lvlText: lvlText ? (attrOf(lvlText, 'val') ?? '%1.') : '%1.',
        ind: pPr ? parseIndent(pPr) : undefined,
      }
    }
    abstracts.set(id, levels)
  }

  for (const num of kidsOf(numberingEl, 'num')) {
    const id = numAttr(num, 'numId')
    const abs = kidOf(num, 'abstractNumId')
    if (id === undefined || !abs) continue
    nums.set(id, numAttr(abs, 'val') ?? -1)
  }

  return { abstracts, nums }
}

// ---------------------------------------------------------------------------
// Client-side pagination script (runs inside the preview iframe)
// ---------------------------------------------------------------------------
const PAGINATION_SCRIPT = String.raw`
(function () {
  var CONTENT_H_PT = 666.9;
  var PT2PX = 96 / 72;
  var LIMIT = CONTENT_H_PT * PT2PX;
  var TOLERANCE = 0.5;

  var viewer = document.getElementById('viewer');
  var loading = document.getElementById('loading');
  var docRoot = document.getElementById('doc');
  var flow = document.getElementById('flow');
  var shell = document.getElementById('page-shell');

  function finishWithPages(pages) {
    pages.forEach(function (group) {
      var page = shell.content.firstElementChild.cloneNode(true);
      var body = page.querySelector('.a4-body');
      group.forEach(function (el) { body.appendChild(el); });
      viewer.appendChild(page);
    });
    if (flow.parentNode) flow.parentNode.removeChild(flow);
    if (shell.parentNode) shell.parentNode.removeChild(shell);
    if (loading && loading.parentNode) loading.parentNode.removeChild(loading);
    if (docRoot.parentNode) docRoot.parentNode.removeChild(docRoot);
  }

  function fallback(err) {
    if (window.console && console.error) console.error('pagination failed', err);
    flow.style.visibility = 'visible';
    flow.style.background = '#fff';
    flow.style.padding = '100pt 56.7pt 75pt 56.7pt';
    flow.style.width = '595.3pt';
    flow.style.margin = '0 auto';
    docRoot.style.visibility = 'visible';
    if (loading && loading.parentNode) loading.parentNode.removeChild(loading);
    if (shell && shell.parentNode) shell.parentNode.removeChild(shell);
  }

  function rectHeight(el) {
    return el.getBoundingClientRect().height;
  }

  function margins(el) {
    var cs = window.getComputedStyle(el);
    return {
      t: parseFloat(cs.marginTop) || 0,
      b: parseFloat(cs.marginBottom) || 0
    };
  }

  function heightOf(el) {
    var m = margins(el);
    return rectHeight(el) + m.t + m.b;
  }

  function tabStops(p) {
    var out = [];
    var raw = p.getAttribute('data-stops');
    var custom = raw ? raw.split(',').filter(Boolean).map(Number) : [];
    var max = 0;
    custom.forEach(function (v) { out.push(v); if (v > max) max = v; });
    var step = 36;
    var stop = step;
    while (stop <= max) stop += step;
    for (; stop <= 3000; stop += step) out.push(stop);
    out.sort(function (a, b) { return a - b; });
    return out;
  }

  function fixTabs() {
    var nodes = flow.querySelectorAll('.tab');
    var seen = [];
    Array.prototype.forEach.call(nodes, function (tab) {
      var p = tab.closest('p, h1, h2, td, th');
      if (!p || seen.indexOf(p) >= 0) return;
      seen.push(p);
      var stops = tabStops(p);
      var cell = p.closest('td, th');
      var refLeft = (cell || flow).getBoundingClientRect().left;
      var tabs = p.querySelectorAll('.tab');
      Array.prototype.forEach.call(tabs, function (t) {
        var r = t.getBoundingClientRect();
        var xPt = (r.left - refLeft) * 0.75 + 0.01;
        var next = 0;
        for (var i = 0; i < stops.length; i++) {
          if (stops[i] > xPt) { next = stops[i]; break; }
        }
        if (!next) next = Math.ceil(xPt / 36) * 36;
        t.style.width = Math.max(0, next - xPt) + 'pt';
      });
    });
  }

  function lineRects(el) {
    var groups = [];
    var byTop = {};
    function add(r) {
      if (r.height <= 0.01 && r.width <= 0.01) return;
      var key = Math.round(r.top * 2) / 2;
      if (!byTop[key]) {
        byTop[key] = { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
        groups.push(byTop[key]);
      } else {
        var g = byTop[key];
        if (r.bottom > g.bottom) g.bottom = r.bottom;
        if (r.left < g.left) g.left = r.left;
        if (r.right > g.right) g.right = r.right;
      }
    }
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue) continue;
      var range = document.createRange();
      range.selectNodeContents(node);
      var rects = range.getClientRects();
      for (var i = 0; i < rects.length; i++) add(rects[i]);
    }
    groups.sort(function (a, b) { return a.top - b.top; });
    return groups;
  }

  function pointAt(el, index) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var node;
    var acc = 0;
    var last = null;
    while ((node = walker.nextNode())) {
      var len = node.nodeValue.length;
      last = node;
      if (acc + len >= index) return { node: node, offset: index - acc };
      acc += len;
    }
    if (last) return { node: last, offset: last.nodeValue.length };
    return { node: el, offset: el.childNodes.length };
  }

  function offsetAtLineEnd(el, lines, lineCount) {
    var targetBottom = lines[lineCount - 1].bottom;
    var total = el.textContent.length;
    var lo = 1;
    var hi = total;
    var best = 1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      var start = pointAt(el, 0);
      var end = pointAt(el, mid);
      var range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      var rects = range.getClientRects();
      var lastRect = rects.length ? rects[rects.length - 1] : null;
      if (lastRect && lastRect.bottom <= targetBottom + 0.75) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best;
  }

  // Returns: {tail: Element} | 'newpage' | null (fits entirely)
  function splitByLines(el, maxH) {
    var lines = lineRects(el);
    if (!lines.length) return null;
    var elTop = el.getBoundingClientRect().top;
    var fit = 0;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].bottom - elTop <= maxH + TOLERANCE) fit = i + 1;
    }
    if (fit >= lines.length) return null;
    if (fit < 1) return 'newpage';
    if (fit < 2 && lines.length > 3) return 'newpage';
    var total = lines.length;
    if (total - fit < 2 && fit > 2) fit = total - 2;
    if (fit < 1) return 'newpage';

    var offset = offsetAtLineEnd(el, lines, fit);
    if (offset <= 0) return 'newpage';
    if (offset >= el.textContent.length) return null;

    var startPoint = pointAt(el, offset);
    var endPoint = pointAt(el, el.textContent.length);
    var range = document.createRange();
    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset);
    var fragment = range.extractContents();
    var tail = el.cloneNode(false);
    tail.appendChild(fragment);
    if (el.parentNode) el.parentNode.insertBefore(tail, el.nextSibling);
    return { tail: tail };
  }

  var pages = [];
  var current = [];
  var used = 0;

  function newPage() {
    if (current.length) pages.push(current);
    current = [];
    used = 0;
  }

  function push(el) {
    if (!current.length && pages.length > 0) el.style.marginTop = '0px';
    var h = heightOf(el);
    current.push(el);
    used += h;
    return h;
  }

  function place(el) {
    if (el.tagName === 'TABLE') { placeTable(el); return; }

    var atTop = current.length === 0;
    if (atTop && pages.length > 0) el.style.marginTop = '0px';
    var h = heightOf(el);
    if (used + h <= LIMIT + TOLERANCE) {
      current.push(el);
      used += h;
      return;
    }
    if (current.length > 0) {
      var res = splitByLines(el, LIMIT - used);
      if (res === 'newpage') { newPage(); place(el); return; }
      if (res === null) {
        current.push(el);
        used += heightOf(el);
        if (used > LIMIT) newPage();
        return;
      }
      current.push(el);
      used += heightOf(el);
      newPage();
      place(res.tail);
      return;
    }
    // Fresh page: element taller than the page.
    var fresh = splitByLines(el, LIMIT);
    if (fresh === null || fresh === 'newpage') {
      current.push(el);
      used += heightOf(el);
      return;
    }
    current.push(el);
    used += heightOf(el);
    newPage();
    place(fresh.tail);
  }

  function makeChunk(table, headerRows) {
    var chunk = document.createElement('table');
    chunk.setAttribute('style', table.getAttribute('style') || '');
    var grid = table.querySelector('colgroup');
    if (grid) chunk.appendChild(grid.cloneNode(true));
    var body = document.createElement('tbody');
    chunk.appendChild(body);
    headerRows.forEach(function (row) {
      var clone = row.cloneNode(true);
      clone.removeAttribute('data-copied');
      body.appendChild(clone);
    });
    if (table.parentNode) table.parentNode.insertBefore(chunk, table);
    return { el: chunk, body: body };
  }

  function placeTable(table) {
    var whole = heightOf(table);
    if (used + whole <= LIMIT + TOLERANCE) {
      current.push(table);
      used += whole;
      return;
    }

    var allRows = Array.prototype.slice.call(table.rows);
    var headerRows = allRows.filter(function (r) { return r.getAttribute('data-hdr') === '1'; });
    var bodyRows = allRows.filter(function (r) { return r.getAttribute('data-hdr') !== '1' });
    var index = 0;

    while (index < bodyRows.length) {
      if (current.length > 0 && LIMIT - used < 8) { newPage(); continue; }
      var chunk = makeChunk(table, headerRows);
      var moved = 0;
      while (index < bodyRows.length) {
        var row = bodyRows[index];
        chunk.body.appendChild(row);
        var h = heightOf(chunk.el);
        if (used + h > LIMIT + TOLERANCE) {
          if (moved === 0) {
            moved = 1;
            index += 1;
            break;
          }
          var nextRow = bodyRows[index + 1] || null;
          var tbody = table.tBodies[0];
          if (tbody) tbody.insertBefore(row, nextRow);
          break;
        }
        moved += 1;
        index += 1;
      }
      if (moved > 0) {
        current.push(chunk.el);
        used += heightOf(chunk.el);
      } else if (chunk.el.parentNode) {
        chunk.el.parentNode.removeChild(chunk.el);
      }
      if (index < bodyRows.length) newPage();
    }

    if (table.parentNode) table.parentNode.removeChild(table);
  }

  function keepGroupHeight(units, start) {
    var el = units[start];
    var h = heightOf(el);
    if (el.getAttribute('data-keep') !== '1') return h;
    var j = start + 1;
    while (j < units.length) {
      h += heightOf(units[j]);
      if (units[j].getAttribute('data-keep') !== '1') break;
      j += 1;
    }
    return h;
  }

  function run() {
    try {
      fixTabs();
      var units = Array.prototype.slice.call(flow.children);
      for (var i = 0; i < units.length; i++) {
        var el = units[i];
        if (el.getAttribute('data-break') === 'page' && current.length > 0) newPage();
        if (el.getAttribute('data-keep') === '1' && current.length > 0) {
          if (used + keepGroupHeight(units, i) > LIMIT + TOLERANCE) newPage();
        }
        place(el);
      }
      if (current.length) pages.push(current);
      finishWithPages(pages);
    } catch (err) {
      fallback(err);
    }
  }

  if (document.fonts && document.fonts.ready) {
    var done = false;
    var go = function () { if (!done) { done = true; run(); } };
    document.fonts.ready.then(go, go);
    setTimeout(go, 3000);
  } else {
    run();
  }
})();
`

// ---------------------------------------------------------------------------
// Page CSS
// ---------------------------------------------------------------------------
const buildCss = (): string => `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background-color: #525659; }
body {
  font-family: 'Raleway', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 10pt;
  color: #1A1A1A;
  -webkit-font-smoothing: antialiased;
}
#loading { color: #fff; font-size: 13px; padding: 32px 0; text-align: center; }
.viewer {
  padding: 24px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}
.doc-root { width: ${PAGE_W_PT}pt; visibility: hidden; }
.doc-flow {
  width: ${CONTENT_W_PT}pt;
  background-color: #fff;
  display: flex;
  flex-direction: column;
}
.doc-flow, .a4-body {
  font-family: 'Raleway', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.35;
  color: #1A1A1A;
  text-align: left;
  white-space: pre-wrap;
}
.a4-body {
  position: absolute;
  top: ${MARGIN_TOP_PT}pt;
  left: ${MARGIN_LEFT_PT}pt;
  width: ${CONTENT_W_PT}pt;
  display: flex;
  flex-direction: column;
  z-index: 2;
}
p, h1, h2 {
  margin: 0;
  padding: 0;
  font-size: 10pt;
  font-weight: 400;
  font-style: normal;
  text-align: left;
  line-height: 1.35;
}
h1, h2 { font-weight: 700; }
.np::before {
  content: attr(data-marker);
  display: inline-block;
  width: var(--marker-w, 19pt);
  text-indent: 0;
  text-align: left;
}
.tab { display: inline-block; width: 0; height: 0; vertical-align: baseline; }
table {
  border-collapse: collapse;
  table-layout: fixed;
  margin-top: 0;
  margin-bottom: 0;
  font-size: 10pt;
  line-height: 1.35;
  color: #1A1A1A;
  white-space: pre-wrap;
}
td, th {
  margin: 0;
  padding: 0;
  font-size: 10pt;
  font-weight: 400;
  text-align: left;
  line-height: 1.35;
  white-space: pre-wrap;
}
th { font-weight: 700; }
.a4-page {
  position: relative;
  width: ${PAGE_W_PT}pt;
  height: ${PAGE_H_PT}pt;
  background-color: #ffffff;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  flex-shrink: 0;
}
.doc-header {
  position: absolute;
  top: ${HEADER_TOP_PT}pt;
  left: ${MARGIN_LEFT_PT}pt;
  width: ${CONTENT_W_PT}pt;
  z-index: 3;
}
.doc-header p { margin: 0; }
.doc-footer {
  position: absolute;
  bottom: ${FOOTER_BOTTOM_PT}pt;
  left: ${MARGIN_LEFT_PT}pt;
  width: ${CONTENT_W_PT}pt;
  z-index: 3;
}
.doc-watermark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  pointer-events: none;
  line-height: 0;
}
.doc-watermark img { display: block; }
@media print {
  html, body { background: transparent; }
  .viewer { padding: 0; gap: 0; }
  #loading { display: none; }
  .a4-page { box-shadow: none; page-break-after: always; }
  @page { size: A4 portrait; margin: 0; }
}
`

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function renderAkadPreviewHtml(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes)

  const readPart = async (path: string): Promise<string> => {
    const file = zip.file(path)
    if (!file) throw new Error(`Missing DOCX part: ${path}`)
    return file.async('string')
  }

  const [documentXml, stylesXml, numberingXml] = await Promise.all([
    readPart('word/document.xml'),
    readPart('word/styles.xml').catch(() => ''),
    readPart('word/numbering.xml').catch(() => ''),
  ])

  const { styles, docPP, docRP } = stylesXml
    ? parseStyles(stylesXml)
    : { styles: new Map<string, DocStyle>(), docPP: {}, docRP: {} }
  const { abstracts, nums } = numberingXml
    ? parseNumbering(numberingXml)
    : { abstracts: new Map<number, NumberLevel[]>(), nums: new Map<number, number>() }

  const documentRoot = parseXml(documentXml)
  const documentEl = findDescendant(documentRoot, 'document') ?? documentRoot
  const body = kidOf(documentEl, 'body')
  if (!body) throw new Error('DOCX body not found')

  const ctx: DocContext = {
    docPP,
    docRP,
    styles,
    stylePPCache: new Map(),
    styleRPCache: new Map(),
    abstracts,
    nums,
    numberingCounters: new Map(),
    images: new Map(),
    body,
  }

  const bodyHtml = renderBody(ctx)

  const header = await renderHeaderFooterPart(
    ctx,
    zip,
    'word/header1.xml',
    'word/_rels/header1.xml.rels',
    'header',
  )
  const footer = await renderHeaderFooterPart(
    ctx,
    zip,
    'word/footer1.xml',
    'word/_rels/footer1.xml.rels',
    'footer',
  )

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Pratinjau Dokumen Akad</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Raleway:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap" rel="stylesheet" />
<style>${buildCss()}</style>
</head>
<body>
<div class="viewer" id="viewer">
  <div id="loading">Menyiapkan pratinjau…</div>
  <div class="doc-root" id="doc">
    <div class="doc-flow" id="flow">${bodyHtml}</div>
  </div>
  <template id="page-shell">
    <div class="a4-page">
      <div class="doc-header">${header.blocks}</div>
      ${header.watermark ? `<div class="doc-watermark">${header.watermark}</div>` : ''}
      <div class="a4-body"></div>
      <div class="doc-footer">${footer.blocks}</div>
    </div>
  </template>
</div>
<script>${PAGINATION_SCRIPT}</script>
</body>
</html>`
}
