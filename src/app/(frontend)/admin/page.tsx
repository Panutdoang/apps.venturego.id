import { redirect } from 'next/navigation'
import { AdminDashboard } from './admin-dashboard'
import { getFirebaseFirestore } from '@/lib/firebase-admin'
import { getStaffSession } from '@/lib/firebase-session'
import type { AdminPaymentRecord, FinancingApplicationRecord } from '@/lib/firebase-data'

export const dynamic = 'force-dynamic'

const toPlainValue = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') return value
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString()
  }
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(toPlainValue)
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      toPlainValue(entry),
    ]),
  )
}

export default async function AdminPage() {
  const staff = await getStaffSession()
  if (!staff) redirect('/')

  const db = getFirebaseFirestore()
  const [snapshot, paymentSnapshot] = await Promise.all([
    db.collection('applications').orderBy('createdAt', 'desc').limit(500).get(),
    db
      .collection('payments')
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get()
      .catch(() => null),
  ])
  const applications = snapshot.docs.map((document) => {
    const data = toPlainValue(document.data()) as Record<string, unknown>
    const createdAt = typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString()
    return {
      ...data,
      id: document.id,
      createdAt,
    } as FinancingApplicationRecord
  })

  const payments: AdminPaymentRecord[] = (paymentSnapshot?.docs ?? []).map((document) => {
    const data = toPlainValue(document.data()) as Record<string, unknown>
    return {
      id: document.id,
      applicationDocId: typeof data.applicationDocId === 'string' ? data.applicationDocId : '',
      applicationId: typeof data.applicationId === 'string' ? data.applicationId : '',
      type: data.type === 'CUSTOM' ? 'CUSTOM' : 'INSTALLMENT',
      installmentNumber: Number.isInteger(data.installmentNumber)
        ? (data.installmentNumber as number)
        : null,
      amount:
        typeof data.amount === 'number' && Number.isSafeInteger(data.amount) ? data.amount : 0,
      description: typeof data.description === 'string' ? data.description : '',
      status:
        data.status === 'PAID' || data.status === 'EXPIRED' || data.status === 'FAILED'
          ? data.status
          : 'PENDING',
      invoiceUrl: typeof data.invoiceUrl === 'string' ? data.invoiceUrl : null,
      paidAt: typeof data.paidAt === 'string' ? data.paidAt : null,
      paidMethod: typeof data.paidMethod === 'string' ? data.paidMethod : null,
      paidChannel: typeof data.paidChannel === 'string' ? data.paidChannel : null,
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
    }
  })

  return (
    <AdminDashboard email={staff.email ?? ''} applications={applications} payments={payments} />
  )
}
