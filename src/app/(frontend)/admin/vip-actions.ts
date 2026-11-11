'use server'

import { FieldValue } from 'firebase-admin/firestore'
import { getFirebaseFirestore } from '@/lib/firebase-admin'
import { getStaffSession } from '@/lib/firebase-session'
import {
  computeVipCache,
  isVipLedgerType,
  VIP_STATUSES,
  type VipLedgerRow,
  type VipLedgerType,
  type VipStatus,
} from '@/lib/vip'

export type AdminVipInvestor = {
  id: string
  displayName: string
  emails: string[]
  phone: string
  idCardNumber: string
  address: string
  bankName: string
  bankAccountNumber: string
  bankAccountName: string
  profitShareDay: number
  status: VipStatus
  notes: string
  linked: boolean
  principalBalance: number
  totalDeposit: number
  totalWithdrawal: number
  totalProfitShared: number
  totalDividend: number
  lastProfitShare: { date: string; amount: number } | null
  joinedAt: string | null
}

export type AdminVipLedgerItem = {
  id: string
  investorId: string
  date: string
  type: VipLedgerType
  amount: number
  note: string
  source: string
  createdBy: string
  voided: boolean
  voidReason: string
}

export type AdminVipInvestorInput = {
  id?: string
  displayName: string
  emails: string
  phone: string
  idCardNumber: string
  address: string
  bankName: string
  bankAccountNumber: string
  bankAccountName: string
  profitShareDay: number
  status: string
  notes: string
}

export type AdminVipTransactionInput = {
  investorId: string
  date: string
  type: string
  amount: number
  note: string
}

type Result<T = object> = ({ ok: true } & T) | { ok: false; message: string }

const YMD = /^\d{4}-\d{2}-\d{2}$/
const ID = /^[a-z0-9-]{2,40}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''
const money = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) ? value : 0
const validDate = (value: string) =>
  YMD.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)

const requireStaff = async () => {
  const staff = await getStaffSession()
  return staff ? (staff.email ?? staff.uid) : null
}

const writeAudit = (
  action: string,
  investorId: string,
  by: string,
  detail: Record<string, unknown>,
) =>
  getFirebaseFirestore().collection('vipAudit').add({
    action,
    investorId,
    by,
    detail,
    at: FieldValue.serverTimestamp(),
  })

// Hitung ulang cache saldo investor dari ledger (dipanggil setelah setiap perubahan ledger).
const refreshCache = async (investorId: string) => {
  const db = getFirebaseFirestore()
  const rows = await db.collection('vipLedger').where('investorId', '==', investorId).get()
  const cache = computeVipCache(rows.docs.map((entry) => entry.data() as VipLedgerRow))
  await db
    .collection('vipInvestors')
    .doc(investorId)
    .update({ ...cache, updatedAt: FieldValue.serverTimestamp() })
}

export async function listVipInvestors(): Promise<
  Result<{ investors: AdminVipInvestor[]; ledger: AdminVipLedgerItem[] }>
