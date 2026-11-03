'use server'

import { Buffer } from 'node:buffer'
import { FieldValue } from 'firebase-admin/firestore'
import { getFirebaseAuth, getFirebaseBucket, getFirebaseFirestore } from '@/lib/firebase-admin'
import {
  DOCUMENT_DEFINITIONS,
  MAX_DOCUMENT_SIZE_BYTES,
  isAcceptedDocumentType,
} from '@/lib/documents'

type DocumentEntry = {
  documentType: string
  status: string
  storagePath?: string
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

export type UploadDocumentResult = { ok: true } | { ok: false; message: string }

const isAnonymousIdentity = async (uploadToken: string) => {
  if (!uploadToken || uploadToken.length > 10_000) return null
  const identity = await getFirebaseAuth().verifyIdToken(uploadToken)
  return identity.firebase?.sign_in_provider === 'anonymous' ? identity : null
}

export async function getOwnedApplications(uploadToken: string): Promise<OwnedApplicationsResult> {
  try {
    const identity = await isAnonymousIdentity(uploadToken)
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

export async function uploadApplicationDocument(
  uploadToken: string,
  applicationId: string,
  documentIndex: number,
  storagePath: string,
): Promise<UploadDocumentResult> {
  let ownedPath = ''
  try {
    const identity = await isAnonymousIdentity(uploadToken)
    if (!identity) return { ok: false, message: 'Sesi telah berakhir. Silakan masuk kembali.' }

    ownedPath = `application-uploads/${identity.uid}/`
    if (
      typeof applicationId !== 'string' ||
      applicationId.length > 150 ||
      !Number.isInteger(documentIndex) ||
      typeof storagePath !== 'string' ||
      storagePath.length > 500 ||
      !storagePath.startsWith(ownedPath)
    ) {
      return { ok: false, message: 'Data unggahan tidak valid.' }
    }

    const applicationRef = getFirebaseFirestore().collection('applications').doc(applicationId)
    const applicationSnapshot = await applicationRef.get()
    if (
      !applicationSnapshot.exists ||
      applicationSnapshot.data()?.ownerFirebaseUid !== identity.uid
    ) {
      return { ok: false, message: 'Pengajuan tidak ditemukan untuk sesi ini.' }
    }

    const application = applicationSnapshot.data()
    const product = application?.product
    if (!Object.hasOwn(DOCUMENT_DEFINITIONS, product)) {
      return { ok: false, message: 'Jenis pengajuan tidak valid.' }
    }
    const definitions = DOCUMENT_DEFINITIONS[product as keyof typeof DOCUMENT_DEFINITIONS]
    if (documentIndex < 0 || documentIndex >= definitions.length) {
      return { ok: false, message: 'Jenis dokumen tidak valid.' }
    }

    const bucket = getFirebaseBucket()
    const file = bucket.file(storagePath)
    const [metadata] = await file.getMetadata()
    const size = Number(metadata.size)
    const mimeType = metadata.contentType ?? ''
    const originalName = metadata.metadata?.originalName
    const fileName = typeof originalName === 'string' ? originalName : 'dokumen'
    if (!Number.isFinite(size) || size <= 0 || size > MAX_DOCUMENT_SIZE_BYTES) {
      await file.delete({ ignoreNotFound: true })
      return { ok: false, message: 'Ukuran berkas maksimal 10 MB.' }
    }
    if (!isAcceptedDocumentType(mimeType)) {
      await file.delete({ ignoreNotFound: true })
      return { ok: false, message: 'Gunakan berkas PDF, JPG, atau PNG.' }
    }

    const [header] = await file.download({ start: 0, end: 7 })
    const validSignature =
      (mimeType === 'application/pdf' && header.subarray(0, 5).toString('ascii') === '%PDF-') ||
      (mimeType === 'image/jpeg' &&
        header[0] === 0xff &&
        header[1] === 0xd8 &&
        header[2] === 0xff) ||
      (mimeType === 'image/png' &&
        header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    if (!validSignature) {
      await file.delete({ ignoreNotFound: true })
      return { ok: false, message: 'Isi berkas tidak sesuai dengan formatnya.' }
    }

    const documentType = definitions[documentIndex].label
    await getFirebaseFirestore().runTransaction(async (transaction) => {
      const latest = await transaction.get(applicationRef)
      if (
        !latest.exists ||
        latest.data()?.ownerFirebaseUid !== identity.uid ||
        latest.data()?.product !== product
      ) {
        throw new Error('Application ownership changed.')
      }

      const currentDocuments = Array.isArray(latest.data()?.documents)
        ? (latest.data()?.documents as DocumentEntry[])
        : []
      const nextDocuments = definitions.map((definition, index) => {
        const existing = currentDocuments.find((item) => item.documentType === definition.label)
        if (index !== documentIndex) {
          return existing ?? { documentType: definition.label, status: 'NOT_UPLOADED' }
        }
        return {
          documentType,
          status: 'UPLOADED',
          storagePath,
          fileName: fileName.slice(0, 180),
          mimeType,
          size,
        }
      })

      transaction.update(applicationRef, {
        documents: nextDocuments,
        updatedAt: FieldValue.serverTimestamp(),
      })
    })

    return { ok: true }
  } catch {
    if (ownedPath && storagePath.startsWith(ownedPath)) {
      await getFirebaseBucket()
        .file(storagePath)
        .delete({ ignoreNotFound: true })
        .catch(() => {})
    }
    return { ok: false, message: 'Berkas belum dapat diunggah. Silakan coba lagi.' }
  }
}
