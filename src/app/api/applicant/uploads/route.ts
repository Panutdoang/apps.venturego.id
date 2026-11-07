import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase-admin'
import { isAllowedSignInProvider } from '@/lib/auth-shared'
import {
  DOCUMENT_DEFINITIONS,
  MAX_DOCUMENT_SIZE_BYTES,
  hasValidDocumentSignature,
  isAcceptedDocumentType,
  sanitizeUploadFileName,
} from '@/lib/documents'
import {
  GDriveError,
  abortResumableSession,
  createResumableSession,
  deleteDriveFile,
  getOrCreateChildFolder,
  getRootFolderId,
  sanitizeDriveFolderName,
  sendResumableChunk,
  signUploadTicket,
  verifyUploadTicket,
} from '@/lib/gdrive'

const CHUNK_SIZE = 4 * 1024 * 1024
const APPLICATION_DOC_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

const failure = (message: string, status = 400) =>
  NextResponse.json({ ok: false, message }, { status })

const verifyGoogleToken = async (request: Request) => {
  const token = request.headers.get('x-upload-token')
  if (!token || token.length > 10_000) return null
  try {
    const identity = await getFirebaseAuth().verifyIdToken(token)
    return isAllowedSignInProvider(identity.firebase?.sign_in_provider) ? identity : null
  } catch {
    return null
  }
}

const statusForError = (error: GDriveError) => {
  switch (error.code) {
    case 'NOT_CONFIGURED':
      return 503
    case 'INVALID':
      return 422
    case 'FORBIDDEN':
      return 403
    default:
      return 502
  }
}

