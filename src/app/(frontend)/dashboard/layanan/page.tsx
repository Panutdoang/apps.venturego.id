import Link from 'next/link'
import {
  DashboardCard,
  DashboardIcon,
  type DashboardIconName,
  DashboardScaffold,
} from '../_components/dashboard-ui'

const services: {
  href: string
  icon: DashboardIconName
  title: string
  detail: string
}[] = [
  {
    href: '/dashboard/pembayaran',
    icon: 'receipt',
    title: 'Bayar angsuran',
    detail: 'Selesaikan tagihan berikutnya',
  },
  {
    href: '/dashboard/simulasi',
    icon: 'calculator',
    title: 'Simulasi pembiayaan',
    detail: 'Hitung estimasi kewajiban',
  },
  {
    href: '/',
    icon: 'plus',
    title: 'Ajukan pembiayaan',
    detail: 'Mulai pengajuan baru',
  },
  {
    href: '/dashboard/dokumen',
    icon: 'document',
    title: 'Dokumen',
    detail: 'Lihat akad dan bukti bayar',
  },
  {
    href: '/dashboard/riwayat',
    icon: 'history',
    title: 'Riwayat transaksi',
    detail: 'Pantau seluruh aktivitas',
  },
  {
    href: '/dashboard/bantuan',
    icon: 'help',
    title: 'Pusat bantuan',
    detail: 'Hubungi layanan VSV',
  },
]

export default function ServicesPage() {
  return (
    <DashboardScaffold active="home" subtitle="Akses semua fitur VSV" title="Semua layanan">
      <div className="grid grid-cols-2 gap-3">
        {services.map((service) => (
          <Link href={service.href} key={service.title}>
            <DashboardCard className="h-full p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="grid size-11 place-items-center rounded-2xl bg-indigo-50 text-[var(--primary)]">
                <DashboardIcon name={service.icon} />
              </span>
              <h2 className="mt-4 text-sm font-bold text-slate-800">{service.title}</h2>
              <p className="mt-1 text-[10px] leading-4 text-slate-400">{service.detail}</p>
            </DashboardCard>
          </Link>
        ))}
      </div>
    </DashboardScaffold>
  )
}
