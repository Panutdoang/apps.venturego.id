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

type NotificationEntry = {
  id: string
  icon: 'calendar' | 'document' | 'check' | 'info'
  title: string
  detail: string
  time: string
  href: string
  important: boolean
}

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Pengajuan terkirim',
  ELIGIBILITY_REVIEW: 'Tinjauan kelayakan berjalan',
  DOCUMENT_REVIEW: 'Berkas sedang diperiksa',
  REVISION_REQUIRED: 'Berkas memerlukan revisi',
  COST_VERIFICATION: 'Rincian biaya sedang disusun',
  APPROVED: 'Pengajuan disetujui',
  CONTRACT_PREPARATION: 'Persiapan akad pembiayaan',
  ACTIVE: 'Program pembiayaan aktif',
  COMPLETED: 'Program pembiayaan selesai',
  REJECTED: 'Pengajuan belum disetujui',
  CANCELLED: 'Pengajuan dibatalkan',
}

const formatDateShort = (iso: string | null) => {
  if (!iso) return 'Terbaru'
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [applications, setApplications] = useState<UserApplicationDetail[]>([])
  const [payments, setPayments] = useState<UserPaymentItem[]>([])
  const [allRead, setAllRead] = useState(false)

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
          if (active) setError('Notifikasi belum dapat dimuat. Silakan coba lagi.')
        } finally {
          if (active) setLoading(false)
        }
      })
    } catch {
      setError('Notifikasi belum dapat dimuat. Silakan coba lagi.')
      setLoading(false)
    }
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  const notifications = useMemo<NotificationEntry[]>(() => {
    const list: NotificationEntry[] = []

    for (const app of applications) {
      // 1. Next unpaid installment reminder
      const nextUnpaid = app.schedule.find((item) => !item.paid)
      if (nextUnpaid) {
        list.push({
          id: `due-${app.id}-${nextUnpaid.installment}`,
          icon: 'calendar',
          title: `Jadwal Angsuran ke-${nextUnpaid.installment}`,
          detail: `Tagihan ${formatRupiah(nextUnpaid.amount)} untuk ${app.applicationId} jatuh tempo pada ${nextUnpaid.dueDate}.`,
          time: nextUnpaid.dueDate,
          href: '/dashboard/pembayaran',
          important: true,
        })
      }

      // 2. Verified offer awaiting acceptance
      if (app.pricingStatus === 'VERIFIED' && !app.acceptedAt) {
        list.push({
          id: `offer-${app.id}`,
          icon: 'document',
          title: 'Rincian biaya terverifikasi tersedia',
          detail: `Tinjau dan setujui rincian Nafaqah & Ujrah untuk pengajuan ${app.applicationId}.`,
          time: formatDateShort(app.updatedAt ?? app.createdAt),
          href: '/dashboard/angsuran',
          important: true,
        })
      } else if (app.pricingStatus === 'AGREED') {
        list.push({
          id: `agreed-${app.id}`,
          icon: 'check',
          title: 'Akad final tercatat disepakati',
          detail: `Akad untuk ${app.applicationId} telah aktif dengan total kewajiban ${formatRupiah(app.totalObligation ?? 0)}.`,
          time: formatDateShort(app.updatedAt ?? app.createdAt),
          href: '/dashboard/angsuran',
          important: false,
        })
      }

      // 3. Documents needing revision
      const revisionDocs = app.documents.filter((d) => d.status === 'REVISION_REQUIRED')
      if (revisionDocs.length > 0) {
        list.push({
          id: `rev-${app.id}`,
          icon: 'info',
          title: `${revisionDocs.length} dokumen memerlukan perbaikan`,
          detail: `Silakan unggah ulang: ${revisionDocs.map((d) => d.documentType).join(', ')}.`,
          time: formatDateShort(app.updatedAt ?? app.createdAt),
          href: '/dashboard/unggah-berkas',
          important: true,
        })
      }

      // 4. Support request responses
      for (const [idx, req] of app.supportRequests.entries()) {
        if (req.response) {
          list.push({
            id: `sup-${app.id}-${idx}`,
            icon: 'info',
            title: 'Tanggapan permohonan keringanan',
            detail: req.response,
            time: formatDateShort(req.requestedAt),
            href: '/dashboard/angsuran',
            important: true,
          })
        }
      }

      // 5. Application status notification
      list.push({
        id: `status-${app.id}`,
        icon: 'document',
        title: STATUS_LABELS[app.status] ?? `Status: ${app.status}`,
        detail: `Pengajuan ${app.applicationId} (${app.product === 'FULL_COVER' ? 'VSV Full Cover' : 'VSV Dana Keberangkatan'}) tercatat di sistem.`,
        time: formatDateShort(app.createdAt),
        href: '/dashboard',
        important: false,
      })
    }

    for (const payment of payments) {
      if (payment.status === 'PAID') {
        list.push({
          id: `paid-${payment.id}`,
          icon: 'check',
          title: 'Pembayaran diterima',
          detail: `${payment.description || 'Pembayaran'} sebesar ${formatRupiah(payment.amount)} telah dikonfirmasi lunas.`,
          time: formatDateShort(payment.paidAt ?? payment.createdAt),
          href: '/dashboard/pembayaran',
          important: false,
        })
      } else if (payment.status === 'PENDING') {
        list.push({
          id: `pend-${payment.id}`,
          icon: 'calendar',
          title: 'Menunggu penyelesaian pembayaran',
          detail: `Tagihan ${formatRupiah(payment.amount)} (${payment.description}) masih menunggu pembayaran.`,
          time: formatDateShort(payment.createdAt),
          href: '/dashboard/pembayaran',
          important: true,
        })
      }
    }

    return list
  }, [applications, payments])

  return (
    <DashboardScaffold active="home" subtitle="Pembaruan akun Anda" title="Notifikasi">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">Terbaru ({notifications.length})</h2>
        {notifications.length > 0 && (
          <button
            className="text-xs font-semibold text-[var(--primary)]"
            onClick={() => setAllRead(true)}
            type="button"
          >
            Tandai sudah dibaca
          </button>
        )}
      </div>

      {loading && <DashboardCardSkeleton rows={4} />}

      {!loading && error && (
        <p className="rounded-2xl bg-amber-50 p-4 text-xs text-amber-800" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && notifications.length === 0 && (
        <DashboardCard className="p-5 text-center">
          <p className="text-xs leading-5 text-slate-500">
            Belum ada pemberitahuan baru untuk akun Anda saat ini.
          </p>
        </DashboardCard>
      )}

      {!loading && !error && notifications.length > 0 && (
        <DashboardCard>
          {notifications.map((item) => {
            const unread = item.important && !allRead
            return (
              <Link
                className={`relative flex gap-3 border-b border-slate-100 p-4 transition hover:bg-slate-50 last:border-0 ${
                  unread ? 'bg-blue-50/40' : ''
                }`}
                href={item.href}
                key={item.id}
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-[var(--primary)] shadow-sm">
                  <DashboardIcon name={item.icon} />
                </span>
                <div className="min-w-0 flex-1 pr-3">
                  <h3 className="text-sm font-bold text-slate-800">{item.title}</h3>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">{item.detail}</p>
                  <span className="mt-2 block text-[10px] text-slate-400">{item.time}</span>
                </div>
                {unread && (
                  <span className="absolute right-4 top-4 size-2 rounded-full bg-[var(--accent)]" />
                )}
              </Link>
            )
          })}
        </DashboardCard>
      )}
    </DashboardScaffold>
  )
}
