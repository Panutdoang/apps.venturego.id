'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { getFirebaseClientAuth } from '@/lib/firebase-client'
import { DashboardBottomNav } from './_components/dashboard-ui'
import { getDashboardSummary, type DashboardApplication } from './actions'

type IconName =
  | 'bell'
  | 'calendar'
  | 'chevron'
  | 'clock'
  | 'document'
  | 'eye'
  | 'eyeOff'
  | 'help'
  | 'history'
  | 'home'
  | 'plus'
  | 'profile'
  | 'receipt'
  | 'shield'
  | 'vip'
  | 'wallet'

function Icon({ name, className = 'size-5' }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    calendar: (
      <>
        <path d="M8 2v4M16 2v4M3 10h18" />
        <rect x="3" y="4" width="18" height="18" rx="3" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    document: (
      <>
        <path d="M6 2h8l4 4v16H6z" />
        <path d="M14 2v5h5M9 13h6M9 17h6" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    eyeOff: (
      <>
        <path d="m3 3 18 18M10.6 6.2A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-2.1 2.8M6.2 6.2C3.5 8 2 12 2 12s3.5 6 10 6a10 10 0 0 0 4.2-.9" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.8 9a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.2.9-1.2 1.8M12 17h.01" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5M12 7v5l3 2" />
      </>
    ),
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v11h14V10M9 21v-7h6v7" />
      </>
    ),
    plus: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 22a8 8 0 0 1 16 0" />
      </>
    ),
    receipt: (
      <>
        <path d="M5 3h14v19l-3-2-4 2-4-2-3 2z" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" />
        <path d="m9 12 2 2 4-5" />
      </>
    ),
    vip: (
      <>
        <path d="m12 3 2.5 5.1 5.6.8-4.1 4 .97 5.6L12 15.9l-5 2.6.97-5.6-4.1-4 5.6-.8L12 3Z" />
        <path d="M7 21h10" />
      </>
    ),
    wallet: (
      <>
        <path d="M4 5h14a2 2 0 0 1 2 2v12H4a2 2 0 0 1-2-2V5a3 3 0 0 1 3-3h12" />
        <path d="M15 11h7v5h-7a2.5 2.5 0 0 1 0-5Z" />
      </>
    ),
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {paths[name]}
    </svg>
  )
}

const formatRupiah = (value: number) => `Rp${value.toLocaleString('id-ID')}`

const formatDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Belum ditentukan'
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

