'use server'

import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase-admin'
import { isAllowedSignInProvider } from '@/lib/auth-shared'

export type DashboardScheduleSummary = {
  total: number
  dueByToday: number
  paidCount: number
  paidAmount: number
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
  documentsVerified: number
  documentsRevision: number
  documentsTotal: number
  createdAt: number | null
}

export type DashboardSummaryResult =
  | { ok: true; application: DashboardApplication | null }
  | { ok: false; message: string }

export type UserDocumentItem = {
  documentType: string
  status: 'NOT_UPLOADED' | 'UPLOADED' | 'VERIFIED' | 'REVISION_REQUIRED'
  fileName: string | null
  size: number | null
}

export type UserScheduleItem = {
  installment: number
  dueDate: string
  amount: number
  paid: boolean
}

export type UserApplicationDetail = {
  id: string
  applicationId: string
  product: 'FULL_COVER' | 'DEPARTURE_BRIDGING'
  applicantName: string
  phone: string
  lpkName: string
  destination: 'JAPAN' | 'TURKEY'
  status: string
  pricingStatus: string
  requestedFinancingAmount: number | null
  totalObligation: number | null
  finalAgreementReference: string | null
  acceptedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  personalDetails: {
    birthPlace: string
    birthDate: string
    gender: string
    religion: string
    idCardAddress: string
    domicileAddress: string
    domicilePostalCode: string
  }
  documents: UserDocumentItem[]
  schedule: UserScheduleItem[]
  supportRequests: {
    message: string
    requestedAt: string
    status: 'OPEN' | 'REVIEWED'
    response: string | null
  }[]
}

export type UserPaymentItem = {
  id: string
  applicationDocId: string
  applicationId: string
  type: 'INSTALLMENT' | 'CUSTOM'
  installmentNumber: number | null
  amount: number
  description: string
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED'
  invoiceUrl: string | null
  paidAt: string | null
  paidMethod: string | null
  createdAt: string | null
}

export type UserActivityFeedResult =
  | {
      ok: true
      applications: UserApplicationDetail[]
      payments: UserPaymentItem[]
    }
  | { ok: false; message: string }

const verifyUserIdentity = async (token: string) => {
  if (!token || token.length > 10_000) return null
  const identity = await getFirebaseAuth().verifyIdToken(token)
  return isAllowedSignInProvider(identity.firebase?.sign_in_provider) ? identity : null
}

const readCount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null

const readPaidSet = (value: unknown): Set<number> =>
  new Set(
    Array.isArray(value)
      ? value.filter((entry): entry is number => Number.isInteger(entry) && entry > 0)
      : [],
  )

const readScheduleSummary = (
  value: unknown,
  paidSet: Set<number>,
): DashboardScheduleSummary | null => {
  if (!Array.isArray(value) || value.length === 0) return null
  const today = new Date().toISOString().slice(0, 10)
  let total = 0
  let dueByToday = 0
  let paidCount = 0
  let paidAmount = 0
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
    const installment = Number((entry as { installment?: unknown }).installment)
    const dueDate = (entry as { dueDate: string }).dueDate
    const amount = (entry as { amount: number }).amount
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isSafeInteger(amount)) continue
    total += 1
    const isPaid = Number.isInteger(installment) && paidSet.has(installment)
    if (isPaid) {
      paidCount += 1
      paidAmount += amount
    }
    if (dueDate <= today) {
      dueByToday += 1
    }
    if (!isPaid && nextDueDate === null) {
      nextDueDate = dueDate
      nextDueAmount = amount
    }
  }
  if (total === 0) return null
  return { total, dueByToday, paidCount, paidAmount, nextDueDate, nextDueAmount }
}

const readTimestampIso = (value: unknown): string | null => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString()
  }
  return null
}

