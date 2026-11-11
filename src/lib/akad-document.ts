import 'server-only'

import JSZip from 'jszip'
import { AKAD_TEMPLATE_BASE64 as JUALAH_TEMPLATE_BASE64 } from './akad-templates/jualah'
import { AKAD_TEMPLATE_BASE64 as WAKALAH_TEMPLATE_BASE64 } from './akad-templates/wakalah'
import {
  calculateInstallmentSchedule,
  coerceFinancingLines,
  getFinancingLineTotal,
} from './departure-financing'
import { terbilang } from './terbilang'

export type AkadTemplateKind = 'WAKALAH' | 'JUALAH'

export type BuiltAkadDocument = {
  bytes: Uint8Array
  documentNumber: string
  template: AkadTemplateKind
}

type ApplicationData = Record<string, unknown>

const RELIGION_LABELS: Record<string, string> = {
  ISLAM: 'Islam',
  PROTESTANT: 'Kristen Protestan',
  CATHOLIC: 'Katolik',
  HINDU: 'Hindu',
  BUDDHIST: 'Buddha',
  CONFUCIAN: 'Konghucu',
}

const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

const TEMPLATE_ERROR = 'Template dokumen akad tidak sesuai versi aplikasi.'

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const unescapeXml = (value: string) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

const formatLongDate = (date: Date, timeZone: 'Asia/Jakarta' | 'UTC'): string =>
  new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone,
  }).format(date)

const formatWeekday = (date: Date): string =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }).format(date)

const parseIsoDate = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

const formatIsoLongDate = (value: string): string | null => {
  const date = parseIsoDate(value)
  return date ? formatLongDate(date, 'UTC') : null
}

const rp = (amount: number) => amount.toLocaleString('id-ID')

const readNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

const readText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const at = <T>(values: T[], index: number): T => {
  if (index < 0 || index >= values.length) throw new Error(TEMPLATE_ERROR)
  return values[index]
}

const countToken = (xml: string, token: string): number => xml.split(token).length - 1

const assertTokenCount = (xml: string, token: string, expected: number) => {
  const actual = countToken(xml, token)
  if (actual !== expected) throw new Error(TEMPLATE_ERROR)
}

const findTableByMarker = (xml: string, marker: string): { start: number; end: number } | null => {
  const pattern = /<w:tbl>[\s\S]*?<\/w:tbl>/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(xml))) {
    if (match[0].includes(marker)) {
      return { start: match.index, end: match.index + match[0].length }
    }
  }
  return null
}

const removeDraftTemplateNotice = (xml: string): string => {
  const notice = findTableByMarker(xml, 'Draft template.')
  return notice ? `${xml.slice(0, notice.start)}${xml.slice(notice.end)}` : xml
}

const updateParagraphContaining = (
  xml: string,
  marker: string,
  replacement: string | null,
): string =>
  xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = Array.from(paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g), (match) =>
      unescapeXml(match[1]),
    ).join('')
    if (!text.includes(marker)) return paragraph
    if (replacement === null) return ''
    const paragraphProperties = paragraph.match(/<w:pPr[\s\S]*?<\/w:pPr>/)?.[0] ?? ''
    const runProperties = paragraph.match(/<w:rPr[\s\S]*?<\/w:rPr>/)?.[0] ?? ''
    return `<w:p>${paragraphProperties}<w:r>${runProperties}<w:t xml:space="preserve">${escapeXml(replacement)}</w:t></w:r></w:p>`
  })

const splitRows = (table: string): string[] =>
  Array.from(table.matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g), (match) => match[0])

const splitCells = (row: string): string[] =>
  Array.from(row.matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g), (match) => match[0])

const cellText = (cell: string): string => {
  const parts = Array.from(cell.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g), (match) => match[1])
  return unescapeXml(parts.join('')).trim()
}

const rowText = (row: string): string => splitCells(row).map(cellText).join(' | ')

const setCellText = (cell: string, value: string): string => {
  const escaped = escapeXml(value)
  let first = true
  return cell
    .replace(/<w:tab\/>|<w:br\/>|<w:cr\/>/g, '')
    .replace(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g, (match) => {
      if (!first) {
        return match.replace(/^(<w:t(?:\s[^>]*)?>)[\s\S]*(<\/w:t>)$/, '$1$2')
      }
      first = false
      return match.replace(/^(<w:t(?:\s[^>]*)?>)[\s\S]*(<\/w:t>)$/, (_full, open, close) => {
        return `${open}${escaped}${close}`
      })
    })
}

