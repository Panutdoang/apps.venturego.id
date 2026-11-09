'use client'

import { useEffect, useState } from 'react'
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

const formatSize = (size: number | null) =>
  size && size > 0 ? `${(size / 1024 / 1024).toFixed(1)} MB` : ''

const formatDateShort = (iso: string | null) => {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const PRICING_LABELS: Record<string, string> = {
  ESTIMATED: 'Estimasi sedang diverifikasi',
  VERIFIED: 'Penawaran terverifikasi',
  AGREED: 'Akad final disepakati',
}

const DOC_STATUS_LABELS: Record<string, string> = {
  UPLOADED: 'Sudah diunggah',
  VERIFIED: 'Diverifikasi',
  REVISION_REQUIRED: 'Perlu perbaikan',
}

export default function DocumentsPage() {
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
          if (active) setError('Arsip dokumen belum dapat dimuat. Silakan coba lagi.')
        } finally {
          if (active) setLoading(false)
        }
      })
    } catch {
      setError('Arsip dokumen belum dapat dimuat. Silakan coba lagi.')
      setLoading(false)
    }
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  const uploadedDocs = applications.flatMap((app) =>
    app.documents
      .filter((doc) => doc.status !== 'NOT_UPLOADED')
      .map((doc) => ({ ...doc, applicationId: app.applicationId })),
  )
  const paidPayments = payments.filter((p) => p.status === 'PAID')

  return (
    <DashboardScaffold active="profil" subtitle="Arsip pembiayaan Anda" title="Dokumen saya">
      <div className="flex gap-3 rounded-2xl bg-blue-50 p-4">
        <DashboardIcon name="shield" className="size-5 shrink-0 text-[var(--primary)]" />
        <p className="text-[11px] leading-5 text-slate-600">
          Seluruh berkas persyaratan dan ringkasan akad yang tertaut pada akun Anda.
        </p>
      </div>

      {loading && (
        <>
          <DashboardCardSkeleton rows={2} />
          <DashboardCardSkeleton rows={4} />
        </>
      )}

      {!loading && error && (
        <p className="rounded-2xl bg-amber-50 p-4 text-xs text-amber-800" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && applications.length === 0 && (
        <DashboardCard className="p-5 text-center">
          <p className="text-xs leading-5 text-slate-500">
            Belum ada dokumen pembiayaan karena Anda belum memiliki pengajuan aktif.
          </p>
          <Link
            className="mt-3 inline-block rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-bold text-white"
            href="/?step=1"
          >
            Buat pengajuan baru
          </Link>
        </DashboardCard>
      )}

      {!loading && !error && applications.length > 0 && (
        <>
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Ringkasan Akad & Pembiayaan
              </h2>
              <Link
                className="text-xs font-semibold text-[var(--primary)]"
                href="/dashboard/angsuran"
              >
                Rincian akad →
              </Link>
            </div>
            <DashboardCard>
              {applications.map((app) => {
                const amount = app.totalObligation ?? app.requestedFinancingAmount
                return (
                  <Link
                    className="flex items-center gap-3 border-b border-slate-100 p-4 transition hover:bg-slate-50 last:border-0"
                    href="/dashboard/angsuran"
                    key={app.id}
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-[var(--primary)]">
                      <DashboardIcon name="document" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold text-slate-800">
                        {app.product === 'FULL_COVER'
                          ? 'Akad VSV Full Cover'
                          : 'Akad VSV Dana Keberangkatan'}{' '}
                        · {app.applicationId}
                      </h3>
                      <p className="mt-1 truncate text-[10px] text-slate-400">
                        {PRICING_LABELS[app.pricingStatus] ?? app.pricingStatus}
                        {amount !== null ? ` • ${formatRupiah(amount)}` : ''}
                        {app.finalAgreementReference
                          ? ` • Ref: ${app.finalAgreementReference}`
                          : ''}
                      </p>
                    </div>
                    <DashboardIcon name="chevron" className="size-4 shrink-0 text-slate-300" />
                  </Link>
                )
              })}
            </DashboardCard>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Berkas Persyaratan ({uploadedDocs.length})
              </h2>
              <Link
                className="text-xs font-semibold text-[var(--primary)]"
                href="/dashboard/unggah-berkas"
              >
                Kelola berkas →
              </Link>
            </div>
            <DashboardCard>
              {uploadedDocs.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  Belum ada berkas yang diunggah.{' '}
                  <Link
                    className="font-bold text-[var(--primary)] underline"
                    href="/dashboard/unggah-berkas"
                  >
                    Unggah sekarang
                  </Link>
                </div>
              ) : (
                uploadedDocs.map((doc, idx) => (
                  <article
                    className="flex items-center gap-3 border-b border-slate-100 p-4 last:border-0"
                    key={`${doc.applicationId}-${doc.documentType}-${idx}`}
                  >
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-2xl ${
                        doc.status === 'VERIFIED'
                          ? 'bg-emerald-50 text-emerald-600'
                          : doc.status === 'REVISION_REQUIRED'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-blue-50 text-[var(--primary)]'
                      }`}
                    >
                      <DashboardIcon
                        name={doc.status === 'VERIFIED' ? 'check' : 'document'}
                        className="size-5"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-xs font-bold text-slate-800">
                        {doc.documentType}
                      </h3>
                      <p className="mt-1 truncate text-[10px] text-slate-400">
                        {doc.fileName ?? 'Berkas'}
                        {doc.size ? ` • ${formatSize(doc.size)}` : ''} • {doc.applicationId}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                        doc.status === 'VERIFIED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : doc.status === 'REVISION_REQUIRED'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-blue-50 text-[var(--primary)]'
                      }`}
                    >
                      {DOC_STATUS_LABELS[doc.status] ?? doc.status}
                    </span>
                  </article>
                ))
              )}
            </DashboardCard>
          </section>

          {paidPayments.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                Bukti Pembayaran Lunas ({paidPayments.length})
              </h2>
              <DashboardCard>
                {paidPayments.map((payment) => (
                  <article
                    className="flex items-center gap-3 border-b border-slate-100 p-4 last:border-0"
                    key={payment.id}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                      <DashboardIcon name="receipt" className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-xs font-bold text-slate-800">
                        {payment.description || `Pembayaran ${payment.applicationId}`}
                      </h3>
                      <p className="mt-1 truncate text-[10px] text-slate-400">
                        {formatDateShort(payment.paidAt ?? payment.createdAt)}
                        {payment.paidMethod ? ` • ${payment.paidMethod}` : ''}
                      </p>
                    </div>
                    <strong className="shrink-0 text-xs text-emerald-700">
                      {formatRupiah(payment.amount)}
                    </strong>
                  </article>
                ))}
              </DashboardCard>
            </section>
          )}
        </>
      )}
    </DashboardScaffold>
  )
}
