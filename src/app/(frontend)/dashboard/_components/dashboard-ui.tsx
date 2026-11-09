import Link from 'next/link'
import type { ReactNode } from 'react'

export type DashboardIconName =
  | 'arrowLeft'
  | 'bank'
  | 'bell'
  | 'calculator'
  | 'calendar'
  | 'card'
  | 'check'
  | 'chevron'
  | 'clock'
  | 'document'
  | 'download'
  | 'edit'
  | 'help'
  | 'history'
  | 'home'
  | 'info'
  | 'lock'
  | 'mail'
  | 'phone'
  | 'plus'
  | 'profile'
  | 'receipt'
  | 'shield'
  | 'star'
  | 'upload'
  | 'wallet'

export function DashboardIcon({
  name,
  className = 'size-5',
}: {
  name: DashboardIconName
  className?: string
}) {
  const paths: Record<DashboardIconName, ReactNode> = {
    arrowLeft: <path d="m15 18-6-6 6-6M9 12h11" />,
    bank: (
      <>
        <path d="m3 9 9-6 9 6M5 10h14M6 10v8M10 10v8M14 10v8M18 10v8M3 21h18" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    calculator: (
      <>
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <path d="M8 6h8v4H8zM8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
      </>
    ),
    calendar: (
      <>
        <path d="M8 2v4M16 2v4M3 10h18" />
        <rect x="3" y="4" width="18" height="18" rx="3" />
      </>
    ),
    card: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20M6 15h4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    document: (
      <>
        <path d="M6 2h8l4 4v16H6zM14 2v5h5M9 13h6M9 17h6" />
      </>
    ),
    download: <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />,
    edit: <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20ZM14 7l3 3" />,
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.8 9a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.2.9-1.2 1.8M12 17h.01" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2" />
      </>
    ),
    home: (
      <>
        <path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7h.01" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    phone: (
      <path d="M6.6 2h3l1.5 5-2.3 1.5a16 16 0 0 0 6.7 6.7l1.5-2.3 5 1.5v3a3 3 0 0 1-3 3C10 20.4 3.6 14 3.6 5a3 3 0 0 1 3-3Z" />
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
        <path d="M5 3h14v19l-3-2-4 2-4-2-3 2zM9 8h6M9 12h6M9 16h4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" />
        <path d="m9 12 2 2 4-5" />
      </>
    ),
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
    upload: (
      <>
        <path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4" />
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

type PrimaryRoute = 'home' | 'angsuran' | 'riwayat' | 'berkas' | 'profil'

const navigation: {
  key: PrimaryRoute
  href: string
  label: string
  icon: DashboardIconName
}[] = [
  { key: 'angsuran', href: '/dashboard/angsuran', label: 'Angsuran', icon: 'wallet' },
  { key: 'riwayat', href: '/dashboard/riwayat', label: 'Riwayat', icon: 'history' },
  { key: 'home', href: '/dashboard', label: 'Beranda', icon: 'home' },
  { key: 'berkas', href: '/dashboard/unggah-berkas', label: 'Unggah', icon: 'upload' },
  { key: 'profil', href: '/dashboard/profil', label: 'Profil', icon: 'profile' },
]

export function DashboardScaffold({
  active,
  title,
  subtitle,
  showHeader = true,
  backHref = '/dashboard',
  children,
}: {
  active: PrimaryRoute
  title: string
  subtitle?: string
  showHeader?: boolean
  backHref?: string
  children: ReactNode
}) {
  return (
    <main className="dashboard-app min-h-dvh bg-[var(--canvas)]">
      <section className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-[#f8f9fd] shadow-[0_0_48px_rgba(15,23,42,0.08)]">
        {showHeader && (
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
            <Link
              aria-label="Kembali"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700"
              href={backHref}
            >
              <DashboardIcon name="arrowLeft" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight text-slate-950">{title}</h1>
              {subtitle && <p className="mt-0.5 truncate text-[11px] text-slate-500">{subtitle}</p>}
            </div>
          </header>
        )}
        <div className="flex flex-1 flex-col gap-5 px-5 py-5 pb-32">{children}</div>
        <DashboardBottomNav active={active} />
      </section>
    </main>
  )
}

export function DashboardBottomNav({ active }: { active: PrimaryRoute }) {
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex w-full items-center rounded-t-[24px] bg-white/95 px-2 py-1.5 shadow-[0_-8px_28px_rgba(15,23,42,0.10)] ring-1 ring-slate-200/60 backdrop-blur-xl">
        {navigation.map((item) => {
          const isActive = active === item.key
          const isHome = item.key === 'home'
          return (
            <Link
              className="group flex min-w-0 flex-1 flex-col items-center gap-0 px-1 py-1"
              href={item.href}
              key={item.key}
            >
              <span className="grid h-10 w-full place-items-center">
                <span
                  className={
                    isHome && isActive
                      ? 'grid size-10 place-items-center rounded-2xl bg-[var(--primary)] text-white shadow-[0_4px_12px_rgba(26,70,145,0.24)] ring-2 ring-blue-100 transition group-hover:opacity-90'
                      : isActive
                        ? 'grid size-9 place-items-center rounded-2xl bg-[var(--primary)] text-white shadow-sm transition group-hover:opacity-90'
                        : 'grid size-9 place-items-center rounded-2xl text-slate-400 transition group-hover:bg-slate-100 group-hover:text-slate-600'
                  }
                >
                  <DashboardIcon name={item.icon} className={isHome ? 'size-6' : 'size-5'} />
                </span>
              </span>
              <span
                className={
                  isHome && isActive
                    ? 'text-[11px] font-extrabold text-[var(--primary)]'
                    : isActive
                      ? 'text-[10px] font-bold text-[var(--primary)]'
                      : `text-[10px] font-semibold ${isHome ? 'text-slate-500' : 'text-slate-400'}`
                }
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export function DashboardCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100 ${className}`}
    >
      {children}
    </section>
  )
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />
}

export function DashboardCardSkeleton({
  rows = 3,
  className = '',
}: {
  rows?: number
  className?: string
}) {
  return (
    <section
      aria-label="Memuat konten"
      aria-live="polite"
      className={`overflow-hidden rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 ${className}`}
      role="status"
    >
      <span className="sr-only">Memuat konten…</span>
      <div className="mb-4 flex items-center gap-3">
        <SkeletonBlock className="size-10 shrink-0 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <SkeletonBlock className="h-3 w-2/5" />
          <SkeletonBlock className="h-2.5 w-3/5" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <div className="flex items-center gap-3" key={index}>
            <SkeletonBlock className="size-8 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <SkeletonBlock className={`h-2.5 ${index % 2 ? 'w-3/5' : 'w-4/5'}`} />
              <SkeletonBlock className={`h-2 ${index % 2 ? 'w-2/5' : 'w-1/2'}`} />
            </div>
            <SkeletonBlock className="h-3 w-14" />
          </div>
        ))}
      </div>
    </section>
  )
}

export function DashboardPageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <main className="dashboard-app min-h-dvh bg-[var(--canvas)]">
      <section className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-[#f8f9fd] px-5 py-6">
        <div aria-label="Memuat akun" className="space-y-6" role="status">
          <span className="sr-only">Memuat akun…</span>
          <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <SkeletonBlock className="size-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <SkeletonBlock className="h-2.5 w-24" />
              <SkeletonBlock className="h-4 w-40" />
            </div>
          </div>
          <SkeletonBlock className="h-32 rounded-3xl" />
          {Array.from({ length: rows }, (_, index) => (
            <DashboardCardSkeleton key={index} rows={2} />
          ))}
        </div>
      </section>
    </main>
  )
}

export function DashboardMenuRow({
  href,
  icon,
  title,
  detail,
}: {
  href: string
  icon: DashboardIconName
  title: string
  detail?: string
}) {
  return (
    <Link
      className="flex items-center gap-3 border-b border-slate-100 p-4 last:border-b-0"
      href={href}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-[var(--primary)]">
        <DashboardIcon name={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-sm text-slate-800">{title}</strong>
        {detail && (
          <small className="mt-1 block truncate text-[11px] text-slate-400">{detail}</small>
        )}
      </span>
      <DashboardIcon name="chevron" className="size-5 text-slate-300" />
    </Link>
  )
}