const readTimestampMillis = (value: unknown): number | null => {
  if (!value) return null
  if (typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis()
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export async function getDashboardSummary(token: string): Promise<DashboardSummaryResult> {
  try {
    const identity = await verifyUserIdentity(token)
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
      const createdAt = readTimestampMillis(data.createdAt)
      const financialPlan =
        data.financialPlan && typeof data.financialPlan === 'object' ? data.financialPlan : {}
      const departureDetails =
        data.departureDetails && typeof data.departureDetails === 'object'
          ? data.departureDetails
          : null
      const documents = Array.isArray(data.documents) ? data.documents : []
      const paidSet = readPaidSet(data.paidInstallments)

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
        schedule: readScheduleSummary(financialPlan.schedule, paidSet),
        documentsUploaded: documents.filter(
          (doc) =>
            doc &&
            typeof doc === 'object' &&
            (doc as { status?: unknown }).status !== 'NOT_UPLOADED',
        ).length,
        documentsVerified: documents.filter(
          (doc) =>
            doc && typeof doc === 'object' && (doc as { status?: unknown }).status === 'VERIFIED',
        ).length,
        documentsRevision: documents.filter(
          (doc) =>
            doc &&
            typeof doc === 'object' &&
            (doc as { status?: unknown }).status === 'REVISION_REQUIRED',
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

export async function getUserActivityFeed(token: string): Promise<UserActivityFeedResult> {
  try {
    const identity = await verifyUserIdentity(token)
    if (!identity) return { ok: false, message: 'Sesi telah berakhir. Silakan masuk kembali.' }

    const db = getFirebaseFirestore()
    const [appSnapshot, paymentSnapshot] = await Promise.all([
      db.collection('applications').where('ownerFirebaseUid', '==', identity.uid).get(),
      db.collection('payments').where('ownerFirebaseUid', '==', identity.uid).limit(50).get(),
    ])

    const applications: UserApplicationDetail[] = appSnapshot.docs
      .flatMap((document) => {
        const data = document.data()
        if (typeof data.applicantName !== 'string' || typeof data.applicationId !== 'string') {
          return []
        }
        const financialPlan =
          data.financialPlan && typeof data.financialPlan === 'object'
            ? (data.financialPlan as Record<string, unknown>)
            : {}
        const departureDetails =
          data.departureDetails && typeof data.departureDetails === 'object'
            ? (data.departureDetails as Record<string, unknown>)
            : null
        const personal =
          data.personalDetails && typeof data.personalDetails === 'object'
            ? (data.personalDetails as Record<string, unknown>)
            : {}
        const paidSet = readPaidSet(data.paidInstallments)

        const rawDocs = Array.isArray(data.documents) ? data.documents : []
        const documents: UserDocumentItem[] = rawDocs.flatMap((doc) => {
          if (!doc || typeof doc !== 'object') return []
          const item = doc as Record<string, unknown>
          if (typeof item.documentType !== 'string') return []
          const rawStatus = String(item.status ?? 'NOT_UPLOADED')
          const status: UserDocumentItem['status'] =
            rawStatus === 'UPLOADED' ||
            rawStatus === 'VERIFIED' ||
            rawStatus === 'REVISION_REQUIRED'
              ? rawStatus
              : 'NOT_UPLOADED'
          return [
            {
              documentType: item.documentType,
              status,
              fileName: typeof item.fileName === 'string' ? item.fileName : null,
              size: typeof item.size === 'number' && Number.isFinite(item.size) ? item.size : null,
            },
          ]
        })

        const rawSchedule = Array.isArray(financialPlan.schedule) ? financialPlan.schedule : []
        const schedule: UserScheduleItem[] = rawSchedule.flatMap((entry) => {
          if (!entry || typeof entry !== 'object') return []
          const item = entry as Record<string, unknown>
          const installment = Number(item.installment)
          const dueDate = typeof item.dueDate === 'string' ? item.dueDate : ''
          const amount = Number(item.amount)
          if (
            !Number.isInteger(installment) ||
            installment < 1 ||
            !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
            !Number.isSafeInteger(amount)
          ) {
            return []
          }
          return [{ installment, dueDate, amount, paid: paidSet.has(installment) }]
        })

        const rawSupport = Array.isArray(data.supportRequests) ? data.supportRequests : []
        const supportRequests = rawSupport.flatMap((req) => {
          if (!req || typeof req !== 'object') return []
          const item = req as Record<string, unknown>
          if (typeof item.message !== 'string' || typeof item.requestedAt !== 'string') return []
          return [
            {
              message: item.message,
              requestedAt: item.requestedAt,
              status: item.status === 'REVIEWED' ? ('REVIEWED' as const) : ('OPEN' as const),
              response: typeof item.response === 'string' && item.response ? item.response : null,
            },
          ]
        })

        const acceptance =
          data.userFinancingAcceptance &&
          typeof data.userFinancingAcceptance === 'object' &&
          typeof (data.userFinancingAcceptance as { acceptedAt?: unknown }).acceptedAt === 'string'
            ? String((data.userFinancingAcceptance as { acceptedAt: string }).acceptedAt)
            : null

        const detail: UserApplicationDetail = {
          id: document.id,
          applicationId: data.applicationId,
          product: data.product === 'FULL_COVER' ? 'FULL_COVER' : 'DEPARTURE_BRIDGING',
          applicantName: data.applicantName,
          phone: typeof data.phone === 'string' ? data.phone : '',
          lpkName: typeof data.lpkName === 'string' ? data.lpkName : '',
          destination: data.destination === 'TURKEY' ? 'TURKEY' : 'JAPAN',
          status: typeof data.status === 'string' ? data.status : 'SUBMITTED',
          pricingStatus:
            typeof financialPlan.pricingStatus === 'string'
              ? financialPlan.pricingStatus
              : 'ESTIMATED',
          requestedFinancingAmount: departureDetails
            ? readCount(departureDetails.requestedFinancingAmount)
            : null,
          totalObligation: readCount(financialPlan.totalObligation),
          finalAgreementReference:
            typeof financialPlan.finalAgreementReference === 'string' &&
            financialPlan.finalAgreementReference
              ? financialPlan.finalAgreementReference
              : null,
          acceptedAt: acceptance,
          createdAt: readTimestampIso(data.createdAt),
          updatedAt: readTimestampIso(data.updatedAt),
          personalDetails: {
            birthPlace: typeof personal.birthPlace === 'string' ? personal.birthPlace : '',
            birthDate: typeof personal.birthDate === 'string' ? personal.birthDate : '',
            gender: typeof personal.gender === 'string' ? personal.gender : '',
            religion: typeof personal.religion === 'string' ? personal.religion : '',
            idCardAddress: typeof personal.idCardAddress === 'string' ? personal.idCardAddress : '',
            domicileAddress:
              typeof personal.domicileAddress === 'string' ? personal.domicileAddress : '',
            domicilePostalCode:
              typeof personal.domicilePostalCode === 'string' ? personal.domicilePostalCode : '',
          },
          documents,
          schedule,
          supportRequests,
        }
        return [detail]
      })
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))

    const payments: UserPaymentItem[] = paymentSnapshot.docs
      .map((document) => {
        const data = document.data()
        return {
          id: document.id,
          applicationDocId: typeof data.applicationDocId === 'string' ? data.applicationDocId : '',
          applicationId: typeof data.applicationId === 'string' ? data.applicationId : '',
          type: data.type === 'CUSTOM' ? ('CUSTOM' as const) : ('INSTALLMENT' as const),
          installmentNumber: Number.isInteger(data.installmentNumber)
            ? (data.installmentNumber as number)
            : null,
          amount:
            typeof data.amount === 'number' && Number.isSafeInteger(data.amount) ? data.amount : 0,
          description: typeof data.description === 'string' ? data.description : '',
          status:
            data.status === 'PAID' || data.status === 'EXPIRED' || data.status === 'FAILED'
              ? (data.status as 'PAID' | 'EXPIRED' | 'FAILED')
              : ('PENDING' as const),
          invoiceUrl: typeof data.invoiceUrl === 'string' ? data.invoiceUrl : null,
          paidAt: typeof data.paidAt === 'string' ? data.paidAt : null,
          paidMethod: typeof data.paidMethod === 'string' ? data.paidMethod : null,
          createdAt: readTimestampIso(data.createdAt),
        }
      })
      .sort((a, b) => (b.paidAt ?? b.createdAt ?? '').localeCompare(a.paidAt ?? a.createdAt ?? ''))

    return { ok: true, applications, payments }
  } catch {
    return { ok: false, message: 'Data aktivitas belum dapat dimuat. Silakan coba lagi.' }
  }
}