const replaceTableRowCells = (row: string, values: (string | null)[]): string => {
  let index = 0
  return row.replace(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g, (cell) => {
    const value = values[index]
    index += 1
    return value === null || value === undefined ? cell : setCellText(cell, value)
  })
}

type WakaiahTableParts = {
  header: string
  nafaqahRows: string[]
  ujrahRows: string[]
  subtotalNafaqah: string | null
  subtotalUjrah: string | null
  qardhRow: string | null
  totalRow: string | null
  others: string[]
}

const parseCostTable = (table: string): WakaiahTableParts => {
  const rows = splitRows(table)
  const parts: WakaiahTableParts = {
    header: '',
    nafaqahRows: [],
    ujrahRows: [],
    subtotalNafaqah: null,
    subtotalUjrah: null,
    qardhRow: null,
    totalRow: null,
    others: [],
  }
  for (const row of rows) {
    const text = rowText(row)
    if (!parts.header && text.includes('Komponen')) {
      parts.header = row
    } else if (text.includes('Subtotal Nafaqah')) {
      parts.subtotalNafaqah = row
    } else if (text.includes('Subtotal Ujrah')) {
      parts.subtotalUjrah = row
    } else if (text.includes('Qardh hasan')) {
      parts.qardhRow = row
    } else if (text.includes('TOTAL KEWAJIBAN')) {
      parts.totalRow = row
    } else {
      const cells = splitCells(row)
      const keterangan = cells.length >= 5 ? cellText(cells[4]) : ''
      if (keterangan === 'Nafaqah') parts.nafaqahRows.push(row)
      else if (keterangan === 'Ujrah') parts.ujrahRows.push(row)
      else parts.others.push(row)
    }
  }
  return parts
}

const fillAmountCell = (row: string | null, amount: number): string | null => {
  if (!row) return null
  let filled = false
  return row.replace(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g, (cell) => {
    if (!filled && cell.includes('Rp[ ]')) {
      filled = true
      return setCellText(cell, `Rp${rp(amount)}`)
    }
    return cell
  })
}

const buildSectionRows = (
  templateRows: string[],
  items: { label: string; recipient: string; amount: number }[],
  keterangan: string,
): string[] => {
  const rows: string[] = []
  const model = templateRows.length > 0 ? templateRows[templateRows.length - 1] : null
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    const base = index < templateRows.length ? templateRows[index] : model
    if (!base) continue
    rows.push(
      replaceTableRowCells(base, [
        String(index + 1),
        item.label,
        item.recipient,
        `Rp${rp(item.amount)}`,
        keterangan,
      ]),
    )
  }
  return rows
}

const reassembleTable = (table: string, rows: string[]): string => {
  const allRows = splitRows(table)
  if (allRows.length === 0) return table
  const firstStart = table.indexOf(allRows[0])
  const lastRow = allRows[allRows.length - 1]
  const lastEnd = table.indexOf(lastRow) + lastRow.length
  return table.slice(0, firstStart) + rows.join('') + table.slice(lastEnd)
}

const applyCostTable = (
  xml: string,
  parts: WakaiahTableParts,
  nafaqahItems: { label: string; recipient: string; amount: number }[],
  ujrahItems: { label: string; recipient: string; amount: number }[],
  nafaqahTotal: number,
  ujrahTotal: number,
  qardhAmount: number,
  total: number,
): string => {
  const nafaqah = buildSectionRows(parts.nafaqahRows, nafaqahItems, 'Nafaqah')
  const ujrah = buildSectionRows(parts.ujrahRows, ujrahItems, 'Ujrah')
  const rows: string[] = []
  if (parts.header) rows.push(parts.header)
  rows.push(...nafaqah)
  if (parts.subtotalNafaqah) {
    rows.push(fillAmountCell(parts.subtotalNafaqah, nafaqahTotal) ?? parts.subtotalNafaqah)
  }
  rows.push(...ujrah)
  if (parts.subtotalUjrah) {
    rows.push(fillAmountCell(parts.subtotalUjrah, ujrahTotal) ?? parts.subtotalUjrah)
  }
  if (parts.qardhRow) rows.push(fillAmountCell(parts.qardhRow, qardhAmount) ?? parts.qardhRow)
  if (parts.totalRow) rows.push(fillAmountCell(parts.totalRow, total) ?? parts.totalRow)
  rows.push(...parts.others)

  let nextNumber = 1
  const finalRows = rows.map((row) => {
    const cells = splitCells(row)
    const keterangan = cells.length > 0 ? cellText(cells[cells.length - 1]) : ''
    if (keterangan === 'Nafaqah' || keterangan === 'Ujrah' || keterangan === 'Qardh hasan') {
      const updated = replaceTableRowCells(row, [String(nextNumber)])
      nextNumber += 1
      return updated
    }
    return row
  })

  const tableStart = findTableByMarker(xml, 'Penerima pembayaran')
  if (!tableStart) return xml
  const table = xml.slice(tableStart.start, tableStart.end)
  const newTable = reassembleTable(table, finalRows)
  return xml.slice(0, tableStart.start) + newTable + xml.slice(tableStart.end)
}

