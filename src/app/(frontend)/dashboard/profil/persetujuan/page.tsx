'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { getFirebaseClientAuth } from '@/lib/firebase-client'
import { getUserActivityFeed, type UserApplicationDetail } from '../../actions'
import { DashboardCard, DashboardIcon, DashboardScaffold } from '../../_components/dashboard-ui'

const formatDate = (value: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

const POLICY_POINTS = [
  'Data pengajuan (identitas, kontak, dan dokumen) disimpan di database Firestore dan hanya diakses oleh server serta staf resmi VentureGo.',
  'Berkas seperti KTP dan ijazah diunggah ke Google Drive privat; unduhan hanya melalui akun Anda dan route staf yang terautentikasi.',
  'Alamat email dipakai untuk verifikasi akun, notifikasi pengajuan, dan bantuan — tidak dibagikan ke pihak ketiga untuk pemasaran.',
  'Untuk koreksi atau penghapusan data, hubungi tim layanan melalui vworksofficial@gmail.com.',
]

export default function ConsentPolicyPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [applications, setApplications] = useState<UserApplicationDetail[]>([])
  const [selectedApplicationId, setSelectedApplicationId] = useState('')

  const selectedApplication =
    applications.find((application) => application.id === selectedApplicationId) ??
    applications[0] ??
    null

  useEffect(() => {
    let active = true
    const unsubscribe = onAuthStateChanged(getFirebaseClientAuth(), async (user) => {
      if (!user || !active) {
        if (active) setLoading(false)
        return
      }
      try {
        const token = await user.getIdToken()
        if (!active) return
        const feed = await getUserActivityFeed(token)
        if (!active) return
        if (feed.ok) {
          setApplications(feed.applications)
          setSelectedApplicationId((current) =>
            feed.applications.some((application) => application.id === current)
              ? current
              : (feed.applications[0]?.id ?? ''),
          )
          setError('')
        } else {
          setError(feed.message)
        }
      } catch {
        if (active) setError('Data persetujuan belum dapat dimuat. Silakan coba lagi.')
      } finally {
        if (active) setLoading(false)
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const consentRows = selectedApplication
    ? [
        {
          label: 'Paham akad Wakalah bil Ujrah',
          granted: selectedApplication.consent.understandsWakalah,
        },
        {
          label: 'Persetujuan pemrosesan data',
          granted: selectedApplication.consent.acceptsDataProcessing,
        },
      ]
    : []

  return (
    <DashboardScaffold
      active="profil"
      backHref="/dashboard/profil"
      subtitle="Salinan persetujuan dan kebijakan data"
      title="Kebijakan & Persetujuan"
    >
      {!loading && applications.length > 1 && (
        <label className="block text-xs font-semibold text-slate-600">
          Data pengajuan
          <select
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-800"
            onChange={(event) => setSelectedApplicationId(event.target.value)}
            value={selectedApplication?.id ?? ''}
          >
            {applications.map((application) => (
              <option key={application.id} value={application.id}>
                {application.applicationId} ·{' '}
                {application.product === 'FULL_COVER' ? 'Full Cover' : 'Dana Keberangkatan'}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-700" role="alert">
          {error}
        </p>
      )}

      <DashboardCard>
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-sm font-bold text-slate-900">Persetujuan saat pengajuan</h2>
          {selectedApplication && (
            <p className="mt-1 text-[11px] text-slate-500">
              {selectedApplication.applicationId} · diajukan{' '}
              {formatDate(selectedApplication.createdAt)}
            </p>
          )}
        </div>
        {loading ? (
          <div aria-label="Memuat persetujuan" className="space-y-3 p-4" role="status">
            <span className="sr-only">Memuat persetujuan…</span>
            <div className="h-3 w-3/5 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-3 w-2/5 animate-pulse rounded-lg bg-slate-200" />
          </div>
        ) : !selectedApplication ? (
          <p className="p-4 text-xs leading-5 text-slate-500">
            Belum ada pengajuan yang tertaut ke akun ini.
          </p>
        ) : (
          <div>
            {consentRows.map((row) => (
              <div
                className="flex items-center gap-3 border-b border-slate-100 p-4 last:border-0"
                key={row.label}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full ${
                    row.granted ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  <DashboardIcon className="size-4" name={row.granted ? 'check' : 'info'} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800">{row.label}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {row.granted ? 'Dicatat saat pengajuan dikirim' : 'Tidak tercatat'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>

      <DashboardCard className="p-4">
        <h2 className="text-sm font-bold text-slate-900">Kebijakan pemrosesan data</h2>
        <ul className="mt-3 space-y-3 text-xs leading-5 text-slate-600">
          {POLICY_POINTS.map((point) => (
            <li className="flex gap-2.5" key={point}>
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
              {point}
            </li>
          ))}
        </ul>
      </DashboardCard>
    </DashboardScaffold>
  )
}
