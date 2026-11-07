'use server'

import { headers } from 'next/headers'
import { FieldValue } from 'firebase-admin/firestore'
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase-admin'
import { isAllowedSignInProvider } from '@/lib/auth-shared'
import { createXenditInvoice } from '@/lib/xendit'

export type PaymentStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED'

export type PaymentRecord = {
  id: string
  applicationDocId: string
  type: 'INSTALLMENT' | 'CUSTOM'
  installmentNumber: number | null
  amount: number
  description: string
  status: PaymentStatus
  invoiceUrl: string | null
  paidAt: string | null
  paidMethod: string | null
}

export type PaymentScheduleEntry = {
  installment: number
  dueDate: string
  amount: number
  paid: boolean
}

export type PaymentApplication = {
  id: string
  applicationId: string
  applicantName: string
  status: string
  schedule: PaymentScheduleEntry[] | null
}

export type PaymentOverviewResult =
  | { ok: true; applications: PaymentApplication[]; payments: PaymentRecord[] }
  | { ok: false; message: string }

export type CreatePaymentResult = { ok: true; invoiceUrl: string } | { ok: false; message: string }

const isGoogleIdentity = async (token: string) => {
  if (!token || token.length > 10_000) return null
  const identity = await getFirebaseAuth().verifyIdToken(token)
  return isAllowedSignInProvider(identity.firebase?.sign_in_provider) ? identity : null
}

const readPaidSet = (value: unknown): Set<number> =>
  new Set(
    Array.isArray(value)
      ? value.filter((entry): entry is number => Number.isInteger(entry) && entry > 0)
      : [],
  )

const readSchedule = (value: unknown, paid: Set<number>): PaymentScheduleEntry[] | null => {
  if (!Array.isArray(value) || value.length === 0) return null
  const entries: PaymentScheduleEntry[] = []
  for (const item of value) {
    if (
      !item ||
      typeof item !== 'object' ||
      !Number.isInteger((item as { installment?: unknown }).installment) ||
      typeof (item as { dueDate?: unknown }).dueDate !== 'string' ||
      typeof (item as { amount?: unknown }).amount !== 'number'
    ) {
      continue
    }
    const installment = (item as { installment: number }).installment
    const dueDate = (item as { dueDate: string }).dueDate
    const amount = (item as { amount: number }).amount
    if (installment < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isSafeInteger(amount)) {
      continue
    }
    entries.push({ installment, dueDate, amount, paid: paid.has(installment) })
  }
  return entries.length > 0 ? entries : null
}

const readPaymentRecord = (id: string, data: Record<string, unknown>): PaymentRecord => ({
  id,
  applicationDocId: typeof data.applicationDocId === 'string' ? data.applicationDocId : '',
  type: data.type === 'CUSTOM' ? 'CUSTOM' : 'INSTALLMENT',
  installmentNumber: Number.isInteger(data.installmentNumber)
    ? (data.installmentNumber as number)
    : null,
  amount: typeof data.amount === 'number' && Number.isSafeInteger(data.amount) ? data.amount : 0,
  description: typeof data.description === 'string' ? data.description : '',
  status:
    data.status === 'PAID' || data.status === 'EXPIRED' || data.status === 'FAILED'
      ? data.status
      : 'PENDING',
  invoiceUrl: typeof data.invoiceUrl === 'string' ? data.invoiceUrl : null,
  paidAt: typeof data.paidAt === 'string' ? data.paidAt : null,
  paidMethod: typeof data.paidMethod === 'string' ? data.paidMethod : null,
})

