import Link from 'next/link'
import { DashboardCard, DashboardIcon, DashboardScaffold } from '../_components/dashboard-ui'

const schedule = [
  { month: 'Maret 2026', date: '25 Mar', status: 'Lunas', paid: true },
  { month: 'April 2026', date: '25 Apr', status: 'Berikutnya', paid: false },
  { month: 'Mei 2026', date: '25 Mei', status: 'Terjadwal', paid: false },
  { month: 'Juni 2026', date: '25 Jun', status: 'Terjadwal', paid: false },
]

export default function InstallmentsPage() {
  return (
    <DashboardScaffold active="angsuran" subtitle="Kontrak VSV-240182" title="Angsuran saya">
      <DashboardCard className="bg-[var(--primary)] text-white ring-0">
        <div className="p-5">
          <span className="text-xs text-indigo-100">Sisa kewajiban</span>
          <strong className="mt-2 block text-2xl tracking-tight">Rp14.500.000</strong>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
            <div className="h-full w-[28%] rounded-full bg-white" />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-indigo-100">
            <span>4 dari 16 angsuran</span>
            <span>28% selesai</span>
          </div>
        </div>
      </DashboardCard>

      <DashboardCard>
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--primary)]">
              Jatuh tempo berikutnya
            </span>
            <strong className="mt-1 block text-xl text-slate-900">Rp1.250.000</strong>
            <span className="mt-1 block text-xs text-slate-500">25 April 2026</span>
          </div>
          <span className="grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-600">
            <DashboardIcon name="calendar" />
          </span>
        </div>
        <div className="p-4">
          <Link
            className="block rounded-full bg-[var(--primary)] px-5 py-3 text-center text-sm font-bold text-white"
            href="/dashboard/pembayaran"
          >
            Bayar sekarang
          </Link>
        </div>
      </DashboardCard>

      <section>
        <h2 className="mb-3 text-base font-bold text-slate-900">Jadwal angsuran</h2>
        <DashboardCard>
          {schedule.map((item) => (
            <div
              className="flex items-center gap-3 border-b border-slate-100 p-4 last:border-0"
              key={item.month}
            >
              <span
                className={`grid size-10 place-items-center rounded-xl ${
                  item.paid ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <DashboardIcon name={item.paid ? 'check' : 'clock'} className="size-5" />
              </span>
              <div className="flex-1">
                <strong className="text-sm text-slate-800">{item.month}</strong>
                <p className="mt-1 text-[11px] text-slate-400">Rp1.250.000 • {item.date}</p>
              </div>
              <span
                className={`text-[10px] font-bold ${
                  item.paid ? 'text-emerald-600' : 'text-slate-400'
                }`}
              >
                {item.status}
              </span>
            </div>
          ))}
        </DashboardCard>
      </section>
    </DashboardScaffold>
  )
}
