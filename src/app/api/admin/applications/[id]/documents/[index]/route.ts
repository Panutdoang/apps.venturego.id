import { NextResponse } from 'next/server'
import { getFirebaseBucket, getFirebaseFirestore } from '@/lib/firebase-admin'
import { getStaffSession } from '@/lib/firebase-session'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const staff = await getStaffSession()
  if (!staff) return NextResponse.json({ message: 'Tidak diizinkan.' }, { status: 401 })

  const { id, index: indexValue } = await params
  const index = Number(indexValue)
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || !Number.isInteger(index) || index < 0 || index > 30) {
    return NextResponse.json({ message: 'Berkas tidak ditemukan.' }, { status: 404 })
  }

  try {
    const application = await getFirebaseFirestore().collection('applications').doc(id).get()
    const documents = application.data()?.documents
    const document = Array.isArray(documents) ? documents[index] : null
    const storagePath = document?.storagePath
    if (typeof storagePath !== 'string' || !storagePath.startsWith('application-uploads/')) {
      return NextResponse.json({ message: 'Berkas tidak ditemukan.' }, { status: 404 })
    }

    const [contents] = await getFirebaseBucket().file(storagePath).download()
    const fileName = String(document.fileName ?? 'dokumen').replace(/[\r\n"\\/]/g, '_')
    return new Response(new Uint8Array(contents), {
      headers: {
        'Content-Type': String(document.mimeType ?? 'application/octet-stream'),
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json({ message: 'Berkas belum dapat diunduh.' }, { status: 404 })
  }
}
