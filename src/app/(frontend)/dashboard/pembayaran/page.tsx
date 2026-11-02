'use client'

import Link from 'next/link'
import { useState } from 'react'
import { DashboardCard, DashboardIcon, DashboardScaffold } from '../_components/dashboard-ui'

export default function PaymentPage() {
  const [method, setMethod] = useState('bca')
  const [confirmed, setConfirmed] = useState(false)

  if (confirmed) {
    return (
      <DashboardScaffold active="angsuran" subtitle="Simulasi pembayaran" title="Pembayaran">
        <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
          <span className="grid size-20 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <DashboardIcon name="check" className="size-10" />
          </span>
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
            Instruksi pembayaran dibuat
          </h2>
          <p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">
            Ini adalah simulasi. Tidak ada transaksi atau tagihan nyata yang dibuat.
          </p>
          <DashboardCard className="mt-7 w-full p-5 text-left">
            <span className="text-[11px] text-slate-400">Nomor virtual account demo</span>
            <strong className="mt-2 block text-xl tracking-wider text-slate-900">
              8808 1048 2100
            </strong>
            <div className="mt-4 flex justify-between border-t border-slate-100 pt-4 text-xs">
              <span className="text-slate-500">Total pembayaran</span>
              <strong className="text-slate-900">Rp1.250.000</strong>
            </div>
          </DashboardCard>
          <Link
            className="mt-6 w-full rounded-full bg-[var(--primary)] px-5 py-3.5 text-sm font-bold text-white"
            href="/dashboard/angsuran"
          >
            Kembali ke angsuran
          </Link>
        </div>
      </DashboardScaffold>
    )
  }

  return (
    <DashboardScaffold
      active="angsuran"
      subtitle="Pembayaran aman dalam mode demo"
      title="Bayar angsuran"
    >
      <DashboardCard>
        <div className="border-b border-slate-100 p-5">
          <span className="text-xs text-slate-500">Total pembayaran</span>
          <strong className="mt-2 block text-2xl tracking-tight text-slate-950">Rp1.250.000</strong>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 text-xs">
          <div>
            <span className="text-slate-400">Jatuh tempo</span>
            <strong className="mt-1 block text-slate-700">25 April 2026</strong>
          </div>
          <div>
            <span className="text-slate-400">Angsuran ke</span>
            <strong className="mt-1 block text-slate-700">5 dari 16</strong>
          </div>
        </div>
      </DashboardCard>

      <section>
        <h2 className="mb-3 text-sm font-bold text-slate-900">Pilih metode pembayaran</h2>
        <DashboardCard>
          {[
            { id: 'bca', label: 'BCA Virtual Account', detail: 'Verifikasi otomatis' },
            { id: 'mandiri', label: 'Mandiri Virtual Account', detail: 'Verifikasi otomatis' },
            {
              id: 'bank',
              label: 'Transfer bank lainnya',
              detail: 'Verifikasi hingga 1 hari kerja',
            },
          ].map((option) => (
            <label
              className="flex cursor-pointer items-center gap-3 border-b border-slate-100 p-4 last:border-0"
              key={option.id}
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-indigo-50 text-[var(--primary)]">
                <DashboardIcon name="bank" />
              </span>
              <span className="flex-1">
                <strong className="block text-sm text-slate-800">{option.label}</strong>
                <small className="mt-1 block text-[10px] text-slate-400">{option.detail}</small>
              </span>
              <input
                checked={method === option.id}
                className="size-5 accent-[var(--primary)]"
                name="payment-method"
                onChange={() => setMethod(option.id)}
                type="radio"
              />
            </label>
          ))}
        </DashboardCard>
      </section>

      <div className="flex gap-3 rounded-2xl bg-amber-50 p-4">
        <DashboardIcon name="info" className="size-5 shrink-0 text-amber-600" />
        <p className="text-[11px] leading-5 text-amber-900">
          Halaman ini masih mode demo. Tombol di bawah hanya menampilkan contoh instruksi.
        </p>
      </div>

      <button
        className="mt-auto rounded-full bg-[var(--primary)] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-900/10"
        onClick={() => setConfirmed(true)}
        type="button"
      >
        Lanjutkan pembayaran
      </button>
    </DashboardScaffold>
  )
}
