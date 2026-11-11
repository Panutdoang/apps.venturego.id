'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { onAuthStateChanged } from 'firebase/auth'
import { getFirebaseClientAuth } from '@/lib/firebase-client'
import { formatRupiah } from '@/lib/financing-plan'
import {
  DashboardCard,
  DashboardCardSkeleton,
  DashboardIcon,
  DashboardScaffold,
} from '../_components/dashboard-ui'
import { getVipDetail, type VipLedgerItem, type VipLedgerType, type VipSummary } from './actions'

const LEDGER_LABELS: Record<VipLedgerType, { title: string; sign: 1 | -1; tone: string }> = {
  DEPOSIT: { title: 'Setoran dana', sign: 1, tone: 'bg-blue-50 text-[var(--primary)]' },
  WITHDRAWAL: { title: 'Penarikan dana', sign: -1, tone: 'bg-slate-100 text-slate-600' },
  PROFIT_SHARE: { title: 'Bagi hasil', sign: 1, tone: 'bg-emerald-50 text-emerald-700' },
  DIVIDEND: { title: 'Dividen', sign: 1, tone: 'bg-amber-50 text-amber-700' },
}

const formatDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

type Filter = 'Semua' | 'Bagi hasil' | 'Setoran & penarikan'

export default function VipPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [vip, setVip] = useState<VipSummary | null>(null)
  const [ledger, setLedger] = useState<VipLedgerItem[]>([])
  const [filter, setFilter] = useState<Filter>('Semua')

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = onAuthStateChanged(getFirebaseClientAuth(), async (user) => {
        if (!active) return
        if (!user) {
          setLoading(false)
          return
        }
        try {
          const result = await getVipDetail(await user.getIdToken())
          if (!active) return
          if (!result.ok) setError(result.message)
          else {
            setVip(result.vip)
            setLedger(result.ledger)
          }
        } catch {
          if (active) setError('Data VIP belum dapat dimuat. Silakan coba lagi.')
        } finally {
          if (active) setLoading(false)
        }
      })
    } catch {
      setError('Data VIP belum dapat dimuat. Silakan coba lagi.')
      setLoading(false)
    }
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  const shown = ledger.filter((item) =>
    filter === 'Semua'
      ? true
      : filter === 'Bagi hasil'
        ? item.type === 'PROFIT_SHARE' || item.type === 'DIVIDEND'
        : item.type === 'DEPOSIT' || item.type === 'WITHDRAWAL',
  )

  return (
    <DashboardScaffold active="home" subtitle="Vworks Investment Partner" title="VIP">
      {loading && (
        <>
          <DashboardCardSkeleton rows={3} />
          <DashboardCardSkeleton rows={4} />
        </>
      )}

      {!loading && error && (
        <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && vip && (
        <>
          <section className="rounded-3xl brand-card p-5 text-white shadow-sm">
            <p className="text-xs text-blue-100">Saldo Vworks Investment Partner</p>
            <strong className="mt-2 block text-3xl font-bold tracking-[-0.03em]">
              {formatRupiah(vip.principalBalance)}
            </strong>
            <p className="mt-1 text-[11px] text-blue-100">
              {vip.displayName}
              {vip.joinedAt ? ` · mitra sejak ${formatDate(vip.joinedAt)}` : ''}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/15 pt-4">
              <div>
                <span className="text-[11px] text-blue-100">Total bagi hasil diterima</span>
                <strong className="mt-1 block text-sm">
                  {formatRupiah(vip.totalProfitShared)}
                </strong>
              </div>
              <div className="border-l border-white/15 pl-4">
                <span className="text-[11px] text-blue-100">Jadwal berikutnya</span>
                <strong className="mt-1 block text-sm">
                  {formatDate(vip.nextProfitShareDate)}
                </strong>
              </div>
            </div>
            {vip.totalDividend > 0 && (
              <p className="mt-3 text-[11px] text-blue-100">
                Dividen diterima {formatRupiah(vip.totalDividend)}
              </p>
            )}
          </section>

          <section aria-labelledby="vip-history-title">
            <div className="mb-3 flex items-center justify-between">
              <h2
                className="text-base font-bold tracking-tight text-slate-900"
                id="vip-history-title"
              >
                Riwayat dana
              </h2>
              <span className="text-[11px] text-slate-400">{shown.length} transaksi</span>
            </div>
            <div className="mb-3 flex gap-2 overflow-x-auto [scrollbar-width:none]">
              {(['Semua', 'Bagi hasil', 'Setoran & penarikan'] as Filter[]).map((option) => (
                <button
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                    filter === option
                      ? 'brand-fill text-white'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200'
                  }`}
                  key={option}
                  onClick={() => setFilter(option)}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
            <DashboardCard>
              {shown.length === 0 ? (
                <p className="p-5 text-xs text-slate-500">Belum ada transaksi.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {shown.map((item) => {
                    const meta = LEDGER_LABELS[item.type]
                    return (
                      <li className="flex items-center gap-3 px-4 py-3" key={item.id}>
                        <span
                          className={`grid size-9 shrink-0 place-items-center rounded-xl ${meta.tone}`}
                        >
                          <DashboardIcon
                            className="size-4"
                            name={item.type === 'WITHDRAWAL' ? 'bank' : 'wallet'}
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {item.note || meta.title}
                          </p>
                          <p className="text-[11px] text-slate-400">{formatDate(item.date)}</p>
                        </div>
                        <strong
                          className={`shrink-0 text-sm ${meta.sign > 0 ? 'text-emerald-700' : 'text-slate-600'}`}
                        >
                          {meta.sign > 0 ? '+' : '−'}
                          {formatRupiah(item.amount)}
                        </strong>
                      </li>
                    )
                  })}
                </ul>
              )}
            </DashboardCard>
          </section>

          <p className="text-[11px] leading-5 text-slate-400">
            Bagi hasil disalurkan sesuai akad dan kinerja pembiayaan siswa, setiap tanggal{' '}
            {vip.profitShareDay}. Pertanyaan atau permintaan penarikan dana: hubungi tim VentureGo
            melalui <Link href="/dashboard/bantuan">Pusat Bantuan</Link>.
          </p>
        </>
      )}

      {!loading && !error && !vip && (
        <DashboardCard className="px-6 py-8">
          <span className="grid size-14 place-items-center rounded-3xl bg-amber-50 text-amber-600">
            <DashboardIcon name="star" className="size-7" />
          </span>
          <h2 className="mt-4 text-base font-bold text-slate-900">Vworks Investment Partner</h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Mitra VIP ikut mendanai biaya keberangkatan siswa VentureGo ke luar negeri. Dana
            disalurkan sebagai pembiayaan syariah kepada siswa, dan mitra menerima bagi hasil sesuai
            akad setiap tanggal 15.
          </p>
          <ul className="mt-4 space-y-2 text-xs text-slate-600">
            <li>• Saldo dan riwayat bagi hasil bisa dipantau langsung di aplikasi.</li>
            <li>• Laporan penyaluran dana ke siswa secara berkala.</li>
            <li>• Kemitraan dengan perjanjian tertulis bersama PT VKB.</li>
          </ul>
          <p className="mt-4 rounded-xl bg-blue-50 p-3 text-[11px] leading-5 text-slate-600">
            Saat ini VIP terbatas untuk mitra yang sudah menandatangani perjanjian. Bila Anda
            berminat, hubungi tim VentureGo melalui{' '}
            <Link className="font-semibold text-[var(--primary)]" href="/dashboard/bantuan">
              Pusat Bantuan
            </Link>
            .
          </p>
        </DashboardCard>
      )}
    </DashboardScaffold>
  )
}
