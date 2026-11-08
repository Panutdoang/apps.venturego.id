'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { getFirebaseClientAuth } from '@/lib/firebase-client'
import type { FinancingCostLine, InstallmentEntry } from '@/lib/departure-financing'
import {
  acceptFinancingOffer,
  getOwnedFinancingApplications,
  requestFinancingSupport,
  type UserFinancingResult,
} from './actions'
import {
  DashboardCard,
  DashboardCardSkeleton,
  DashboardScaffold,
} from '../_components/dashboard-ui'

type UserApplication = Extract<UserFinancingResult, { ok: true }>['applications'][number]

const formatRupiah = (value: unknown) =>
  `Rp${(typeof value === 'number' && Number.isFinite(value) ? value : 0).toLocaleString('id-ID')}`

const formatDate = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Belum ditentukan'
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

const readLines = (value: unknown): FinancingCostLine[] =>
  Array.isArray(value)
    ? value.filter(
        (line): line is FinancingCostLine =>
          Boolean(line) &&
          typeof line.label === 'string' &&
          typeof line.recipient === 'string' &&
          typeof line.amount === 'number' &&
          typeof line.evidenceReference === 'string',
      )
    : []

const readSchedule = (value: unknown): InstallmentEntry[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is InstallmentEntry =>
          Boolean(entry) &&
          Number.isInteger(entry.installment) &&
          typeof entry.dueDate === 'string' &&
          typeof entry.amount === 'number' &&
          typeof entry.remainingBalance === 'number',
      )
    : []

