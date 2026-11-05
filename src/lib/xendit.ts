import 'server-only'

import { timingSafeEqual } from 'node:crypto'

const XENDIT_API_BASE = 'https://api.xendit.co'

export const XENDIT_INVOICE_DURATION_SECONDS = 48 * 60 * 60

export type XenditInvoiceResult =
  | { ok: true; invoiceId: string; invoiceUrl: string; expiryDate: string | null }
  | { ok: false; configured: boolean; message: string }

export async function createXenditInvoice(params: {
  externalId: string
  amount: number
  description: string
  returnUrl: string
}): Promise<XenditInvoiceResult> {
  const secretKey = process.env.XENDIT_SECRET_KEY
  if (!secretKey) {
    return {
      ok: false,
      configured: false,
      message:
        'Pembayaran daring belum dikonfigurasi di server. Hubungi tim VentureGo untuk info pembayaran.',
    }
  }
  try {
    const response = await fetch(`${XENDIT_API_BASE}/v2/invoices`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        external_id: params.externalId,
        amount: params.amount,
        description: params.description,
        invoice_duration: XENDIT_INVOICE_DURATION_SECONDS,
        currency: 'IDR',
        success_redirect_url: params.returnUrl,
        failure_redirect_url: params.returnUrl,
      }),
      cache: 'no-store',
    })
    const payload = (await response.json().catch(() => null)) as {
      id?: unknown
      invoice_url?: unknown
      expiry_date?: unknown
      message?: unknown
    } | null
    if (
      !response.ok ||
      typeof payload?.id !== 'string' ||
      typeof payload.invoice_url !== 'string'
    ) {
      const detail =
        typeof payload?.message === 'string' && payload.message.length <= 200
          ? payload.message
          : `HTTP ${response.status}`
      console.error('Xendit create invoice failed', detail)
      return {
        ok: false,
        configured: true,
        message: 'Tagihan pembayaran belum dapat dibuat. Silakan coba lagi beberapa saat lagi.',
      }
    }
    return {
      ok: true,
      invoiceId: payload.id,
      invoiceUrl: payload.invoice_url,
      expiryDate: typeof payload.expiry_date === 'string' ? payload.expiry_date : null,
    }
  } catch {
    console.error('Xendit create invoice request error')
    return {
      ok: false,
      configured: true,
      message: 'Layanan pembayaran sedang tidak dapat dihubungi. Silakan coba lagi nanti.',
    }
  }
}

export function isValidXenditCallbackToken(receivedToken: string | null): boolean {
  const expected = process.env.XENDIT_CALLBACK_TOKEN
  if (!expected || !receivedToken) return false
  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(receivedToken)
  if (expectedBuffer.length !== receivedBuffer.length || expectedBuffer.length === 0) return false
  return timingSafeEqual(expectedBuffer, receivedBuffer)
}
