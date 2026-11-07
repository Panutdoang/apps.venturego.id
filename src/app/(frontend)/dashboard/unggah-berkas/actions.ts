'use server'

import { DOCUMENT_DEFINITIONS } from '@/lib/documents'
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase-admin'
import { isAllowedSignInProvider } from '@/lib/auth-shared'

type DocumentEntry = {
  documentType: string
  status: string
  fileId?: string
  fileName?: string
  mimeType?: string
  size?: number
}

export type OwnedApplication = {
  id: string
  applicationId: string
  product: keyof typeof DOCUMENT_DEFINITIONS
  applicantName: string
  documents: DocumentEntry[]
}

export type OwnedApplicationsResult =
  | { ok: true; applications: OwnedApplication[] }
  | { ok: false; message: string }

const isGoogleIdentity = async (uploadToken: string) => {
  if (!uploadToken || uploadToken.length > 10_000) return null
  const identity = await getFirebaseAuth().verifyIdToken(uploadToken)
  return isAllowedSignInProvider(identity.firebase?.sign_in_provider) ? identity : null
}

export async function getOwnedApplications(uploadToken: string): Promise<OwnedApplicationsResult> {
  try {
    const identity = await isGoogleIdentity(uploadToken)
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
        !Object.hasOwn(DOCUMENT_DEFINITIONS, data.product)
      ) {
        return []
      }

      return [
        {
          id: document.id,
          applicationId: data.applicationId,
          product: data.product as keyof typeof DOCUMENT_DEFINITIONS,
          applicantName: data.applicantName,
          documents: Array.isArray(data.documents) ? (data.documents as DocumentEntry[]) : [],
        },
      ]
    })

    return { ok: true, applications }
  } catch {
    return { ok: false, message: 'Data pengajuan belum dapat dimuat. Silakan coba lagi.' }
  }
}
