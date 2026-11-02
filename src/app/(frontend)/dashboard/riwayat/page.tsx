import { DashboardCard, DashboardIcon, DashboardScaffold } from '../_components/dashboard-ui'

const transactions = [
  { date: '25 Mar 2026', label: 'Pembayaran angsuran', amount: 'Rp1.250.000' },
  { date: '25 Feb 2026', label: 'Pembayaran angsuran', amount: 'Rp1.250.000' },
  { date: '25 Jan 2026', label: 'Pembayaran angsuran', amount: 'Rp1.250.000' },
  { date: '24 Des 2025', label: 'Pencairan pembiayaan', amount: 'Rp20.000.000' },
]

export default function HistoryPage() {
  return (
    <DashboardScaffold active="riwayat" subtitle="Seluruh aktivitas akun" title="Riwayat transaksi">
      <div className="grid grid-cols-3 gap-2">
        {['Semua', 'Pembayaran', 'Dokumen'].map((filter, index) => (
          <span
            className={`rounded-full px-3 py-2.5 text-center text-xs font-semibold ${
              index === 0
                ? 'bg-[var(--primary)] text-white'
                : 'bg-white text-slate-500 ring-1 ring-slate-200'
            }`}
            key={filter}
          >
            {filter}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">2026</h2>
        <span className="text-[11px] text-slate-400">4 aktivitas</span>
      </div>

      <DashboardCard>
        {transactions.map((transaction, index) => (
          <article
            className="flex items-center gap-3 border-b border-slate-100 p-4 last:border-0"
            key={`${transaction.date}-${transaction.label}`}
          >
            <span
              className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
                index === transactions.length - 1
                  ? 'bg-indigo-50 text-[var(--primary)]'
                  : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              <DashboardIcon name={index === transactions.length - 1 ? 'wallet' : 'receipt'} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-bold text-slate-800">{transaction.label}</h3>
              <p className="mt-1 text-[11px] text-slate-400">{transaction.date} • Berhasil</p>
            </div>
            <strong className="text-xs text-slate-700">{transaction.amount}</strong>
          </article>
        ))}
      </DashboardCard>

      <div className="flex gap-3 rounded-2xl bg-indigo-50 p-4 text-[11px] leading-5 text-slate-600">
        <DashboardIcon name="info" className="mt-0.5 size-5 shrink-0 text-[var(--primary)]" />
        Riwayat di halaman ini adalah data demo dan belum terhubung dengan akun pembayaran nyata.
      </div>
    </DashboardScaffold>
  )
}
