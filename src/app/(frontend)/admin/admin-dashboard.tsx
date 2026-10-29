'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  APPLICATION_DOCUMENT_STATUSES,
  APPLICATION_STATUSES,
  PRICING_STATUSES,
  type FinancingApplicationRecord,
} from '@/lib/firebase-data'
import { updateApplicationStatus } from './actions'

const STATUS_LABELS: Record<(typeof APPLICATION_STATUSES)[number], string> = {
  SUBMITTED: 'Terkirim',
  ELIGIBILITY_REVIEW: 'Pemeriksaan kelayakan',
  DOCUMENT_REVIEW: 'Pemeriksaan dokumen',
  REVISION_REQUIRED: 'Perlu perbaikan',
  COST_VERIFICATION: 'Verifikasi biaya',
  APPROVED: 'Disetujui',
  CONTRACT_PREPARATION: 'Persiapan akad',
  ACTIVE: 'Aktif',
  COMPLETED: 'Selesai',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
}
const DOCUMENT_STATUS_LABELS: Record<(typeof APPLICATION_DOCUMENT_STATUSES)[number], string> = {
  NOT_UPLOADED: 'Belum diunggah',
  UPLOADED: 'Sudah diunggah',
  VERIFIED: 'Diverifikasi',
  REVISION_REQUIRED: 'Perlu perbaikan',
}
const PRICING_STATUS_LABELS: Record<(typeof PRICING_STATUSES)[number], string> = {
  ESTIMATED: 'Estimasi',
  VERIFIED: 'Terverifikasi',
  AGREED: 'Disepakati',
}

export function AdminDashboard({
  email,
  applications,
}: {
  email: string
  applications: FinancingApplicationRecord[]
}) {
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const logout = async () => {
    await fetch('/api/admin/session', { method: 'DELETE' })
    router.refresh()
  }

  const save = (application: FinancingApplicationRecord, formData: FormData) => {
    setError('')
    startTransition(async () => {
      const result = await updateApplicationStatus(
        application.id,
        String(formData.get('status')),
        String(formData.get('internalNotes') ?? ''),
        application.documents.map((_, index) => String(formData.get(`documentStatus-${index}`))),
        String(formData.get('pricingStatus')),
        {
          nafaqahTotal: String(formData.get('nafaqahTotal') ?? ''),
          ujrahTotal: String(formData.get('ujrahTotal') ?? ''),
          totalObligation: String(formData.get('totalObligation') ?? ''),
          tenorMonths: String(formData.get('tenorMonths') ?? ''),
          monthlyInstallment: String(formData.get('monthlyInstallment') ?? ''),
        },
      )
      if (!result.ok) setError(result.message)
      else router.refresh()
    })
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#17158c]">VentureGo · Operasional</p>
          <h1 className="mt-1 text-2xl font-bold">Pengajuan pembiayaan</h1>
          <p className="mt-1 text-sm text-slate-600">Masuk sebagai {email}</p>
        </div>
        <button
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
          onClick={logout}
        >
          Keluar
        </button>
      </header>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {applications.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
          Belum ada pengajuan.
        </section>
      ) : (
        <div className="space-y-4">
          {applications.map((application) => (
            <form
              action={(formData) => save(application, formData)}
              className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              key={application.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#17158c]">
                    {application.applicationId}
                  </p>
                  <h2 className="mt-1 text-lg font-bold">{application.applicantName}</h2>
                  <p className="text-sm text-slate-600">
                    {application.phone} · {application.lpkName}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                  {application.product === 'FULL_COVER' ? 'Full Cover' : 'Dana Keberangkatan'}
                </span>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <p>
                  <span className="text-slate-500">Tujuan:</span> {application.destination}
                </p>
                <p>
                  <span className="text-slate-500">Dibuat:</span>{' '}
                  {new Date(application.createdAt).toLocaleString('id-ID')}
                </p>
                <p>
                  <span className="text-slate-500">Dokumen:</span>{' '}
                  {application.documents.filter((doc) => doc.storagePath).length} terunggah
                </p>
              </div>
              <details className="rounded-lg bg-slate-50 px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold">
                  Rincian dan dokumen
                </summary>
                <div className="mt-3 space-y-3 text-sm">
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">
                    {JSON.stringify(
                      {
                        personalDetails: application.personalDetails,
                        eligibility: application.eligibility,
                        fullCoverDetails: application.fullCoverDetails,
                        departureDetails: application.departureDetails,
                        fundingNeeds: application.fundingNeeds,
                        financialPlan: application.financialPlan,
                      },
                      null,
                      2,
                    )}
                  </pre>
                  {application.documents.map((document, index) => (
                    <div
                      className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-2"
                      key={`${document.documentType}-${index}`}
                    >
                      <span>{document.documentType}</span>
                      <div className="flex items-center gap-3">
                        <select
                          aria-label={`Status ${document.documentType}`}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                          defaultValue={document.status}
                          name={`documentStatus-${index}`}
                        >
                          {APPLICATION_DOCUMENT_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {DOCUMENT_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                        {document.storagePath && (
                          <a
                            className="font-semibold text-[#17158c] underline"
                            href={`/api/admin/applications/${application.id}/documents/${index}`}
                          >
                            Unduh {document.fileName ?? 'berkas'}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto]">
                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  Status
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900"
                    defaultValue={application.status}
                    name="status"
                  >
                    {APPLICATION_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  Status biaya
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900"
                    defaultValue={String(application.financialPlan.pricingStatus ?? 'ESTIMATED')}
                    name="pricingStatus"
                  >
                    {PRICING_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {PRICING_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  Catatan internal
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900"
                    defaultValue={application.internalNotes}
                    maxLength={2000}
                    name="internalNotes"
                  />
                </label>
                <button
                  className="self-end rounded-lg bg-[#17158c] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={pending}
                >
                  Simpan
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {([
                  ['nafaqahTotal', 'Nafaqah'],
                  ['ujrahTotal', 'Ujrah'],
                  ['totalObligation', 'Total kewajiban'],
                  ['tenorMonths', 'Tenor (bulan)'],
                  ['monthlyInstallment', 'Angsuran bulanan'],
                ] as const).map(([name, label]) => (
                  <label className="space-y-1 text-xs font-semibold text-slate-600" key={name}>
                    {label}
                    <input
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900"
                      defaultValue={String(application.financialPlan[name] ?? '')}
                      min={name === 'tenorMonths' ? 1 : 0}
                      max={name === 'tenorMonths' ? 36 : undefined}
                      name={name}
                      step={1}
                      type="number"
                    />
                  </label>
                ))}
              </div>
            </form>
          ))}
        </div>
      )}
    </main>
  )
}
