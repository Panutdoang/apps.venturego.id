'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { getFirebaseClientAuth } from '@/lib/firebase-client'
import { getUserActivityFeed, type UserApplicationDetail } from '../../actions'
import { DashboardCard, DashboardIcon, DashboardScaffold } from '../../_components/dashboard-ui'

export default function ProfileDocumentsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [applications, setApplications] = useState<UserApplicationDetail[]>([])
  const [selectedApplicationId, setSelectedApplicationId] = useState('')
  const [agreementPreviewUrl, setAgreementPreviewUrl] = useState('')
  const [agreementLoading, setAgreementLoading] = useState(false)

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
        if (active) setError('Dokumen belum dapat dimuat. Silakan coba lagi.')
      } finally {
        if (active) setLoading(false)
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(
    () => () => {
      if (agreementPreviewUrl) URL.revokeObjectURL(agreementPreviewUrl)
    },
    [agreementPreviewUrl],
  )

  const openAgreement = async () => {
    if (!selectedApplication?.agreementPdf) return
    const user = getFirebaseClientAuth().currentUser
    if (!user) {
      setError('Sesi telah berakhir. Silakan masuk kembali.')
      return
    }

    setAgreementLoading(true)
    setError('')
    try {
      const response = await fetch(
        `/api/applicant/applications/${selectedApplication.id}/agreement`,
        { headers: { Authorization: `Bearer ${await user.getIdToken()}` } },
      )
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { message?: string }
        throw new Error(result.message || 'PDF akad belum dapat dibuka.')
      }
      const blob = await response.blob()
      setAgreementPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return URL.createObjectURL(blob)
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'PDF akad belum dapat dibuka.')
    } finally {
      setAgreementLoading(false)
    }
  }

  return (
    <DashboardScaffold
      active="profil"
      backHref="/dashboard/profil"
      subtitle="Akad Wakalah bil Ujrah"
      title="Dokumen Saya"
    >
      {!loading && applications.length > 1 && (
        <label className="block text-xs font-semibold text-slate-600">
          Data pengajuan
          <select
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-800"
            onChange={(event) => {
              setSelectedApplicationId(event.target.value)
              setAgreementPreviewUrl((current) => {
                if (current) URL.revokeObjectURL(current)
                return ''
              })
            }}
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

      <section aria-label="Dokumen saya">
        {loading ? (
          <DashboardCard className="p-5">
            <div aria-label="Memuat dokumen" className="space-y-3" role="status">
              <span className="sr-only">Memuat dokumen…</span>
              <div className="flex items-start gap-3">
                <div className="size-11 shrink-0 animate-pulse rounded-2xl bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/5 animate-pulse rounded-lg bg-slate-200" />
                  <div className="h-2.5 w-3/5 animate-pulse rounded-lg bg-slate-200" />
                </div>
              </div>
            </div>
          </DashboardCard>
        ) : !selectedApplication ? (
          <DashboardCard className="p-5">
            <p className="text-xs leading-5 text-slate-500">
              Belum ada pengajuan yang tertaut ke akun ini.
            </p>
          </DashboardCard>
        ) : (
          <DashboardCard className="p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-[var(--primary)]">
                <DashboardIcon name="document" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-slate-900">Akad Wakalah bil Ujrah</h2>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  {selectedApplication.agreementPdf
                    ? `${selectedApplication.agreementPdf.fileName} · ${selectedApplication.applicationId}`
                    : selectedApplication.pricingStatus === 'AGREED'
                      ? 'Akad disepakati. PDF final akan muncul setelah diunggah tim VentureGo.'
                      : 'PDF akad final tersedia setelah rincian biaya disepakati.'}
                </p>
              </div>
            </div>
            {selectedApplication.agreementPdf && (
              <div className="mt-4 flex gap-2">
                <button
                  className="flex-1 rounded-xl bg-[var(--primary)] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-60"
                  disabled={agreementLoading}
                  onClick={() => void openAgreement()}
                  type="button"
                >
                  {agreementLoading ? 'Membuka PDF…' : 'Lihat Akad PDF'}
                </button>
                {agreementPreviewUrl && (
                  <a
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700"
                    download={selectedApplication.agreementPdf.fileName}
                    href={agreementPreviewUrl}
                  >
                    Unduh
                  </a>
                )}
              </div>
            )}
            {agreementPreviewUrl && (
              <iframe
                className="mt-4 h-[58dvh] w-full rounded-xl border border-slate-200 bg-slate-50"
                src={agreementPreviewUrl}
                title="Pratinjau Akad Wakalah bil Ujrah"
              />
            )}
          </DashboardCard>
        )}
      </section>
    </DashboardScaffold>
  )
}
