import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getFirebaseFirestore } from '@/lib/firebase-admin'
import { isValidXenditCallbackToken } from '@/lib/xendit'

const readString = (value: unknown): string => (typeof value === 'string' ? value : '')

export async function POST(request: Request) {
  if (!process.env.XENDIT_CALLBACK_TOKEN) {
    return NextResponse.json(
      { message: 'Webhook pembayaran belum dikonfigurasi.' },
      { status: 503 },
    )
  }
  if (!isValidXenditCallbackToken(request.headers.get('x-callback-token'))) {
    return NextResponse.json({ message: 'Token callback tidak valid.' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape')
    payload = parsed as Record<string, unknown>
  } catch {
    return NextResponse.json({ message: 'Payload tidak valid.' }, { status: 400 })
  }

  const externalId = readString(payload.external_id)
  const status = readString(payload.status)
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(externalId)) {
    return NextResponse.json({ received: true })
  }

  try {
    const db = getFirebaseFirestore()
    const paymentRef = db.collection('payments').doc(externalId)
    await db.runTransaction(async (transaction) => {
      const payment = await transaction.get(paymentRef)
      if (!payment.exists) return
      const data = payment.data() ?? {}

      if (status === 'PAID' || status === 'SETTLED') {
        if (data.status === 'PAID') return
        transaction.update(paymentRef, {
          status: 'PAID',
          paidAt: readString(payload.paid_at) || new Date().toISOString(),
          paidMethod: readString(payload.payment_method),
          paidChannel: readString(payload.payment_channel),
          updatedAt: FieldValue.serverTimestamp(),
        })
        const installmentNumber = data.installmentNumber
        const applicationDocId = readString(data.applicationDocId)
        if (
          data.type === 'INSTALLMENT' &&
          Number.isInteger(installmentNumber) &&
          (installmentNumber as number) >= 1 &&
          /^[A-Za-z0-9_-]{1,128}$/.test(applicationDocId)
        ) {
          transaction.update(db.collection('applications').doc(applicationDocId), {
            paidInstallments: FieldValue.arrayUnion(installmentNumber),
            updatedAt: FieldValue.serverTimestamp(),
          })
        }
        return
      }

      if (status === 'EXPIRED' && data.status === 'PENDING') {
        transaction.update(paymentRef, {
          status: 'EXPIRED',
          updatedAt: FieldValue.serverTimestamp(),
        })
      }
    })
    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ received: false }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Metode tidak diizinkan.' }, { status: 405 })
}
