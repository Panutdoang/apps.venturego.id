import { DashboardCard, DashboardIcon, DashboardScaffold } from '../_components/dashboard-ui'

const documents = [
  ['Akad pembiayaan', 'PDF • 1,8 MB • 12 Mar 2026'],
  ['Ringkasan pembiayaan', 'PDF • 680 KB • 12 Mar 2026'],
  ['Jadwal angsuran', 'PDF • 420 KB • 12 Mar 2026'],
  ['Bukti pembayaran Maret', 'PDF • 210 KB • 25 Mar 2026'],
]

export default function DocumentsPage() {
  return (
    <DashboardScaffold active="profil" subtitle="Arsip pembiayaan Anda" title="Dokumen saya">
      <div className="flex gap-3 rounded-2xl bg-indigo-50 p-4">
        <DashboardIcon name="shield" className="size-5 shrink-0 text-[var(--primary)]" />
        <p className="text-[11px] leading-5 text-slate-600">
          Dokumen dilindungi dan hanya dapat diakses melalui akun Anda.
        </p>
      </div>
      <DashboardCard>
        {documents.map(([title, detail]) => (
          <article
            className="flex items-center gap-3 border-b border-slate-100 p-4 last:border-0"
            key={title}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-[var(--primary)]">
              <DashboardIcon name="document" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-bold text-slate-800">{title}</h2>
              <p className="mt-1 truncate text-[10px] text-slate-400">{detail}</p>
            </div>
            <span
              aria-label={`Unduh ${title}`}
              className="grid size-9 place-items-center rounded-full bg-slate-100 text-slate-500"
            >
              <DashboardIcon name="download" className="size-4" />
            </span>
          </article>
        ))}
      </DashboardCard>
      <p className="text-center text-[10px] leading-4 text-slate-400">
        Tombol unduh akan aktif setelah dashboard terhubung ke data pengguna.
      </p>
    </DashboardScaffold>
  )
}
