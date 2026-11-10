const ONES = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan']

const threeDigits = (value: number): string => {
  if (value < 10) return ONES[value]
  if (value < 20) return value === 10 ? 'sepuluh' : `${ONES[value - 10]} belas`
  if (value < 100) {
    const rest = value % 10
    return `${ONES[Math.floor(value / 10)]} puluh${rest ? ` ${ONES[rest]}` : ''}`
  }
  const hundreds = Math.floor(value / 100)
  const rest = value % 100
  return `${hundreds === 1 ? 'seratus' : `${ONES[hundreds]} ratus`}${rest ? ` ${threeDigits(rest)}` : ''}`
}

export const terbilang = (amount: number): string => {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount >= 1_000_000_000_000) {
    throw new Error('Nominal tidak dapat diubah menjadi terbilang.')
  }
  if (amount === 0) return 'nol'
  const parts: string[] = []
  const millions = Math.floor(amount / 1_000_000)
  const thousands = Math.floor((amount % 1_000_000) / 1_000)
  const rest = amount % 1_000
  if (millions > 0) parts.push(`${threeDigits(millions)} juta`)
  if (thousands > 0) parts.push(thousands === 1 ? 'seribu' : `${threeDigits(thousands)} ribu`)
  if (rest > 0) parts.push(threeDigits(rest))
  return parts.join(' ')
}
