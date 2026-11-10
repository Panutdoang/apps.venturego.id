'use client'

import { DashboardCard, DashboardIcon, DashboardScaffold } from '../../_components/dashboard-ui'

const ABOUT_ROWS: { label: string; value: string; href?: string }[] = [
  { label: 'Nama', value: 'VSV — Vworks Student Venture' },
  { label: 'Situs', value: 'venturego.id', href: 'https://venturego.id' },
  {
    label: 'Email layanan',
    value: 'vworksofficial@gmail.com',
    href: 'mailto:vworksofficial@gmail.com',
  },
  { label: 'Skema pembiayaan', value: 'Wakalah bil Ujrah' },
  { label: 'Basis data', value: 'Database aplikasi' },
]

export default function AboutPage() {
  return (
    <DashboardScaffold
      active="profil"
      backHref="/dashboard/profil"
      subtitle="Keterangan aplikasi"
      title="Tentang Aplikasi"
    >
      <DashboardCard className="brand-card p-5 text-white ring-0">
        <span className="grid size-12 place-items-center rounded-2xl bg-white/15">
          <DashboardIcon name="star" />
        </span>
        <h2 className="mt-4 text-lg font-bold">VSV — Vworks Student Venture</h2>
        <p className="mt-1.5 text-xs leading-5 text-blue-100">
          Platform pengajuan dan pemantauan pembiayaan syariah Wakalah bil Ujrah untuk siswa LPK —
          dari pengajuan, verifikasi berkas, hingga angsuran.
        </p>
      </DashboardCard>

      <DashboardCard>
        <dl className="grid grid-cols-2 gap-px bg-slate-100 text-xs">
          {ABOUT_ROWS.map((row, index) => (
            <div
              className={`bg-white p-4 ${index === ABOUT_ROWS.length - 1 && ABOUT_ROWS.length % 2 === 1 ? 'col-span-2' : ''}`}
              key={row.label}
            >
              <dt className="text-slate-400">{row.label}</dt>
              <dd className="mt-1 font-semibold text-slate-800">
                {row.href ? (
                  <a
                    className="text-[var(--primary)] underline"
                    href={row.href}
                    rel={row.href.startsWith('http') ? 'noreferrer' : undefined}
                    target={row.href.startsWith('http') ? '_blank' : undefined}
                  >
                    {row.value}
                  </a>
                ) : (
                  row.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </DashboardCard>

      <p className="text-center text-[10px] leading-4 text-slate-400">
        © 2026 VentureGo · Vworks Student Venture. Seluruh data pemohon dilindungi kebijakan
        pemrosesan data.
      </p>
    </DashboardScaffold>
  )
}