const getReturnUrl = async () => {
  const origin = (await headers()).get('origin')
  if (origin) {
    try {
      return `${new URL(origin).origin}/dashboard/pembayaran`
    } catch {
      // fall through to the configured site URL
    }
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (siteUrl) {
    try {
      return `${new URL(siteUrl).origin}/dashboard/pembayaran`
    } catch {
      // fall through to the relative path
    }
  }
  return '/dashboard/pembayaran'
}

export async function getPaymentOverview(token: string): Promise<PaymentOverviewResult> {
  try {
    const identity = await isGoogleIdentity(token)
    if (!identity) return { ok: false, message: 'Sesi telah berakhir. Silakan masuk kembali.' }

    const db = getFirebaseFirestore()
    const [applicationSnapshot, paymentSnapshot] = await Promise.all([
      db.collection('applications').where('ownerFirebaseUid', '==', identity.uid).get(),
      db.collection('payments').where('ownerFirebaseUid', '==', identity.uid).limit(20).get(),
    ])

    const applications = applicationSnapshot.docs.flatMap((document) => {
      const data = document.data()
      if (typeof data.applicantName !== 'string' || typeof data.applicationId !== 'string') {
        return []
      }
      const paid = readPaidSet(data.paidInstallments)
      const schedule =
        data.financialPlan && typeof data.financialPlan === 'object'
          ? readSchedule((data.financialPlan as Record<string, unknown>).schedule, paid)
          : null
      return [
        {
          id: document.id,
          applicationId: data.applicationId,
          applicantName: data.applicantName,
          status: typeof data.status === 'string' ? data.status : 'SUBMITTED',
          schedule,
        },
      ]
    })

    const payments = paymentSnapshot.docs
      .map((document) => {
        const data = document.data()
        return {
          record: readPaymentRecord(document.id, data),
          createdAt:
            data.createdAt && typeof data.createdAt.toMillis === 'function'
              ? data.createdAt.toMillis()
              : 0,
        }
      })
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((entry) => entry.record)

    return { ok: true, applications, payments }
  } catch {
    return { ok: false, message: 'Riwayat pembayaran belum dapat dimuat. Silakan coba lagi.' }
  }
}

const issueInvoice = async (params: {
  paymentDocId: string
  amount: number
  description: string
}): Promise<CreatePaymentResult> => {
  const returnUrl = await getReturnUrl()
  const invoice = await createXenditInvoice({
    externalId: params.paymentDocId,
    amount: params.amount,
    description: params.description,
    returnUrl,
  })
  if (!invoice.ok) return { ok: false, message: invoice.message }

  const db = getFirebaseFirestore()
  await db
    .collection('payments')
    .doc(params.paymentDocId)
    .update({
      invoiceId: invoice.invoiceId,
      invoiceUrl: invoice.invoiceUrl,
      expiresAt: invoice.expiryDate ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    })
  return { ok: true, invoiceUrl: invoice.invoiceUrl }
}

const findReusablePendingPayment = async (
  applicationDocId: string,
  installmentNumber: number,
): Promise<{ id: string; invoiceUrl: string | null } | null> => {
  const db = getFirebaseFirestore()
  const snapshot = await db
    .collection('payments')
    .where('applicationDocId', '==', applicationDocId)
    .where('installmentNumber', '==', installmentNumber)
    .where('status', '==', 'PENDING')
    .limit(5)
    .get()
  const now = Date.now()
  for (const document of snapshot.docs) {
    const data = document.data()
    const expiresAt = typeof data.expiresAt === 'string' ? Date.parse(data.expiresAt) : NaN
    if (Number.isFinite(expiresAt) && expiresAt <= now) {
      await document.ref.update({
        status: 'EXPIRED',
        updatedAt: FieldValue.serverTimestamp(),
      })
      continue
    }
    return {
      id: document.id,
      invoiceUrl: typeof data.invoiceUrl === 'string' ? data.invoiceUrl : null,
    }
  }
  return null
}

export async function createInstallmentPayment(
  token: string,
  applicationDocId: string,
  installmentNumber: number,
): Promise<CreatePaymentResult> {
  try {
    const identity = await isGoogleIdentity(token)
    if (!identity) return { ok: false, message: 'Sesi telah berakhir. Silakan masuk kembali.' }
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(applicationDocId)) {
      return { ok: false, message: 'Pengajuan tidak valid.' }
    }
    if (!Number.isInteger(installmentNumber) || installmentNumber < 1 || installmentNumber > 36) {
      return { ok: false, message: 'Nomor angsuran tidak valid.' }
    }

    const db = getFirebaseFirestore()
    const applicationRef = db.collection('applications').doc(applicationDocId)
    const application = await applicationRef.get()
    const data = application.data()
    if (
      !application.exists ||
      data?.ownerFirebaseUid !== identity.uid ||
      ['CANCELLED', 'REJECTED'].includes(String(data?.status))
    ) {
      return { ok: false, message: 'Pengajuan tidak dapat dibayar.' }
    }

    const paid = readPaidSet(data?.paidInstallments)
    if (paid.has(installmentNumber)) {
      return { ok: false, message: 'Angsuran ini sudah lunas.' }
    }
    const schedule = readSchedule(
      data?.financialPlan && typeof data.financialPlan === 'object'
        ? (data.financialPlan as Record<string, unknown>).schedule
        : null,
      paid,
    )
    const entry = schedule?.find((item) => item.installment === installmentNumber)
    if (!entry) {
      return { ok: false, message: 'Jadwal angsuran ini tidak ditemukan.' }
    }

    const existing = await findReusablePendingPayment(applicationDocId, installmentNumber)
    const description = `Angsuran ke-${installmentNumber} · ${data?.applicationId ?? ''}`.trim()
    if (existing?.invoiceUrl) return { ok: true, invoiceUrl: existing.invoiceUrl }

    let paymentDocId = existing?.id
    if (!paymentDocId) {
      const paymentRef = db.collection('payments').doc()
      paymentDocId = paymentRef.id
      await paymentRef.set({
        externalId: paymentRef.id,
        applicationDocId,
        applicationId: typeof data?.applicationId === 'string' ? data.applicationId : '',
        ownerFirebaseUid: identity.uid,
        type: 'INSTALLMENT',
        installmentNumber,
        amount: entry.amount,
        description,
        status: 'PENDING',
        invoiceId: null,
        invoiceUrl: null,
        expiresAt: null,
        paidAt: null,
        paidMethod: null,
        paidChannel: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
    }
    return await issueInvoice({
      paymentDocId,
      amount: entry.amount,
      description,
    })
  } catch {
    return { ok: false, message: 'Pembayaran belum dapat diproses. Silakan coba lagi.' }
  }
}

export async function createCustomPayment(
  token: string,
  applicationDocId: string,
  amount: number,
): Promise<CreatePaymentResult> {
  try {
    const identity = await isGoogleIdentity(token)
    if (!identity) return { ok: false, message: 'Sesi telah berakhir. Silakan masuk kembali.' }
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(applicationDocId)) {
      return { ok: false, message: 'Pengajuan tidak valid.' }
    }
    if (!Number.isSafeInteger(amount) || amount < 1_000 || amount > 100_000_000) {
      return {
        ok: false,
        message: 'Nominal pembayaran minimal Rp1.000 dan maksimal Rp100.000.000.',
      }
    }

    const db = getFirebaseFirestore()
    const applicationRef = db.collection('applications').doc(applicationDocId)
    const application = await applicationRef.get()
    const data = application.data()
    if (
      !application.exists ||
      data?.ownerFirebaseUid !== identity.uid ||
      ['CANCELLED', 'REJECTED'].includes(String(data?.status))
    ) {
      return { ok: false, message: 'Pengajuan tidak dapat dibayar.' }
    }

    const description = `Pembayaran sukarela · ${data?.applicationId ?? ''}`.trim()
    const paymentRef = db.collection('payments').doc()
    await paymentRef.set({
      externalId: paymentRef.id,
      applicationDocId,
      applicationId: typeof data?.applicationId === 'string' ? data.applicationId : '',
      ownerFirebaseUid: identity.uid,
      type: 'CUSTOM',
      installmentNumber: null,
      amount,
      description,
      status: 'PENDING',
      invoiceId: null,
      invoiceUrl: null,
      expiresAt: null,
      paidAt: null,
      paidMethod: null,
      paidChannel: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    return await issueInvoice({ paymentDocId: paymentRef.id, amount, description })
  } catch {
    return { ok: false, message: 'Pembayaran belum dapat diproses. Silakan coba lagi.' }
  }
}
