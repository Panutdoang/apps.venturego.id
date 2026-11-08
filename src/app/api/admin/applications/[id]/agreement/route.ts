import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getFirebaseFirestore } from '@/lib/firebase-admin'
import { getStaffSession } from '@/lib/firebase-session'
import { buildDocumentFileName, hasValidDocumentSignature } from '@/lib/documents'
import { ensureApplicationDriveFolder } from '@/lib/drive-folders'
import { deleteDriveFile, downloadDriveFile, uploadDriveFile } from '@/lib/gdrive'

const APPLICATION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
const MAX_AGREEMENT_SIZE_BYTES = 4 * 1024 * 1024

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ ok: false, message }, { status })

const safeFileName = (value: string) =>
  value
    .replace(/[\r\n"\\/\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 160)

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffSession()
  if (!staff) return errorResponse('Tidak diizinkan.', 401)

  const { id } = await params
  if (!APPLICATION_ID_PATTERN.test(id)) return errorResponse('Pengajuan tidak ditemukan.', 404)
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/pdf') {
    return errorResponse('Unggah dokumen akad dalam format PDF.')
  }

  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_AGREEMENT_SIZE_BYTES) {
    return errorResponse('Ukuran PDF akad maksimal 4 MB.')
  }

  try {
    const bytes = new Uint8Array(await request.arrayBuffer())
    if (bytes.byteLength <= 0 || bytes.byteLength > MAX_AGREEMENT_SIZE_BYTES) {
      return errorResponse('Ukuran PDF akad maksimal 4 MB.')
    }
    if (!hasValidDocumentSignature('application/pdf', bytes.subarray(0, 8))) {
      return errorResponse('Isi berkas tidak sesuai dengan format PDF.', 422)
    }

    const firestore = getFirebaseFirestore()
    const applicationRef = firestore.collection('applications').doc(id)
    const snapshot = await applicationRef.get()
    const application = snapshot.data()
    const financialPlan =
      application?.financialPlan && typeof application.financialPlan === 'object'
        ? application.financialPlan
        : {}
    const agreementReference =
      typeof financialPlan.finalAgreementReference === 'string'
        ? financialPlan.finalAgreementReference.trim()
        : ''
    if (!snapshot.exists || financialPlan.pricingStatus !== 'AGREED' || !agreementReference) {
      return errorResponse('PDF akad final hanya dapat diunggah setelah akad disepakati.', 409)
    }

    const applicantName =
      typeof application?.applicantName === 'string' ? application.applicantName : ''
    const fileName = applicantName.trim()
      ? buildDocumentFileName('Akad Wakalah bil Ujrah', applicantName, '.pdf')
      : `${id}-akad-wakalah-bil-ujrah.pdf`
    const existingFolderId =
      typeof application?.driveFolderId === 'string' ? application.driveFolderId : ''
    const folderId = existingFolderId || (await ensureApplicationDriveFolder(application ?? {}))

    const uploaded = await uploadDriveFile({
      parentFolderId: folderId,
      fileName,
      mimeType: 'application/pdf',
      bytes,
    })

    let linked = false
    try {
      linked = await firestore.runTransaction(async (transaction) => {
        const latest = await transaction.get(applicationRef)
        const latestData = latest.data()
        if (
          !latest.exists ||
          latestData?.financialPlan?.pricingStatus !== 'AGREED' ||
          latestData?.financialPlan?.finalAgreementReference !== agreementReference
        ) {
          return false
        }
        transaction.update(applicationRef, {
          ...(existingFolderId ? {} : { driveFolderId: folderId }),
          agreementPdf: {
            fileId: uploaded.fileId,
            fileName,
            mimeType: 'application/pdf',
            size: uploaded.size,
            uploadedAt: FieldValue.serverTimestamp(),
            uploadedBy: staff.email ?? staff.uid,
            agreementReference,
          },
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: staff.email ?? staff.uid,
        })
        return true
      })
    } catch {
      await deleteDriveFile(uploaded.fileId)
      return errorResponse('PDF sudah diterima, tetapi belum dapat ditautkan ke pengajuan.', 500)
    }
    if (!linked) {
      await deleteDriveFile(uploaded.fileId)
      return errorResponse(
        'Akad tidak lagi berstatus Disepakati. Segarkan data sebelum mengunggah.',
        409,
      )
    }

    return NextResponse.json({ ok: true, fileName, size: uploaded.size })
  } catch {
    return errorResponse('PDF akad belum dapat diunggah. Silakan coba lagi.', 502)
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffSession()
  if (!staff) return errorResponse('Tidak diizinkan.', 401)

  const { id } = await params
  if (!APPLICATION_ID_PATTERN.test(id)) return errorResponse('Berkas tidak ditemukan.', 404)

  try {
    const application = await getFirebaseFirestore().collection('applications').doc(id).get()
    const agreementPdf = application.data()?.agreementPdf
    if (!agreementPdf || typeof agreementPdf.fileId !== 'string') {
      return errorResponse('PDF akad belum tersedia.', 404)
    }

    const bytes = await downloadDriveFile(agreementPdf.fileId)
    const fileName = safeFileName(String(agreementPdf.fileName ?? 'akad-wakalah-bil-ujrah.pdf'))
    return new Response(bytes as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return errorResponse('PDF akad belum dapat diunduh.', 404)
  }
}
