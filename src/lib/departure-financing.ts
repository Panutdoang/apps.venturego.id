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

export function parseFinancingLines(value: string): FinancingCostLine[] | null {
  if (value.length > 20_000) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }
  if (!Array.isArray(parsed) || parsed.length > MAX_FINANCING_LINES) return null

  const lines: FinancingCostLine[] = []
  for (const item of parsed) {
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
