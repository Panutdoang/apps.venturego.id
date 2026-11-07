'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { onAuthStateChanged } from 'firebase/auth'
import { getFirebaseClientAuth } from '@/lib/firebase-client'
import {
  createCustomPayment,
  createInstallmentPayment,
  getPaymentOverview,
  type PaymentApplication,
  type PaymentOverviewResult,
} from './actions'
import {
  DashboardCard,
  DashboardCardSkeleton,
  DashboardIcon,
  DashboardScaffold,
} from '../_components/dashboard-ui'

type Overview = Extract<PaymentOverviewResult, { ok: true }>

const formatRupiah = (value: number) => `Rp${value.toLocaleString('id-ID')}`

const formatDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Belum ditentukan'
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Menunggu pembayaran',
  PAID: 'Lunas',
  EXPIRED: 'Kedaluwarsa',
  FAILED: 'Gagal',
}

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Terkirim',
  ELIGIBILITY_REVIEW: 'Tinjauan kelayakan',
  DOCUMENT_REVIEW: 'Tinjauan berkas',
  REVISION_REQUIRED: 'Perlu revisi',
  COST_VERIFICATION: 'Verifikasi biaya',
  APPROVED: 'Disetujui',
  CONTRACT_PREPARATION: 'Persiapan akad',
  ACTIVE: 'AKTIF',
  COMPLETED: 'Selesai',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
}

const isClosed = (application: PaymentApplication) =>
  ['CANCELLED', 'REJECTED'].includes(application.status)

