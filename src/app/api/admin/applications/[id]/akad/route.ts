import { renderAkadPreviewHtml } from '@/lib/akad-preview'
import { NextResponse } from 'next/server'
import { buildAkadDocument } from '@/lib/akad-document'
import { getFirebaseFirestore } from '@/lib/firebase-admin'
import { getStaffSession } from '@/lib/firebase-session'
import { downloadDriveFile } from '@/lib/gdrive'
import {
  getExistingStudentNumber,
  peekNextStudentNumber,
  studentNumberSequence,
} from '@/lib/student-number'

const APPLICATION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ ok: false, message }, { status })

const safeFileName = (value: string) =>
  value
    .replace(/[\r\n"\\/\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 160)

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffSession()
  if (!staff) return errorResponse('Tidak diizinkan.', 401)

  const { id } = await params
  if (!APPLICATION_ID_PATTERN.test(id)) return errorResponse('Pengajuan tidak ditemukan.', 404)

  const mode = new URL(request.url).searchParams.get('mode')

  try {
    const application = await getFirebaseFirestore().collection('applications').doc(id).get()
    if (!application.exists) return errorResponse('Pengajuan tidak ditemukan.', 404)
    const applicationData = application.data() ?? {}
    const plan = (applicationData.financialPlan ?? {}) as Record<string, unknown>
    const akadDocument = (plan.akadDocument ?? null) as Record<string, unknown> | null

    let bytes: Uint8Array
    let fileName: string

    if (akadDocument && typeof akadDocument.driveFileId === 'string') {
      bytes = await downloadDriveFile(akadDocument.driveFileId)
      fileName =
        typeof akadDocument.fileName === 'string' && akadDocument.fileName
          ? akadDocument.fileName
          : `${id}-akad.docx`
    } else {
      const ownerUid =
        typeof applicationData.ownerFirebaseUid === 'string' ? applicationData.ownerFirebaseUid : ''
      const existingNumber = ownerUid ? await getExistingStudentNumber(ownerUid) : null
      const studentNumber = existingNumber ?? (await peekNextStudentNumber())
      const sequence = (studentNumber ? studentNumberSequence(studentNumber) : null) ?? '0000'
      const built = await buildAkadDocument({
        application: applicationData,
        studentSequence: sequence,
        issuedAt: new Date(),
      })
      bytes = built.bytes
      fileName = `${id}-draft-akad.docx`
    }

    if (mode === 'docx') {
      return new Response(bytes as unknown as BodyInit, {
        headers: {
          'Content-Type': DOCX_MIME,
          'Content-Disposition': `attachment; filename="${safeFileName(fileName)}"`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    const previewHtml = await renderAkadPreviewHtml(bytes)
    return new Response(previewHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return errorResponse('Pratinjau dokumen akad belum dapat dibuat. Coba lagi.', 502)
  }
}
