'use server'

import { FieldValue } from 'firebase-admin/firestore'
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase-admin'
import { isAllowedSignInProvider } from '@/lib/auth-shared'
import type { FinancingApplicationRecord } from '@/lib/firebase-data'

type UserFinancingApplication = Pick<
  FinancingApplicationRecord,
  | 'id'
  | 'applicationId'
  | 'applicantName'
  | 'status'
  | 'departureDetails'
  | 'financialPlan'
  | 'userFinancingAcceptance'
  | 'supportRequests'
>

export type UserFinancingResult =
  | { ok: true; applications: UserFinancingApplication[] }
  | { ok: false; message: string }

export type FinancingActionResult = { ok: true } | { ok: false; message: string }

type UserSupportRequest = NonNullable<FinancingApplicationRecord['supportRequests']>[number]

const isGoogleIdentity = async (token: string) => {
  if (!token || token.length > 10_000) return null
  const identity = await getFirebaseAuth().verifyIdToken(token)
  return isAllowedSignInProvider(identity.firebase?.sign_in_provider) ? identity : null
}

const isSupportRequest = (value: unknown): value is UserSupportRequest => {
  if (!value || typeof value !== 'object') return false
  const request = value as Record<string, unknown>
  return (
    request.type === 'PAYMENT_RELIEF' &&
    typeof request.message === 'string' &&
    typeof request.requestedAt === 'string' &&
    ['OPEN', 'REVIEWED'].includes(String(request.status)) &&
    (request.response === undefined || typeof request.response === 'string')
  )
}

export async function getOwnedFinancingApplications(token: string): Promise<UserFinancingResult> {
  try {
    const identity = await isGoogleIdentity(token)
    if (!identity) return { ok: false, message: 'Sesi telah berakhir. Silakan masuk kembali.' }

    const snapshot = await getFirebaseFirestore()
      .collection('applications')
      .where('ownerFirebaseUid', '==', identity.uid)
      .get()
    const applications = snapshot.docs.flatMap((document) => {
      const data = document.data()
      if (
        typeof data.applicationId !== 'string' ||
        typeof data.applicantName !== 'string' ||
        data.product !== 'DEPARTURE_BRIDGING' ||
        !data.financialPlan ||
        typeof data.financialPlan !== 'object'
      ) {
        return []
      }
      return [
        {
          id: document.id,
          applicationId: data.applicationId,
          applicantName: data.applicantName,
          status: typeof data.status === 'string' ? data.status : 'SUBMITTED',
          departureDetails:
            data.departureDetails && typeof data.departureDetails === 'object'
              ? data.departureDetails
              : null,
          financialPlan: data.financialPlan as Record<string, unknown>,
          userFinancingAcceptance:
            data.userFinancingAcceptance &&
            typeof data.userFinancingAcceptance === 'object' &&
            typeof data.userFinancingAcceptance.acceptedAt === 'string'
              ? data.userFinancingAcceptance
              : undefined,
          supportRequests: Array.isArray(data.supportRequests)
            ? data.supportRequests.filter(isSupportRequest)
            : [],
        },
      ]
    })
    return { ok: true, applications }
  } catch {
    return { ok: false, message: 'Rincian pembiayaan belum dapat dimuat. Silakan coba lagi.' }
  }
}

export async function acceptFinancingOffer(
  token: string,
  applicationId: string,
): Promise<FinancingActionResult> {
  try {
    const identity = await isGoogleIdentity(token)
    if (!identity) return { ok: false, message: 'Sesi telah berakhir. Silakan masuk kembali.' }
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(applicationId)) {
      return { ok: false, message: 'Pengajuan tidak valid.' }
    }

    const applicationRef = getFirebaseFirestore().collection('applications').doc(applicationId)
    await getFirebaseFirestore().runTransaction(async (transaction) => {
      const application = await transaction.get(applicationRef)
      const data = application.data()
      const plan = data?.financialPlan
      if (
        !application.exists ||
        data?.ownerFirebaseUid !== identity.uid ||
        data?.product !== 'DEPARTURE_BRIDGING' ||
        ['CANCELLED', 'REJECTED'].includes(data?.status) ||
        plan?.pricingStatus !== 'VERIFIED' ||
        !plan?.offerSnapshot ||
        typeof plan.offerSnapshot !== 'object'
      ) {
        throw new Error('OFFER_NOT_READY')
      }
      if (data.userFinancingAcceptance) throw new Error('OFFER_ALREADY_ACCEPTED')
      transaction.update(applicationRef, {
        userFinancingAcceptance: {
          acceptedAt: new Date().toISOString(),
          offerSnapshot: plan.offerSnapshot,
        },
        updatedAt: FieldValue.serverTimestamp(),
      })
    })
    return { ok: true }
  } catch (error) {
    if (error instanceof Error && error.message === 'OFFER_ALREADY_ACCEPTED') {
      return { ok: false, message: 'Persetujuan atas penawaran ini sudah tercatat.' }
    }
    if (error instanceof Error && error.message === 'OFFER_NOT_READY') {
      return {
        ok: false,
        message:
          'Penawaran belum terverifikasi atau sudah berubah. Muat ulang rincian terlebih dahulu.',
      }
    }
    return { ok: false, message: 'Persetujuan belum dapat disimpan. Silakan coba lagi.' }
  }
}

export async function requestFinancingSupport(
  token: string,
  applicationId: string,
  message: string,
): Promise<FinancingActionResult> {
  try {
    const identity = await isGoogleIdentity(token)
    if (!identity) return { ok: false, message: 'Sesi telah berakhir. Silakan masuk kembali.' }
    if (
      !/^[A-Za-z0-9_-]{1,128}$/.test(applicationId) ||
      typeof message !== 'string' ||
      message.trim().length < 10 ||
      message.length > 1_000
    ) {
      return { ok: false, message: 'Jelaskan permohonan keringanan minimal 10 karakter.' }
    }

    const applicationRef = getFirebaseFirestore().collection('applications').doc(applicationId)
    await getFirebaseFirestore().runTransaction(async (transaction) => {
      const application = await transaction.get(applicationRef)
      const data = application.data()
      if (
        !application.exists ||
        data?.ownerFirebaseUid !== identity.uid ||
        data?.product !== 'DEPARTURE_BRIDGING' ||
        ['CANCELLED', 'REJECTED'].includes(data?.status) ||
        !['VERIFIED', 'AGREED'].includes(data?.financialPlan?.pricingStatus)
      ) {
        throw new Error('APPLICATION_NOT_READY')
      }
      const previous = Array.isArray(data.supportRequests) ? data.supportRequests : []
      if (previous.length >= 10) throw new Error('REQUEST_LIMIT')
      transaction.update(applicationRef, {
        supportRequests: [
          ...previous,
          {
            type: 'PAYMENT_RELIEF',
            message: message.trim(),
            requestedAt: new Date().toISOString(),
            status: 'OPEN',
          },
        ],
        updatedAt: FieldValue.serverTimestamp(),
      })
    })
    return { ok: true }
  } catch (error) {
    if (error instanceof Error && error.message === 'REQUEST_LIMIT') {
      return {
        ok: false,
        message: 'Batas permohonan tercapai. Hubungi tim VentureGo untuk bantuan.',
      }
    }
    if (error instanceof Error && error.message === 'APPLICATION_NOT_READY') {
      return { ok: false, message: 'Pengajuan belum memiliki rincian biaya terverifikasi.' }
    }
    return { ok: false, message: 'Permohonan belum dapat dikirim. Silakan coba lagi.' }
  }
}