const applyFullCoverCostTable = (xml: string, values: ResolvedValues): string => {
  const location = findTableByMarker(xml, 'Penerima pembayaran')
  if (!location) throw new Error(TEMPLATE_ERROR)
  const table = xml.slice(location.start, location.end)
  const rows = splitRows(table)
  const findRow = (marker: string) => rows.find((row) => rowText(row).includes(marker)) ?? null
  const header = findRow('Komponen')
  const itemTemplate = findRow('Pendaftaran dan MCU')
  const nafaqahSubtotal = findRow('Subtotal Nafaqah al-Wakalah')
  const ujrahTemplate = findRow('Jasa perwakilan')
  const ujrahSubtotal = findRow('Subtotal Ujrah')
  const jualaTemplate = findRow('Imbalan penempatan')
  const totalTemplate = findRow('TOTAL KEWAJIBAN PIHAK KEDUA')
  if (
    !header ||
    !itemTemplate ||
    !nafaqahSubtotal ||
    !ujrahTemplate ||
    !ujrahSubtotal ||
    !jualaTemplate ||
    !totalTemplate
  ) {
    throw new Error(TEMPLATE_ERROR)
  }

  const rebuiltRows = [
    header,
    replaceTableRowCells(itemTemplate, [
      '1',
      'Invoice tagihan LPK',
      values.lpkMitra ? `LPK ${values.lpkMitra}` : 'LPK mitra',
      `Rp${rp(values.hppInvoiceAmount)}`,
      'Nafaqah (HPP)',
    ]),
    replaceTableRowCells(itemTemplate, [
      '2',
      'Uang saku siswa',
      'PIHAK KEDUA',
      `Rp${rp(values.hppPocketMoneyAmount)}`,
      'Nafaqah (HPP)',
    ]),
    fillAmountCell(nafaqahSubtotal, values.nafaqahTotal) as string,
    replaceTableRowCells(ujrahTemplate, [
      '3',
      'Jasa perwakilan (Wakalah bil Ujrah)',
      'PIHAK PERTAMA',
      `Rp${rp(values.ujrahTotal)}`,
      'Ujrah, tetap',
    ]),
    fillAmountCell(ujrahSubtotal, values.ujrahTotal) as string,
    replaceTableRowCells(jualaTemplate, [
      '4',
      "Imbalan penempatan (Ju'alah)",
      'PIHAK PERTAMA',
      `Rp${rp(values.jualaTotal)}`,
      "Ju'l, dibayar jika COE terbit",
    ]),
    fillAmountCell(totalTemplate, values.totalIfCoe) as string,
  ]
  const nextTable = reassembleTable(table, rebuiltRows)
  return xml.slice(0, location.start) + nextTable + xml.slice(location.end)
}

const applyAppendixDocumentsTable = (
  xml: string,
  documents: { label: string; date: string; condition: string; count: number }[],
): string => {
  const location = findTableByMarker(xml, 'Akta Kelahiran')
  if (!location) throw new Error(TEMPLATE_ERROR)
  const table = xml.slice(location.start, location.end)
  const rows = splitRows(table)
  const header = rows[0]
  const template = rows.find((row) => rowText(row).includes('Akta Kelahiran'))
  if (!header || !template) throw new Error(TEMPLATE_ERROR)
  const documentRows = documents.map((document, index) =>
    replaceTableRowCells(template, [
      String(index + 1),
      document.label,
      document.condition === 'ORIGINAL' ? 'Asli' : 'Fotokopi',
      String(document.count),
      `Tanggal ${formatIsoLongDate(document.date) ?? document.date}`,
    ]),
  )
  const nextTable = reassembleTable(table, [header, ...documentRows])
  return xml.slice(0, location.start) + nextTable + xml.slice(location.end)
}

