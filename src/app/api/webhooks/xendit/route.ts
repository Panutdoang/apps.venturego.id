import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getFirebaseFirestore } from '@/lib/firebase-admin'
import { isValidXenditCallbackToken } from '@/lib/xendit'

const readString = (value: unknown): string => (typeof value === 'string' ? value : '')

// Akun Xendit dipakai bersama beberapa app. Callback milik app lain dikenali
// dari awalan external_id dan diteruskan apa adanya (byte-for-byte, dengan
// x-callback-token asli), tidak diproses di sini. Jangan dihapus: tanpa ini
// callback dijawab 200 lalu hilang, dan Xendit tidak mengirim ulang.
//  - `trm-` : VA toko/distributor Turrima (Agrisys)
//  - `vsv-` : VA & invoice siswa lama di app VentureGo versi sebelumnya
//             (blueprint, data 36 kontrak) — sampai datanya dimigrasi ke sini.
const FORWARD_ROUTES: { prefix: string; label: string; url: string }[] = [
  {
    prefix: 'trm-',
    label: 'turrima',
    url:
      process.env.TURRIMA_WEBHOOK_URL || 'https://turrima.integratedfarming.id/api/xendit/callback',
  },
  {
    prefix: 'vsv-',
    label: 'vsv-legacy',
    url: process.env.LEGACY_VSV_WEBHOOK_URL || 'https://venture-go.vercel.app/api/webhooks/xendit',
  },
]

async function forwardCallback(
  route: { label: string; url: string },
  rawBody: string,
  callbackToken: string,
) {
  try {
    const response = await fetch(route.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-callback-token': callbackToken },
      body: rawBody,
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      // Bukan 2xx: balas 502 supaya Xendit mengirim ulang.
      return NextResponse.json({ received: false }, { status: 502 })
    }
    return NextResponse.json({ received: true, forwarded: route.label })
  } catch {
    return NextResponse.json({ received: false }, { status: 502 })
  }
}

export async function POST(request: Request) {
  if (!process.env.XENDIT_CALLBACK_TOKEN) {
    return NextResponse.json(
      { message: 'Webhook pembayaran belum dikonfigurasi.' },
      { status: 503 },
    )
  }
  const callbackToken = request.headers.get('x-callback-token')
  if (!isValidXenditCallbackToken(callbackToken)) {
    return NextResponse.json({ message: 'Token callback tidak valid.' }, { status: 401 })
  }

  let rawBody: string
  let payload: Record<string, unknown>
  try {
    rawBody = await request.text()
    const parsed: unknown = JSON.parse(rawBody)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape')
    payload = parsed as Record<string, unknown>
  } catch {
    return NextResponse.json({ message: 'Payload tidak valid.' }, { status: 400 })
  }

  const externalId = readString(payload.external_id)
  const forwardRoute = FORWARD_ROUTES.find((route) => externalId.startsWith(route.prefix))
  if (forwardRoute) {
    return forwardCallback(forwardRoute, rawBody, callbackToken ?? '')
  }
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
