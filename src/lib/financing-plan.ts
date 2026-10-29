export const FINANCING_TENOR_MONTHS = 12
export const UJRAH_RATE_PER_MONTH = 0.024

export const FINANCING_OPTIONS = [
  { amount: 31_000_000, label: 'Rp31 juta' },
  { amount: 33_000_000, label: 'Rp33 juta' },
  { amount: 36_000_000, label: 'Rp36 juta' },
  { amount: 40_000_000, label: 'Rp40 juta' },
] as const

export type FinancingAmount = (typeof FINANCING_OPTIONS)[number]['amount']

export type WakalahPlan = {
  nafaqahTotal: number
  ujrahTotal: number
  totalObligation: number
  tenorMonths: number
  monthlyInstallment: number
  finalInstallment: number
}

export const formatRupiah = (value: number) =>
  `Rp${Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

export const isFinancingAmount = (value: number): value is FinancingAmount =>
  FINANCING_OPTIONS.some((option) => option.amount === value)

export function calculateWakalahPlan(principal: number): WakalahPlan {
  const ujrahTotal = Math.round(
    principal * UJRAH_RATE_PER_MONTH * FINANCING_TENOR_MONTHS,
  )
  const totalObligation = principal + ujrahTotal
  const monthlyInstallment = Math.round(totalObligation / FINANCING_TENOR_MONTHS)
  const finalInstallment =
    totalObligation - monthlyInstallment * (FINANCING_TENOR_MONTHS - 1)

  return {
    nafaqahTotal: principal,
    ujrahTotal,
    totalObligation,
    tenorMonths: FINANCING_TENOR_MONTHS,
    monthlyInstallment,
    finalInstallment,
  }
}
