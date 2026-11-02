import {
  DashboardCard,
  DashboardIcon,
  DashboardMenuRow,
  DashboardScaffold,
} from '../_components/dashboard-ui'

export default function ProfilePage() {
  return (
    <DashboardScaffold active="profil" subtitle="Kelola akun dan keamanan" title="Profil saya">
      <DashboardCard>
        <div className="flex items-center gap-4 p-5">
          <span className="grid size-16 place-items-center rounded-full bg-indigo-50 text-[var(--primary)]">
            <DashboardIcon name="profile" className="size-8" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-slate-900">Dimas Pratama</h2>
            <p className="mt-1 text-xs text-slate-500">Pengguna terverifikasi</p>
          </div>
          <span className="grid size-9 place-items-center rounded-full bg-slate-100 text-slate-500">
            <DashboardIcon name="edit" className="size-4" />
          </span>
        </div>
        <div className="grid grid-cols-2 border-t border-slate-100">
          <div className="p-4">
            <span className="text-[10px] text-slate-400">Nomor ponsel</span>
            <strong className="mt-1 block text-xs text-slate-700">0812 •••• 4821</strong>
          </div>
          <div className="border-l border-slate-100 p-4">
            <span className="text-[10px] text-slate-400">ID pengguna</span>
            <strong className="mt-1 block text-xs text-slate-700">VSV-104821</strong>
          </div>
        </div>
      </DashboardCard>

      <section>
        <h2 className="mb-3 text-sm font-bold text-slate-900">Akun</h2>
        <DashboardCard>
          <DashboardMenuRow
            detail="Data identitas dan kontak"
            href="/dashboard/profil"
            icon="profile"
            title="Informasi pribadi"
          />
          <DashboardMenuRow
            detail="Akad dan ringkasan pembiayaan"
            href="/dashboard/dokumen"
            icon="document"
            title="Dokumen saya"
          />
          <DashboardMenuRow
            detail="PIN dan perlindungan akun"
            href="/dashboard/profil"
            icon="lock"
            title="Keamanan"
          />
        </DashboardCard>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-slate-900">Dukungan</h2>
        <DashboardCard>
          <DashboardMenuRow
            detail="Hubungi tim layanan VSV"
            href="/dashboard/bantuan"
            icon="help"
            title="Pusat bantuan"
          />
        </DashboardCard>
      </section>

      <p className="text-center text-[10px] text-slate-400">VentureGo VSV • Versi demo 1.0</p>
    </DashboardScaffold>
  )
}