const handleInit = async (request: Request, uid: string) => {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return failure('Data unggahan tidak valid.')
  }

  const fileName = sanitizeUploadFileName(typeof body.fileName === 'string' ? body.fileName : '')
  const size = typeof body.size === 'number' ? body.size : Number.NaN
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : ''
  const documentIndex =
    typeof body.documentIndex === 'number' && Number.isSafeInteger(body.documentIndex)
      ? body.documentIndex
      : -1
  if (!fileName) return failure('Nama berkas tidak valid.')
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_DOCUMENT_SIZE_BYTES) {
    return failure('Ukuran berkas maksimal 10 MB.')
  }
  if (!isAcceptedDocumentType(mimeType)) return failure('Gunakan berkas PDF, JPG, atau PNG.')
  if (documentIndex < 0 || documentIndex > 60) {
    return failure('Jenis dokumen tidak valid.')
  }

  const firestore = getFirebaseFirestore()
  let folderId: string
  const applicationDocId =
    typeof body.applicationDocId === 'string' && APPLICATION_DOC_PATTERN.test(body.applicationDocId)
      ? body.applicationDocId
      : null

  if (applicationDocId) {
    const applicationRef = firestore.collection('applications').doc(applicationDocId)
    const snapshot = await applicationRef.get()
    const data = snapshot.data()
    if (!snapshot.exists || data?.ownerFirebaseUid !== uid) {
      return failure('Pengajuan tidak ditemukan untuk sesi ini.', 404)
    }
    const definitions = DOCUMENT_DEFINITIONS[data?.product as keyof typeof DOCUMENT_DEFINITIONS]
    if (!definitions) return failure('Jenis pengajuan tidak valid.')
    if (documentIndex >= definitions.length) return failure('Jenis dokumen tidak valid.')

    const existingFolderId = typeof data?.driveFolderId === 'string' ? data.driveFolderId : ''
    if (existingFolderId) {
      folderId = existingFolderId
    } else {
      const rootId = await getRootFolderId()
      const folderName = sanitizeDriveFolderName(
        `${String(data?.applicantName ?? '')} - ${String(data?.applicationId ?? '')}`,
      )
      if (!folderName) return failure('Nama pemohon belum diisi.')
      folderId = await getOrCreateChildFolder(rootId, folderName)
      await applicationRef.update({
        driveFolderId: folderId,
        updatedAt: FieldValue.serverTimestamp(),
      })
    }
  } else {
    const product = typeof body.product === 'string' ? body.product : ''
    if (!Object.hasOwn(DOCUMENT_DEFINITIONS, product))
      return failure('Jenis pengajuan tidak valid.')
    if (
      documentIndex >= DOCUMENT_DEFINITIONS[product as keyof typeof DOCUMENT_DEFINITIONS].length
    ) {
      return failure('Jenis dokumen tidak valid.')
    }
    const folderName = sanitizeDriveFolderName(
      typeof body.folderName === 'string' ? body.folderName : '',
    )
    if (folderName.length < 2) return failure('Nama pemohon belum diisi.')

    const mappingRef = firestore.collection('driveFolders').doc(uid)
    const mapping = await mappingRef.get()
    const mappingData = mapping.data()
    if (
      mapping.exists &&
      mappingData?.ownerUid === uid &&
      mappingData?.stage === 'draft' &&
      typeof mappingData?.folderId === 'string' &&
      mappingData.folderId
    ) {
      folderId = mappingData.folderId
    } else {
      const rootId = await getRootFolderId()
      const draftFolderName = `${folderName} · ${uid.slice(0, 6)}`
      folderId = await getOrCreateChildFolder(rootId, draftFolderName)
      await mappingRef.set({
        ownerUid: uid,
        folderId,
        folderName: draftFolderName,
        stage: 'draft',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
    }
  }

  const sessionUrl = await createResumableSession({
    parentFolderId: folderId,
    fileName,
    mimeType,
    size,
  })
  const ticket = signUploadTicket({
    uid,
    folderId,
    documentIndex,
    appDocId: applicationDocId,
    fileName,
    mimeType,
    size,
    sessionUrl,
  })
  return NextResponse.json({ ok: true, ticket, chunkSize: CHUNK_SIZE })
}

const handleChunk = async (request: Request, uid: string) => {
  let ticket
  try {
    ticket = verifyUploadTicket(request.headers.get('x-upload-ticket') ?? '')
  } catch (error) {
    if (error instanceof GDriveError) return failure(error.message, statusForError(error))
    return failure('Sesi unggah tidak valid. Silakan ulangi unggahan.')
  }
  if (ticket.uid !== uid) return failure('Sesi unggah tidak valid.', 403)

  const contentRange = request.headers.get('content-range') ?? ''
  const rangeMatch = contentRange.match(/^bytes (\d+)-(\d+)\/(\d+)$/)
  if (!rangeMatch) return failure('Posisi potongan unggahan tidak valid.')
  const start = Number(rangeMatch[1])
  const end = Number(rangeMatch[2])
  const total = Number(rangeMatch[3])
  if (
    total !== ticket.size ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    end < start ||
    end >= total
  ) {
    return failure('Posisi potongan unggahan tidak valid.')
  }

  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.byteLength !== end - start + 1 || bytes.byteLength > CHUNK_SIZE) {
    return failure('Ukuran potongan unggahan tidak valid.')
  }

  if (start === 0 && !hasValidDocumentSignature(ticket.mimeType, bytes.subarray(0, 8))) {
    await abortResumableSession(ticket.sessionUrl)
    return failure('Isi berkas tidak sesuai dengan formatnya.', 422)
  }

  const result = await sendResumableChunk(ticket.sessionUrl, bytes, start, total)
  if (!result.done) return NextResponse.json({ ok: true, done: false })

  if (ticket.appDocId) {
    const applicationRef = getFirebaseFirestore().collection('applications').doc(ticket.appDocId)
    try {
      await getFirebaseFirestore().runTransaction(async (transaction) => {
        const latest = await transaction.get(applicationRef)
        const data = latest.data()
        if (!latest.exists || data?.ownerFirebaseUid !== uid) {
          throw new GDriveError('Pengajuan tidak ditemukan untuk sesi ini.', 'INVALID')
        }
        const definitions = DOCUMENT_DEFINITIONS[data?.product as keyof typeof DOCUMENT_DEFINITIONS]
        if (!definitions) throw new GDriveError('Jenis pengajuan tidak valid.', 'INVALID')
        const currentDocuments = Array.isArray(data?.documents) ? data.documents : []
        const nextDocuments = definitions.map((definition, index) => {
          if (index !== ticket.documentIndex) {
            return (
              currentDocuments.find(
                (item: { documentType?: string }) => item.documentType === definition.label,
              ) ?? { documentType: definition.label, status: 'NOT_UPLOADED' }
            )
          }
          return {
            documentType: definition.label,
            status: 'UPLOADED',
            fileId: result.fileId,
            fileName: ticket.fileName,
            mimeType: ticket.mimeType,
            size: ticket.size,
          }
        })
        transaction.update(applicationRef, {
          documents: nextDocuments,
          driveFolderId: ticket.folderId,
          updatedAt: FieldValue.serverTimestamp(),
        })
      })
    } catch (error) {
      await deleteDriveFile(result.fileId)
      if (error instanceof GDriveError) return failure(error.message, statusForError(error))
      return failure('Berkas belum dapat disimpan. Silakan coba lagi.', 502)
    }
  }

  return NextResponse.json({
    ok: true,
    done: true,
    fileId: result.fileId,
    fileName: ticket.fileName,
    mimeType: ticket.mimeType,
    size: ticket.size,
  })
}

export async function POST(request: Request) {
  const identity = await verifyGoogleToken(request)
  if (!identity) return failure('Sesi unggah telah berakhir. Silakan muat ulang halaman.', 401)

  const action = request.headers.get('x-upload-action')
  try {
    if (action === 'init') return await handleInit(request, identity.uid)
    if (action === 'chunk') return await handleChunk(request, identity.uid)
    return failure('Permintaan unggahan tidak valid.', 404)
  } catch (error) {
    if (error instanceof GDriveError) return failure(error.message, statusForError(error))
    return failure('Berkas belum dapat diunggah. Silakan coba lagi.', 502)
  }
}
