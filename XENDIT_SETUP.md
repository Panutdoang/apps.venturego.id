# Xendit payment gateway setup

The `/dashboard/pembayaran` page creates Xendit **Invoices** (hosted checkout)
for installment and voluntary payments. Xendit calls the webhook at
`/api/webhooks/xendit` to mark payments as paid. Amounts are IDR; invoices
expire after 48 hours.

Payment methods enabled for this integration: **Virtual Account (BCA, Mandiri,
BNI, BRI)** and **QRIS**. Methods shown at checkout are controlled by the
payment methods enabled in the Xendit dashboard — keep other methods disabled
until the app should offer them. QRIS is capped at Rp20.000.000 per Xendit; for
larger invoices only available methods will be shown by Xendit.

## 1. Account and keys

1. Create an account at <https://dashboard.xendit.co> (use **Test mode** first).
2. Settings → Developers → API keys → **Generate secret key** (Admin or Tech
   Settings permission required).
3. Copy the secret key into `XENDIT_SECRET_KEY` in `.env.local` (local) and in
   your production environment (e.g. Vercel encrypted env vars). The key is
   shown only once — store it as a secret; never commit, log, or paste it into
   chat or source files.

## 2. Webhook

1. Settings → Developers → Webhooks (or Settings → Webhooks):
   - **Invoice webhook URL**: `https://<your-domain>/api/webhooks/xendit`
   - Use **Save and Test** to send a test event.
2. Copy the **Webhook verification token** from the same page into
   `XENDIT_CALLBACK_TOKEN`. The route rejects any request whose
   `x-callback-token` header does not match this value.
3. For local development the webhook must reach your machine — use a tunnel
   (e.g. `ngrok http 3000`) and set the tunnel URL as the webhook URL while
   testing, then restore the production URL after.
4. Optional but recommended: add your server IPs to Settings → IP Allowlist.

## 3. Payment methods

Settings → Payment methods: enable the Virtual Accounts you need (BCA,
Mandiri, BNI, BRI) and **QRIS**. Disable methods the app should not offer
(cards, e-wallets, retail outlets) for now.

## 4. Environment variables

Server-only (never expose to the client or use a `NEXT_PUBLIC_` prefix):

- `XENDIT_SECRET_KEY` — API secret key (Basic auth on `api.xendit.co`)
- `XENDIT_CALLBACK_TOKEN` — webhook verification token

Already used from existing config:

- `NEXT_PUBLIC_SITE_URL` — fallback base for redirect URLs after payment

Empty placeholders for the two Xendit variables are already present in
`.env.local`; fill them in yourself. Local dev (`pnpm dev`) does not need real
keys until you exercise payment creation — without them the page shows a
friendly "not configured" message instead of failing.

## 5. Flow reference

- Client calls `createInstallmentPayment` / `createCustomPayment`
  (`src/app/(frontend)/dashboard/pembayaran/actions.ts`) with an anonymous
  Firebase ID token; the action verifies ownership, writes a `PENDING` record
  in the Firestore `payments` collection, creates a Xendit invoice with
  `external_id` = the payment document ID, and returns `invoice_url` for
  redirect.
- On payment, Xendit POSTs to `/api/webhooks/xendit`; after token verification
  the route idempotently sets the payment to `PAID` (or `EXPIRED`) and appends
  the installment number to the owning application's `paidInstallments` array.
- Firestore rules stay deny-all: the `payments` collection is only accessible
  through verified server actions and this webhook route.