const applyScheduleTable = (xml: string, scheduleRows: string[]): string => {
  const location = findTableByMarker(xml, 'Angsuran ke-')
  if (!location) return xml
  const table = xml.slice(location.start, location.end)
  const rows = splitRows(table)
  if (rows.length < 2) return xml
  const header = rows[0]
  const newRows = [header, ...scheduleRows]
  const newTable = reassembleTable(table, newRows)
  return xml.slice(0, location.start) + newTable + xml.slice(location.end)
}

const buildScheduleRowTemplates = (xml: string): string | null => {
  const location = findTableByMarker(xml, 'Angsuran ke-')
  if (!location) return null
  const rows = splitRows(xml.slice(location.start, location.end))
  const model = rows.find((row) => rowText(row).includes('[tanggal]'))
  return model ?? null
}

type ResolvedValues = {
  studentSequence: string
  issuedAt: Date
  name: string
  ttl: string | null
  address: string | null
  religion: string | null
  nik: string | null
  phone: string | null
  // wakalah
  nafaqahTotal: number
  ujrahTotal: number
  qardhAmount: number
  total: number
  installmentCount: number
  monthlyInstallment: number
  firstPaymentLong: string | null
  // jualah
  jualaTotal: number
  totalIfCoe: number
  tenorMonths: number
  monthlyAfterCoe: number
  languageMonths: string | null
  skillMonths: string | null
  lpkMitra: string | null
  hppInvoiceAmount: number
  hppPocketMoneyAmount: number
  languageAllowanceMonthly: number
  skillAllowanceMonthly: number
  departureAllowanceAmount: number
  commitmentCompensationAmount: number
  commitmentSettlementDays: number
  wakalahDocumentReturnBusinessDays: number
  wakalahWrittenWarningCount: number
  wakalahGraceDays: number
  wakalahOtherUjrahService: string | null
  wakalahMediator: string | null
  wakalahDisputeInstitution: string | null
  guardianName: string | null
  lpkWitnessName: string | null
}

const buildCommonArrays = (values: ResolvedValues) => {
  const issueLong = formatLongDate(values.issuedAt, 'Asia/Jakarta')
  const weekday = formatWeekday(values.issuedAt)
  return {
    '[nomor kontrak]': [values.studentSequence],
    '[bulan romawi]': [ROMAN_MONTHS[values.issuedAt.getUTCMonth()] ?? ''],
    '[tahun]': [String(values.issuedAt.getUTCFullYear())],
    '[hari]': [weekday],
    '[nama lengkap]': [values.name],
    '[tempat, tanggal lahir]': [values.ttl],
    '[alamat sesuai KTP]': [values.address],
    '[agama]': [values.religion],
    '[nomor KTP]': [values.nik ?? '……………………'],
    '[nomor HP]': [values.phone],
    '[mitra]': [values.lpkMitra, values.lpkMitra],
    '[nama Pihak Kedua]': [values.name],
    '[nama lengkap Pihak Kedua]': [values.name],
    issueLong,
    weekday,
  }
}

const resolveWakalah = (
  token: string,
  index: number,
  values: ResolvedValues,
  scheduleRebuilt: boolean,
): string | null => {
  const common = buildCommonArrays(values)
  const issueLong = common.issueLong
  switch (token) {
    case '[nomor kontrak]':
    case '[bulan romawi]':
    case '[tahun]':
    case '[hari]':
    case '[nama lengkap]':
    case '[tempat, tanggal lahir]':
    case '[alamat sesuai KTP]':
    case '[agama]':
    case '[nomor KTP]':
    case '[nomor HP]':
    case '[mitra]':
    case '[nama Pihak Kedua]': {
      const list = common[token as keyof typeof common]
      if (!Array.isArray(list)) return null
      return at(list as (string | null)[], index)
    }
    case '[tanggal]': {
      const list = scheduleRebuilt
        ? [issueLong, values.firstPaymentLong, issueLong, null]
        : [issueLong, values.firstPaymentLong, issueLong, null, null, null]
      return at(list, index)
    }
    case '[jumlah]':
      return at(
        [
          values.languageMonths,
          values.skillMonths,
          String(values.installmentCount),
          String(values.wakalahDocumentReturnBusinessDays),
          String(values.wakalahWrittenWarningCount),
          String(values.wakalahGraceDays),
        ],
        index,
      )
    case '[hapus bila tidak ada]':
      return ''
    case '[pihak mediator, jika ada]':
      return values.wakalahMediator ?? ''
    case '[atau lembaga lain yang disepakati dan berwenang]':
      return values.wakalahDisputeInstitution ?? ''
    case '[nominal]':
      return at(
        [
          rp(values.ujrahTotal),
          values.qardhAmount > 0 ? rp(values.qardhAmount) : null,
          rp(values.nafaqahTotal),
          rp(values.ujrahTotal),
          rp(values.qardhAmount),
          rp(values.monthlyInstallment),
        ],
        index,
      )
    case '[terbilang]':
      return at([terbilang(values.ujrahTotal)], index)
    case '[total]':
      return at([rp(values.total)], index)
    default:
      return null
  }
}