> {
  try {
    if (!(await requireStaff())) return { ok: false, message: 'Sesi staf berakhir.' }
    const db = getFirebaseFirestore()
    const [investorSnap, ledgerSnap] = await Promise.all([
      db.collection('vipInvestors').get(),
      db.collection('vipLedger').get(),
    ])
    const investors = investorSnap.docs
      .map((entry): AdminVipInvestor => {
        const d = entry.data()
        const last = d.lastProfitShare
        return {
          id: entry.id,
          displayName: text(d.displayName, 120),
          emails: Array.isArray(d.emails) ? d.emails.filter((e) => typeof e === 'string') : [],
          phone: text(d.phone, 40),
          idCardNumber: text(d.idCardNumber, 32),
          address: text(d.address, 300),
          bankName: text(d.bankName, 60),
          bankAccountNumber: text(d.bankAccountNumber, 40),
          bankAccountName: text(d.bankAccountName, 120),
          profitShareDay: Number.isInteger(d.profitShareDay) ? d.profitShareDay : 15,
          status: d.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
          notes: text(d.notes, 1000),
          linked: Boolean(d.ownerFirebaseUid),
          principalBalance: money(d.principalBalance),
          totalDeposit: money(d.totalDeposit),
          totalWithdrawal: money(d.totalWithdrawal),
          totalProfitShared: money(d.totalProfitShared),
          totalDividend: money(d.totalDividend),
          lastProfitShare:
            last && typeof last.date === 'string'
              ? { date: last.date, amount: money(last.amount) }
              : null,
          joinedAt: typeof d.joinedAt === 'string' ? d.joinedAt : null,
        }
      })
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
    const ledger = ledgerSnap.docs
      .flatMap((entry): AdminVipLedgerItem[] => {
        const d = entry.data()
        if (typeof d.date !== 'string' || !isVipLedgerType(d.type)) return []
        return [
          {
            id: entry.id,
            investorId: text(d.investorId, 40),
            date: d.date,
            type: d.type,
            amount: money(d.amount),
            note: text(d.note, 200),
            source: text(d.source, 40),
            createdBy: text(d.createdBy, 120),
            voided: Boolean(d.voidedAt),
            voidReason: text(d.voidReason, 300),
          },
        ]
      })
      .sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id))
    return { ok: true, investors, ledger }
  } catch {
    return { ok: false, message: 'Data VIP belum dapat dimuat.' }
  }
}

export async function saveVipInvestor(
  input: AdminVipInvestorInput,
): Promise<Result<{ id: string }>> {
  try {
    const by = await requireStaff()
    if (!by) return { ok: false, message: 'Sesi staf berakhir. Silakan masuk kembali.' }

    const displayName = text(input.displayName, 120)
    if (displayName.length < 2) return { ok: false, message: 'Nama mitra wajib diisi.' }
    const emails = [
      ...new Set(
        text(input.emails, 500)
          .split(/[\s,;]+/)
          .map((email) => email.toLowerCase())
          .filter(Boolean),
      ),
    ]
    if (emails.some((email) => !EMAIL.test(email)))
      return { ok: false, message: 'Format email tidak valid.' }
    const idCardNumber = text(input.idCardNumber, 32).replace(/\s/g, '')
    if (idCardNumber && !/^\d{16}$/.test(idCardNumber))
      return { ok: false, message: 'NIK harus 16 digit angka.' }
    const day = Number(input.profitShareDay)
    if (!Number.isInteger(day) || day < 1 || day > 28)
      return { ok: false, message: 'Tanggal bagi hasil harus 1–28.' }
    const status: VipStatus = (VIP_STATUSES as readonly string[]).includes(input.status)
      ? (input.status as VipStatus)
      : 'ACTIVE'

    const db = getFirebaseFirestore()
    // Email yang sama tidak boleh dipakai dua mitra (login dicocokkan lewat email).
    for (const email of emails) {
      const clash = await db
        .collection('vipInvestors')
        .where('emails', 'array-contains', email)
        .limit(2)
        .get()
      if (clash.docs.some((entry) => entry.id !== input.id))
        return { ok: false, message: `Email ${email} sudah dipakai mitra lain.` }
    }

    const profile = {
      displayName,
      emails,
      phone: text(input.phone, 40),
      idCardNumber,
      address: text(input.address, 300),
      bankName: text(input.bankName, 60),
      bankAccountNumber: text(input.bankAccountNumber, 40).replace(/\s/g, ''),
      bankAccountName: text(input.bankAccountName, 120),
      profitShareDay: day,
      status,
      notes: text(input.notes, 1000),
      updatedBy: by,
      updatedAt: FieldValue.serverTimestamp(),
    }

    if (input.id) {
      if (!ID.test(input.id)) return { ok: false, message: 'Mitra tidak valid.' }
      const ref = db.collection('vipInvestors').doc(input.id)
      if (!(await ref.get()).exists) return { ok: false, message: 'Mitra tidak ditemukan.' }
      await ref.update(profile)
      await writeAudit('UPDATE_PROFILE', input.id, by, { displayName, status })
      return { ok: true, id: input.id }
    }

    let id = slugify(displayName) || 'mitra'
    for (let n = 2; (await db.collection('vipInvestors').doc(id).get()).exists; n++) {
      id = `${slugify(displayName).slice(0, 28)}-${n}`
    }
    await db
      .collection('vipInvestors')
      .doc(id)
      .create({
        investorId: id,
        ...profile,
        ownerFirebaseUid: null,
        ...computeVipCache([]),
        source: 'ADMIN',
        createdBy: by,
        createdAt: FieldValue.serverTimestamp(),
      })
    await writeAudit('CREATE', id, by, { displayName })
    return { ok: true, id }
  } catch {
    return { ok: false, message: 'Data mitra belum dapat disimpan.' }
  }
}

