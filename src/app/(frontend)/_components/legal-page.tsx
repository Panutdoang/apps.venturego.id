import Link from 'next/link'
import type { ReactNode } from 'react'

export const SERVICE_EMAIL = 'vworksofficial@gmail.com'

export type LegalSection = { title: string; body: ReactNode }

// Kerangka halaman publik Kebijakan Privasi & Syarat Layanan.
// Bisa dibuka tanpa login (dibutuhkan Google OAuth, Play Store, App Store).
export function LegalPage({
  title,
  effectiveDate,
  intro,
  sections,
}: {
  title: string
  effectiveDate: string
  intro: ReactNode
  sections: LegalSection[]
}) {
  return (
    <main className="dashboard-app min-h-screen bg-[var(--canvas)]">
      <header className="brand-surface rounded-b-[32px] px-5 pb-10 pt-8 text-white">
        <div className="mx-auto max-w-2xl">
          <Link className="text-xs font-semibold text-white/85 hover:text-white" href="/">
            ← VentureGo · Vworks Student Venture
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">{title}</h1>
          <p className="mt-1 text-xs text-white/85">Berlaku sejak {effectiveDate}</p>
        </div>
      </header>

      <article className="legal-content mx-auto -mt-5 max-w-2xl px-4 pb-16">
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-7">
          <div className="text-sm leading-6 text-slate-600">{intro}</div>
          <ol className="mt-6 space-y-6">
            {sections.map((section, index) => (
              <li key={section.title}>
                <h2 className="text-base font-bold text-slate-900">
                  {index + 1}. {section.title}
                </h2>
                <div className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
                  {section.body}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <nav className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs font-semibold">
          <Link className="text-[var(--primary)] hover:underline" href="/kebijakan-privasi">
            Kebijakan Privasi
          </Link>
          <Link className="text-[var(--primary)] hover:underline" href="/syarat-layanan">
            Syarat Layanan
          </Link>
          <Link className="text-[var(--primary)] hover:underline" href="/">
            Beranda
          </Link>
        </nav>
      </article>
    </main>
  )
}