function ApplicationTerms({
  application,
  token,
  refresh,
}: {
  application: UserApplication
  token: string
  refresh: () => void
}) {
  const [supportMessage, setSupportMessage] = useState('')
  const [feedback, setFeedback] = useState('')
  const [pending, startTransition] = useTransition()
  const plan = application.financialPlan
  const verified = plan.pricingStatus === 'VERIFIED'
  const agreed = plan.pricingStatus === 'AGREED'
  const closed = ['CANCELLED', 'REJECTED'].includes(application.status)
  const accepted = Boolean(application.userFinancingAcceptance?.acceptedAt)
  const nafaqahItems = readLines(plan.nafaqahItems)
  const ujrahItems = readLines(plan.ujrahItems)
  const schedule = readSchedule(plan.schedule)
  const supportRequests = application.supportRequests ?? []
  const agreementReference =
    typeof plan.finalAgreementReference === 'string' ? plan.finalAgreementReference : ''
  const agreementUrl = /^https:\/\/\S+$/i.test(agreementReference) ? agreementReference : null

  const handleAccept = () => {
    setFeedback('')
    startTransition(async () => {
      const result = await acceptFinancingOffer(token, application.id)
      setFeedback(result.ok ? 'Persetujuan atas penawaran tercatat.' : result.message)
      if (result.ok) refresh()
    })
  }

  const handleSupportRequest = (formData: FormData) => {
    setFeedback('')
    startTransition(async () => {
      const result = await requestFinancingSupport(
        token,
        application.id,
        String(formData.get('supportMessage') ?? ''),
      )
      setFeedback(
        result.ok ? 'Permohonan keringanan telah dikirim untuk ditinjau.' : result.message,
      )
      if (result.ok) {
        setSupportMessage('')
        refresh()
      }
    })
  }

  return (
    <article className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)]">
            {application.applicationId}
          </p>
          <h2 className="mt-1 text-base font-bold text-slate-900">{application.applicantName}</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600">
          {application.status === 'CANCELLED'
            ? 'Pengajuan dibatalkan'
            : application.status === 'REJECTED'
              ? 'Pengajuan ditolak'
              : agreed
                ? 'Akad disepakati'
                : verified
                  ? 'Penawaran terverifikasi'
                  : 'Menunggu verifikasi'}
        </span>
      </header>
      <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-950">
        Estimasi total yang Anda ajukan:{' '}
        <strong>
          {typeof application.departureDetails?.requestedFinancingAmount === 'number'
            ? formatRupiah(application.departureDetails.requestedFinancingAmount)
            : 'Belum tercatat'}
        </strong>
        . Angka ini bukan total Nafaqah/Ujrah terverifikasi atau nominal akad.
      </p>

      {verified || agreed ? (
        <>
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800">Rincian kewajiban</h3>
            {[
              ['Nafaqah · biaya riil', nafaqahItems],
              ['Ujrah · jasa', ujrahItems],
            ].map(([title, items]) => (
              <div className="rounded-xl border border-slate-100 p-3" key={title as string}>
                <h4 className="text-xs font-bold text-slate-600">{title as string}</h4>
                <div className="mt-2 divide-y divide-slate-100">
                  {(items as FinancingCostLine[]).map((line, index) => (
                    <div
                      className="flex justify-between gap-3 py-2 text-xs"
                      key={`${line.label}-${index}`}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800">{line.label}</p>
                        {line.recipient && (
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            Penerima: {line.recipient}
                          </p>
                        )}
                        {line.evidenceReference &&
                          (/^https:\/\/\S+$/i.test(line.evidenceReference) ? (
                            <a
                              className="mt-0.5 block break-all text-[10px] font-semibold text-[var(--primary)] underline"
                              href={line.evidenceReference}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Lihat bukti pembayaran
                            </a>
                          ) : (
                            <p className="mt-0.5 break-all text-[10px] text-slate-500">
                              Referensi bukti: {line.evidenceReference}
                            </p>
                          ))}
                      </div>
                      <span className="shrink-0 font-semibold text-slate-700">
                        {formatRupiah(line.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="space-y-2 rounded-xl bg-indigo-50 p-3 text-xs">
              <div className="flex justify-between gap-3">
                <span>Nafaqah</span>
                <strong>{formatRupiah(plan.nafaqahTotal)}</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span>Ujrah tetap</span>
                <strong>{formatRupiah(plan.ujrahTotal)}</strong>
              </div>
              {Number(plan.qardhAmount) > 0 && (
                <div className="flex justify-between gap-3">
                  <span>Uang saku qardh (pokok)</span>
                  <strong>{formatRupiah(plan.qardhAmount)}</strong>
                </div>
              )}
              {Number(plan.refundTotal) > 0 && (
                <>
                  <div className="flex justify-between gap-3">
                    <span>Refund/potongan</span>
                    <strong>−{formatRupiah(plan.refundTotal)}</strong>
                  </div>
                  {typeof plan.refundEvidenceReference === 'string' &&
                    plan.refundEvidenceReference &&
                    (/^https:\/\/\S+$/i.test(plan.refundEvidenceReference) ? (
                      <a
                        className="block break-all text-[10px] font-semibold text-[var(--primary)] underline"
                        href={plan.refundEvidenceReference}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Lihat bukti refund/potongan
                      </a>
                    ) : (
                      <p className="break-all text-[10px] text-slate-500">
                        Referensi bukti refund: {plan.refundEvidenceReference}
                      </p>
                    ))}
                </>
              )}
              <div className="flex justify-between gap-3 border-t border-indigo-200 pt-2 text-sm">
                <span className="font-bold">Total akad</span>
                <strong>{formatRupiah(plan.totalObligation)}</strong>
              </div>
            </div>
          </section>

          {closed ? (
            <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              {application.status === 'CANCELLED' ? 'Pengajuan dibatalkan.' : 'Pengajuan ditolak.'}{' '}
              Lihat catatan penyelesaian dan pengurangan refund di atas; jadwal angsuran reguler
              tidak berlaku.
            </p>
          ) : schedule.length > 0 ? (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Jadwal angsuran</h3>
                <span className="text-[10px] text-slate-500">{schedule.length} kali</span>
              </div>
              <DashboardCard>
                {schedule.map((entry) => (
                  <div
                    className="flex items-center justify-between gap-3 border-b border-slate-100 p-3 last:border-0"
                    key={entry.installment}
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-800">
                        Angsuran {entry.installment}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">{formatDate(entry.dueDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-800">
                        {formatRupiah(entry.amount)}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Sisa setelah bayar {formatRupiah(entry.remainingBalance)}
                      </p>
                    </div>
                  </div>
                ))}
              </DashboardCard>
            </section>
          ) : (
            <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              Jadwal angsuran belum dicantumkan dalam rincian akad.
            </p>
          )}

          {agreementReference && (
            <p className="break-all text-xs text-slate-600">
              Referensi akad final:{' '}
              {agreementUrl ? (
                <a
                  className="font-semibold text-[var(--primary)] underline"
                  href={agreementUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Buka akad final
                </a>
              ) : (
                <strong>{agreementReference}</strong>
              )}
            </p>
          )}

          {verified && !closed && (
            <div className="rounded-xl border border-indigo-100 bg-white p-3">
              <p className="text-xs leading-5 text-slate-600">
                Persetujuan ini mencatat bahwa Anda menerima rincian biaya di atas. Status akad
                belum menjadi Disepakati sampai admin mencatat akad final yang sudah ditandatangani.
              </p>
              <button
                className="mt-3 w-full rounded-full bg-[var(--primary)] px-4 py-3 text-xs font-bold text-white disabled:opacity-50"
                disabled={pending || accepted}
                onClick={handleAccept}
                type="button"
              >
                {accepted ? 'Penawaran sudah disetujui' : 'Saya menyetujui rincian terverifikasi'}
              </button>
            </div>
          )}

          {agreed && !closed && (
            <p className="rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
              Akad final tercatat disepakati. Total kewajiban tidak bertambah karena waktu atau
              keterlambatan. Pelunasan dipercepat tidak dikenai penalti.
            </p>
          )}

          {typeof plan.settlementNotes === 'string' && plan.settlementNotes && (
            <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              Catatan penyelesaian: {plan.settlementNotes}
            </p>
          )}

          <section className="rounded-xl border border-slate-100 p-3">
            <h3 className="text-xs font-bold text-slate-800">Permohonan keringanan</h3>
            {supportRequests.map((request, index) => (
              <p className="mt-2 text-[10px] leading-4 text-slate-600" key={index}>
                {request.status === 'OPEN' ? 'Menunggu tinjauan' : 'Ditinjau'} · {request.message}
                {request.response && (
                  <span className="mt-1 block font-semibold text-slate-700">
                    Tanggapan tim: {request.response}
                  </span>
                )}
              </p>
            ))}
            {!closed && (
              <form action={handleSupportRequest} className="mt-3 space-y-2">
                <textarea
                  className="min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  maxLength={1000}
                  minLength={10}
                  name="supportMessage"
                  onChange={(event) => setSupportMessage(event.target.value)}
                  placeholder="Ceritakan kebutuhan tenggang waktu atau penyesuaian jadwal."
                  required
                  value={supportMessage}
                />
                <button
                  className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                  disabled={pending}
                >
                  Kirim permohonan
                </button>
              </form>
            )}
          </section>
        </>
      ) : (
        <p className="rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
          Admin sedang menyusun dan memverifikasi rincian biaya. Nominal dari contoh akad tidak
          digunakan sebagai harga otomatis.
        </p>
      )}
      {feedback && (
        <p aria-live="polite" className="text-xs text-slate-600" role="status">
          {feedback}
        </p>
      )}
    </article>
  )
}

export default function InstallmentsPage() {
  const [token, setToken] = useState('')
  const [applications, setApplications] = useState<UserApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadApplications = useCallback(async (idToken: string) => {
    const result = await getOwnedFinancingApplications(idToken)
    if (!result.ok) {
      setError(result.message)
      setApplications([])
      return
    }
    setError('')
    setApplications(result.applications)
  }, [])

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = onAuthStateChanged(getFirebaseClientAuth(), async (user) => {
        if (!active) return
        if (!user) {
          setToken('')
          setApplications([])
          setError('Sesi akun tidak ditemukan. Silakan masuk kembali.')
          setLoading(false)
          return
        }
        try {
          const idToken = await user.getIdToken()
          if (!active) return
          setToken(idToken)
          await loadApplications(idToken)
        } catch {
          if (active) setError('Sesi tidak dapat diverifikasi. Silakan muat ulang halaman.')
        } finally {
          if (active) setLoading(false)
        }
      })
    } catch {
      setError('Rincian angsuran belum dapat dimuat. Silakan coba lagi.')
      setLoading(false)
    }
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [loadApplications])

  const refresh = () => {
    if (token) void loadApplications(token)
  }

  return (
    <DashboardScaffold
      active="angsuran"
      showHeader={false}
      subtitle="Rincian sesuai akad"
      title="Angsuran saya"
    >
      {loading && (
        <>
          <DashboardCardSkeleton rows={3} />
          <DashboardCardSkeleton rows={4} />
        </>
      )}
      {error && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && applications.length === 0 && (
        <p className="rounded-xl bg-white p-5 text-sm leading-6 text-slate-600">
          Belum ada pengajuan Dana Keberangkatan pada sesi ini.
        </p>
      )}
      {applications.map((application) => (
        <DashboardCard className="p-4" key={application.id}>
          <ApplicationTerms application={application} refresh={refresh} token={token} />
        </DashboardCard>
      ))}
    </DashboardScaffold>
  )
}
