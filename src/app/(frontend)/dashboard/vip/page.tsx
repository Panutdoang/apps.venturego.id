import { DashboardCard, DashboardIcon, DashboardScaffold } from '../_components/dashboard-ui'

export default function VipPage() {
  return (
    <DashboardScaffold active="home" title="VIP">
      <DashboardCard className="flex flex-col items-center px-6 py-10 text-center">
        <span className="grid size-16 place-items-center rounded-3xl bg-blue-50 text-[var(--primary)]">
          <DashboardIcon name="star" className="size-8" />
        </span>
        <span className="mt-5 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold text-amber-700">
          SEDANG DIKEMBANGKAN
        </span>
        <h2 className="mt-4 text-base font-bold text-slate-900">VIP</h2>
        <p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">
          Layanan VIP Vworks Students Venture sedang dalam pengembangan.
        </p>
      </DashboardCard>
    </DashboardScaffold>
  )
}
