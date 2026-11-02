'use client'

import Link from 'next/link'
import { useState } from 'react'

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

const quickActions = [
  { label: 'Bayar angsuran', icon: 'receipt' as const, href: '/dashboard/pembayaran' },
  { label: 'Simulasi', icon: 'wallet' as const, href: '/dashboard/simulasi' },
  { label: 'Ajukan dana', icon: 'plus' as const, href: '/' },
  { label: 'Bantuan', icon: 'help' as const, href: '/dashboard/bantuan' },
]

export default function DashboardPage() {
  const [showBalance, setShowBalance] = useState(true)

  return (
    <main className="dashboard-app min-h-dvh bg-[var(--canvas)]">
      <section className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[#f8f9fd] shadow-[0_0_48px_rgba(15,23,42,0.08)]">
        <header className="rounded-b-[32px] bg-[var(--primary)] px-5 pb-24 pt-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-white/15 ring-1 ring-white/25">
                <Icon name="profile" className="size-6" />
              </span>
              <div>
                <p className="text-xs text-indigo-100">Selamat datang,</p>
                <h1 className="mt-0.5 text-base font-bold tracking-tight">Dimas Pratama</h1>
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

        <div className="-mt-16 flex flex-1 flex-col gap-6 px-5 pb-8">
          <section
            className="rounded-3xl bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.10)]"
            id="ringkasan"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Sisa pembiayaan</p>
                <div className="mt-2 flex items-center gap-2">
                  <strong className="text-2xl font-bold tracking-[-0.03em] text-slate-950">
                    {showBalance ? 'Rp14.500.000' : 'Rp••••••••'}
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
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700">
                AKTIF
              </span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-[28%] rounded-full bg-[var(--accent)]" />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-slate-500">
              <span>28% telah dibayar</span>
              <span>Total Rp20.000.000</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
              <div>
                <span className="text-[11px] text-slate-400">Tenor tersisa</span>
                <strong className="mt-1 block text-sm text-slate-800">12 bulan</strong>
              </div>
              <div className="border-l border-slate-100 pl-4">
                <span className="text-[11px] text-slate-400">Nomor kontrak</span>
                <strong className="mt-1 block text-sm text-slate-800">VSV-240182</strong>
              </div>
            </div>
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
            <div className="grid grid-cols-4 gap-2">
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

          <section
            className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100"
            id="angsuran"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">
                  Angsuran berikutnya
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">Rp1.250.000</h2>
              </div>
              <span className="grid size-11 place-items-center rounded-2xl bg-amber-50 text-amber-600">
                <CalendarPage />
              </span>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Icon name="clock" className="size-4" />
                <span>Jatuh tempo 25 April 2026</span>
              </div>
              <Link
                className="rounded-full bg-[var(--primary)] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90"
                href="/dashboard/pembayaran"
              >
                Bayar
              </Link>
            </div>
          </section>

          <section aria-labelledby="activity-title" id="riwayat">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold tracking-tight text-slate-900" id="activity-title">
                Aktivitas terbaru
              </h2>
              <Link
                className="text-xs font-semibold text-[var(--primary)]"
                href="/dashboard/riwayat"
              >
                Lihat semua
              </Link>
            </div>
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
              <article className="flex items-center gap-3 border-b border-slate-100 p-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <Icon name="receipt" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold text-slate-800">Pembayaran angsuran</h3>
                  <p className="mt-1 text-[11px] text-slate-400">25 Maret 2026 • Berhasil</p>
                </div>
                <strong className="text-sm text-slate-800">Rp1.250.000</strong>
              </article>
              <Link className="flex items-center gap-3 p-4" href="/dashboard/dokumen">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-[var(--primary)]">
                  <Icon name="document" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold text-slate-800">
                    Dokumen akad tersedia
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-400">12 Maret 2026 • Dokumen</p>
                </div>
                <Icon name="chevron" className="size-5 text-slate-300" />
              </Link>
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

        <nav
          aria-label="Navigasi utama"
          className="sticky bottom-0 z-20 mt-auto grid grid-cols-4 border-t border-slate-100 bg-white/95 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 backdrop-blur"
        >
          <a className="flex flex-col items-center gap-1 text-[var(--primary)]" href="#ringkasan">
            <Icon name="home" className="size-5" />
            <span className="text-[10px] font-bold">Beranda</span>
          </a>
          <Link
            className="flex flex-col items-center gap-1 text-slate-400"
            href="/dashboard/angsuran"
          >
            <Icon name="wallet" className="size-5" />
            <span className="text-[10px] font-semibold">Angsuran</span>
          </Link>
          <Link
            className="flex flex-col items-center gap-1 text-slate-400"
            href="/dashboard/riwayat"
          >
            <Icon name="history" className="size-5" />
            <span className="text-[10px] font-semibold">Riwayat</span>
          </Link>
          <Link
            className="flex flex-col items-center gap-1 text-slate-400"
            href="/dashboard/profil"
          >
            <Icon name="profile" className="size-5" />
            <span className="text-[10px] font-semibold">Profil</span>
          </Link>
        </nav>
      </section>
    </main>
  )
}

function CalendarPage() {
  return <Icon name="calendar" className="size-5" />
}