const STATUS_LABELS: Record<string, string> = {
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

const STAGE_BY_STATUS: Record<string, number> = {
  SUBMITTED: 1,
  ELIGIBILITY_REVIEW: 2,
  DOCUMENT_REVIEW: 3,
  REVISION_REQUIRED: 3,
  COST_VERIFICATION: 4,
  APPROVED: 4,
  CONTRACT_PREPARATION: 4,
  ACTIVE: 6,
  COMPLETED: 7,
}

const PRODUCT_LABELS: Record<DashboardApplication['product'], string> = {
  FULL_COVER: 'Full Cover',
  DEPARTURE_BRIDGING: 'Dana Keberangkatan',
}

const progressSteps = [
  { step: 1, label: 'Pengajuan', sub: 'Mengisi form pengajuan Vworks Students Venture' },
  { step: 2, label: 'Verifikasi & kelayakan', sub: 'Oleh tim Venturego & pihak LPK mitra' },
  { step: 3, label: 'Pengumpulan berkas online', sub: 'Scan dokumen persyaratan lengkap' },
  { step: 4, label: 'Akad pembiayaan', sub: 'Penandatanganan kontrak syariah' },
  { step: 5, label: 'Pencairan dana', sub: 'Dana dikirim langsung ke LPK' },
  { step: 6, label: 'Program angsuran', sub: 'Cicilan berjalan sesuai jadwal' },
  { step: 7, label: 'Pelunasan', sub: 'Program pembiayaan selesai' },
]

const quickActions = [
  { label: 'Bayar angsuran', icon: 'receipt' as const, href: '/dashboard/pembayaran' },
  { label: 'Simulasi', icon: 'wallet' as const, href: '/dashboard/simulasi' },
  { label: 'Ajukan baru', icon: 'plus' as const, href: '/?step=1' },
  { label: 'Bantuan', icon: 'help' as const, href: '/dashboard/bantuan' },
  { label: 'VIP', icon: 'vip' as const, href: '/dashboard/vip' },
]

export default function DashboardPage() {
  const [showBalance, setShowBalance] = useState(true)
  const [showSubmissionNotice, setShowSubmissionNotice] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [application, setApplication] = useState<DashboardApplication | null>(null)
  const [accountName, setAccountName] = useState('')

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('applicationSubmitted') !== '1') return

    setShowSubmissionNotice(true)
    window.history.replaceState(window.history.state, '', '/dashboard')
    const timeout = window.setTimeout(() => setShowSubmissionNotice(false), 5000)
    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = onAuthStateChanged(getFirebaseClientAuth(), async (user) => {
        if (!active) return
        if (!user) {
          setApplication(null)
          setAccountName('')
          setError('')
          setLoading(false)
          return
        }
        setAccountName(user.displayName?.trim() ?? '')
        try {
          const idToken = await user.getIdToken()
          if (!active) return
          const result = await getDashboardSummary(idToken)
          if (!active) return
          if (!result.ok) {
            setError(result.message)
            setApplication(null)
          } else {
            setError('')
            setApplication(result.application)
          }
        } catch {
          if (active) setError('Ringkasan tidak dapat dimuat. Silakan muat ulang halaman.')
        } finally {
          if (active) setLoading(false)
        }
      })
    } catch {
      setError('Ringkasan tidak dapat dimuat. Silakan muat ulang halaman.')
      setLoading(false)
    }
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  const schedule = application?.schedule ?? null
  const closed = ['REJECTED', 'CANCELLED'].includes(application?.status ?? '')
  const currentStep = application ? (STAGE_BY_STATUS[application.status] ?? 0) : 0
  const allDone = application?.status === 'COMPLETED'
  const primaryAmount =
    application?.totalObligation ?? application?.requestedFinancingAmount ?? null
  const amountLabel =
    application?.totalObligation !== null && application?.totalObligation !== undefined
      ? 'Total kewajiban akad'
      : 'Estimasi diajukan'
  const statusLabel = application ? (STATUS_LABELS[application.status] ?? application.status) : ''
  const greetingName = loading
    ? 'Memuat…'
    : application
      ? application.applicantName.split(' ')[0]
      : accountName || 'Pengguna'

  return (
    <main className="dashboard-app min-h-dvh bg-[var(--canvas)]">
      {showSubmissionNotice && (
        <div
          aria-live="polite"
          className="fixed left-1/2 top-4 z-50 flex w-[calc(100%-32px)] max-w-[398px] -translate-x-1/2 items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_8px_32px_rgba(15,23,42,0.16)] ring-1 ring-emerald-100"
          role="status"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">
            ✓
          </span>
          <span className="text-sm font-semibold text-slate-800">Pengajuan berhasil diajukan</span>
        </div>
      )}
      <section className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-[#f8f9fd] shadow-[0_0_48px_rgba(15,23,42,0.08)]">
        <header className="rounded-b-[32px] bg-[var(--primary)] px-5 pb-24 pt-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-white/15 ring-1 ring-white/25">
                <Icon name="profile" className="size-6" />
              </span>
              <div>
                <p className="text-xs text-indigo-100">Selamat datang,</p>
                <h1 className="mt-0.5 text-base font-bold tracking-tight">{greetingName}</h1>
              </div>
            </div>
            <Link
              aria-label="Lihat notifikasi"
              className="relative grid size-11 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"
              href="/dashboard/notifikasi"
            >
              <Icon name="bell" />
              <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-amber-300 ring-2 ring-[var(--primary)]" />
            </Link>
          </div>
        </header>

        <div className="-mt-16 flex flex-1 flex-col gap-6 px-5 pb-32">
          <section
            className="rounded-3xl bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.10)]"
            id="ringkasan"
          >
            {loading && (
              <p className="text-sm text-slate-500" role="status">
                Memuat ringkasan pengajuan…
              </p>
            )}
            {!loading && error && (
              <p
                className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800"
                role="alert"
              >
                {error}
              </p>
            )}
            {!loading && !error && application && (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">{amountLabel}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <strong className="text-2xl font-bold tracking-[-0.03em] text-slate-950">
                        {primaryAmount !== null
                          ? showBalance
                            ? formatRupiah(primaryAmount)
                            : 'Rp••••••••'
                          : 'Belum tercatat'}
                      </strong>
                      {primaryAmount !== null && (
                        <button
                          aria-label={showBalance ? 'Sembunyikan nominal' : 'Tampilkan nominal'}
                          className="grid size-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          onClick={() => setShowBalance((current) => !current)}
                          type="button"
                        >
                          <Icon name={showBalance ? 'eye' : 'eyeOff'} className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${
                      application.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700'
                        : closed
                          ? 'bg-red-50 text-red-700'
                          : 'bg-indigo-50 text-[var(--primary)]'
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>
                {schedule ? (
                  <>
                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{
                          width: `${Math.round((schedule.dueByToday / schedule.total) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                      <span>
                        {schedule.dueByToday} dari {schedule.total} angsuran jatuh tempo
                      </span>
                      <span>
                        {application.totalObligation !== null
                          ? `Total kewajiban ${formatRupiah(application.totalObligation)}`
                          : `${PRODUCT_LABELS[application.product]}`}
                      </span>
                    </div>
                    <div
                      className="mt-5 grid gap-3 border-t border-slate-100 pt-4"
                      style={{ gridTemplateColumns: '1fr 3fr' }}
                    >
                      <div>
                        <span className="text-[11px] text-slate-400">Sisa angsuran</span>
                        <strong className="mt-1 block text-sm text-slate-800">
                          {schedule.total - schedule.dueByToday} kali
                        </strong>
                      </div>
                      <div className="border-l border-slate-100 pl-4">
                        <span className="text-[11px] text-slate-400">Jatuh tempo berikutnya</span>
                        <div className="mt-1">
                          <strong className="text-sm text-slate-800">
                            {schedule.nextDueDate
                              ? `${formatDate(schedule.nextDueDate)}${
                                  schedule.nextDueAmount !== null
                                    ? ` · ${formatRupiah(schedule.nextDueAmount)}`
                                    : ''
                                }`
                              : 'Semua angsuran jatuh tempo'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div
                    className="mt-5 grid gap-3 border-t border-slate-100 pt-4"
                    style={{ gridTemplateColumns: '1fr 3fr' }}
                  >
                    <div>
                      <span className="text-[11px] text-slate-400">Berkas terunggah</span>
                      <strong className="mt-1 block text-sm text-slate-800">
                        {application.documentsUploaded}/{application.documentsTotal}
                      </strong>
                    </div>
                    <div className="border-l border-slate-100 pl-4">
                      <span className="text-[11px] text-slate-400">Nomor pengajuan</span>
                      <div className="mt-1">
                        <strong className="text-sm text-slate-800">
                          {application.applicationId}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
                {application.pricingStatus === 'ESTIMATED' && !schedule && (
                  <p className="mt-4 text-[11px] leading-4 text-slate-400">
                    {PRODUCT_LABELS[application.product]} · Rincian biaya sedang disusun dan
                    diverifikasi tim VentureGo.
                  </p>
                )}
              </>
            )}
            {!loading && !error && !application && (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Total angsuran terbayar</p>
                    <div className="mt-2 flex items-center gap-2">
                      <strong className="text-2xl font-bold tracking-[-0.03em] text-slate-950">
                        {showBalance ? formatRupiah(0) : 'Rp••••••••'}
                      </strong>
                      <button
                        aria-label={showBalance ? 'Sembunyikan nominal' : 'Tampilkan nominal'}
                        className="grid size-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        onClick={() => setShowBalance((current) => !current)}
                        type="button"
                      >
                        <Icon name={showBalance ? 'eye' : 'eyeOff'} className="size-4" />
                      </button>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-500">
                    Belum ada pengajuan
                  </span>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-0 rounded-full bg-[var(--accent)]" />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                  <span>Belum ada pembayaran</span>
                  <span>Total kewajiban Rp0</span>
                </div>
                <div
                  className="mt-5 grid gap-3 border-t border-slate-100 pt-4"
                  style={{ gridTemplateColumns: '2fr 3fr' }}
                >
                  <div>
                    <span className="text-[11px] text-slate-400">Tenor</span>
                    <strong className="mt-1 block text-sm text-slate-800">0 bulan</strong>
                  </div>
                  <div className="border-l border-slate-100 pl-4">
                    <span className="text-[11px] text-slate-400">Virtual Account</span>
                    <div className="mt-1">
                      <strong className="text-sm text-slate-800">0000000000000000</strong>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--primary)] to-indigo-900 p-5 text-white shadow-sm">
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold tracking-tight text-white">
                  Ajukan Pembiayaan Baru
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-indigo-100">
                  Mulai pengajuan Full Cover atau Dana Keberangkatan dengan skema syariah.
                </p>
              </div>
              <Link
                className="shrink-0 rounded-full bg-amber-400 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-sm transition hover:bg-amber-300 active:scale-95"
                href="/?step=1"
              >
                Mulai
              </Link>
            </div>
            <div className="pointer-events-none absolute -bottom-8 -right-8 size-32 rounded-full bg-white/10 blur-xl" />
          </section>

          <section aria-labelledby="quick-actions-title">
            <div className="mb-4 flex items-center justify-between">
              <h2
                className="text-base font-bold tracking-tight text-slate-900"
                id="quick-actions-title"
              >
                Layanan cepat
              </h2>
              <Link className="text-xs font-medium text-[var(--primary)]" href="/dashboard/layanan">
                Semua layanan
              </Link>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {quickActions.map((action) => (
                <Link
                  className="group flex min-w-0 flex-col items-center gap-2 text-center"
                  href={action.href}
                  key={action.label}
                >
                  <span className="grid size-13 place-items-center rounded-2xl bg-white text-[var(--primary)] shadow-sm ring-1 ring-slate-100 transition group-hover:-translate-y-0.5 group-hover:shadow-md">
                    <Icon name={action.icon} className="size-5" />
                  </span>
                  <span className="text-[10px] font-semibold leading-4 text-slate-600">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="progress-title" id="progress">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold tracking-tight text-slate-900" id="progress-title">
                Alur progress saat ini
              </h2>
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-[var(--primary)]">
                {loading
                  ? 'Memuat…'
                  : application
                    ? allDone
                      ? 'Selesai 7/7'
                      : currentStep > 0
                        ? `Tahap ${currentStep}/7`
                        : 'Tidak aktif'
                    : 'Belum memulai'}
              </span>
            </div>
            {closed && application && (
              <p className="mb-3 rounded-xl bg-red-50 p-3 text-[11px] leading-5 text-red-700">
                Pengajuan ini {application.status === 'REJECTED' ? 'ditolak' : 'dibatalkan'} dan
                tidak berlanjut ke tahap berikutnya.
              </p>
            )}
            <div className="overflow-hidden rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <ol className="relative space-y-0">
                {progressSteps.map((item, idx, arr) => {
                  const done = Boolean(application) && (allDone || item.step < currentStep)
                  const active =
                    Boolean(application) && !allDone && item.step === currentStep && !closed
                  return (
                    <li key={item.step} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <span
                          className={[
                            'grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ring-2',
                            done
                              ? 'bg-[var(--primary)] text-white ring-[var(--primary)]'
                              : active
                                ? 'bg-white text-[var(--primary)] ring-[var(--primary)]'
                                : 'bg-slate-100 text-slate-400 ring-slate-200',
                          ].join(' ')}
                        >
                          {done ? (
                            <svg
                              className="size-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          ) : (
                            item.step
                          )}
                        </span>
                        {idx < arr.length - 1 && (
                          <span
                            className={[
                              'mt-1 w-0.5 flex-1 rounded-full',
                              done ? 'bg-[var(--primary)]' : 'bg-slate-200',
                            ].join(' ')}
                            style={{ minHeight: '28px' }}
                          />
                        )}
                      </div>
                      <div className={['pb-5', idx === arr.length - 1 ? 'pb-0' : ''].join(' ')}>
                        <p
                          className={[
                            'text-sm font-bold leading-tight',
                            active
                              ? 'text-[var(--primary)]'
                              : done
                                ? 'text-slate-800'
                                : 'text-slate-400',
                          ].join(' ')}
                        >
                          {item.label}
                          {active && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                              SEKARANG
                            </span>
                          )}
                        </p>
                        <p
                          className={[
                            'mt-0.5 text-[11px]',
                            done || active ? 'text-slate-400' : 'text-slate-300',
                          ].join(' ')}
                        >
                          {item.sub}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          </section>

          <aside className="flex items-start gap-3 rounded-2xl bg-indigo-50 p-4" id="bantuan">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[var(--primary)]">
              <Icon name="help" className="size-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Butuh bantuan?</h2>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                Tim VSV siap membantu pertanyaan pembiayaan dan angsuran Anda.
              </p>
            </div>
          </aside>
        </div>

        <DashboardBottomNav active="home" />
      </section>
    </main>
  )
}