const resolveJualah = (token: string, index: number, values: ResolvedValues): string | null => {
  const common = buildCommonArrays(values)
  const issueLong = common.issueLong
  const tNafaqah = terbilang(values.nafaqahTotal)
  const tUjrah = terbilang(values.ujrahTotal)
  const tJuala = terbilang(values.jualaTotal)
  const tTotal = terbilang(values.totalIfCoe)
  const tCommitment = terbilang(values.commitmentCompensationAmount)
  switch (token) {
    case '[nomor kontrak]':
    case '[bulan romawi]':
    case '[tahun]':
    case '[hari]':
    case '[nama lengkap]':
    case '[tempat, tanggal lahir]':
    case '[alamat sesuai KTP]':
    case '[agama]':
    case '[nomor KTP]':
    case '[nama lengkap Pihak Kedua]': {
      const list = common[token as keyof typeof common]
      if (!Array.isArray(list)) return null
      return at(list as (string | null)[], index)
    }
    case '[mitra]':
      return at([values.lpkMitra, values.lpkMitra], index)
    case '[tanggal]':
      return at([issueLong, values.firstPaymentLong, issueLong, issueLong], index)
    case '[ujrah]':
      return at(
        Array.from({ length: 5 }, () => rp(values.ujrahTotal)),
        index,
      )
    case '[nafaqah]':
      return at(
        Array.from({ length: 4 }, () => rp(values.nafaqahTotal)),
        index,
      )
    case '[ju&apos;l]':
      return at(
        Array.from({ length: 6 }, () => rp(values.jualaTotal)),
        index,
      )
    case '[total]':
      return at([rp(values.totalIfCoe), rp(values.totalIfCoe)], index)
    case '[terbilang]':
      return at(
        [
          tUjrah,
          tNafaqah,
          tUjrah,
          tJuala,
          tNafaqah,
          tUjrah,
          tNafaqah,
          tUjrah,
          tJuala,
          tTotal,
          tJuala,
          tCommitment,
          tNafaqah,
          tUjrah,
          tJuala,
          tTotal,
        ],
        index,
      )
    case '[jumlah]':
      return at(
        [
          String(values.tenorMonths),
          values.languageMonths,
          values.skillMonths,
          String(values.commitmentSettlementDays),
          String(values.tenorMonths),
          values.languageMonths,
          values.skillMonths,
        ],
        index,
      )
    case '[angsuran]':
      return at([rp(values.monthlyAfterCoe)], index)
    case '[nominal]':
      return at(
        [
          rp(values.languageAllowanceMonthly),
          rp(values.skillAllowanceMonthly),
          rp(values.departureAllowanceAmount),
          rp(values.commitmentCompensationAmount),
        ],
        index,
      )
    case '[ ]':
      return at(
        Array.from({ length: 8 }, () => null),
        index,
      )
    default:
      return null
  }
}

const fillTokens = (
  xml: string,
  resolve: (token: string, index: number) => string | null,
): string => {
  const counters = new Map<string, number>()
  return xml.replace(/\[[^\[\]]{1,80}\]/g, (token) => {
    const index = counters.get(token) ?? 0
    counters.set(token, index + 1)
    const value = resolve(token, index)
    return value === null ? token : escapeXml(value)
  })
}

const deriveFirstPaymentDate = (application: ApplicationData): string => {
  const plan = (application.financialPlan ?? {}) as Record<string, unknown>
  const stored = readText(plan.firstPaymentDate)
  if (/^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored
  const eligibility = (application.eligibility ?? {}) as Record<string, unknown>
  const estimatedDeparture = readText(eligibility.estimatedDeparture)
  if (/^\d{4}-\d{2}-\d{2}$/.test(estimatedDeparture)) {
    const [depYear, depMonth] = estimatedDeparture.split('-').map(Number)
    const nextYear = depMonth === 12 ? depYear + 1 : depYear
    const nextMonth = depMonth === 12 ? 1 : depMonth + 1
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  }
  const now = new Date()
  const nextDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1))
  return nextDate.toISOString().slice(0, 10)
}

