'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { getFirebaseClientAuth } from '@/lib/firebase-client'
import { DOCUMENT_DEFINITIONS } from '@/lib/documents'
import {
  APPLICATION_DOCUMENT_STATUSES,
  APPLICATION_STATUSES,
  PRICING_STATUSES,
  type AdminPaymentRecord,
  type ApplicationDocumentStatus,
  type FinancingApplicationRecord,
} from '@/lib/firebase-data'
import { updateApplicationStatus } from './actions'
import { FinanceTermsFields } from './finance-terms-fields'

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

const STATUS_BADGE_STYLES: Record<string, string> = {
  SUBMITTED: 'bg-blue-50 text-blue-700 ring-blue-200',
  ELIGIBILITY_REVIEW: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  DOCUMENT_REVIEW: 'bg-purple-50 text-purple-700 ring-purple-200',
  REVISION_REQUIRED: 'bg-amber-50 text-amber-800 ring-amber-200',
  COST_VERIFICATION: 'bg-cyan-50 text-cyan-800 ring-cyan-200',
  APPROVED: 'bg-teal-50 text-teal-800 ring-teal-200',
  CONTRACT_PREPARATION: 'bg-violet-50 text-violet-800 ring-violet-200',
  ACTIVE: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  COMPLETED: 'bg-slate-100 text-slate-800 ring-slate-300',
  REJECTED: 'bg-red-50 text-red-700 ring-red-200',
  CANCELLED: 'bg-rose-50 text-rose-700 ring-rose-200',
}

const DOCUMENT_STATUS_LABELS: Record<(typeof APPLICATION_DOCUMENT_STATUSES)[number], string> = {
  NOT_UPLOADED: 'Belum diunggah',
  UPLOADED: 'Sudah diunggah',
  VERIFIED: 'Diverifikasi',
  REVISION_REQUIRED: 'Perlu perbaikan',
}

const DOCUMENT_BADGE_STYLES: Record<ApplicationDocumentStatus, string> = {
  NOT_UPLOADED: 'bg-slate-100 text-slate-600',
  UPLOADED: 'bg-blue-50 text-blue-700',
  VERIFIED: 'bg-emerald-50 text-emerald-700',
  REVISION_REQUIRED: 'bg-amber-50 text-amber-800',
}

const PRICING_STATUS_LABELS: Record<(typeof PRICING_STATUSES)[number], string> = {
  ESTIMATED: 'Estimasi',
  VERIFIED: 'Terverifikasi',
  AGREED: 'Disepakati',
}

const PRICING_BADGE_STYLES: Record<string, string> = {
  ESTIMATED: 'bg-slate-100 text-slate-700',
  VERIFIED: 'bg-amber-50 text-amber-800',
  AGREED: 'bg-emerald-50 text-emerald-800',
}

const RELIGION_LABELS: Record<string, string> = {
  ISLAM: 'Islam',
  PROTESTANT: 'Kristen Protestan',
  CATHOLIC: 'Katolik',
  HINDU: 'Hindu',
  BUDDHIST: 'Buddha',
  CONFUCIAN: 'Konghucu',
}

const DOC_PROGRESS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Belum diproses',
  IN_PROGRESS: 'Sedang diproses',
  ISSUED: 'Sudah terbit',
}

const LANGUAGE_LABELS: Record<string, string> = {
  NOT_STARTED: 'Belum mulai',
  BASIC_N5: 'N5 Dasar',
  N5: 'N5',
  N4: 'N4',
  N3_PLUS: 'N3 atau lebih tinggi',
}

const NEED_LABELS: Record<string, string> = {
  LANGUAGE_TRAINING: 'Biaya pelatihan bahasa',
  LANGUAGE_ALLOWANCE: 'Uang saku pelatihan bahasa',
  SKILL_TRAINING: 'Biaya pelatihan skill',
  SKILL_ALLOWANCE: 'Uang saku pelatihan skill',
  MEDICAL: 'Biaya MCU',
  DOCUMENT: 'Biaya dokumen keberangkatan',
  LPK_PAYMENT: 'Pembayaran LPK',
  ALLOWANCE: 'Biaya uang saku keberangkatan',
  TRANSPORT: 'Transportasi',
  ACCOMMODATION: 'Akomodasi',
  OTHER: 'Kebutuhan lainnya',
}

type ChronologicalStageId =
  | 'overview'
  | 'eligibility'
  | 'documents'
  | 'pricing'
  | 'contract'
  | 'installments'
  | 'support'

type DetailTabId = 'profile' | 'documents' | 'pricing' | 'contract' | 'installments' | 'support'

const SIDEBAR_MENUS: {
  id: ChronologicalStageId
  step: string
  title: string
  subtitle: string
  defaultTab: DetailTabId
}[] = [
  {
    id: 'overview',
    step: '01',
    title: 'Ikhtisar Operasional',
    subtitle: 'Ringkasan pipeline & antrean prioritas',
    defaultTab: 'profile',
  },
  {
    id: 'eligibility',
    step: '02',
    title: 'Pengajuan & Kelayakan',
    subtitle: 'Biodata, LPK, & kesiapan keberangkatan',
    defaultTab: 'profile',
  },
  {
    id: 'documents',
    step: '03',
    title: 'Verifikasi Berkas',
    subtitle: 'Pemeriksaan dokumen Drive & revisi',
    defaultTab: 'documents',
  },
  {
    id: 'pricing',
    step: '04',
    title: 'Verifikasi Biaya',
    subtitle: 'Susun Nafaqah, Ujrah, & penawaran',
    defaultTab: 'pricing',
  },
  {
    id: 'contract',
    step: '05',
    title: 'Persetujuan & Akad',
    subtitle: 'Konfirmasi pemohon & referensi akad final',
    defaultTab: 'contract',
  },
  {
    id: 'installments',
    step: '06',
    title: 'Angsuran & Pembayaran',
    subtitle: 'Jadwal cicilan & transaksi Xendit',
    defaultTab: 'installments',
  },
  {
    id: 'support',
    step: '07',
    title: 'Keringanan & Audit',
    subtitle: 'Permohonan keringanan, arsip, & riwayat',
    defaultTab: 'support',
  },
]

