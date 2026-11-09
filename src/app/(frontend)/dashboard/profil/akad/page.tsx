'use client'

import { DashboardCard, DashboardIcon, DashboardScaffold } from '../../_components/dashboard-ui'

export default function AgreementInfoPage() {
  return (
    <DashboardScaffold
      active="profil"
      backHref="/dashboard/profil"
      subtitle="Skema pembiayaan VSV"
      title="Akad Wakalah bil Ujrah"
    >
      <DashboardCard className="bg-[var(--primary)] p-4 text-white ring-0">
        <h2 className="text-sm font-bold">Akad Wakalah bil Ujrah</h2>
        <p className="mt-1 text-xs leading-5 text-blue-100">
          Skema pembiayaan syariah yang dipakai VSV — Anda memberi kuasa kepada VentureGo untuk
          mengurus dan membayarkan kebutuhan yang disepakati.
        </p>
      </DashboardCard>

      <DashboardCard className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Cara kerjanya
        </p>
        <ul className="mt-3 space-y-3 text-xs leading-5 text-slate-600">
          <li className="flex gap-2.5">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
            Anda memberi kuasa kepada VentureGo sebagai wakil untuk membantu mengurus kebutuhan
            keberangkatan yang disepakati.
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
            Dana digunakan untuk kebutuhan yang disetujui; rincian dan bukti pengeluaran
            diverifikasi staf sebelum akad final.
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
            Ujrah adalah imbalan jasa yang besarannya dan cara pembayarannya harus tercantum jelas
            dalam akad.
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
            Nilai final (Nafaqah, Ujrah, dan jadwal angsuran) mengikuti verifikasi serta persetujuan
            Anda; angka simulasi bukan ketentuan akad.
          </li>
        </ul>
      </DashboardCard>

      <DashboardCard className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Istilah dalam akad
        </p>
        <dl className="mt-3 space-y-3 text-xs">
          <div>
            <dt className="font-bold text-slate-800">Nafaqah</dt>
            <dd className="mt-0.5 leading-5 text-slate-600">
              Biaya riil kebutuhan keberangkatan yang dibayarkan VentureGo atas persetujuan Anda,
              lengkap dengan rincian dan bukti pengeluaran.
            </dd>
          </div>
          <div>
            <dt className="font-bold text-slate-800">Ujrah</dt>
            <dd className="mt-0.5 leading-5 text-slate-600">
              Imbalan jasa VentureGo; besaran dan cara pembayarannya tercantum dalam akad final.
            </dd>
          </div>
          <div>
            <dt className="font-bold text-slate-800">Uang saku qardh</dt>
            <dd className="mt-0.5 leading-5 text-slate-600">
              Pinjaman uang saku yang dicatat dalam akad bila diajukan pada skema Dana
              Keberangkatan.
            </dd>
          </div>
          <div>
            <dt className="font-bold text-slate-800">Total akad</dt>
            <dd className="mt-0.5 leading-5 text-slate-600">
              Nafaqah + Ujrah + uang saku qardh − refund/potongan.
            </dd>
          </div>
        </dl>
      </DashboardCard>

      <DashboardCard className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Akses cepat
        </p>
        <div className="mt-3 space-y-2">
          <a
            className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            href="/dashboard/profil/dokumen"
          >
            Lihat PDF akad di Dokumen Saya
          </a>
          <a
            className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            href="/dashboard/angsuran"
          >
            Rincian kewajiban &amp; angsuran
          </a>
          <a
            className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            href="/dashboard/simulasi"
          >
            Simulasi pembiayaan
          </a>
        </div>
      </DashboardCard>
    </DashboardScaffold>
  )
}
