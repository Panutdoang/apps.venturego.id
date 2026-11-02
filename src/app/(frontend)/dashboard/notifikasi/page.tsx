import { DashboardCard, DashboardIcon, DashboardScaffold } from '../_components/dashboard-ui'

const notifications = [
  {
    icon: 'calendar' as const,
    title: 'Pengingat angsuran',
    detail: 'Angsuran Rp1.250.000 jatuh tempo pada 25 April 2026.',
    time: 'Hari ini, 09.20',
    unread: true,
  },
  {
    icon: 'document' as const,
    title: 'Dokumen akad tersedia',
    detail: 'Dokumen akad pembiayaan Anda sudah dapat dilihat dan diunduh.',
    time: '12 Mar 2026',
    unread: true,
  },
  {
    icon: 'check' as const,
    title: 'Pembayaran berhasil',
    detail: 'Pembayaran angsuran Maret telah diterima.',
    time: '25 Mar 2026',
    unread: false,
  },
]

export default function NotificationsPage() {
  return (
    <DashboardScaffold active="home" subtitle="Pembaruan akun Anda" title="Notifikasi">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">Terbaru</h2>
        <span className="text-xs font-semibold text-[var(--primary)]">Tandai sudah dibaca</span>
      </div>
      <DashboardCard>
        {notifications.map((item) => (
          <article
            className={`relative flex gap-3 border-b border-slate-100 p-4 last:border-0 ${
              item.unread ? 'bg-indigo-50/40' : ''
            }`}
            key={item.title}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-[var(--primary)] shadow-sm">
              <DashboardIcon name={item.icon} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-800">{item.title}</h3>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">{item.detail}</p>
              <span className="mt-2 block text-[10px] text-slate-400">{item.time}</span>
            </div>
            {item.unread && (
              <span className="absolute right-4 top-4 size-2 rounded-full bg-[var(--accent)]" />
            )}
          </article>
        ))}
      </DashboardCard>
    </DashboardScaffold>
  )
}
