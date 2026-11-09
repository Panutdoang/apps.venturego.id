'use server'

import { FieldValue } from 'firebase-admin/firestore'
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase-admin'
import { isAllowedSignInProvider } from '@/lib/auth-shared'
import { ensureStudentNumber } from '@/lib/student-number'

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
  agreementPdf: {
    fileName: string
    size: number | null
    uploadedAt: string | null
  } | null
  acceptedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  personalDetails: {
    domicileSameAsIdCard: boolean
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
  consent: {
    understandsWakalah: boolean
    acceptsDataProcessing: boolean
  }
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

export type StudentNumberResult =
  | { ok: true; studentNumber: string }
  | { ok: false; message: string }

export type ApplicantProfileInput = {
  applicantName: string
  phone: string
  birthPlace: string
  birthDate: string
  gender: 'MALE' | 'FEMALE'
  religion: 'ISLAM' | 'PROTESTANT' | 'CATHOLIC' | 'HINDU' | 'BUDDHIST' | 'CONFUCIAN'
  idCardAddress: string
  domicileSameAsIdCard: boolean
  domicileAddress: string
  domicilePostalCode: string
}

export type ApplicantProfileUpdateResult = { ok: true } | { ok: false; message: string }

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

export async function getOrCreateStudentNumber(token: string): Promise<StudentNumberResult> {
  try {
    const identity = await verifyUserIdentity(token)
    if (!identity) return { ok: false, message: 'Sesi telah berakhir. Silakan masuk kembali.' }

    const studentNumber = await ensureStudentNumber(identity.uid)
    if (!studentNumber) {
      return { ok: false, message: 'Nomor induk siswa belum dapat dimuat. Silakan coba lagi.' }
    }

    return { ok: true, studentNumber }
  } catch {
    return { ok: false, message: 'Nomor induk siswa belum dapat dimuat. Silakan coba lagi.' }
  }
}

export async function updateApplicantPersonalDetails(
  token: string,
  applicationId: string,
  input: ApplicantProfileInput,
): Promise<ApplicantProfileUpdateResult> {
  try {
    const identity = await verifyUserIdentity(token)
    if (!identity) return { ok: false, message: 'Sesi telah berakhir. Silakan masuk kembali.' }
    if (typeof applicationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(applicationId)) {
      return { ok: false, message: 'Pengajuan tidak valid.' }
    }

    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return { ok: false, message: 'Data profil tidak valid.' }
    }

    const applicantName = typeof input.applicantName === 'string' ? input.applicantName.trim() : ''
    const phone = typeof input.phone === 'string' ? input.phone.trim() : ''
    const birthPlace = typeof input.birthPlace === 'string' ? input.birthPlace.trim() : ''
    const birthDate = typeof input.birthDate === 'string' ? input.birthDate.trim() : ''
    const idCardAddress = typeof input.idCardAddress === 'string' ? input.idCardAddress.trim() : ''
    const domicileAddress = input.domicileSameAsIdCard
      ? idCardAddress
      : typeof input.domicileAddress === 'string'
        ? input.domicileAddress.trim()
        : ''
    const domicilePostalCode =
      typeof input.domicilePostalCode === 'string' ? input.domicilePostalCode.trim() : ''
    const religions = ['ISLAM', 'PROTESTANT', 'CATHOLIC', 'HINDU', 'BUDDHIST', 'CONFUCIAN']

    if (
      applicantName.length < 2 ||
      applicantName.length > 100 ||
      phone.length > 24 ||
      !/^(\+62|62|0)[0-9]{8,14}$/.test(phone.replace(/[\s-]/g, '')) ||
      birthPlace.length < 2 ||
      birthPlace.length > 80 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
      !['MALE', 'FEMALE'].includes(input.gender) ||
      !religions.includes(input.religion) ||
      typeof input.domicileSameAsIdCard !== 'boolean' ||
      idCardAddress.length < 5 ||
      idCardAddress.length > 500 ||
      domicileAddress.length < 5 ||
      domicileAddress.length > 500 ||
      !/^\d{0,10}$/.test(domicilePostalCode)
    ) {
      return {
        ok: false,
        message: 'Periksa kembali nama, nomor WhatsApp, tanggal lahir, dan alamat.',
      }
    }

    const birth = new Date(`${birthDate}T00:00:00.000Z`)
    if (
      Number.isNaN(birth.getTime()) ||
      birth.toISOString().slice(0, 10) !== birthDate ||
      birth.getUTCFullYear() < 1900
    ) {
      return { ok: false, message: 'Tanggal lahir tidak valid.' }
    }

    const applicationRef = getFirebaseFirestore().collection('applications').doc(applicationId)
    const outcome = await getFirebaseFirestore().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(applicationRef)
      const data = snapshot.data()
      if (!snapshot.exists || data?.ownerFirebaseUid !== identity.uid) return 'NOT_FOUND'

      const pricingStatus = data?.financialPlan?.pricingStatus
      if (pricingStatus === 'AGREED' || ['ACTIVE', 'COMPLETED'].includes(String(data.status))) {
        return 'LOCKED'
      }

      transaction.update(applicationRef, {
        applicantName: applicantName.replace(/[<>]/g, ''),
        phone: phone.replace(/[<>]/g, ''),
        personalDetails: {
          ...(data.personalDetails && typeof data.personalDetails === 'object'
            ? data.personalDetails
            : {}),
          birthPlace: birthPlace.replace(/[<>]/g, ''),
          birthDate,
          gender: input.gender,
          religion: input.religion,
          idCardAddress: idCardAddress.replace(/[<>]/g, ''),
          domicileSameAsIdCard: input.domicileSameAsIdCard,
          domicileAddress: domicileAddress.replace(/[<>]/g, ''),
          domicilePostalCode,
        },
        applicantProfileUpdatedAt: FieldValue.serverTimestamp(),
      })
      return 'UPDATED'
    })

    if (outcome === 'NOT_FOUND') {
      return { ok: false, message: 'Pengajuan tidak ditemukan pada akun ini.' }
    }
    if (outcome === 'LOCKED') {
      return {
        ok: false,
        message:
          'Data terkunci setelah akad disepakati atau pembiayaan aktif. Hubungi Pusat Bantuan untuk koreksi.',
      }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: 'Data diri belum dapat disimpan. Silakan coba lagi.' }
  }
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

        const agreementDocument =
          data.agreementPdf && typeof data.agreementPdf === 'object'
            ? (data.agreementPdf as Record<string, unknown>)
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
          agreementPdf:
            financialPlan.pricingStatus === 'AGREED' &&
            agreementDocument &&
            typeof agreementDocument.fileId === 'string' &&
            typeof agreementDocument.agreementReference === 'string' &&
            agreementDocument.agreementReference === financialPlan.finalAgreementReference
              ? {
                  fileName:
                    typeof agreementDocument.fileName === 'string'
                      ? agreementDocument.fileName
                      : 'Akad Wakalah bil Ujrah.pdf',
                  size:
                    typeof agreementDocument.size === 'number' &&
                    Number.isFinite(agreementDocument.size)
                      ? agreementDocument.size
                      : null,
                  uploadedAt: readTimestampIso(agreementDocument.uploadedAt),
                }
              : null,
          acceptedAt: acceptance,
          createdAt: readTimestampIso(data.createdAt),
          updatedAt: readTimestampIso(data.updatedAt),
          personalDetails: {
            domicileSameAsIdCard: personal.domicileSameAsIdCard === true,
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
          consent: {
            understandsWakalah: data.understandsWakalah === true,
            acceptsDataProcessing: data.acceptsDataProcessing === true,
          },
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
