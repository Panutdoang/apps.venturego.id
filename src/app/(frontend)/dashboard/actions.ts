'use server'

import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase-admin'
import { isAllowedSignInProvider } from '@/lib/auth-shared'

export type DashboardScheduleSummary = {
  total: number
  dueByToday: number
  nextDueDate: string | null
  nextDueAmount: number | null
}

export type DashboardApplication = {
  id: string
  applicationId: string
  product: 'FULL_COVER' | 'DEPARTURE_BRIDGING'
  applicantName: string
  status: string
  pricingStatus: string
  requestedFinancingAmount: number | null
  totalObligation: number | null
  schedule: DashboardScheduleSummary | null
  documentsUploaded: number
  documentsTotal: number
  createdAt: number | null
}

export type DashboardSummaryResult =
  | { ok: true; application: DashboardApplication | null }
  | { ok: false; message: string }

const isGoogleIdentity = async (token: string) => {
  if (!token || token.length > 10_000) return null
  const identity = await getFirebaseAuth().verifyIdToken(token)
  return isAllowedSignInProvider(identity.firebase?.sign_in_provider) ? identity : null
}

const readCount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null

const readSchedule = (value: unknown): DashboardScheduleSummary | null => {
  if (!Array.isArray(value) || value.length === 0) return null
  const today = new Date().toISOString().slice(0, 10)
  let total = 0
  let dueByToday = 0
  let nextDueDate: string | null = null
  let nextDueAmount: number | null = null
  for (const entry of value) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof (entry as { dueDate?: unknown }).dueDate !== 'string' ||
      typeof (entry as { amount?: unknown }).amount !== 'number'
    ) {
      continue
    }
    const dueDate = (entry as { dueDate: string }).dueDate
    const amount = (entry as { amount: number }).amount
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isSafeInteger(amount)) continue
    total += 1
    if (dueDate <= today) {
      dueByToday += 1
    } else if (nextDueDate === null) {
      nextDueDate = dueDate
      nextDueAmount = amount
    }
  }
  if (total === 0) return null
  return { total, dueByToday, nextDueDate, nextDueAmount }
}

export async function getDashboardSummary(token: string): Promise<DashboardSummaryResult> {
  try {
    const identity = await isGoogleIdentity(token)
    if (!identity) return { ok: false, message: 'Sesi telah berakhir. Silakan masuk kembali.' }

    const snapshot = await getFirebaseFirestore()
      .collection('applications')
      .where('ownerFirebaseUid', '==', identity.uid)
      .get()

    const applications = snapshot.docs.flatMap((document) => {
      const data = document.data()
      if (typeof data.applicantName !== 'string' || typeof data.applicationId !== 'string') {
        return []
      }
      const createdAt =
        data.createdAt && typeof data.createdAt.toMillis === 'function'
          ? data.createdAt.toMillis()
          : null
      const financialPlan =
        data.financialPlan && typeof data.financialPlan === 'object' ? data.financialPlan : {}
      const departureDetails =
        data.departureDetails && typeof data.departureDetails === 'object'
          ? data.departureDetails
          : null
      const documents = Array.isArray(data.documents) ? data.documents : []
      const application: DashboardApplication = {
        id: document.id,
        applicationId: data.applicationId,
        product: data.product === 'FULL_COVER' ? 'FULL_COVER' : 'DEPARTURE_BRIDGING',
        applicantName: data.applicantName,
        status: typeof data.status === 'string' ? data.status : 'SUBMITTED',
        pricingStatus:
          typeof financialPlan.pricingStatus === 'string'
            ? financialPlan.pricingStatus
            : 'ESTIMATED',
        requestedFinancingAmount: departureDetails
          ? readCount(departureDetails.requestedFinancingAmount)
          : null,
        totalObligation: readCount(financialPlan.totalObligation),
        schedule: readSchedule(financialPlan.schedule),
        documentsUploaded: documents.filter(
          (document) =>
            document &&
            typeof document === 'object' &&
            (document as { status?: unknown }).status !== 'NOT_UPLOADED',
        ).length,
        documentsTotal: documents.length,
        createdAt,
      }
      return [application]
    })

    applications.sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0))
    return { ok: true, application: applications[0] ?? null }
  } catch {
    return { ok: false, message: 'Ringkasan dashboard belum dapat dimuat. Silakan coba lagi.' }
  }
}
