'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { onAuthStateChanged } from 'firebase/auth'
import { getFirebaseClientAuth } from '@/lib/firebase-client'
import { formatRupiah } from '@/lib/financing-plan'
import { getUserActivityFeed, type UserApplicationDetail, type UserPaymentItem } from '../actions'
import {
  DashboardCard,
  DashboardCardSkeleton,
  DashboardIcon,
  DashboardScaffold,
} from '../_components/dashboard-ui'

type FilterCategory = 'Semua' | 'Pembayaran' | 'Dokumen'

type ActivityItem = {
  id: string
  category: 'Pembayaran' | 'Dokumen'
  icon: 'receipt' | 'wallet' | 'document' | 'check'
  tone: 'emerald' | 'indigo' | 'amber'
  title: string
  subtitle: string
  rightLabel: string
  timestamp: string
}

const formatDateShort = (iso: string | null) => {
  if (!iso) return 'Terbaru'
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const PAYMENT_STATUS_LABELS: Record<UserPaymentItem['status'], string> = {
  PAID: 'Lunas',
  PENDING: 'Menunggu pembayaran',
  EXPIRED: 'Kedaluwarsa',
  FAILED: 'Gagal',
}

const DOC_STATUS_LABELS: Record<string, string> = {
  UPLOADED: 'Sudah diunggah',
  VERIFIED: 'Diverifikasi',
  REVISION_REQUIRED: 'Perlu perbaikan',
}

export default function HistoryPage() {
  const [filter, setFilter] = useState<FilterCategory>('Semua')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [applications, setApplications] = useState<UserApplicationDetail[]>([])
  const [payments, setPayments] = useState<UserPaymentItem[]>([])

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = onAuthStateChanged(getFirebaseClientAuth(), async (user) => {
        if (!active) return
        if (!user) {
          setApplications([])
          setPayments([])
          setLoading(false)
          return
        }
        try {
          const token = await user.getIdToken()
          if (!active) return
          const result = await getUserActivityFeed(token)
          if (!active) return
          if (!result.ok) {
            setError(result.message)
          } else {
            setError('')
            setApplications(result.applications)
            setPayments(result.payments)
          }
        } catch {
          if (active) setError('Riwayat aktivitas belum dapat dimuat. Silakan coba lagi.')
        } finally {
          if (active) setLoading(false)
        }
      })
    } catch {
      setError('Riwayat aktivitas belum dapat dimuat. Silakan coba lagi.')
      setLoading(false)
    }
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  const activities = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = []

    for (const payment of payments) {
      const dateStr = formatDateShort(payment.paidAt ?? payment.createdAt)
      const statusText = PAYMENT_STATUS_LABELS[payment.status] ?? payment.status
      items.push({
        id: `pay-${payment.id}`,
        category: 'Pembayaran',
        icon: 'receipt',
        tone:
          payment.status === 'PAID' ? 'emerald' : payment.status === 'PENDING' ? 'amber' : 'indigo',
        title:
          payment.description ||
          (payment.type === 'CUSTOM'
            ? 'Pembayaran sukarela'
            : `Pembayaran angsuran ke-${payment.installmentNumber ?? ''}`),
        subtitle: `${dateStr} • ${statusText}${payment.paidMethod ? ` (${payment.paidMethod})` : ''}`,
        rightLabel: formatRupiah(payment.amount),
        timestamp: payment.paidAt ?? payment.createdAt ?? '',
      })
    }

    for (const app of applications) {
      const amount = app.totalObligation ?? app.requestedFinancingAmount
      items.push({
        id: `app-${app.id}`,
        category: 'Pembayaran',
        icon: 'wallet',
        tone: 'indigo',
        title: `Pengajuan ${app.product === 'FULL_COVER' ? 'VSV Full Cover' : 'VSV Dana Keberangkatan'}`,
        subtitle: `${formatDateShort(app.createdAt)} • ${app.applicationId}`,
        rightLabel: amount !== null ? formatRupiah(amount) : app.status,
        timestamp: app.createdAt ?? '',
      })

      for (const [idx, doc] of app.documents.entries()) {
        if (doc.status === 'NOT_UPLOADED') continue
        items.push({
          id: `doc-${app.id}-${idx}`,
          category: 'Dokumen',
          icon: doc.status === 'VERIFIED' ? 'check' : 'document',
          tone:
            doc.status === 'VERIFIED'
              ? 'emerald'
              : doc.status === 'REVISION_REQUIRED'
                ? 'amber'
                : 'indigo',
          title: doc.documentType,
          subtitle: `${app.applicationId} • ${doc.fileName ?? 'Berkas terunggah'}`,
          rightLabel: DOC_STATUS_LABELS[doc.status] ?? doc.status,
          timestamp: app.updatedAt ?? app.createdAt ?? '',
        })
      }
    }

    return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  }, [applications, payments])

  const filteredActivities = useMemo(
    () => (filter === 'Semua' ? activities : activities.filter((item) => item.category === filter)),
    [activities, filter],
  )

  return (
    <DashboardScaffold
      active="riwayat"
      showHeader={false}
      subtitle="Seluruh aktivitas akun"
      title="Riwayat transaksi"
    >
      <div className="grid grid-cols-3 gap-2">
        {(['Semua', 'Pembayaran', 'Dokumen'] as const).map((item) => (
          <button
            className={`rounded-full px-3 py-2.5 text-center text-xs font-semibold transition ${
              filter === item
                ? 'bg-[var(--primary)] text-white'
                : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
            key={item}
            onClick={() => setFilter(item)}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">Aktivitas tercatat</h2>
        <span className="text-[11px] text-slate-400">
          {loading ? (
            <span className="sr-only">Memuat aktivitas</span>
          ) : (
            `${filteredActivities.length} aktivitas`
          )}
        </span>
      </div>

      {loading && <DashboardCardSkeleton rows={5} />}

      {!loading && error && (
        <p className="rounded-2xl bg-amber-50 p-4 text-xs text-amber-800" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && filteredActivities.length === 0 && (
        <DashboardCard className="p-5 text-center">
          <p className="text-xs leading-5 text-slate-500">
            Belum ada aktivitas {filter !== 'Semua' ? filter.toLowerCase() : ''} yang tercatat pada
            akun Anda.
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <Link
              className="rounded-full bg-blue-50 px-3.5 py-2 text-[11px] font-bold text-[var(--primary)]"
              href="/?step=1"
            >
              Ajukan pembiayaan
            </Link>
            <Link
              className="rounded-full bg-slate-100 px-3.5 py-2 text-[11px] font-bold text-slate-700"
              href="/dashboard/pembayaran"
            >
              Ke pembayaran
            </Link>
          </div>
        </DashboardCard>
      )}

      {!loading && !error && filteredActivities.length > 0 && (
        <DashboardCard>
          {filteredActivities.map((item) => (
            <article
              className="flex items-center gap-3 border-b border-slate-100 p-4 last:border-0"
              key={item.id}
            >
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
                  item.tone === 'emerald'
                    ? 'bg-emerald-50 text-emerald-600'
                    : item.tone === 'amber'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-blue-50 text-[var(--primary)]'
                }`}
              >
                <DashboardIcon name={item.icon} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-bold text-slate-800">{item.title}</h3>
                <p className="mt-1 truncate text-[11px] text-slate-400">{item.subtitle}</p>
              </div>
              <strong className="shrink-0 text-right text-xs text-slate-700">
                {item.rightLabel}
              </strong>
            </article>
          ))}
        </DashboardCard>
      )}
    </DashboardScaffold>
  )
}
