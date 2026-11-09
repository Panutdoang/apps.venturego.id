'use client'

import { useMemo, useState } from 'react'
import { FINANCING_OPTIONS, calculateWakalahPlan, formatRupiah } from '@/lib/financing-plan'
import { DashboardCard, DashboardIcon, DashboardScaffold } from '../_components/dashboard-ui'

export default function SimulationPage() {
  const [amount, setAmount] = useState<number>(FINANCING_OPTIONS[0].amount)
  const plan = useMemo(() => calculateWakalahPlan(amount), [amount])

  return (
    <DashboardScaffold
      active="home"
      subtitle="Estimasi Wakalah bil Ujrah"
      title="Simulasi pembiayaan"
    >
      <DashboardCard className="bg-[var(--primary)] p-5 text-white ring-0">
        <span className="grid size-11 place-items-center rounded-2xl bg-white/15">
          <DashboardIcon name="calculator" />
        </span>
        <p className="mt-4 text-xs text-blue-100">Estimasi angsuran bulanan</p>
        <strong className="mt-2 block text-2xl tracking-tight">
          {formatRupiah(plan.monthlyInstallment)}
        </strong>
        <span className="mt-2 block text-[11px] text-blue-200">
          Selama {plan.tenorMonths} bulan
        </span>
      </DashboardCard>

      <section>
        <h2 className="mb-3 text-sm font-bold text-slate-900">Pilih kebutuhan pembiayaan</h2>
        <div className="grid grid-cols-2 gap-3">
          {FINANCING_OPTIONS.map((option) => (
            <button
              className={`rounded-2xl px-4 py-4 text-left transition ${
                amount === option.amount
                  ? 'bg-[var(--primary)] text-white shadow-md'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200'
              }`}
              key={option.amount}
              onClick={() => setAmount(option.amount)}
              type="button"
            >
              <span className="text-[10px] opacity-70">Pembiayaan</span>
              <strong className="mt-1 block text-sm">{option.label}</strong>
            </button>
          ))}
        </div>
      </section>

      <DashboardCard>
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-sm font-bold text-slate-900">Rincian estimasi</h2>
        </div>
        {[
          ['Nafaqah', formatRupiah(plan.nafaqahTotal)],
          ['Total ujrah', formatRupiah(plan.ujrahTotal)],
          ['Total kewajiban', formatRupiah(plan.totalObligation)],
          ['Tenor', `${plan.tenorMonths} bulan`],
          ['Angsuran terakhir', formatRupiah(plan.finalInstallment)],
        ].map(([label, value]) => (
          <div
            className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 text-xs last:border-0"
            key={label}
          >
            <span className="text-slate-500">{label}</span>
            <strong className="text-slate-800">{value}</strong>
          </div>
        ))}
      </DashboardCard>

      <div className="flex gap-3 rounded-2xl bg-blue-50 p-4">
        <DashboardIcon name="info" className="size-5 shrink-0 text-[var(--primary)]" />
        <p className="text-[11px] leading-5 text-slate-600">
          Hasil ini merupakan simulasi. Nilai akhir mengikuti verifikasi program, kebutuhan, dan
          akad pembiayaan.
        </p>
      </div>
    </DashboardScaffold>
  )
}
