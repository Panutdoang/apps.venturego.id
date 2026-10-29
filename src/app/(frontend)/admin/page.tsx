import { AdminDashboard } from './admin-dashboard'
import { AdminSignIn } from './admin-sign-in'
import { getFirebaseFirestore } from '@/lib/firebase-admin'
import { getStaffSession } from '@/lib/firebase-session'
import type { FinancingApplicationRecord } from '@/lib/firebase-data'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const staff = await getStaffSession()
  if (!staff) return <AdminSignIn />

  const snapshot = await getFirebaseFirestore()
    .collection('applications')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get()
  const applications = snapshot.docs.map((document) => {
    const data = document.data()
    const createdAt = data.createdAt?.toDate?.() ?? new Date()
    return {
      ...data,
      id: document.id,
      createdAt: createdAt.toISOString(),
    } as FinancingApplicationRecord
  })

  return <AdminDashboard email={staff.email ?? ''} applications={applications} />
}
