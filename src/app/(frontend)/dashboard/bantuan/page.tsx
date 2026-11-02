import {
  DashboardCard,
  DashboardIcon,
  DashboardMenuRow,
  DashboardScaffold,
} from '../_components/dashboard-ui'

export default function HelpPage() {
  return (
    <DashboardScaffold active="home" subtitle="Kami siap membantu" title="Pusat bantuan">
      <DashboardCard className="bg-[var(--primary)] p-5 text-white ring-0">
        <span className="grid size-12 place-items-center rounded-2xl bg-white/15">
          <DashboardIcon name="help" />
        </span>
        <h2 className="mt-4 text-xl font-bold">Ada yang bisa kami bantu?</h2>
        <p className="mt-2 text-xs leading-5 text-indigo-100">
          Temukan jawaban atau hubungi tim layanan VSV pada jam operasional.
        </p>
      </DashboardCard>

      <section>
        <h2 className="mb-3 text-sm font-bold text-slate-900">Hubungi kami</h2>
        <DashboardCard>
          <DashboardMenuRow
            detail="Senin–Jumat, 08.00–17.00 WIB"
            href="/dashboard/bantuan"
            icon="phone"
            title="WhatsApp layanan"
          />
          <DashboardMenuRow
            detail="support@venturego.id"
            href="/dashboard/bantuan"
            icon="mail"
            title="Kirim email"
          />
        </DashboardCard>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-slate-900">Pertanyaan populer</h2>
        <DashboardCard>
          {[
            'Bagaimana cara membayar angsuran?',
            'Kapan pembayaran saya diverifikasi?',
            'Bagaimana mengunduh dokumen akad?',
            'Apa yang terjadi jika terlambat membayar?',
          ].map((question) => (
            <div
              className="flex items-center justify-between border-b border-slate-100 p-4 text-sm font-semibold text-slate-700 last:border-0"
              key={question}
            >
              <span>{question}</span>
              <DashboardIcon name="chevron" className="size-5 shrink-0 text-slate-300" />
            </div>
          ))}
        </DashboardCard>
      </section>
    </DashboardScaffold>
  )
}
