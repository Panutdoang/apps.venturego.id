export type FinancingCostLine = {
  label: string
  recipient: string
  amount: number
  evidenceReference: string
}

export type InstallmentEntry = {
  installment: number
  dueDate: string
  amount: number
  remainingBalance: number
}

export const MAX_FINANCING_LINES = 20
export const MAX_INSTALLMENTS = 36

export function coerceFinancingLines(value: unknown): FinancingCostLine[] | null {
  if (!Array.isArray(value) || value.length > MAX_FINANCING_LINES) return null

  const lines: FinancingCostLine[] = []
  for (const item of value) {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof item.label !== 'string' ||
      typeof item.recipient !== 'string' ||
      typeof item.evidenceReference !== 'string' ||
      typeof item.amount !== 'number' ||
      !Number.isSafeInteger(item.amount) ||
      item.amount < 0 ||
      item.label.trim().length > 120 ||
      item.recipient.trim().length > 120 ||
      item.evidenceReference.trim().length > 300
    ) {
      return null
    }
    lines.push({
      label: item.label.trim(),
      recipient: item.recipient.trim(),
      amount: item.amount,
      evidenceReference: item.evidenceReference.trim(),
    })
  }
  return lines
}

export function parseFinancingLines(value: string): FinancingCostLine[] | null {
  if (value.length > 20_000) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }
  return coerceFinancingLines(parsed)
}

export function calculateInstallmentSchedule(
  totalAmount: number,
  installmentCount: number,
  firstPaymentDate: string,
): InstallmentEntry[] | null {
  if (
    !Number.isSafeInteger(totalAmount) ||
    totalAmount < 0 ||
    !Number.isInteger(installmentCount) ||
    installmentCount < 1 ||
    installmentCount > MAX_INSTALLMENTS ||
    !/^\d{4}-\d{2}-\d{2}$/.test(firstPaymentDate)
  ) {
    return null
  }
  const [year, month, day] = firstPaymentDate.split('-').map(Number)
  const initialDate = new Date(Date.UTC(year, month - 1, day))
  if (
    initialDate.getUTCFullYear() !== year ||
    initialDate.getUTCMonth() !== month - 1 ||
    initialDate.getUTCDate() !== day
  ) {
    return null
  }

  const regularAmount = Math.floor(totalAmount / installmentCount)
  return Array.from({ length: installmentCount }, (_, index) => {
    const targetMonth = month - 1 + index
    const targetYear = year + Math.floor(targetMonth / 12)
    const normalizedMonth = targetMonth % 12
    const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate()
    const dueDate = new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay)))
      .toISOString()
      .slice(0, 10)
    const amount =
      index === installmentCount - 1
        ? totalAmount - regularAmount * (installmentCount - 1)
        : regularAmount
    return {
      installment: index + 1,
      dueDate,
      amount,
      remainingBalance: totalAmount - regularAmount * index - amount,
    }
  })
}

export const getFinancingLineTotal = (lines: FinancingCostLine[]) =>
  lines.reduce((total, line) => total + line.amount, 0)

export const DEPARTURE_ADMIN_FEE_RATE = 0.05
export const DEPARTURE_UJRAH_RATE_PER_MONTH = 0.024
export const DEPARTURE_UJRAH_TENOR_MONTHS = 12

export const FIXED_NAFAQAH_LABELS = [
  'Pendidikan Bahasa Jepang',
  'Pelatihan Skill Kerja',
  'Pengurusan dokumen (Paspor, Visa, COE)',
] as const

export const UJRAH_WAKALAH_LABEL =
  'Ujrah jasa wakalah bil ujrah (imbalan kuasa pengurusan pembiayaan)'
export const UJRAH_ADMIN_LABEL = 'Ujrah biaya administrasi pencairan'
export const QARDH_LABEL = 'Uang saku (qardh hasan)'

export type DepartureFinancials = {
  valid: boolean
  principal: number
  adminFee: number
  netAmount: number
  invoice: number
  pocketMoney: number
  wakalahUjrah: number
  nafaqahItems: FinancingCostLine[]
  ujrahItems: FinancingCostLine[]
  nafaqahTotal: number
  ujrahTotal: number
  qardhAmount: number
}

export function departureAdminFee(principal: number): number {
  return Math.round(principal * DEPARTURE_ADMIN_FEE_RATE)
}

export function departureWakalahUjrah(principal: number): number {
  return Math.round(principal * DEPARTURE_UJRAH_RATE_PER_MONTH) * DEPARTURE_UJRAH_TENOR_MONTHS
}

export function deriveDepartureFinancials(options: {
  principal: number
  invoice: number
  lpkName: string
}): DepartureFinancials {
  const lpkName = options.lpkName.trim().slice(0, 110) || 'LPK Mitra'
  const principal =
    Number.isSafeInteger(options.principal) && options.principal > 0 ? options.principal : 0
  const invoice =
    Number.isSafeInteger(options.invoice) && options.invoice >= 0 ? options.invoice : 0
  const adminFee = departureAdminFee(principal)
  const netAmount = principal - adminFee
  const valid = principal > 0 && invoice <= netAmount
  const pocketMoney = valid ? netAmount - invoice : 0
  const wakalahUjrah = departureWakalahUjrah(principal)
  const recipient = `oleh LPK ${lpkName}`.slice(0, 120)
  const nafaqahItems: FinancingCostLine[] = FIXED_NAFAQAH_LABELS.map((label) => ({
    label,
    recipient,
    amount: 0,
    evidenceReference: '',
  }))
  const ujrahItems: FinancingCostLine[] = [
    {
      label: UJRAH_WAKALAH_LABEL,
      recipient: 'VentureGo VSV',
      amount: Math.max(0, wakalahUjrah),
      evidenceReference: '',
    },
    {
      label: UJRAH_ADMIN_LABEL,
      recipient: 'VentureGo VSV',
      amount: Math.max(0, adminFee),
      evidenceReference: '',
    },
  ]
  return {
    valid,
    principal,
    adminFee: Math.max(0, adminFee),
    netAmount,
    invoice,
    pocketMoney,
    wakalahUjrah: Math.max(0, wakalahUjrah),
    nafaqahItems,
    ujrahItems,
    nafaqahTotal: invoice,
    ujrahTotal: Math.max(0, wakalahUjrah) + Math.max(0, adminFee),
    qardhAmount: pocketMoney,
  }
}

export function serializeStable(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize)
    if (item && typeof item === 'object') {
      return Object.fromEntries(
        Object.entries(item)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, entry]) => [key, normalize(entry)]),
      )
    }
    return item
  }
  return JSON.stringify(normalize(value))
}