const resolveValues = (application: ApplicationData, issuedAt: Date): ResolvedValues => {
  const plan = (application.financialPlan ?? {}) as Record<string, unknown>
  const personal = (application.personalDetails ?? {}) as Record<string, unknown>
  const fullCover = (application.fullCoverDetails ?? {}) as Record<string, unknown>
  const product = readText(application.product)

  const name = readText(application.applicantName)
  const phone = readText(application.phone)
  const lpkRaw = readText(application.lpkName)
    .replace(/^LPK\s+/i, '')
    .trim()
  const lpkMitra = lpkRaw || null
  const birthPlace = readText(personal.birthPlace)
  const birthDate = readText(personal.birthDate)
  const ttlParts: string[] = []
  if (birthPlace) ttlParts.push(birthPlace)
  const birthLong = formatIsoLongDate(birthDate)
  if (birthLong) ttlParts.push(birthLong)
  const ttl = ttlParts.length > 0 ? ttlParts.join(', ') : null
  const address = readText(personal.idCardAddress) || null
  const religionRaw = readText(personal.religion)
  const religion = RELIGION_LABELS[religionRaw] ?? (religionRaw || null)
  const nik = readText(personal.idCardNumber) || null
  const guardianName = readText(personal.guardianName) || null
  const lpkWitnessName = readText(plan.lpkWitnessName) || null

  if (product === 'FULL_COVER') {
    const nafaqahTotal = readNumber(plan.nafaqahTotal)
    const ujrahTotal = readNumber(plan.ujrahTotal)
    const jualaTotal = readNumber(plan.jualaTotal)
    const tenorRaw = readNumber(plan.tenorMonths)
    const tenorMonths =
      Number.isInteger(tenorRaw) && tenorRaw >= 1 && tenorRaw <= 36 ? tenorRaw : 12
    const totalObligation = readNumber(plan.totalObligation) || nafaqahTotal + ujrahTotal
    const totalIfCoe = readNumber(plan.totalObligationIfCoe) || totalObligation + jualaTotal
    const monthlyAfterCoe =
      readNumber(plan.monthlyInstallmentAfterCoe) || Math.floor(totalIfCoe / tenorMonths)
    const languageMonths =
      readNumber(fullCover.languageTrainingMonths) > 0
        ? String(readNumber(fullCover.languageTrainingMonths))
        : null
    const skillMonths =
      readNumber(fullCover.skillTrainingMonths) > 0
        ? String(readNumber(fullCover.skillTrainingMonths))
        : null
    return {
      studentSequence: '',
      issuedAt,
      name,
      ttl,
      address,
      religion,
      nik,
      phone,
      nafaqahTotal,
      ujrahTotal,
      qardhAmount: 0,
      total: totalObligation,
      installmentCount: tenorMonths,
      monthlyInstallment: monthlyAfterCoe,
      firstPaymentLong: formatIsoLongDate(deriveFirstPaymentDate(application)),
      jualaTotal,
      totalIfCoe,
      tenorMonths,
      monthlyAfterCoe,
      languageMonths,
      skillMonths,
      lpkMitra,
      hppInvoiceAmount:
        readNumber(plan.hppLpkInvoiceAmount) || readNumber(fullCover.lpkInvoiceAmount),
      hppPocketMoneyAmount: readNumber(plan.hppPocketMoneyAmount),
      languageAllowanceMonthly: readNumber(plan.languageAllowanceMonthly),
      skillAllowanceMonthly: readNumber(plan.skillAllowanceMonthly),
      departureAllowanceAmount: readNumber(plan.departureAllowanceAmount),
      commitmentCompensationAmount: readNumber(plan.commitmentCompensationAmount),
      commitmentSettlementDays: readNumber(plan.commitmentSettlementDays),
      wakalahDocumentReturnBusinessDays: readNumber(plan.wakalahDocumentReturnBusinessDays),
      wakalahWrittenWarningCount: readNumber(plan.wakalahWrittenWarningCount),
      wakalahGraceDays: readNumber(plan.wakalahGraceDays),
      wakalahOtherUjrahService: readText(plan.wakalahOtherUjrahService) || null,
      wakalahMediator: readText(plan.wakalahMediator) || null,
      wakalahDisputeInstitution: readText(plan.wakalahDisputeInstitution) || null,
      guardianName,
      lpkWitnessName,
    }
  }

  const nafaqahItems = coerceFinancingLines(plan.nafaqahItems) ?? []
  const ujrahItems = coerceFinancingLines(plan.ujrahItems) ?? []
  const nafaqahTotal = getFinancingLineTotal(nafaqahItems)
  const ujrahTotal = getFinancingLineTotal(ujrahItems)
  const qardhAmount = plan.qardhDisbursed === true ? readNumber(plan.qardhAmount) : 0
  const refundTotal = readNumber(plan.refundTotal)
  const total = Math.max(0, nafaqahTotal + ujrahTotal + qardhAmount - refundTotal)
  const countRaw = readNumber(plan.installmentCount)
  const installmentCount =
    Number.isInteger(countRaw) && countRaw >= 1 && countRaw <= 36 ? countRaw : 12
  const monthlyInstallment = Math.floor(total / installmentCount)
  const firstPaymentLong = formatIsoLongDate(deriveFirstPaymentDate(application))
  return {
    studentSequence: '',
    issuedAt,
    name,
    ttl,
    address,
    religion,
    nik,
    phone,
    nafaqahTotal,
    ujrahTotal,
    qardhAmount,
    total,
    installmentCount,
    monthlyInstallment,
    firstPaymentLong,
    jualaTotal: 0,
    totalIfCoe: total,
    tenorMonths: installmentCount,
    monthlyAfterCoe: monthlyInstallment,
    languageMonths: readNumber(plan.wakalahLanguageMonths)
      ? String(readNumber(plan.wakalahLanguageMonths))
      : null,
    skillMonths: readNumber(plan.wakalahSkillMonths)
      ? String(readNumber(plan.wakalahSkillMonths))
      : null,
    lpkMitra,
    hppInvoiceAmount: readNumber(plan.hppLpkInvoiceAmount),
    hppPocketMoneyAmount: readNumber(plan.hppPocketMoneyAmount),
    languageAllowanceMonthly: readNumber(plan.languageAllowanceMonthly),
    skillAllowanceMonthly: readNumber(plan.skillAllowanceMonthly),
    departureAllowanceAmount: readNumber(plan.departureAllowanceAmount),
    commitmentCompensationAmount: readNumber(plan.commitmentCompensationAmount),
    commitmentSettlementDays: readNumber(plan.commitmentSettlementDays),
    wakalahDocumentReturnBusinessDays: readNumber(plan.wakalahDocumentReturnBusinessDays),
    wakalahWrittenWarningCount: readNumber(plan.wakalahWrittenWarningCount),
    wakalahGraceDays: readNumber(plan.wakalahGraceDays),
    wakalahOtherUjrahService: readText(plan.wakalahOtherUjrahService) || null,
    wakalahMediator: readText(plan.wakalahMediator) || null,
    wakalahDisputeInstitution: readText(plan.wakalahDisputeInstitution) || null,
    guardianName,
    lpkWitnessName,
  }
}