const DETAIL_TABS: { id: DetailTabId; step: string; label: string }[] = [
  { id: 'profile', step: '02', label: 'Profil & Kelayakan' },
  { id: 'documents', step: '03', label: 'Verifikasi Berkas' },
  { id: 'pricing', step: '04', label: 'Rincian Biaya' },
  { id: 'contract', step: '05', label: 'Persetujuan & Akad' },
  { id: 'installments', step: '06', label: 'Jadwal Angsuran' },
  { id: 'support', step: '07', label: 'Keringanan & Audit' },
]

const formatRupiah = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? `Rp${value.toLocaleString('id-ID')}`
    : 'Belum ditetapkan'

const formatDateTime = (value: unknown) => {
  if (typeof value !== 'string' || !value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('id-ID')
}

const formatSizeMb = (size?: number) =>
  typeof size === 'number' && size > 0 ? `${(size / 1024 / 1024).toFixed(2)} MB` : ''

const matchesStage = (app: FinancingApplicationRecord, stage: ChronologicalStageId): boolean => {
  const pricingStatus = String(app.financialPlan?.pricingStatus ?? 'ESTIMATED')
  switch (stage) {
    case 'overview':
      return true
    case 'eligibility':
      return ['SUBMITTED', 'ELIGIBILITY_REVIEW'].includes(app.status)
    case 'documents':
      return (
        ['DOCUMENT_REVIEW', 'REVISION_REQUIRED'].includes(app.status) ||
        app.documents.some((doc) => doc.status === 'UPLOADED' || doc.status === 'REVISION_REQUIRED')
      )
    case 'pricing':
      return (
        ['COST_VERIFICATION', 'APPROVED'].includes(app.status) ||
        (pricingStatus === 'ESTIMATED' && !['REJECTED', 'CANCELLED'].includes(app.status))
      )
    case 'contract':
      return (
        app.status === 'CONTRACT_PREPARATION' ||
        pricingStatus === 'VERIFIED' ||
        pricingStatus === 'AGREED' ||
        Boolean(app.userFinancingAcceptance?.acceptedAt)
      )
    case 'installments':
      return (
        ['ACTIVE', 'COMPLETED'].includes(app.status) ||
        (Array.isArray(app.financialPlan?.schedule) && app.financialPlan.schedule.length > 0)
      )
    case 'support':
      return (
        (app.supportRequests?.length ?? 0) > 0 ||
        ['REJECTED', 'CANCELLED'].includes(app.status) ||
        (app.financialPlanHistory?.length ?? 0) > 0
      )
  }
}

type ScheduleRow = {
  installment: number
  dueDate: string
  amount: number
  remainingBalance?: number
}

const readScheduleRows = (value: unknown): ScheduleRow[] => {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is ScheduleRow =>
      Boolean(item) &&
      typeof item === 'object' &&
      typeof (item as ScheduleRow).installment === 'number' &&
      typeof (item as ScheduleRow).dueDate === 'string' &&
      typeof (item as ScheduleRow).amount === 'number',
  )
}