export async function addVipTransaction(input: AdminVipTransactionInput): Promise<Result> {
  try {
    const by = await requireStaff()
    if (!by) return { ok: false, message: 'Sesi staf berakhir. Silakan masuk kembali.' }
    if (!ID.test(input.investorId)) return { ok: false, message: 'Mitra tidak valid.' }
    if (!isVipLedgerType(input.type)) return { ok: false, message: 'Jenis transaksi tidak valid.' }
    if (!validDate(input.date)) return { ok: false, message: 'Tanggal tidak valid.' }
    const amount = Number(input.amount)
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100_000_000_000)
      return { ok: false, message: 'Nominal harus bilangan bulat lebih dari 0.' }

    const db = getFirebaseFirestore()
    const investor = await db.collection('vipInvestors').doc(input.investorId).get()
    if (!investor.exists) return { ok: false, message: 'Mitra tidak ditemukan.' }
    if (input.type === 'WITHDRAWAL' && amount > money(investor.get('principalBalance')))
      return { ok: false, message: 'Penarikan melebihi saldo dana mitra.' }

    const ref = await db.collection('vipLedger').add({
      investorId: input.investorId,
      date: input.date,
      type: input.type,
      amount,
      note: text(input.note, 200),
      source: 'ADMIN',
      createdBy: by,
      createdAt: FieldValue.serverTimestamp(),
    })
    await refreshCache(input.investorId)
    await writeAudit('ADD_TRANSACTION', input.investorId, by, {
      ledgerId: ref.id,
      type: input.type,
      date: input.date,
      amount,
    })
    return { ok: true }
  } catch {
    return { ok: false, message: 'Transaksi belum dapat dicatat.' }
  }
}

// Ledger tidak dihapus: baris yang salah ditandai batal beserta alasannya.
export async function voidVipTransaction(ledgerId: string, reason: string): Promise<Result> {
  try {
    const by = await requireStaff()
    if (!by) return { ok: false, message: 'Sesi staf berakhir. Silakan masuk kembali.' }
    if (!/^[A-Za-z0-9_-]{1,160}$/.test(ledgerId))
      return { ok: false, message: 'Transaksi tidak valid.' }
    const voidReason = text(reason, 300)
    if (voidReason.length < 3) return { ok: false, message: 'Alasan pembatalan wajib diisi.' }

    const ref = getFirebaseFirestore().collection('vipLedger').doc(ledgerId)
    const snapshot = await ref.get()
    if (!snapshot.exists) return { ok: false, message: 'Transaksi tidak ditemukan.' }
    if (snapshot.get('voidedAt')) return { ok: false, message: 'Transaksi sudah dibatalkan.' }
    await ref.update({ voidedAt: FieldValue.serverTimestamp(), voidedBy: by, voidReason })
    const investorId = String(snapshot.get('investorId'))
    await refreshCache(investorId)
    await writeAudit('VOID_TRANSACTION', investorId, by, { ledgerId, reason: voidReason })
    return { ok: true }
  } catch {
    return { ok: false, message: 'Transaksi belum dapat dibatalkan.' }
  }
}
