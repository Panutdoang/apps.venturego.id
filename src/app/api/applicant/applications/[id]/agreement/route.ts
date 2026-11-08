import { NextResponse } from 'next/server'
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase-admin'
import { isAllowedSignInProvider } from '@/lib/auth-shared'
import { downloadDriveFile } from '@/lib/gdrive'

const APPLICATION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

const errorResponse = (message: string, status = 400) => NextResponse.json({ message }, { status })

const safeFileName = (value: string) => value.replace(/[\r\n"\\/\u0000-\u001f]/g, '_').slice(0, 160)

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token || token.length > 10_000) return errorResponse('Sesi tidak valid.', 401)

  const { id } = await params
  if (!APPLICATION_ID_PATTERN.test(id)) return errorResponse('Berkas tidak ditemukan.', 404)

  try {
    const identity = await getFirebaseAuth().verifyIdToken(token, true)
    if (!isAllowedSignInProvider(identity.firebase?.sign_in_provider)) {
      return errorResponse('Akun ini tidak dapat mengakses dokumen.', 403)
    }

    const application = await getFirebaseFirestore().collection('applications').doc(id).get()
    const data = application.data()
    if (!application.exists || data?.ownerFirebaseUid !== identity.uid) {
      return errorResponse('Berkas tidak ditemukan pada akun ini.', 404)
    }

    const agreementPdf = data.agreementPdf
    if (
      data.financialPlan?.pricingStatus !== 'AGREED' ||
      !agreementPdf ||
      typeof agreementPdf.fileId !== 'string' ||
      typeof agreementPdf.agreementReference !== 'string' ||
      agreementPdf.agreementReference !== data.financialPlan.finalAgreementReference
    ) {
      return errorResponse('PDF akad final belum tersedia.', 404)
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