function ApplicationWorkspaceForm({
  application,
  payments,
  activeTab,
  setActiveTab,
  pending,
  onSave,
}: {
  application: FinancingApplicationRecord
  payments: AdminPaymentRecord[]
  activeTab: DetailTabId
  setActiveTab: (tab: DetailTabId) => void
  pending: boolean
  onSave: (application: FinancingApplicationRecord, formData: FormData) => void
}) {
  const [docStatuses, setDocStatuses] = useState<ApplicationDocumentStatus[]>(() =>
    application.documents.map((doc) => doc.status),
  )

  const definitions =
    DOCUMENT_DEFINITIONS[application.product] ?? DOCUMENT_DEFINITIONS.DEPARTURE_BRIDGING
  const uploadedCount = application.documents.filter((doc) => Boolean(doc.fileId)).length
  const verifiedCount = docStatuses.filter((status) => status === 'VERIFIED').length
  const revisionCount = docStatuses.filter((status) => status === 'REVISION_REQUIRED').length
  const openSupportCount = (application.supportRequests ?? []).filter(
    (req) => req.status === 'OPEN',
  ).length

  const pricingStatus = String(application.financialPlan?.pricingStatus ?? 'ESTIMATED')
  const schedule = readScheduleRows(application.financialPlan?.schedule)
  const paidSet = new Set(
    Array.isArray(application.paidInstallments) ? application.paidInstallments : [],
  )
  const paidInstallmentsCount = schedule.filter((row) => paidSet.has(row.installment)).length
  const paidAmountTotal = schedule
    .filter((row) => paidSet.has(row.installment))
    .reduce((sum, row) => sum + row.amount, 0)
  const totalObligation =
    typeof application.financialPlan?.totalObligation === 'number'
      ? application.financialPlan.totalObligation
      : null

  const personal = application.personalDetails ?? {}
  const eligibility = application.eligibility ?? {}
  const fullCover = application.fullCoverDetails ?? {}
  const departure = application.departureDetails ?? {}

  const markAllUploadedAsVerified = () => {
    setDocStatuses((current) =>
      current.map((status, index) => (application.documents[index]?.fileId ? 'VERIFIED' : status)),
    )
  }

  return (
    <form
      action={(formData) => onSave(application, formData)}
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
    >
      {/* Top Identity Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#17158c] px-2.5 py-1 text-xs font-bold tracking-wide text-white">
              {application.applicationId}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                STATUS_BADGE_STYLES[application.status] ??
                'bg-slate-100 text-slate-700 ring-slate-200'
              }`}
            >
              {STATUS_LABELS[application.status as keyof typeof STATUS_LABELS] ??
                application.status}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                PRICING_BADGE_STYLES[pricingStatus] ?? 'bg-slate-100 text-slate-700'
              }`}
            >
              Biaya:{' '}
              {PRICING_STATUS_LABELS[pricingStatus as keyof typeof PRICING_STATUS_LABELS] ??
                pricingStatus}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {application.product === 'FULL_COVER' ? 'VSV Full Cover' : 'VSV Dana Keberangkatan'}
            </span>
          </div>
          <h2 className="mt-2.5 text-xl font-extrabold text-slate-900">
            {application.applicantName}
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            WA: <strong>{application.phone}</strong> · LPK: <strong>{application.lpkName}</strong> ·
            Tujuan: <strong>{application.destination === 'JAPAN' ? 'Jepang' : 'Turki'}</strong>
          </p>
        </div>
        <div className="text-left text-xs text-slate-500 sm:text-right">
          <p>
            Diajukan:{' '}
            <strong className="text-slate-700">{formatDateTime(application.createdAt)}</strong>
          </p>
          {application.updatedAt && (
            <p className="mt-0.5">
              Diperbarui:{' '}
              <strong className="text-slate-700">{formatDateTime(application.updatedAt)}</strong>
              {application.updatedBy ? ` oleh ${application.updatedBy}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Sticky Workflow Action Bar */}
      <div className="rounded-xl border border-indigo-100 bg-slate-50/90 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1.8fr_auto]">
          <label className="space-y-1 text-xs font-semibold text-slate-700">
            <span>Status Pengajuan (Tahap Sistem)</span>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-[#17158c] focus:outline-none"
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
          <label className="space-y-1 text-xs font-semibold text-slate-700">
            <span>Status Rincian Biaya</span>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-[#17158c] focus:outline-none"
              defaultValue={pricingStatus}
              name="pricingStatus"
            >
              {PRICING_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PRICING_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-700">
            <span>Catatan Internal Operasional (Hanya Staf)</span>
            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-normal text-slate-900 focus:border-[#17158c] focus:outline-none"
              defaultValue={application.internalNotes ?? ''}
              maxLength={2000}
              name="internalNotes"
              placeholder="Tulis catatan verifikasi internal untuk tim operasional…"
            />
          </label>
          <button
            className="self-end rounded-lg bg-[#17158c] px-5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#111077] disabled:cursor-wait disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {pending ? 'Menyimpan…' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>

      {/* Chronological Detail Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
        {DETAIL_TABS.map((tab) => {
          const isActive = activeTab === tab.id
          let badgeText = ''
          if (tab.id === 'documents') badgeText = `${uploadedCount}/${application.documents.length}`
          if (tab.id === 'installments' && schedule.length > 0) {
            badgeText = `${paidInstallmentsCount}/${schedule.length}`
          }
          if (tab.id === 'support' && openSupportCount > 0) {
            badgeText = `${openSupportCount} baru`
          }

          return (
            <button
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                isActive
                  ? 'bg-[#17158c] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
              }`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <span
                className={`text-[10px] font-bold ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}
              >
                {tab.step}
              </span>
              <span>{tab.label}</span>
              {badgeText && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : tab.id === 'support' && openSupportCount > 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-white text-slate-700'
                  }`}
                >
                  {badgeText}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* TAB 02: PROFIL & KELAYAKAN */}
      <div className={activeTab === 'profile' ? 'block space-y-5' : 'hidden'}>
        {application.product === 'DEPARTURE_BRIDGING' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
            <strong>Estimasi total yang diajukan pemohon:</strong>{' '}
            <strong>{formatRupiah(departure.requestedFinancingAmount)}</strong> (Sisa kewajiban LPK:{' '}
            <strong>{formatRupiah(departure.outstandingLPKAmount)}</strong>). Angka ini adalah
            pengajuan awal pemohon, bukan nominal Nafaqah/Ujrah terverifikasi atau nilai akad final.
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Biodata KTP & Domisili */}
          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-900">1. Identitas & Kontak Pemohon</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-slate-400">Nama Lengkap (KTP)</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">{application.applicantName}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Nomor WhatsApp</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">{application.phone}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Tempat, Tanggal Lahir</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">
                  {String(personal.birthPlace ?? '—')}, {String(personal.birthDate ?? '—')}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Jenis Kelamin & Agama</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">
                  {personal.gender === 'FEMALE' ? 'Perempuan' : 'Laki-laki'} ·{' '}
                  {RELIGION_LABELS[String(personal.religion ?? '')] ??
                    String(personal.religion ?? '—')}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-400">Alamat Sesuai KTP</dt>
                <dd className="mt-0.5 rounded-lg bg-slate-50 p-2.5 font-medium text-slate-800">
                  {String(personal.idCardAddress ?? '—')}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-400">
                  Alamat Korespondensi{' '}
                  {personal.domicileSameAsIdCard ? '(Sama dengan KTP)' : '(Berbeda dari KTP)'}
                </dt>
                <dd className="mt-0.5 rounded-lg bg-slate-50 p-2.5 font-medium text-slate-800">
                  {String(personal.domicileAddress ?? '—')}{' '}
                  {personal.domicilePostalCode
                    ? `· Kode Pos ${String(personal.domicilePostalCode)}`
                    : ''}
                </dd>
              </div>
            </dl>
          </section>

          {/* Kesiapan & Kelayakan */}
          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-900">
              2. Checklist Kesiapan & Kelayakan Program
            </h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-slate-400">Lembaga Pelatihan Kerja (LPK)</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">{application.lpkName}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Negara Tujuan & Skema</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">
                  {application.destination === 'JAPAN' ? 'Jepang' : 'Turki'} ·{' '}
                  {application.contractScheme ?? 'WAKALAH_BIL_UJRAH'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Status COE & Visa</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">
                  COE: {DOC_PROGRESS_LABELS[String(eligibility.coeStatus ?? '')] ?? '—'} · Visa:{' '}
                  {DOC_PROGRESS_LABELS[String(eligibility.visaStatus ?? '')] ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Perkiraan Keberangkatan</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">
                  {String(eligibility.estimatedDeparture ?? 'Belum ditentukan')}
                </dd>
              </div>
            </dl>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
              {[
                ['Pelatihan dimulai', eligibility.trainingStarted],
                ['Pelatihan selesai', eligibility.trainingCompleted],
                ['Lulus penempatan', eligibility.placementPassed],
                ['Memiliki paspor', eligibility.hasPassport],
                ['Kontrak kerja ada', eligibility.hasWorkContract],
                ['Persetujuan wali', eligibility.guardianApproval],
              ].map(([label, checked]) => (
                <div
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${
                    checked ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-50 text-slate-500'
                  }`}
                  key={String(label)}
                >
                  <span>{String(label)}</span>
                  <strong className="font-bold">{checked ? 'Ya' : 'Tidak'}</strong>
                </div>
              ))}
            </div>

            {application.product === 'FULL_COVER' && (
              <div className="mt-3 border-t border-slate-100 pt-3 text-xs">
                <p className="font-semibold text-slate-700">Rincian Program Full Cover:</p>
                <p className="mt-1 text-slate-600">
                  Level bahasa:{' '}
                  <strong>
                    {LANGUAGE_LABELS[String(fullCover.languageLevel ?? '')] ??
                      String(fullCover.languageLevel ?? '—')}
                  </strong>{' '}
                  · Mulai pelatihan: <strong>{String(fullCover.trainingStartDate ?? '—')}</strong> ·
                  Durasi bahasa:{' '}
                  <strong>{String(fullCover.languageTrainingMonths ?? '—')} bln</strong> · Durasi
                  skill: <strong>{String(fullCover.skillTrainingMonths ?? '—')} bln</strong>
                </p>
                <p className="mt-1.5 text-slate-600">
                  Kebutuhan diajukan:{' '}
                  <strong>
                    {(application.fundingNeeds ?? []).length > 0
                      ? application.fundingNeeds
                          .map(
                            (item) => NEED_LABELS[String(item.category)] ?? String(item.category),
                          )
                          .join(', ')
                      : 'Tidak ada item dipilih'}
                  </strong>
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* TAB 03: VERIFIKASI BERKAS */}
      <div className={activeTab === 'documents' ? 'block space-y-4' : 'hidden'}>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span>
              Terunggah:{' '}
              <strong className="text-slate-900">
                {uploadedCount}/{application.documents.length}
              </strong>
            </span>
            <span>
              Diverifikasi: <strong className="text-emerald-700">{verifiedCount}</strong>
            </span>
            <span>
              Perlu perbaikan: <strong className="text-amber-700">{revisionCount}</strong>
            </span>
          </div>
          {uploadedCount > 0 && (
            <button
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
              onClick={markAllUploadedAsVerified}
              type="button"
            >
              ✓ Tandai Semua Berkas Terunggah sebagai Diverifikasi
            </button>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">No</th>
                <th className="px-4 py-3">Jenis Dokumen</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Berkas Google Drive</th>
                <th className="px-4 py-3">Status Verifikasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {application.documents.map((document, index) => {
                const def = definitions[index]
                const currentStatus = docStatuses[index] ?? document.status
                return (
                  <tr className="hover:bg-slate-50/80" key={`${document.documentType}-${index}`}>
                    <td className="px-4 py-3 font-medium text-slate-400">{index + 1}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {document.documentType}
                      {def?.required && <span className="ml-1 text-red-600">*</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {def?.section === 'dokumen-pendukung' ? 'Pendukung' : 'Utama'}
                    </td>
                    <td className="px-4 py-3">
                      {document.fileId ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2.5 py-1 font-semibold text-[#17158c] hover:bg-indigo-100"
                            href={`/api/admin/applications/${application.id}/documents/${index}`}
                          >
                            <span>Unduh {document.fileName ?? 'berkas'}</span>
                          </a>
                          {document.size && (
                            <span className="text-[11px] text-slate-400">
                              ({formatSizeMb(document.size)})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">Belum ada berkas</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`Status ${document.documentType}`}
                          className={`rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold ${
                            DOCUMENT_BADGE_STYLES[currentStatus] ?? ''
                          }`}
                          name={`documentStatus-${index}`}
                          onChange={(event) => {
                            const next = event.target.value as ApplicationDocumentStatus
                            setDocStatuses((prev) =>
                              prev.map((item, idx) => (idx === index ? next : item)),
                            )
                          }}
                          value={currentStatus}
                        >
                          {APPLICATION_DOCUMENT_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {DOCUMENT_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* TAB 04: RINCIAN BIAYA & SKEMA SYARIAH */}
      <div className={activeTab === 'pricing' ? 'block space-y-4' : 'hidden'}>
        {application.product === 'FULL_COVER' ? (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/80 p-4 text-xs leading-5 text-indigo-950">
            {application.destination === 'JAPAN'
              ? 'Nilai tidak diisi otomatis dari contoh akad. Verifikasi nominal berdasarkan kebutuhan dan bukti aktual. Ju’alah hanya berlaku jika COE terbit; tenor diisi sesuai akad yang disepakati. Tandai Disepakati hanya setelah akad final ditandatangani.'
              : 'Akad contoh hanya menetapkan Ju’alah untuk Jepang. Konfirmasi ketentuan negara tujuan sebelum biaya dapat diverifikasi.'}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
            <strong>Aturan Verifikasi Biaya Dana Keberangkatan:</strong> Status biaya{' '}
            <strong>Terverifikasi</strong> mensyaratkan minimal 1 komponen Nafaqah (lengkap dengan
            penerima & referensi bukti), minimal 1 komponen Ujrah, serta jadwal angsuran valid (1–36
            bulan, tanggal angsuran pertama berada pada bulan setelah perkiraan keberangkatan:{' '}
            <strong>{String(eligibility.estimatedDeparture ?? 'belum diisi')}</strong>).
          </div>
        )}

        <FinanceTermsFields
          financialPlan={application.financialPlan}
          product={application.product}
        />
      </div>

      {/* TAB 05: PERSETUJUAN PEMOHON & AKAD FINAL */}
      <div className={activeTab === 'contract' ? 'block space-y-4' : 'hidden'}>
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-900">Status Persetujuan Pemohon</h3>
            {application.userFinancingAcceptance?.acceptedAt ? (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-950">
                <p className="font-bold text-emerald-900">
                  ✓ Pemohon telah menyetujui rincian penawaran terverifikasi
                </p>
                <p className="mt-1">
                  Waktu persetujuan:{' '}
                  <strong>{formatDateTime(application.userFinancingAcceptance.acceptedAt)}</strong>
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
                <p className="font-bold">Menunggu persetujuan pemohon</p>
                <p className="mt-1 leading-5">
                  Pemohon belum menekan tombol{' '}
                  <em>&ldquo;Saya menyetujui rincian terverifikasi&rdquo;</em> di halaman{' '}
                  <code>/dashboard/angsuran</code>, atau rincian biaya baru saja diubah sehingga
                  memerlukan persetujuan ulang.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-900">Prasyarat Penguncian Akad Final</h3>
            <ul className="mt-3 space-y-2 text-xs text-slate-700">
              <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>1. Rincian biaya diset ke Terverifikasi / Disepakati</span>
                <strong
                  className={pricingStatus !== 'ESTIMATED' ? 'text-emerald-700' : 'text-amber-700'}
                >
                  {pricingStatus !== 'ESTIMATED' ? 'Terpenuhi' : 'Belum'}
                </strong>
              </li>
              <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>2. Persetujuan pemohon tercatat pada penawaran terbaru</span>
                <strong
                  className={
                    application.userFinancingAcceptance?.acceptedAt
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                  }
                >
                  {application.userFinancingAcceptance?.acceptedAt ? 'Terpenuhi' : 'Belum'}
                </strong>
              </li>
              <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>3. Referensi akad final yang ditandatangani telah diisi</span>
                <strong
                  className={
                    application.financialPlan?.finalAgreementReference
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                  }
                >
                  {application.financialPlan?.finalAgreementReference
                    ? String(application.financialPlan.finalAgreementReference)
                    : 'Belum diisi (isi di tab Rincian Biaya)'}
                </strong>
              </li>
            </ul>
          </section>
        </div>
      </div>

      {/* TAB 06: JADWAL ANGSURAN & PEMBAYARAN */}
      <div className={activeTab === 'installments' ? 'block space-y-5' : 'hidden'}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="text-xs text-slate-500">Total Kewajiban Akad</span>
            <strong className="mt-1 block text-base font-extrabold text-slate-900">
              {formatRupiah(totalObligation)}
            </strong>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <span className="text-xs text-emerald-700">Angsuran Terbayar</span>
            <strong className="mt-1 block text-base font-extrabold text-emerald-900">
              {formatRupiah(paidAmountTotal)} ({paidInstallmentsCount}/{schedule.length} cicilan)
            </strong>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4">
            <span className="text-xs text-indigo-700">Sisa Kewajiban</span>
            <strong className="mt-1 block text-base font-extrabold text-[#17158c]">
              {totalObligation !== null
                ? formatRupiah(Math.max(0, totalObligation - paidAmountTotal))
                : 'Belum ditetapkan'}
            </strong>
          </div>
        </div>

        {schedule.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
            Jadwal angsuran belum terbentuk. Susun dan verifikasi rincian biaya terlebih dahulu pada
            tab <strong>04 · Rincian Biaya</strong>.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Angsuran</th>
                  <th className="px-4 py-3">Jatuh Tempo</th>
                  <th className="px-4 py-3">Nominal Tagihan</th>
                  <th className="px-4 py-3">Sisa Setelah Bayar</th>
                  <th className="px-4 py-3">Status Pembayaran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedule.map((row) => {
                  const isPaid = paidSet.has(row.installment)
                  return (
                    <tr className="hover:bg-slate-50/80" key={row.installment}>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        Angsuran ke-{row.installment}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.dueDate}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {formatRupiah(row.amount)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {typeof row.remainingBalance === 'number'
                          ? formatRupiah(row.remainingBalance)
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isPaid ? '✓ Lunas' : 'Belum dibayar'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Xendit Payment Logs for this Application */}
        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-900">
            Riwayat Transaksi Xendit ({payments.length})
          </h3>
          {payments.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              Belum ada invoice Xendit yang dibuat untuk pengajuan ini.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-400">
                    <th className="py-2 pr-3">Deskripsi</th>
                    <th className="py-2 pr-3">Tipe</th>
                    <th className="py-2 pr-3">Nominal</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Metode / Waktu Lunas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="py-2.5 pr-3 font-medium text-slate-900">
                        {payment.description || payment.id}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600">
                        {payment.type === 'CUSTOM'
                          ? 'Sukarela'
                          : `Angsuran #${payment.installmentNumber ?? '—'}`}
                      </td>
                      <td className="py-2.5 pr-3 font-semibold text-slate-900">
                        {formatRupiah(payment.amount)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            payment.status === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700'
                              : payment.status === 'PENDING'
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {payment.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-500">
                        {payment.paidAt
                          ? `${payment.paidMethod ?? ''}${payment.paidChannel ? ` (${payment.paidChannel})` : ''} · ${formatDateTime(payment.paidAt)}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* TAB 07: PERMOHONAN KERINGANAN & RIWAYAT AUDIT */}
      <div className={activeTab === 'support' ? 'block space-y-5' : 'hidden'}>
        <section className="space-y-3 rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-900">
            Permohonan Keringanan Pemohon ({(application.supportRequests ?? []).length})
          </h3>
          {(application.supportRequests ?? []).length === 0 ? (
            <p className="text-xs text-slate-500">
              Tidak ada permohonan keringanan pada pengajuan ini.
            </p>
          ) : (
            (application.supportRequests ?? []).map((request, index) => (
              <div
                className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4"
                key={`${request.requestedAt}-${index}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-950">
                    Permohonan #{index + 1} ·{' '}
                    {request.status === 'OPEN' ? 'Perlu Ditinjau' : 'Sudah Ditinjau'}
                  </span>
                  <span className="text-[11px] text-amber-800">
                    Diajukan: {formatDateTime(request.requestedAt)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap rounded-lg bg-white p-3 text-xs leading-5 text-slate-800">
                  {request.message}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-semibold text-slate-700">
                    <span>Status permohonan</span>
                    <select
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-normal text-slate-900"
                      defaultValue={request.status}
                      name={`supportRequestStatus-${index}`}
                    >
                      <option value="OPEN">Menunggu tinjauan</option>
                      <option value="REVIEWED">Ditinjau</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-slate-700">
                    <span>Tanggapan untuk pemohon</span>
                    <input
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-normal text-slate-900"
                      defaultValue={request.response ?? ''}
                      maxLength={1000}
                      name={`supportRequestResponse-${index}`}
                      placeholder="Tulis tanggapan resmi tim VentureGo…"
                    />
                  </label>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-900">
            Riwayat Audit Perubahan Biaya ({(application.financialPlanHistory ?? []).length})
          </h3>
          {(application.financialPlanHistory ?? []).length === 0 ? (
            <p className="text-xs text-slate-500">Belum ada riwayat perubahan rincian biaya.</p>
          ) : (
            <div className="space-y-2.5">
              {[...(application.financialPlanHistory ?? [])].reverse().map((entry, idx) => (
                <div
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs"
                  key={`${entry.changedAt}-${idx}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-slate-900">
                      Oleh: {entry.changedBy} · Status Biaya:{' '}
                      {PRICING_STATUS_LABELS[
                        entry.pricingStatus as keyof typeof PRICING_STATUS_LABELS
                      ] ?? entry.pricingStatus}
                    </strong>
                    <span className="text-slate-500">{formatDateTime(entry.changedAt)}</span>
                  </div>
                  <p className="mt-1 text-slate-600">
                    Total Kewajiban:{' '}
                    <strong>{formatRupiah(entry.financialPlan?.totalObligation)}</strong>
                    {entry.finalAgreementReference
                      ? ` · Referensi Akad: ${entry.finalAgreementReference}`
                      : ''}
                  </p>
                  {entry.settlementNotes && (
                    <p className="mt-1 text-slate-500">Catatan: {entry.settlementNotes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </form>
  )
}

export function AdminDashboard({
  email,
  applications,
  payments = [],
}: {
  email: string
  applications: FinancingApplicationRecord[]
  payments?: AdminPaymentRecord[]
}) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [savedNotice, setSavedNotice] = useState('')
  const [pending, startTransition] = useTransition()

  const [activeStage, setActiveStage] = useState<ChronologicalStageId>('overview')
  const [detailTab, setDetailTab] = useState<DetailTabId>('profile')
  const [selectedId, setSelectedId] = useState<string>(applications[0]?.id ?? '')
  const [searchQuery, setSearchQuery] = useState('')
  const [productFilter, setProductFilter] = useState<'ALL' | 'FULL_COVER' | 'DEPARTURE_BRIDGING'>(
    'ALL',
  )
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [showAllInStage, setShowAllInStage] = useState(false)

  const logout = async () => {
    await fetch('/api/admin/session', { method: 'DELETE' })
    await signOut(getFirebaseClientAuth()).catch(() => {})
    router.replace('/')
  }

  const stageCounts = useMemo(() => {
    const counts: Record<ChronologicalStageId, number> = {
      overview: applications.length,
      eligibility: 0,
      documents: 0,
      pricing: 0,
      contract: 0,
      installments: 0,
      support: 0,
    }
    for (const app of applications) {
      if (matchesStage(app, 'eligibility')) counts.eligibility += 1
      if (matchesStage(app, 'documents')) counts.documents += 1
      if (matchesStage(app, 'pricing')) counts.pricing += 1
      if (matchesStage(app, 'contract')) counts.contract += 1
      if (matchesStage(app, 'installments')) counts.installments += 1
      if (matchesStage(app, 'support')) counts.support += 1
    }
    return counts
  }, [applications])

  const filteredApplications = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return applications.filter((app) => {
      if (!showAllInStage && !matchesStage(app, activeStage)) return false
      if (productFilter !== 'ALL' && app.product !== productFilter) return false
      if (statusFilter !== 'ALL' && app.status !== statusFilter) return false
      if (!query) return true
      return (
        app.applicationId.toLowerCase().includes(query) ||
        app.applicantName.toLowerCase().includes(query) ||
        app.phone.toLowerCase().includes(query) ||
        app.lpkName.toLowerCase().includes(query)
      )
    })
  }, [applications, activeStage, showAllInStage, productFilter, statusFilter, searchQuery])

  const selectedApplication =
    filteredApplications.find((app) => app.id === selectedId) ??
    applications.find((app) => app.id === selectedId) ??
    filteredApplications[0] ??
    applications[0] ??
    null

  const selectedPayments = useMemo(
    () =>
      selectedApplication
        ? payments.filter(
            (payment) =>
              payment.applicationDocId === selectedApplication.id ||
              payment.applicationId === selectedApplication.applicationId,
          )
        : [],
    [payments, selectedApplication],
  )

  const handleSelectStage = (stageId: ChronologicalStageId) => {
    setActiveStage(stageId)
    setShowAllInStage(false)
    const menu = SIDEBAR_MENUS.find((item) => item.id === stageId)
    if (menu) setDetailTab(menu.defaultTab)
    const firstMatch = applications.find((app) => matchesStage(app, stageId))
    if (firstMatch) setSelectedId(firstMatch.id)
  }

  const save = (application: FinancingApplicationRecord, formData: FormData) => {
    setError('')
    setSavedNotice('')
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
          jualaTotal: String(formData.get('jualaTotal') ?? ''),
          nafaqahItems: String(formData.get('nafaqahItems') ?? '[]'),
          ujrahItems: String(formData.get('ujrahItems') ?? '[]'),
          qardhAmount: String(formData.get('qardhAmount') ?? '0'),
          qardhDisbursed: String(formData.get('qardhDisbursed') ?? 'false'),
          installmentCount: String(formData.get('installmentCount') ?? ''),
          firstPaymentDate: String(formData.get('firstPaymentDate') ?? ''),
          refundTotal: String(formData.get('refundTotal') ?? '0'),
          refundEvidenceReference: String(formData.get('refundEvidenceReference') ?? ''),
          finalAgreementReference: String(formData.get('finalAgreementReference') ?? ''),
          settlementNotes: String(formData.get('settlementNotes') ?? ''),
        },
        (application.supportRequests ?? []).map((request, index) => ({
          status: String(formData.get(`supportRequestStatus-${index}`) ?? request.status),
          response: String(
            formData.get(`supportRequestResponse-${index}`) ?? request.response ?? '',
          ),
        })),
      )
      if (!result.ok) {
        setError(result.message)
      } else {
        setSavedNotice(`Perubahan pada ${application.applicationId} berhasil disimpan.`)
        router.refresh()
      }
    })
  }

  const activeMenuMeta = SIDEBAR_MENUS.find((item) => item.id === activeStage) ?? SIDEBAR_MENUS[0]

  const openReliefCount = applications.reduce(
    (sum, app) =>
      sum + (app.supportRequests ?? []).filter((request) => request.status === 'OPEN').length,
    0,
  )

  return (
    <div className="min-h-screen bg-[#f4f6fb] text-slate-900 lg:flex">
      {/* LEFT CHRONOLOGICAL SIDEBAR */}
      <aside className="flex w-full flex-col justify-between border-b border-slate-200 bg-[#0f1338] text-white lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="p-5">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <img
              alt="VentureGo"
              className="size-8 rounded-lg bg-white/10 p-1.5"
              height={32}
              src="/venturego-mark.svg"
              width={32}
            />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                VentureGo VSV
              </p>
              <h1 className="text-sm font-extrabold tracking-tight text-white">
                Backoffice Operasional
              </h1>
            </div>
          </div>

          <p className="mt-4 px-2 text-[10px] font-bold uppercase tracking-wider text-indigo-300/80">
            Alur Kronologis Sistem
          </p>
          <nav aria-label="Menu tahapan operasional" className="mt-2 space-y-1">
            {SIDEBAR_MENUS.map((item) => {
              const active = activeStage === item.id
              const count = stageCounts[item.id]
              return (
                <button
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition ${
                    active
                      ? 'bg-[#252b7a] text-white shadow-sm ring-1 ring-indigo-400/30'
                      : 'text-indigo-100/80 hover:bg-white/5 hover:text-white'
                  }`}
                  key={item.id}
                  onClick={() => handleSelectStage(item.id)}
                  type="button"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold ${
                          active
                            ? 'bg-indigo-400/30 text-indigo-100'
                            : 'bg-white/10 text-indigo-200'
                        }`}
                      >
                        {item.step}
                      </span>
                      <span className="truncate text-xs font-bold">{item.title}</span>
                    </div>
                    <p className="mt-0.5 truncate pl-7 text-[11px] text-indigo-200/70">
                      {item.subtitle}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      active ? 'bg-white text-[#17158c]' : 'bg-white/10 text-indigo-100'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </nav>
        </div>

        <div className="border-t border-white/10 bg-black/20 p-4">
          <div className="mb-3 min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
              Staf Aktif
            </span>
            <strong className="mt-0.5 block truncate text-xs text-white">{email}</strong>
          </div>
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
              onClick={() => router.refresh()}
              type="button"
            >
              Segarkan
            </button>
            <button
              className="flex-1 rounded-lg border border-rose-400/30 bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/30"
              onClick={logout}
              type="button"
            >
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE */}
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        {/* Contextual Stage Header */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-extrabold text-[#17158c]">
                TAHAP {activeMenuMeta.step}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Pipeline Operasional VentureGo
              </span>
            </div>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
              {activeMenuMeta.title}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">{activeMenuMeta.subtitle}</p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              aria-label="Cari pengajuan"
              className="w-56 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 shadow-2xs focus:border-[#17158c] focus:outline-none"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Cari ID, nama, WA, LPK…"
              value={searchQuery}
            />
            <select
              aria-label="Filter produk"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs"
              onChange={(event) =>
                setProductFilter(event.target.value as 'ALL' | 'FULL_COVER' | 'DEPARTURE_BRIDGING')
              }
              value={productFilter}
            >
              <option value="ALL">Semua Produk</option>
              <option value="DEPARTURE_BRIDGING">Dana Keberangkatan</option>
              <option value="FULL_COVER">Full Cover</option>
            </select>
            <select
              aria-label="Filter status"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="ALL">Semua Status</option>
              {APPLICATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* Alerts */}
        {error && (
          <div
            className="mb-5 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800"
            role="alert"
          >
            <span>{error}</span>
            <button className="text-red-600 underline" onClick={() => setError('')} type="button">
              Tutup
            </button>
          </div>
        )}
        {savedNotice && (
          <div
            className="mb-5 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900"
            role="status"
          >
            <span>✓ {savedNotice}</span>
            <button
              className="text-emerald-700 underline"
              onClick={() => setSavedNotice('')}
              type="button"
            >
              Tutup
            </button>
          </div>
        )}

        {/* OVERVIEW KPI STRIP (Shown on 01 · Ikhtisar Operasional) */}
        {activeStage === 'overview' && (
          <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <button
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:border-indigo-300"
              onClick={() => handleSelectStage('eligibility')}
              type="button"
            >
              <span className="text-[11px] font-bold uppercase text-slate-400">
                02 · Pengajuan Baru
              </span>
              <strong className="mt-1 block text-2xl font-extrabold text-slate-900">
                {stageCounts.eligibility}
              </strong>
              <span className="mt-1 block text-[11px] text-slate-500">Menunggu cek kelayakan</span>
            </button>
            <button
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:border-indigo-300"
              onClick={() => handleSelectStage('documents')}
              type="button"
            >
              <span className="text-[11px] font-bold uppercase text-slate-400">
                03 · Verifikasi Berkas
              </span>
              <strong className="mt-1 block text-2xl font-extrabold text-purple-700">
                {stageCounts.documents}
              </strong>
              <span className="mt-1 block text-[11px] text-slate-500">Berkas perlu diperiksa</span>
            </button>
            <button
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:border-indigo-300"
              onClick={() => handleSelectStage('pricing')}
              type="button"
            >
              <span className="text-[11px] font-bold uppercase text-slate-400">
                04 · Verifikasi Biaya
              </span>
              <strong className="mt-1 block text-2xl font-extrabold text-[#17158c]">
                {stageCounts.pricing}
              </strong>
              <span className="mt-1 block text-[11px] text-slate-500">
                Penyusunan Nafaqah & Ujrah
              </span>
            </button>
            <button
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:border-indigo-300"
              onClick={() => handleSelectStage('installments')}
              type="button"
            >
              <span className="text-[11px] font-bold uppercase text-slate-400">
                06 · Angsuran Aktif
              </span>
              <strong className="mt-1 block text-2xl font-extrabold text-emerald-700">
                {stageCounts.installments}
              </strong>
              <span className="mt-1 block text-[11px] text-slate-500">
                Program cicilan berjalan
              </span>
            </button>
            <button
              className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-left shadow-2xs transition hover:border-amber-300"
              onClick={() => handleSelectStage('support')}
              type="button"
            >
              <span className="text-[11px] font-bold uppercase text-amber-800">
                07 · Keringanan Terbuka
              </span>
              <strong className="mt-1 block text-2xl font-extrabold text-amber-900">
                {openReliefCount}
              </strong>
              <span className="mt-1 block text-[11px] text-amber-800">
                Permohonan menunggu respon
              </span>
            </button>
          </section>
        )}

        {/* MASTER-DETAIL WORKSPACE */}
        {applications.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
            Belum ada pengajuan pembiayaan yang tercatat di sistem.
          </section>
        ) : (
          <div className="grid items-start gap-6 xl:grid-cols-[340px_1fr]">
            {/* Left Column: Stage Queue List */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
                    Antrean Pengajuan ({filteredApplications.length})
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {showAllInStage ? 'Menampilkan semua tahap' : activeMenuMeta.title}
                  </p>
                </div>
                {activeStage !== 'overview' && (
                  <button
                    className="text-[11px] font-semibold text-[#17158c] underline"
                    onClick={() => setShowAllInStage((current) => !current)}
                    type="button"
                  >
                    {showAllInStage ? 'Filter tahap ini' : `Lihat semua (${applications.length})`}
                  </button>
                )}
              </div>

              {filteredApplications.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  <p>Tidak ada pengajuan pada filter tahap ini.</p>
                  {activeStage !== 'overview' && !showAllInStage && (
                    <button
                      className="mt-2 rounded-lg bg-indigo-50 px-3 py-1.5 font-semibold text-[#17158c]"
                      onClick={() => setShowAllInStage(true)}
                      type="button"
                    >
                      Tampilkan seluruh pengajuan ({applications.length})
                    </button>
                  )}
                </div>
              ) : (
                <div className="max-h-[75vh] divide-y divide-slate-100 overflow-y-auto">
                  {filteredApplications.map((app) => {
                    const isSelected = selectedApplication?.id === app.id
                    const appUploaded = app.documents.filter((doc) => Boolean(doc.fileId)).length
                    const appPricing = String(app.financialPlan?.pricingStatus ?? 'ESTIMATED')
                    const hasOpenRelief = (app.supportRequests ?? []).some(
                      (req) => req.status === 'OPEN',
                    )

                    return (
                      <button
                        className={`block w-full p-4 text-left transition ${
                          isSelected
                            ? 'bg-indigo-50/90 ring-2 ring-inset ring-[#17158c]'
                            : 'hover:bg-slate-50'
                        }`}
                        key={app.id}
                        onClick={() => setSelectedId(app.id)}
                        type="button"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-extrabold text-[#17158c]">
                            {app.applicationId}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${
                              STATUS_BADGE_STYLES[app.status] ??
                              'bg-slate-100 text-slate-700 ring-slate-200'
                            }`}
                          >
                            {STATUS_LABELS[app.status as keyof typeof STATUS_LABELS] ?? app.status}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm font-bold text-slate-900">
                          {app.applicantName}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {app.lpkName} · {app.destination === 'JAPAN' ? 'Jepang' : 'Turki'}
                        </p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                            {app.product === 'FULL_COVER' ? 'Full Cover' : 'Dana Keberangkatan'}
                          </span>
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                            Berkas {appUploaded}/{app.documents.length}
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 ${
                              PRICING_BADGE_STYLES[appPricing] ?? 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {PRICING_STATUS_LABELS[
                              appPricing as keyof typeof PRICING_STATUS_LABELS
                            ] ?? appPricing}
                          </span>
                          {hasOpenRelief && (
                            <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">
                              ! Keringanan
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Right Column: Selected Application Chronological Workspace */}
            {selectedApplication ? (
              <ApplicationWorkspaceForm
                activeTab={detailTab}
                application={selectedApplication}
                key={selectedApplication.id}
                onSave={save}
                payments={selectedPayments}
                pending={pending}
                setActiveTab={setDetailTab}
              />
            ) : (
              <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
                Pilih salah satu pengajuan di daftar sebelah kiri untuk membuka rincian operasional.
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
