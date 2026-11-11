'use server'

import { FieldValue, type DocumentSnapshot } from 'firebase-admin/firestore'
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase-admin'
import { isAllowedSignInProvider } from '@/lib/auth-shared'

// Data VIP (Vworks Investment Partner):
//   vipInvestors/{investorId}  — profil mitra + saldo cache (principalBalance, totalProfitShared, …)
//   vipLedger/{autoId}         — buku besar DEPOSIT / WITHDRAWAL / PROFIT_SHARE / DIVIDEND
// Poin: pointLedger/{autoId} { ownerFirebaseUid, amount (± rupiah), … } — saldo = jumlah amount.
// Semua dibaca lewat Admin SDK (Firestore tetap deny-all).

export type VipLedgerType = 'DEPOSIT' | 'WITHDRAWAL' | 'PROFIT_SHARE' | 'DIVIDEND'

export type VipSummary = {
  displayName: string
  status: string
  principalBalance: number
  totalProfitShared: number
  totalDividend: number
  lastProfitShare: { date: string; amount: number } | null
  profitShareDay: number
  nextProfitShareDate: string
  joinedAt: string | null
}

export type VipLedgerItem = {
  id: string
  date: string
  type: VipLedgerType
  amount: number
  note: string
}

export type WalletSummaryResult =
  | { ok: true; vip: VipSummary | null; points: number }
  | { ok: false; message: string }

export type VipDetailResult =
  | { ok: true; vip: VipSummary | null; ledger: VipLedgerItem[] }
  | { ok: false; message: string }

const LEDGER_TYPES: VipLedgerType[] = ['DEPOSIT', 'WITHDRAWAL', 'PROFIT_SHARE', 'DIVIDEND']
const YMD = /^\d{4}-\d{2}-\d{2}$/

const verifyUserIdentity = async (token: string) => {
  if (!token || token.length > 10_000) return null
  const identity = await getFirebaseAuth().verifyIdToken(token)
  return isAllowedSignInProvider(identity.firebase?.sign_in_provider) ? identity : null
}

const readMoney = (value: unknown): number =>
  typeof value === 'number' && Number.isSafeInteger(value) ? value : 0

// Tanggal bagi hasil berikutnya (tiap tanggal `day`, zona WIB).
const nextProfitShareDate = (day: number) => {
  const now = new Date(Date.now() + 7 * 3_600_000)
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const target =
    now.getUTCDate() <= day ? Date.UTC(year, month, day) : Date.UTC(year, month + 1, day)
  return new Date(target).toISOString().slice(0, 10)
}

const toSummary = (snapshot: DocumentSnapshot): VipSummary | null => {
  const data = snapshot.data()
  if (!data || typeof data.displayName !== 'string') return null
  const day =
    Number.isInteger(data.profitShareDay) && data.profitShareDay >= 1 && data.profitShareDay <= 28
      ? data.profitShareDay
      : 15
  const last = data.lastProfitShare
  return {
    displayName: data.displayName,
    status: typeof data.status === 'string' ? data.status : 'ACTIVE',
    principalBalance: readMoney(data.principalBalance),
    totalProfitShared: readMoney(data.totalProfitShared),
    totalDividend: readMoney(data.totalDividend),
    lastProfitShare:
      last && typeof last.date === 'string' && YMD.test(last.date)
        ? { date: last.date, amount: readMoney(last.amount) }
        : null,
    profitShareDay: day,
    nextProfitShareDate: nextProfitShareDate(day),
    joinedAt: typeof data.joinedAt === 'string' && YMD.test(data.joinedAt) ? data.joinedAt : null,
  }
}

// Cari mitra VIP milik akun ini: lewat UID, atau lewat email Google terverifikasi yang
// terdaftar di `emails` (lalu UID-nya dikaitkan agar berikutnya cukup lewat UID).
const findInvestor = async (identity: Awaited<ReturnType<typeof verifyUserIdentity>>) => {
  if (!identity) return null
  const investors = getFirebaseFirestore().collection('vipInvestors')
  const byUid = await investors.where('ownerFirebaseUid', '==', identity.uid).limit(1).get()
  if (!byUid.empty) return byUid.docs[0]

  const email = identity.email_verified ? identity.email?.trim().toLowerCase() : undefined
  if (!email) return null
  const byEmail = await investors.where('emails', 'array-contains', email).limit(1).get()
  if (byEmail.empty) return null
  const snapshot = byEmail.docs[0]
  if (!snapshot.get('ownerFirebaseUid')) {
    await snapshot.ref.update({
      ownerFirebaseUid: identity.uid,
      claimedAt: FieldValue.serverTimestamp(),
    })
  }
  return snapshot
}

const readPoints = async (uid: string) => {
  const snapshot = await getFirebaseFirestore()
    .collection('pointLedger')
    .where('ownerFirebaseUid', '==', uid)
    .get()
  return snapshot.docs.reduce((total, entry) => total + readMoney(entry.get('amount')), 0)
}

export async function getWalletSummary(token: string): Promise<WalletSummaryResult> {
  try {
    const identity = await verifyUserIdentity(token)
    if (!identity) return { ok: false, message: 'Sesi telah berakhir. Silakan masuk kembali.' }
    const [investor, points] = await Promise.all([findInvestor(identity), readPoints(identity.uid)])
    return { ok: true, vip: investor ? toSummary(investor) : null, points }
  } catch {
    return { ok: false, message: 'Saldo belum dapat dimuat.' }
  }
}

export async function getVipDetail(token: string): Promise<VipDetailResult> {
  try {
    const identity = await verifyUserIdentity(token)
    if (!identity) return { ok: false, message: 'Sesi telah berakhir. Silakan masuk kembali.' }
    const investor = await findInvestor(identity)
    if (!investor) return { ok: true, vip: null, ledger: [] }

    const snapshot = await getFirebaseFirestore()
      .collection('vipLedger')
      .where('investorId', '==', investor.id)
      .get()
    const ledger = snapshot.docs
      .flatMap((entry): VipLedgerItem[] => {
        const data = entry.data()
        if (typeof data.date !== 'string' || !YMD.test(data.date)) return []
        if (!LEDGER_TYPES.includes(data.type)) return []
        return [
          {
            id: entry.id,
            date: data.date,
            type: data.type,
            amount: readMoney(data.amount),
            note: typeof data.note === 'string' ? data.note : '',
          },
        ]
      })
      .sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id))
    return { ok: true, vip: toSummary(investor), ledger }
  } catch {
    return { ok: false, message: 'Data VIP belum dapat dimuat. Silakan coba lagi.' }
  }
}