export default function PaymentPage() {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ kind: 'success' | 'failed'; text: string } | null>(null)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [selectedApplicationId, setSelectedApplicationId] = useState('')
  const [customAmount, setCustomAmount] = useState('')
  const [pending, startTransition] = useTransition()

  const loadOverview = useCallback(async (idToken: string) => {
    const result = await getPaymentOverview(idToken)
    if (!result.ok) {
      setError(result.message)
      setOverview(null)
      return
    }
    setError('')
    setOverview(result)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const payment = params.get('payment')
    if (payment === 'success') {
      setNotice({
        kind: 'success',
        text: 'Pembayaran diterima. Status diverifikasi otomatis dalam beberapa saat — segarkan halaman bila belum berubah.',
      })
    } else if (payment === 'failed') {
      setNotice({
        kind: 'failed',
        text: 'Pembayaran belum selesai. Silakan coba lagi atau pilih metode lain.',
      })
    }
    if (payment) {
      window.history.replaceState(window.history.state, '', '/dashboard/pembayaran')
    }
  }, [])

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = onAuthStateChanged(getFirebaseClientAuth(), async (user) => {
        if (!active) return
        if (!user) {
          setToken('')
          setOverview(null)
          setError('Sesi akun tidak ditemukan. Silakan masuk kembali.')
          setLoading(false)
          return
        }
        try {
          const idToken = await user.getIdToken()
          if (!active) return
          setToken(idToken)
          await loadOverview(idToken)
        } catch {
          if (active) setError('Sesi tidak dapat diverifikasi. Silakan muat ulang halaman.')
        } finally {
          if (active) setLoading(false)
        }
      })
    } catch {
      setError('Pembayaran belum dapat dimuat. Silakan coba lagi.')
      setLoading(false)
    }
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [loadOverview])

  const refresh = () => {
    if (token) void loadOverview(token)
  }

  const openInvoice = (
    result: { ok: true; invoiceUrl: string } | { ok: false; message: string },
  ) => {
    if (result.ok) {
      window.location.href = result.invoiceUrl
      return
    }
    setError(result.message)
  }

  const handleInstallment = (applicationDocId: string, installmentNumber: number) => {
    if (!token) return
    setError('')
    startTransition(async () => {
      openInvoice(await createInstallmentPayment(token, applicationDocId, installmentNumber))
    })
  }

  const handleCustom = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token || !selectedApplicationId) return
    const amount = Number(customAmount.replace(/\D/g, ''))
    setError('')
    startTransition(async () => {
      openInvoice(await createCustomPayment(token, selectedApplicationId, amount))
    })
  }

  const applications = overview?.applications ?? []
  const payableApplications = applications.filter((application) => !isClosed(application))
  const selectedApplication = payableApplications.find(
    (application) => application.id === selectedApplicationId,
  )
  const pendingInstallments = new Set(
    (overview?.payments ?? [])
      .filter(
        (payment) =>
          payment.status === 'PENDING' &&
          payment.type === 'INSTALLMENT' &&
          payment.invoiceUrl &&
          payment.installmentNumber !== null,
      )
      .map((payment) => `${payment.applicationDocId}:${payment.installmentNumber}`),
  )

  return (
    <DashboardScaffold
      active="angsuran"
      subtitle="Virtual Account & QRIS via Xendit"
      title="Bayar angsuran"
    >
      {notice && (
        <div
          aria-live="polite"
          className={`flex items-start gap-3 rounded-2xl p-4 text-[11px] leading-5 ${
            notice.kind === 'success'
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-amber-50 text-amber-900'
          }`}
          role="status"
        >
          <DashboardIcon
            className={`mt-0.5 size-5 shrink-0 ${notice.kind === 'success' ? 'text-emerald-600' : 'text-amber-600'}`}
            name={notice.kind === 'success' ? 'check' : 'info'}
          />
          <p>{notice.text}</p>
        </div>
      )}

      {loading && (
        <>
          <DashboardCardSkeleton rows={4} />
          <DashboardCardSkeleton rows={3} />
        </>
      )}

      {!loading && error && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-800" role="alert">
          {error}
        </p>
      )}

      {!loading && !overview && !error && (
        <p className="rounded-xl bg-white p-5 text-sm leading-6 text-slate-600">
          Pembayaran belum dapat dimuat.
        </p>
      )}

      {overview && payableApplications.length === 0 && (
        <p className="rounded-xl bg-white p-5 text-sm leading-6 text-slate-600">
          Belum ada pengajuan aktif pada sesi ini.{' '}
          <Link className="font-semibold text-[var(--primary)]" href="/?step=1">
            Ajukan pembiayaan
          </Link>{' '}
          terlebih dahulu.
        </p>
      )}

      {overview &&
        applications.map((application) => (
          <DashboardCard className="p-4" key={application.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)]">
                  {application.applicationId}
                </p>
                <h2 className="mt-1 truncate text-sm font-bold text-slate-900">
                  {application.applicantName}
                </h2>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  isClosed(application)
                    ? 'bg-red-50 text-red-700'
                    : 'bg-indigo-50 text-[var(--primary)]'
                }`}
              >
                {APPLICATION_STATUS_LABELS[application.status] ?? application.status}
              </span>
            </div>

            {application.schedule && application.schedule.length > 0 ? (
              <div className="mt-4 max-h-96 space-y-0 overflow-y-auto rounded-2xl border border-slate-100">
                {application.schedule.map((entry) => {
                  const hasPending = pendingInstallments.has(
                    `${application.id}:${entry.installment}`,
                  )
                  return (
                    <div
                      className="flex items-center gap-3 border-b border-slate-100 p-3 last:border-0"
                      key={entry.installment}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800">
                          Angsuran {entry.installment}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {formatDate(entry.dueDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-800">
                          {formatRupiah(entry.amount)}
                        </p>
                        {entry.paid ? (
                          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                            <DashboardIcon className="size-3" name="check" />
                            Lunas
                          </span>
                        ) : isClosed(application) ? (
                          <span className="mt-1 block text-[10px] text-slate-400">Tidak aktif</span>
                        ) : (
                          <button
                            className="mt-1 rounded-full bg-[var(--primary)] px-3 py-1 text-[10px] font-bold text-white disabled:opacity-50"
                            disabled={pending}
                            onClick={() => handleInstallment(application.id, entry.installment)}
                            type="button"
                          >
                            {hasPending ? 'Lanjutkan' : 'Bayar'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">
                {isClosed(application)
                  ? 'Pengajuan ini tidak aktif sehingga tidak dapat dibayar.'
                  : 'Jadwal angsuran belum tersedia. Rincian biaya sedang diverifikasi tim VentureGo.'}
              </p>
            )}
          </DashboardCard>
        ))}

      {overview && payableApplications.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold text-slate-900">Pembayaran bebas</h2>
          <DashboardCard className="p-4">
            <p className="text-[11px] leading-5 text-slate-500">
              Nominal di luar jadwal (pelunasan sebagian atau sukarela). Minimal Rp1.000.
            </p>
            <form className="mt-3 space-y-3" onSubmit={handleCustom}>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs text-slate-700"
                onChange={(event) => setSelectedApplicationId(event.target.value)}
                required
                value={selectedApplicationId}
              >
                <option value="">Pilih pengajuan</option>
                {payableApplications.map((application) => (
                  <option key={application.id} value={application.id}>
                    {application.applicationId} · {application.applicantName}
                  </option>
                ))}
              </select>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs text-slate-700"
                inputMode="numeric"
                min={1000}
                name="amount"
                onChange={(event) => setCustomAmount(event.target.value.replace(/\D/g, ''))}
                placeholder="Nominal, mis. 500000"
                required
                value={customAmount ? Number(customAmount).toLocaleString('id-ID') : ''}
              />
              <button
                className="w-full rounded-full bg-[var(--primary)] px-4 py-3 text-xs font-bold text-white disabled:opacity-50"
                disabled={pending || !selectedApplicationId || !customAmount}
                type="submit"
              >
                {selectedApplication
                  ? `Bayar ${formatRupiah(Number(customAmount) || 0)}`
                  : 'Lanjutkan pembayaran'}
              </button>
            </form>
          </DashboardCard>
        </section>
      )}

      {overview && overview.payments.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Riwayat pembayaran</h2>
            <button
              className="text-[11px] font-semibold text-[var(--primary)] disabled:opacity-50"
              disabled={pending}
              onClick={refresh}
              type="button"
            >
              Segarkan
            </button>
          </div>
          <DashboardCard>
            {overview.payments.map((payment) => (
              <div
                className="flex items-center gap-3 border-b border-slate-100 p-4 last:border-0"
                key={payment.id}
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                    payment.status === 'PAID'
                      ? 'bg-emerald-50 text-emerald-600'
                      : payment.status === 'PENDING'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <DashboardIcon name={payment.status === 'PAID' ? 'check' : 'receipt'} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-800">
                    {payment.description || 'Pembayaran'}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {STATUS_LABELS[payment.status] ?? payment.status}
                    {payment.paidAt
                      ? ` · ${new Date(payment.paidAt).toLocaleDateString('id-ID')}`
                      : ''}
                    {payment.paidMethod ? ` · ${payment.paidMethod}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-bold text-slate-700">
                  {formatRupiah(payment.amount)}
                </span>
              </div>
            ))}
          </DashboardCard>
        </section>
      )}

      <div className="flex gap-3 rounded-2xl bg-indigo-50 p-4">
        <DashboardIcon className="mt-0.5 size-5 shrink-0 text-[var(--primary)]" name="lock" />
        <p className="text-[11px] leading-5 text-slate-600">
          Pembayaran diproses di halaman aman Xendit. Tersedia Virtual Account (BCA, Mandiri, BNI,
          BRI) dan QRIS; status lunas dikonfirmasi otomatis.
        </p>
      </div>

      {!loading && !token && (
        <Link
          className="rounded-full bg-[var(--primary)] px-4 py-3 text-center text-xs font-bold text-white"
          href="/?step=1"
        >
          Mulai pengajuan untuk membayar
        </Link>
      )}
    </DashboardScaffold>
  )
}
