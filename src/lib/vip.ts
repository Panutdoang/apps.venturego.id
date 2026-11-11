// Mitra VIP (Vworks Investment Partner) — tipe & perhitungan bersama (server + klien).
//   vipInvestors/{investorId} — data diri sederhana + cache saldo
//   vipLedger/{id}            — buku besar; baris tidak dihapus, koreksi lewat `voidedAt`
//   vipAudit/{autoId}         — jejak perubahan oleh staf

export const VIP_LEDGER_TYPES = ['DEPOSIT', 'WITHDRAWAL', 'PROFIT_SHARE', 'DIVIDEND'] as const
export type VipLedgerType = (typeof VIP_LEDGER_TYPES)[number]

export const VIP_LEDGER_LABELS: Record<VipLedgerType, string> = {
  DEPOSIT: 'Setoran dana',
  WITHDRAWAL: 'Penarikan dana',
  PROFIT_SHARE: 'Bagi hasil',
  DIVIDEND: 'Dividen',
}

export const VIP_STATUSES = ['ACTIVE', 'INACTIVE'] as const
export type VipStatus = (typeof VIP_STATUSES)[number]

export type VipLedgerRow = {
  date: string
  type: VipLedgerType
  amount: number
  voidedAt?: unknown
}

export const isVipLedgerType = (value: unknown): value is VipLedgerType =>
  typeof value === 'string' && (VIP_LEDGER_TYPES as readonly string[]).includes(value)

// Cache yang disimpan di vipInvestors, dihitung ulang dari seluruh baris ledger yang tidak dibatalkan.
export const computeVipCache = (rows: VipLedgerRow[]) => {
  const valid = rows
    .filter((row) => !row.voidedAt && isVipLedgerType(row.type) && row.amount > 0)
    .sort((left, right) => left.date.localeCompare(right.date))
  const sum = (type: VipLedgerType) =>
    valid.filter((row) => row.type === type).reduce((total, row) => total + row.amount, 0)
  const profits = valid.filter((row) => row.type === 'PROFIT_SHARE')
  const last = profits.at(-1)
  return {
    principalBalance: sum('DEPOSIT') - sum('WITHDRAWAL'),
    totalDeposit: sum('DEPOSIT'),
    totalWithdrawal: sum('WITHDRAWAL'),
    totalProfitShared: sum('PROFIT_SHARE'),
    totalDividend: sum('DIVIDEND'),
    lastProfitShare: last ? { date: last.date, amount: last.amount } : null,
    joinedAt: valid[0]?.date ?? null,
  }
}