export const buildAkadDocument = async (options: {
  application: ApplicationData
  studentSequence: string
  issuedAt: Date
}): Promise<BuiltAkadDocument> => {
  const { application, studentSequence, issuedAt } = options
  const product = readText(application.product)
  const template: AkadTemplateKind = product === 'FULL_COVER' ? 'JUALAH' : 'WAKALAH'
  const base64 = template === 'JUALAH' ? JUALAH_TEMPLATE_BASE64 : WAKALAH_TEMPLATE_BASE64

  const zip = await JSZip.loadAsync(Buffer.from(base64, 'base64'))
  const documentFile = zip.file('word/document.xml')
  if (!documentFile) throw new Error(TEMPLATE_ERROR)
  let xml = removeDraftTemplateNotice(await documentFile.async('string'))

  const values = resolveValues(application, issuedAt)
  values.studentSequence = studentSequence
  if (values.lpkWitnessName) {
    xml = updateParagraphContaining(
      xml,
      'LPK Cahaya Indonesia Langgeng',
      `LPK ${values.lpkMitra ?? 'mitra'} — ${values.lpkWitnessName}`,
    )
  }

  assertTokenCount(xml, '[nomor kontrak]', 1)

  if (template === 'WAKALAH') {
    xml = updateParagraphContaining(
      xml,
      'Wali/Orang tua ',
      values.guardianName ? `Wali/Orang tua PIHAK KEDUA: ${values.guardianName}` : null,
    )
    assertTokenCount(xml, '[nominal]', 6)
    assertTokenCount(xml, '[jumlah]', 6)

    const plan = (application.financialPlan ?? {}) as Record<string, unknown>
    const nafaqahItems = coerceFinancingLines(plan.nafaqahItems) ?? []
    const ujrahItems = coerceFinancingLines(plan.ujrahItems) ?? []
    const appendixDocuments = Array.isArray(plan.appendixDocuments)
      ? plan.appendixDocuments.filter(
          (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object',
        )
      : []
    const ticketIncluded = nafaqahItems.some((item) => /tiket/i.test(item.label))
    if (!ticketIncluded) {
      xml = updateParagraphContaining(xml, 'Biaya tiket dan keperluan keberangkatan', null)
    }
    xml = updateParagraphContaining(
      xml,
      '[jasa lain yang dikerjakan PIHAK PERTAMA sendiri, jelaskan]',
      values.wakalahOtherUjrahService
        ? `Jasa lain yang dikerjakan PIHAK PERTAMA: ${values.wakalahOtherUjrahService}`
        : null,
    )

    const schedule = calculateInstallmentSchedule(
      values.total,
      values.installmentCount,
      deriveFirstPaymentDate(application),
    )
    let scheduleRebuilt = false
    let scheduleRowModel = buildScheduleRowTemplates(xml)
    if (schedule && scheduleRowModel) {
      const scheduleRows = schedule.map((entry) =>
        replaceTableRowCells(scheduleRowModel as string, [
          String(entry.installment),
          formatIsoLongDate(entry.dueDate) ?? '',
          `Rp${rp(entry.amount)}`,
          `Rp${rp(entry.remainingBalance)}`,
        ]),
      )
      xml = applyScheduleTable(xml, scheduleRows)
      scheduleRebuilt = true
      scheduleRowModel = null
    }

    const expectedTanggal = scheduleRebuilt ? 4 : 6
    assertTokenCount(xml, '[tanggal]', expectedTanggal)

    if (nafaqahItems.length > 0 || ujrahItems.length > 0) {
      const location = findTableByMarker(xml, 'Penerima pembayaran')
      if (location) {
        const table = xml.slice(location.start, location.end)
        const parts = parseCostTable(table)
        xml = applyCostTable(
          xml,
          parts,
          nafaqahItems,
          ujrahItems,
          values.nafaqahTotal,
          values.ujrahTotal,
          values.qardhAmount,
          values.total,
        )
      }
    }

    xml = applyAppendixDocumentsTable(
      xml,
      appendixDocuments.map((item) => ({
        label: readText(item.label),
        date: readText(item.date),
        condition: readText(item.condition),
        count: readNumber(item.count),
      })),
    )

    xml = fillTokens(xml, (token, index) => resolveWakalah(token, index, values, scheduleRebuilt))
  } else {
    xml = updateParagraphContaining(
      xml,
      'Wali ',
      values.guardianName ? `Wali: ${values.guardianName}` : null,
    )
    assertTokenCount(xml, '[tanggal]', 4)
    xml = applyFullCoverCostTable(xml, values)
    const plan = (application.financialPlan ?? {}) as Record<string, unknown>
    const appendixDocuments = Array.isArray(plan.appendixDocuments)
      ? plan.appendixDocuments.filter(
          (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object',
        )
      : []
    xml = applyAppendixDocumentsTable(
      xml,
      appendixDocuments.map((item) => ({
        label: readText(item.label),
        date: readText(item.date),
        condition: readText(item.condition),
        count: readNumber(item.count),
      })),
    )
    xml = fillTokens(xml, (token, index) => resolveJualah(token, index, values))
  }

  zip.file('word/document.xml', xml)
  const bytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  const sequence = studentSequence || '0000'
  const romawi = ROMAN_MONTHS[issuedAt.getUTCMonth()] ?? 'I'
  const year = String(issuedAt.getUTCFullYear())
  const documentNumber =
    template === 'JUALAH'
      ? `${sequence}/WKL-JAL-JPN/VSV-WSB/${romawi}/${year}`
      : `${sequence}/WKL-JPN/VSV-WSB/${romawi}/${year}`

  return { bytes, documentNumber, template }
}
