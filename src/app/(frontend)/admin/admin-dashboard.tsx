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

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Menunggu',
  PAID: 'Lunas',
  EXPIRED: 'Kedaluwarsa',
  FAILED: 'Gagal',
}

const PAYMENT_BADGE_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-800',
  PAID: 'bg-emerald-50 text-emerald-700',
  EXPIRED: 'bg-slate-100 text-slate-600',
  FAILED: 'bg-red-50 text-red-700',
}

const ACTIVE_INSTALLMENT_FILTERS: {
  id: 'ALL' | 'OVERDUE' | 'DUE_SOON' | 'CURRENT'
  label: string
}[] = [
  { id: 'ALL', label: 'Semua' },
  { id: 'OVERDUE', label: 'Terlambat' },
  { id: 'DUE_SOON', label: 'Jatuh tempo' },
  { id: 'CURRENT', label: 'Berjalan' },
]

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

type MenuId =
  | 'dashboard'
  | 'applications'
  | 'students'
  | 'contracts'
  | 'installments'
  | 'activeInstallments'
  | 'statistics'
  | 'audit'

type DetailTabId = 'profile' | 'documents' | 'pricing' | 'contract' | 'installments' | 'support'

const SIDEBAR_GROUPS: {
  group: string
  items: {
    id: MenuId
    label: string
    subtitle: string
    defaultTab: DetailTabId
  }[]
}[] = [
  {
    group: 'Menu Utama',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        subtitle: 'Ringkasan operasional, metrik utama, dan pengajuan terbaru',
        defaultTab: 'profile',
      },
      {
        id: 'applications',
        label: 'Pengajuan',
        subtitle: 'Daftar seluruh pengajuan pembiayaan dan status tahapan',
        defaultTab: 'profile',
      },
      {
        id: 'students',
        label: 'Data Siswa',
        subtitle: 'Direktori biodata siswa, LPK mitra, kesiapan keberangkatan, & berkas',
        defaultTab: 'documents',
      },
      {
        id: 'contracts',
        label: 'Draft & Akad',
        subtitle: 'Penyusunan rincian Nafaqah, Ujrah, simulasi, dan penguncian akad final',
        defaultTab: 'pricing',
      },
      {
        id: 'installments',
        label: 'Angsuran & Kas',
        subtitle: 'Pemantauan jadwal cicilan siswa, pembayaran Xendit, & permohonan keringanan',
        defaultTab: 'installments',
      },
      {
        id: 'activeInstallments',
        label: 'Angsuran Aktif',
        subtitle: 'Siswa yang sedang mengangsur atau masih memiliki tanggungan',
        defaultTab: 'installments',
      },
    ],
  },
  {
    group: 'Laporan & Audit',
    items: [
      {
        id: 'statistics',
        label: 'Statistik',
        subtitle: 'Analitik portofolio pembiayaan, performa LPK mitra, & kolektibilitas',
        defaultTab: 'profile',
      },
      {
        id: 'audit',
        label: 'Log Audit',
        subtitle: 'Riwayat perubahan rincian biaya dan jejak verifikasi staf',
        defaultTab: 'support',
      },
    ],
  },
]

const DETAIL_TABS: { id: DetailTabId; label: string }[] = [
  { id: 'profile', label: 'Profil & Kelayakan' },
  { id: 'documents', label: 'Berkas Dokumen' },
  { id: 'pricing', label: 'Draft Biaya & Akad' },
  { id: 'contract', label: 'Status Persetujuan' },
  { id: 'installments', label: 'Jadwal Angsuran' },
  { id: 'support', label: 'Keringanan & Audit' },
]

function MenuIcon({ id }: { id: MenuId }) {
  switch (id) {
    case 'dashboard':
      return (
        <svg
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <rect height="7" rx="1.5" width="7" x="3" y="3" />
          <rect height="7" rx="1.5" width="7" x="14" y="3" />
          <rect height="7" rx="1.5" width="7" x="3" y="14" />
          <rect height="7" rx="1.5" width="7" x="14" y="14" />
        </svg>
      )
    case 'applications':
      return (
        <svg
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect height="4" rx="1" width="6" x="9" y="3" />
          <path d="M9 12h6M9 16h4" strokeLinecap="round" />
        </svg>
      )
    case 'students':
      return (
        <svg
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <circle cx="9" cy="7" r="4" />
          <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" strokeLinecap="round" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.85" strokeLinecap="round" />
        </svg>
      )
    case 'contracts':
      return (
        <svg
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M8 13h8M8 17h5" strokeLinecap="round" />
        </svg>
      )
    case 'installments':
      return (
        <svg
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <rect height="14" rx="2" width="20" x="2" y="5" />
          <path d="M2 10h20M6 15h4" strokeLinecap="round" />
        </svg>
      )
    case 'activeInstallments':
      return (
        <svg
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <rect height="14" rx="2" width="20" x="2" y="5" />
          <path d="M8 12.5l2.5 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'statistics':
      return (
        <svg
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" />
        </svg>
      )
    case 'audit':
      return (
        <svg
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" strokeLinecap="round" />
        </svg>
      )
  }
}

const formatRupiah = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? `Rp${value.toLocaleString('id-ID')}` : '—'

const formatDateShort = (value: unknown) => {
  if (typeof value !== 'string' || !value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatDateTime = (value: unknown) => {
  if (typeof value !== 'string' || !value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('id-ID')
}

const formatSizeMb = (size?: number) =>
  typeof size === 'number' && size > 0 ? `${(size / 1024 / 1024).toFixed(2)} MB` : ''

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

const getLocalIsoDate = (offsetDays = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

const getDaysBetween = (fromIso: string, toIso: string) =>
  Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000)

type InstallmentSummary = {
  schedule: ScheduleRow[]
  paidCount: number
  paidAmount: number
  obligation: number | null
  remaining: number
  unpaidCount: number
  nextDue: ScheduleRow | null
  overdueCount: number
  dueSoon: boolean
  openRelief: number
}

const summarizeInstallments = (app: FinancingApplicationRecord): InstallmentSummary => {
  const schedule = readScheduleRows(app.financialPlan?.schedule)
  const paidSet = new Set(Array.isArray(app.paidInstallments) ? app.paidInstallments : [])
  const paidRows = schedule.filter((row) => paidSet.has(row.installment))
  const paidCount = paidRows.length
  const paidAmount = paidRows.reduce((sum, row) => sum + row.amount, 0)
  const obligation =
    typeof app.financialPlan?.totalObligation === 'number'
      ? app.financialPlan.totalObligation
      : null
  const unpaidRows = schedule.filter((row) => !paidSet.has(row.installment))
  const remaining =
    obligation !== null
      ? Math.max(0, obligation - paidAmount)
      : unpaidRows.reduce((sum, row) => sum + row.amount, 0)
  const today = getLocalIsoDate()
  const soon = getLocalIsoDate(7)
  const nextDue = unpaidRows[0] ?? null
  const overdueCount = unpaidRows.filter((row) => row.dueDate < today).length
  const openRelief = (app.supportRequests ?? []).filter((req) => req.status === 'OPEN').length
  return {
    schedule,
    paidCount,
    paidAmount,
    obligation,
    remaining,
    unpaidCount: unpaidRows.length,
    nextDue,
    overdueCount,
    dueSoon: Boolean(nextDue && nextDue.dueDate >= today && nextDue.dueDate <= soon),
    openRelief,
  }
}

const hasActiveInstallment = (app: FinancingApplicationRecord, summary: InstallmentSummary) =>
  app.status === 'ACTIVE' || summary.remaining > 0 || summary.unpaidCount > 0

function DrawerAction({
  label,
  onClick,
  variant = 'secondary',
  ariaLabel,
}: {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
  ariaLabel?: string
}) {
  return (
    <button
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold shadow-xs transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17158c] ${
        variant === 'primary'
          ? 'bg-[#17158c] text-white hover:bg-[#111077]'
          : 'border border-slate-200 bg-white text-[#17158c] hover:border-[#17158c]/30 hover:bg-indigo-50'
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
      <svg
        aria-hidden="true"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

function ApplicationDrawerForm({
  application,
  payments,
  activeTab,
  setActiveTab,
  pending,
  onSave,
  onUploadAgreement,
  onClose,
}: {
  application: FinancingApplicationRecord
  payments: AdminPaymentRecord[]
  activeTab: DetailTabId
  setActiveTab: (tab: DetailTabId) => void
  pending: boolean
  onSave: (application: FinancingApplicationRecord, formData: FormData) => void
  onUploadAgreement: (applicationId: string, file: File) => Promise<void>
  onClose: () => void
}) {
  const [docStatuses, setDocStatuses] = useState<ApplicationDocumentStatus[]>(() =>
    application.documents.map((doc) => doc.status),
  )
  const [agreementUploading, setAgreementUploading] = useState(false)
  const [agreementUploadError, setAgreementUploadError] = useState('')

  const definitions =
    DOCUMENT_DEFINITIONS[application.product] ?? DOCUMENT_DEFINITIONS.DEPARTURE_BRIDGING
  const uploadedCount = application.documents.filter((doc) => Boolean(doc.fileId)).length
  const verifiedCount = docStatuses.filter((status) => status === 'VERIFIED').length
  const revisionCount = docStatuses.filter((status) => status === 'REVISION_REQUIRED').length
  const openSupportCount = (application.supportRequests ?? []).filter(
    (req) => req.status === 'OPEN',
  ).length

  const pricingStatus = String(application.financialPlan?.pricingStatus ?? 'ESTIMATED')
  const agreementPdfCurrent = Boolean(
    application.agreementPdf &&
    application.agreementPdf.agreementReference ===
      application.financialPlan?.finalAgreementReference,
  )
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
  const nextUnpaidRow = schedule.find((row) => !paidSet.has(row.installment)) ?? null
  const nextDueOverdue = Boolean(nextUnpaidRow && nextUnpaidRow.dueDate < getLocalIsoDate())

  const personal = application.personalDetails ?? {}
  const eligibility = application.eligibility ?? {}
  const fullCover = application.fullCoverDetails ?? {}
  const departure = application.departureDetails ?? {}

  const markAllUploadedAsVerified = () => {
    setDocStatuses((current) =>
      current.map((status, index) => (application.documents[index]?.fileId ? 'VERIFIED' : status)),
    )
  }

  const selectAgreementPdf = async (file: File | undefined) => {
    setAgreementUploadError('')
    if (!file) return
    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      setAgreementUploadError('Pilih berkas akad berformat PDF.')
      return
    }
    if (file.size <= 0 || file.size > 4 * 1024 * 1024) {
      setAgreementUploadError('Ukuran PDF akad maksimal 4 MB.')
      return
    }
    setAgreementUploading(true)
    try {
      await onUploadAgreement(application.id, file)
    } catch (error) {
      setAgreementUploadError(
        error instanceof Error ? error.message : 'PDF akad belum dapat diunggah.',
      )
    } finally {
      setAgreementUploading(false)
    }
  }

  return (
    <form
      action={(formData) => onSave(application, formData)}
      className="flex h-full flex-col bg-white"
    >
      {/* Drawer Header: identity + close */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-[#17158c] px-2 py-0.5 text-[11px] font-bold text-white">
                {application.applicationId}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
                  STATUS_BADGE_STYLES[application.status] ??
                  'bg-slate-100 text-slate-700 ring-slate-200'
                }`}
              >
                {STATUS_LABELS[application.status as keyof typeof STATUS_LABELS] ??
                  application.status}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  PRICING_BADGE_STYLES[pricingStatus] ?? 'bg-slate-100 text-slate-700'
                }`}
              >
                Biaya:{' '}
                {PRICING_STATUS_LABELS[pricingStatus as keyof typeof PRICING_STATUS_LABELS] ??
                  pricingStatus}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
                  application.status === 'ACTIVE' || application.status === 'COMPLETED'
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    : 'bg-red-50 text-red-600 ring-red-200'
                }`}
              >
                {application.status === 'ACTIVE' || application.status === 'COMPLETED'
                  ? 'Folder siswa resmi'
                  : 'Folder draft'}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-bold text-slate-900">{application.applicantName}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {application.phone} · {application.lpkName} ·{' '}
              {application.destination === 'JAPAN' ? 'Jepang' : 'Turki'} ·{' '}
              {application.product === 'FULL_COVER' ? 'VSV Full Cover' : 'VSV Dana Keberangkatan'}
            </p>
          </div>
          <button
            aria-label="Tutup panel pengajuan"
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17158c]"
            onClick={onClose}
            type="button"
          >
            Tutup ✕
          </button>
        </div>
      </div>

      {/* Drawer Navigation Tabs */}
      <div className="border-b border-slate-200 bg-white px-6 py-2.5">
        <div className="flex flex-wrap gap-1.5">
          {DETAIL_TABS.map((tab) => {
            const isActive = activeTab === tab.id
            let badge = ''
            if (tab.id === 'documents') badge = `${uploadedCount}/${application.documents.length}`
            if (tab.id === 'installments' && schedule.length > 0) {
              badge = `${paidInstallmentsCount}/${schedule.length}`
            }
            if (tab.id === 'support' && openSupportCount > 0) badge = `${openSupportCount}`

            return (
              <button
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17158c] ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                <span>{tab.label}</span>
                {badge && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Scrollable Drawer Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* TAB: PROFILE */}
        <div className={activeTab === 'profile' ? 'block space-y-5' : 'hidden'}>
          {application.product === 'DEPARTURE_BRIDGING' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
              Estimasi yang diajukan siswa:{' '}
              <strong>{formatRupiah(departure.requestedFinancingAmount)}</strong> · Sisa kewajiban
              LPK: <strong>{formatRupiah(departure.outstandingLPKAmount)}</strong>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Biodata & Kontak Siswa
              </h3>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-slate-400">Nama Lengkap</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {application.applicantName}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">No. WhatsApp</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{application.phone}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Tempat, Tgl Lahir</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {String(personal.birthPlace ?? '—')}, {String(personal.birthDate ?? '—')}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Gender & Agama</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {personal.gender === 'FEMALE' ? 'Perempuan' : 'Laki-laki'} ·{' '}
                    {RELIGION_LABELS[String(personal.religion ?? '')] ??
                      String(personal.religion ?? '—')}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-400">Alamat KTP</dt>
                  <dd className="mt-0.5 rounded-lg bg-slate-50 p-2.5 text-slate-800">
                    {String(personal.idCardAddress ?? '—')}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-400">Alamat Domisili / Korespondensi</dt>
                  <dd className="mt-0.5 rounded-lg bg-slate-50 p-2.5 text-slate-800">
                    {String(personal.domicileAddress ?? '—')}{' '}
                    {personal.domicilePostalCode ? `(${String(personal.domicilePostalCode)})` : ''}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Program LPK & Kesiapan Keberangkatan
              </h3>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-slate-400">LPK Mitra</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{application.lpkName}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Tujuan & Skema</dt>
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
                  <dt className="text-slate-400">Est. Keberangkatan</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {String(eligibility.estimatedDeparture ?? '—')}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                {[
                  ['Pelatihan dimulai', eligibility.trainingStarted],
                  ['Pelatihan selesai', eligibility.trainingCompleted],
                  ['Lulus penempatan', eligibility.placementPassed],
                  ['Paspor tersedia', eligibility.hasPassport],
                  ['Kontrak kerja ada', eligibility.hasWorkContract],
                  ['Izin orang tua/wali', eligibility.guardianApproval],
                ].map(([label, val]) => (
                  <div
                    className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${
                      val ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-50 text-slate-500'
                    }`}
                    key={String(label)}
                  >
                    <span>{String(label)}</span>
                    <strong>{val ? 'Ya' : 'Tidak'}</strong>
                  </div>
                ))}
              </div>
              {application.product === 'FULL_COVER' && (
                <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
                  Level bahasa:{' '}
                  <strong>
                    {LANGUAGE_LABELS[String(fullCover.languageLevel ?? '')] ??
                      String(fullCover.languageLevel ?? '—')}
                  </strong>{' '}
                  · Durasi bahasa:{' '}
                  <strong>{String(fullCover.languageTrainingMonths ?? '—')} bln</strong> · Skill:{' '}
                  <strong>{String(fullCover.skillTrainingMonths ?? '—')} bln</strong>
                  <p className="mt-1">
                    Kebutuhan:{' '}
                    <strong>
                      {(application.fundingNeeds ?? [])
                        .map((n) => NEED_LABELS[String(n.category)] ?? String(n.category))
                        .join(', ') || '—'}
                    </strong>
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* TAB: DOCUMENTS */}
        <div className={activeTab === 'documents' ? 'block space-y-4' : 'hidden'}>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
            <div className="flex gap-4">
              <span>
                Terunggah:{' '}
                <strong>
                  {uploadedCount}/{application.documents.length}
                </strong>
              </span>
              <span>
                Diverifikasi: <strong className="text-emerald-700">{verifiedCount}</strong>
              </span>
              <span>
                Perlu revisi: <strong className="text-amber-700">{revisionCount}</strong>
              </span>
            </div>
            {uploadedCount > 0 && (
              <button
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 font-semibold text-emerald-800 hover:bg-emerald-100"
                onClick={markAllUploadedAsVerified}
                type="button"
              >
                ✓ Verifikasi Semua Berkas Terunggah
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="px-3.5 py-2.5">No</th>
                  <th className="px-3.5 py-2.5">Dokumen</th>
                  <th className="px-3.5 py-2.5">Kategori</th>
                  <th className="px-3.5 py-2.5">Berkas Drive</th>
                  <th className="px-3.5 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {application.documents.map((document, index) => {
                  const def = definitions[index]
                  const currentStatus = docStatuses[index] ?? document.status
                  return (
                    <tr className="hover:bg-slate-50" key={`${document.documentType}-${index}`}>
                      <td className="px-3.5 py-2.5 text-slate-400">{index + 1}</td>
                      <td className="px-3.5 py-2.5 font-medium text-slate-900">
                        {document.documentType}
                        {def?.required && <span className="ml-1 text-red-500">*</span>}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-500">
                        {def?.section === 'dokumen-pendukung' ? 'Pendukung' : 'Utama'}
                      </td>
                      <td className="px-3.5 py-2.5">
                        {document.fileId ? (
                          <a
                            className="font-semibold text-[#17158c] underline"
                            href={`/api/admin/applications/${application.id}/documents/${index}`}
                          >
                            Unduh {document.fileName ?? 'berkas'}{' '}
                            {document.size ? `(${formatSizeMb(document.size)})` : ''}
                          </a>
                        ) : (
                          <span className="text-slate-400">Belum diunggah</span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <select
                          aria-label={`Status ${document.documentType}`}
                          className={`rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold ${
                            DOCUMENT_BADGE_STYLES[currentStatus] ?? ''
                          }`}
                          name={`documentStatus-${index}`}
                          onChange={(e) => {
                            const next = e.target.value as ApplicationDocumentStatus
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
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* TAB: PRICING & DRAFT AKAD */}
        <div className={activeTab === 'pricing' ? 'block space-y-4' : 'hidden'}>
          <FinanceTermsFields
            financialPlan={application.financialPlan}
            product={application.product}
          />
        </div>

        {/* TAB: CONTRACT APPROVAL */}
        <div className={activeTab === 'contract' ? 'block space-y-4' : 'hidden'}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4 text-xs">
              <h3 className="font-bold text-slate-900">Persetujuan Siswa atas Penawaran</h3>
              {application.userFinancingAcceptance?.acceptedAt ? (
                <p className="mt-2 rounded-lg bg-emerald-50 p-3 font-medium text-emerald-900">
                  ✓ Disetujui siswa pada{' '}
                  <strong>{formatDateTime(application.userFinancingAcceptance.acceptedAt)}</strong>
                </p>
              ) : (
                <p className="mt-2 rounded-lg bg-amber-50 p-3 text-amber-900">
                  Belum ada persetujuan siswa pada versi penawaran saat ini.
                </p>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 p-4 text-xs">
              <h3 className="font-bold text-slate-900">Referensi Akad Final</h3>
              <p className="mt-2 rounded-lg bg-slate-50 p-3 text-slate-700">
                {application.financialPlan?.finalAgreementReference
                  ? String(application.financialPlan.finalAgreementReference)
                  : 'Belum diisi (isi pada tab Draft Biaya & Akad)'}
              </p>
            </div>
          </div>
          <section className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">PDF Akad Wakalah bil Ujrah</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Unggah salinan PDF final yang telah ditandatangani. Berkas disimpan privat di
                  Google Drive dan hanya dapat diakses staf serta pemohon pengajuan ini.
                </p>
              </div>
              {agreementPdfCurrent ? (
                <a
                  className="shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-[#17158c] hover:bg-indigo-100"
                  href={`/api/admin/applications/${application.id}/agreement`}
                >
                  Buka PDF
                </a>
              ) : null}
            </div>
            {pricingStatus !== 'AGREED' ? (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                PDF final dapat diunggah setelah status biaya menjadi Disepakati.
              </p>
            ) : (
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#17158c] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#111077]">
                <span>
                  {agreementUploading
                    ? 'Mengunggah PDF…'
                    : agreementPdfCurrent
                      ? 'Ganti PDF akad'
                      : 'Unggah PDF akad'}
                </span>
                <input
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  disabled={agreementUploading}
                  onChange={(event) => {
                    void selectAgreementPdf(event.target.files?.[0])
                    event.target.value = ''
                  }}
                  type="file"
                />
              </label>
            )}
            {agreementPdfCurrent && application.agreementPdf ? (
              <p className="mt-2 text-[11px] text-slate-500">
                {application.agreementPdf.fileName} · {formatSizeMb(application.agreementPdf.size)}{' '}
                · Diunggah oleh {application.agreementPdf.uploadedBy}
              </p>
            ) : application.agreementPdf ? (
              <p className="mt-2 text-[11px] text-amber-700">
                PDF tersimpan untuk referensi akad sebelumnya. Unggah PDF baru untuk referensi akad
                saat ini.
              </p>
            ) : null}
            {agreementUploadError && (
              <p className="mt-2 text-xs text-red-700" role="alert">
                {agreementUploadError}
              </p>
            )}
          </section>
        </div>

        {/* TAB: INSTALLMENTS */}
        <div className={activeTab === 'installments' ? 'block space-y-4' : 'hidden'}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
              <span className="text-slate-500">Total Kewajiban Akad</span>
              <strong className="mt-1 block text-sm font-bold text-slate-900">
                {formatRupiah(totalObligation)}
              </strong>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs">
              <span className="text-emerald-700">Total Terbayar</span>
              <strong className="mt-1 block text-sm font-bold text-emerald-900">
                {formatRupiah(paidAmountTotal)} ({paidInstallmentsCount}/{schedule.length})
              </strong>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 text-xs">
              <span className="text-indigo-700">Sisa Kewajiban</span>
              <strong className="mt-1 block text-sm font-bold text-[#17158c]">
                {totalObligation !== null
                  ? formatRupiah(Math.max(0, totalObligation - paidAmountTotal))
                  : '—'}
              </strong>
            </div>
            <div
              className={`rounded-xl border p-3.5 text-xs ${
                nextDueOverdue ? 'border-red-200 bg-red-50/70' : 'border-slate-200 bg-white'
              }`}
            >
              <span className={nextDueOverdue ? 'text-red-700' : 'text-slate-500'}>
                Cicilan Berikutnya
              </span>
              <strong
                className={`mt-1 block text-sm font-bold ${
                  nextDueOverdue ? 'text-red-700' : 'text-slate-900'
                }`}
              >
                {nextUnpaidRow
                  ? `${formatDateShort(nextUnpaidRow.dueDate)} · ${formatRupiah(nextUnpaidRow.amount)}`
                  : schedule.length > 0
                    ? 'Semua lunas'
                    : '—'}
              </strong>
              {nextDueOverdue && nextUnpaidRow && (
                <span className="mt-1 block text-[11px] font-semibold text-red-700">
                  Terlambat {getDaysBetween(nextUnpaidRow.dueDate, getLocalIsoDate())} hari
                </span>
              )}
            </div>
          </div>

          {schedule.length === 0 ? (
            <p className="rounded-xl border border-slate-200 p-6 text-center text-xs text-slate-500">
              Jadwal angsuran belum tersedia.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                    <th className="px-3.5 py-2.5">Cicilan</th>
                    <th className="px-3.5 py-2.5">Jatuh Tempo</th>
                    <th className="px-3.5 py-2.5">Nominal</th>
                    <th className="px-3.5 py-2.5">Sisa</th>
                    <th className="px-3.5 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schedule.map((row) => {
                    const paid = paidSet.has(row.installment)
                    return (
                      <tr key={row.installment}>
                        <td className="px-3.5 py-2.5 font-semibold text-slate-900">
                          Ke-{row.installment}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600">{row.dueDate}</td>
                        <td className="px-3.5 py-2.5 font-medium text-slate-900">
                          {formatRupiah(row.amount)}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-500">
                          {formatRupiah(row.remainingBalance)}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              paid
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {paid ? '✓ Lunas' : 'Belum bayar'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {payments.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700">
                Transaksi Xendit ({payments.length})
              </div>
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                    <th className="px-3.5 py-2.5">Keterangan</th>
                    <th className="px-3.5 py-2.5">Nominal</th>
                    <th className="px-3.5 py-2.5">Status</th>
                    <th className="px-3.5 py-2.5">Dibayar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-3.5 py-2.5 font-medium text-slate-900">
                        {payment.description || payment.id}
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-900">
                        {formatRupiah(payment.amount)}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            PAYMENT_BADGE_STYLES[payment.status] ?? 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-500">
                        {payment.paidAt ? formatDateTime(payment.paidAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* TAB: SUPPORT & AUDIT */}
        <div className={activeTab === 'support' ? 'block space-y-4' : 'hidden'}>
          <section className="space-y-3 rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Permohonan Keringanan ({(application.supportRequests ?? []).length})
            </h3>
            {(application.supportRequests ?? []).length === 0 ? (
              <p className="text-xs text-slate-500">Tidak ada permohonan keringanan.</p>
            ) : (
              (application.supportRequests ?? []).map((request, index) => (
                <div
                  className="space-y-2.5 rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs"
                  key={`${request.requestedAt}-${index}`}
                >
                  <div className="flex justify-between font-semibold text-amber-950">
                    <span>Permohonan #{index + 1}</span>
                    <span>{formatDateTime(request.requestedAt)}</span>
                  </div>
                  <p className="rounded bg-white p-2.5 text-slate-800">{request.message}</p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <label className="space-y-1 font-semibold text-slate-700">
                      <span>Status</span>
                      <select
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-normal"
                        defaultValue={request.status}
                        name={`supportRequestStatus-${index}`}
                      >
                        <option value="OPEN">Menunggu tinjauan</option>
                        <option value="REVIEWED">Ditinjau</option>
                      </select>
                    </label>
                    <label className="space-y-1 font-semibold text-slate-700">
                      <span>Tanggapan</span>
                      <input
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-normal"
                        defaultValue={request.response ?? ''}
                        maxLength={1000}
                        name={`supportRequestResponse-${index}`}
                      />
                    </label>
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="space-y-2.5 rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Riwayat Perubahan Biaya ({(application.financialPlanHistory ?? []).length})
            </h3>
            {(application.financialPlanHistory ?? []).length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada riwayat perubahan biaya.</p>
            ) : (
              [...(application.financialPlanHistory ?? [])].reverse().map((entry, idx) => (
                <div
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"
                  key={`${entry.changedAt}-${idx}`}
                >
                  <div className="flex justify-between font-semibold text-slate-900">
                    <span>
                      {entry.changedBy} ·{' '}
                      {PRICING_STATUS_LABELS[
                        entry.pricingStatus as keyof typeof PRICING_STATUS_LABELS
                      ] ?? entry.pricingStatus}
                    </span>
                    <span className="text-slate-500">{formatDateTime(entry.changedAt)}</span>
                  </div>
                  <p className="mt-1 text-slate-600">
                    Total Kewajiban: {formatRupiah(entry.financialPlan?.totalObligation)}
                    {entry.finalAgreementReference
                      ? ` · Akad: ${entry.finalAgreementReference}`
                      : ''}
                  </p>
                </div>
              ))
            )}
          </section>
        </div>
      </div>

      {/* Sticky Footer: status, biaya, catatan, simpan */}
      <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr_auto]">
          <label className="space-y-1 text-[11px] font-semibold text-slate-600">
            <span>Status Pengajuan</span>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900"
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
          <label className="space-y-1 text-[11px] font-semibold text-slate-600">
            <span>Status Biaya</span>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900"
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
          <label className="space-y-1 text-[11px] font-semibold text-slate-600 sm:col-span-2 lg:col-span-1">
            <span>Catatan Internal</span>
            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-normal text-slate-900"
              defaultValue={application.internalNotes ?? ''}
              maxLength={2000}
              name="internalNotes"
              placeholder="Catatan internal staf…"
            />
          </label>
          <button
            className="rounded-lg bg-[#17158c] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#111077] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17158c] disabled:opacity-60 sm:col-span-2 lg:col-span-1"
            disabled={pending}
            type="submit"
          >
            {pending ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
        <p className="mt-2.5 text-[11px] text-slate-500">
          Tekan Simpan untuk menerapkan status pengajuan, status biaya, dokumen, dan catatan
          internal.
        </p>
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

  const [activeMenu, setActiveMenu] = useState<MenuId>('dashboard')
  const [drawerAppId, setDrawerAppId] = useState<string | null>(null)
  const [drawerTab, setDrawerTab] = useState<DetailTabId>('profile')

  const [searchQuery, setSearchQuery] = useState('')
  const [productFilter, setProductFilter] = useState<'ALL' | 'FULL_COVER' | 'DEPARTURE_BRIDGING'>(
    'ALL',
  )
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [activeInstallmentFilter, setActiveInstallmentFilter] = useState<
    'ALL' | 'OVERDUE' | 'DUE_SOON' | 'CURRENT'
  >('ALL')

  const logout = async () => {
    await fetch('/api/admin/session', { method: 'DELETE' })
    await signOut(getFirebaseClientAuth()).catch(() => {})
    router.replace('/')
  }

  const openApplicationDrawer = (appId: string, tab: DetailTabId = 'profile') => {
    setDrawerAppId(appId)
    setDrawerTab(tab)
  }

  const filteredApplications = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return applications.filter((app) => {
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
  }, [applications, productFilter, statusFilter, searchQuery])

  const drawerApplication = useMemo(
    () => (drawerAppId ? (applications.find((app) => app.id === drawerAppId) ?? null) : null),
    [applications, drawerAppId],
  )

  const drawerPayments = useMemo(
    () =>
      drawerApplication
        ? payments.filter(
            (p) =>
              p.applicationDocId === drawerApplication.id ||
              p.applicationId === drawerApplication.applicationId,
          )
        : [],
    [payments, drawerApplication],
  )

  // Summary metrics
  const metrics = useMemo(() => {
    let pendingReview = 0
    let activeCount = 0
    let agreedTotalVolume = 0
    let openReliefCount = 0

    for (const app of applications) {
      if (
        ['SUBMITTED', 'ELIGIBILITY_REVIEW', 'DOCUMENT_REVIEW', 'COST_VERIFICATION'].includes(
          app.status,
        )
      ) {
        pendingReview += 1
      }
      if (app.status === 'ACTIVE' || app.status === 'COMPLETED') {
        activeCount += 1
      }
      const obligation = app.financialPlan?.totalObligation
      if (
        app.financialPlan?.pricingStatus === 'AGREED' &&
        typeof obligation === 'number' &&
        Number.isFinite(obligation)
      ) {
        agreedTotalVolume += obligation
      }
      openReliefCount += (app.supportRequests ?? []).filter((r) => r.status === 'OPEN').length
    }

    const totalPaidVolume = payments
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + p.amount, 0)

    return {
      total: applications.length,
      pendingReview,
      activeCount,
      agreedTotalVolume,
      totalPaidVolume,
      openReliefCount,
    }
  }, [applications, payments])

  // Flat Audit Entries
  const auditEntries = useMemo(() => {
    const rows: {
      changedAt: string
      changedBy: string
      pricingStatus: string
      totalObligation: unknown
      finalAgreementReference?: string
      settlementNotes?: string
      app: FinancingApplicationRecord
    }[] = []
    for (const app of applications) {
      for (const entry of app.financialPlanHistory ?? []) {
        rows.push({
          changedAt: entry.changedAt,
          changedBy: entry.changedBy,
          pricingStatus: entry.pricingStatus,
          totalObligation: entry.financialPlan?.totalObligation,
          finalAgreementReference: entry.finalAgreementReference,
          settlementNotes: entry.settlementNotes,
          app,
        })
      }
    }
    return rows.sort((a, b) => b.changedAt.localeCompare(a.changedAt))
  }, [applications])

  // LPK Partner Stats
  const lpkStats = useMemo(() => {
    const map = new Map<
      string,
      { lpkName: string; count: number; active: number; totalObligation: number }
    >()
    for (const app of applications) {
      const key = app.lpkName.trim() || 'Tanpa Nama LPK'
      const current = map.get(key) ?? { lpkName: key, count: 0, active: 0, totalObligation: 0 }
      current.count += 1
      if (app.status === 'ACTIVE' || app.status === 'COMPLETED') current.active += 1
      if (typeof app.financialPlan?.totalObligation === 'number') {
        current.totalObligation += app.financialPlan.totalObligation
      }
      map.set(key, current)
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [applications])

  // Angsuran Aktif: siswa yang sedang mengangsur atau masih memiliki tanggungan
  const activeInstallmentSummaries = useMemo(
    () =>
      filteredApplications
        .map((app) => ({ app, summary: summarizeInstallments(app) }))
        .filter(({ app, summary }) => hasActiveInstallment(app, summary)),
    [filteredApplications],
  )

  const activeInstallmentMetrics = useMemo(() => {
    let overdue = 0
    let dueSoon = 0
    let openRelief = 0
    let totalRemaining = 0
    for (const { summary } of activeInstallmentSummaries) {
      if (summary.overdueCount > 0) overdue += 1
      else if (summary.dueSoon) dueSoon += 1
      openRelief += summary.openRelief
      totalRemaining += summary.remaining
    }
    return {
      count: activeInstallmentSummaries.length,
      totalRemaining,
      overdue,
      dueSoon,
      openRelief,
    }
  }, [activeInstallmentSummaries])

  const visibleActiveInstallments = useMemo(() => {
    const rows = activeInstallmentSummaries.filter(({ summary }) => {
      if (activeInstallmentFilter === 'OVERDUE') return summary.overdueCount > 0
      if (activeInstallmentFilter === 'DUE_SOON') {
        return summary.overdueCount === 0 && summary.dueSoon
      }
      if (activeInstallmentFilter === 'CURRENT') {
        return summary.overdueCount === 0 && !summary.dueSoon
      }
      return true
    })
    return rows.sort((a, b) => {
      const aOverdue = a.summary.overdueCount > 0 ? 0 : 1
      const bOverdue = b.summary.overdueCount > 0 ? 0 : 1
      if (aOverdue !== bOverdue) return aOverdue - bOverdue
      const aDue = a.summary.nextDue?.dueDate ?? '9999-99-99'
      const bDue = b.summary.nextDue?.dueDate ?? '9999-99-99'
      if (aDue !== bDue) return aDue.localeCompare(bDue)
      return b.summary.remaining - a.summary.remaining
    })
  }, [activeInstallmentSummaries, activeInstallmentFilter])

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
        setSavedNotice(`Data pengajuan ${application.applicationId} berhasil diperbarui.`)
        router.refresh()
      }
    })
  }

  const uploadAgreement = async (applicationId: string, file: File) => {
    const response = await fetch(`/api/admin/applications/${applicationId}/agreement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
        'x-agreement-file-name': encodeURIComponent(file.name),
      },
      body: file,
    })
    const result = (await response.json().catch(() => ({}))) as {
      ok?: boolean
      message?: string
    }
    if (!response.ok || !result.ok) {
      throw new Error(result.message || 'PDF akad belum dapat diunggah.')
    }
    setSavedNotice(`PDF akad ${applicationId} berhasil diunggah.`)
    router.refresh()
  }

  const allMenus = SIDEBAR_GROUPS.flatMap((g) => g.items)
  const activeMenuInfo = allMenus.find((m) => m.id === activeMenu) ?? allMenus[0]

  const getMenuBadge = (id: MenuId): number | null => {
    switch (id) {
      case 'applications':
        return applications.length
      case 'students':
        return applications.length
      case 'contracts':
        return applications.filter(
          (a) =>
            a.financialPlan?.pricingStatus === 'VERIFIED' ||
            a.financialPlan?.pricingStatus === 'AGREED',
        ).length
      case 'installments':
        return metrics.openReliefCount > 0 ? metrics.openReliefCount : metrics.activeCount
      case 'activeInstallments':
        return activeInstallmentMetrics.count
      case 'audit':
        return auditEntries.length
      default:
        return null
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#f8fafc] text-slate-900 lg:h-dvh lg:flex-row lg:overflow-hidden">
      {/* FIXED 100dvh SIDEBAR */}
      <aside className="flex w-full flex-col justify-between border-b border-slate-200 bg-[#0f1338] text-white lg:h-dvh lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r lg:border-slate-800">
        {/* Brand Header */}
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3.5">
          <img
            alt="VentureGo"
            className="size-7 rounded-lg bg-white/10 p-1"
            height={28}
            src="/venturego-mark.svg"
            width={28}
          />
          <div className="min-w-0">
            <p className=" truncate text-xs font-bold tracking-tight text-white">VentureGo VSV</p>
            <p className="truncate text-[10px] font-medium text-indigo-300">Admin Backoffice</p>
          </div>
        </div>

        {/* Compact Menu Groups (Fits inside 1 screen height) */}
        <nav
          aria-label="Navigasi utama backoffice"
          className="flex flex-1 flex-wrap gap-2 overflow-y-auto px-3 py-3 lg:flex-col lg:flex-nowrap lg:gap-4"
        >
          {SIDEBAR_GROUPS.map((group) => (
            <div className="w-full space-y-1" key={group.group}>
              <p className="hidden px-2.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300/60 lg:block">
                {group.group}
              </p>
              <div className="flex flex-wrap gap-1 lg:flex-col">
                {group.items.map((item) => {
                  const active = activeMenu === item.id
                  const badge = getMenuBadge(item.id)
                  return (
                    <button
                      className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition lg:w-full ${
                        active
                          ? 'bg-[#252b7a] font-semibold text-white shadow-2xs ring-1 ring-indigo-400/30'
                          : 'text-indigo-100/75 hover:bg-white/5 hover:text-white'
                      }`}
                      key={item.id}
                      onClick={() => setActiveMenu(item.id)}
                      type="button"
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <MenuIcon id={item.id} />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {badge !== null && badge > 0 && (
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                            active
                              ? 'bg-white text-[#17158c]'
                              : item.id === 'installments' && metrics.openReliefCount > 0
                                ? 'bg-amber-400 text-slate-950'
                                : item.id === 'activeInstallments' &&
                                    activeInstallmentMetrics.overdue > 0
                                  ? 'bg-amber-400 text-slate-950'
                                  : 'bg-white/10 text-indigo-200'
                          }`}
                        >
                          {badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Compact Staff Footer */}
        <div className="border-t border-white/10 bg-black/20 px-3.5 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
              Staf
            </span>
            <span className="truncate text-[11px] font-medium text-white">{email}</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              className="rounded-md border border-white/15 bg-white/5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/10"
              onClick={() => router.refresh()}
              type="button"
            >
              Segarkan
            </button>
            <button
              className="rounded-md border border-rose-400/30 bg-rose-500/20 py-1.5 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-500/30"
              onClick={logout}
              type="button"
            >
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* INDEPENDENTLY SCROLLABLE MAIN CONTENT */}
      <div className="flex min-w-0 flex-1 flex-col lg:h-dvh lg:overflow-y-auto">
        {/* Sticky Minimalist Header */}
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-6 py-3.5 backdrop-blur">
          <div>
            <h1 className="text-base font-bold text-slate-900">{activeMenuInfo.label}</h1>
            <p className="text-xs text-slate-500">{activeMenuInfo.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label="Cari pengajuan atau siswa"
              className="w-52 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 focus:border-[#17158c] focus:bg-white focus:outline-none"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari ID, nama, WA, LPK…"
              value={searchQuery}
            />
            <select
              aria-label="Filter produk"
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700"
              onChange={(e) =>
                setProductFilter(e.target.value as 'ALL' | 'FULL_COVER' | 'DEPARTURE_BRIDGING')
              }
              value={productFilter}
            >
              <option value="ALL">Semua Produk</option>
              <option value="DEPARTURE_BRIDGING">Dana Keberangkatan</option>
              <option value="FULL_COVER">Full Cover</option>
            </select>
            <select
              aria-label="Filter status"
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700"
              onChange={(e) => setStatusFilter(e.target.value)}
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

        {/* Main Workspace Container */}
        <main className="flex-1 space-y-5 p-6">
          {error && (
            <div
              className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-800"
              role="alert"
            >
              <span>{error}</span>
              <button className="underline" onClick={() => setError('')} type="button">
                Tutup
              </button>
            </div>
          )}
          {savedNotice && (
            <div
              className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900"
              role="status"
            >
              <span>✓ {savedNotice}</span>
              <button className="underline" onClick={() => setSavedNotice('')} type="button">
                Tutup
              </button>
            </div>
          )}

          {/* 1. MENU: DASHBOARD */}
          {activeMenu === 'dashboard' && (
            <div className="space-y-5">
              {/* 4 KPI Cards */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                  <span className="text-xs font-medium text-slate-500">Total Pengajuan</span>
                  <strong className="mt-1.5 block text-2xl font-extrabold text-slate-900">
                    {metrics.total}
                  </strong>
                  <span className="mt-1 block text-[11px] text-slate-400">
                    Seluruh produk pembiayaan
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                  <span className="text-xs font-medium text-slate-500">Menunggu Verifikasi</span>
                  <strong className="mt-1.5 block text-2xl font-extrabold text-[#17158c]">
                    {metrics.pendingReview}
                  </strong>
                  <span className="mt-1 block text-[11px] text-slate-400">
                    Kelayakan, berkas, & biaya
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                  <span className="text-xs font-medium text-slate-500">Nilai Akad Disepakati</span>
                  <strong className="mt-1.5 block text-2xl font-extrabold text-emerald-700">
                    {formatRupiah(metrics.agreedTotalVolume)}
                  </strong>
                  <span className="mt-1 block text-[11px] text-slate-400">
                    {metrics.activeCount} program aktif / selesai
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                  <span className="text-xs font-medium text-slate-500">
                    Pembayaran Masuk (Xendit)
                  </span>
                  <strong className="mt-1.5 block text-2xl font-extrabold text-slate-900">
                    {formatRupiah(metrics.totalPaidVolume)}
                  </strong>
                  <span className="mt-1 block text-[11px] text-amber-700">
                    {metrics.openReliefCount} permohonan keringanan terbuka
                  </span>
                </div>
              </div>

              {/* Quick Table: Recent Applications */}
              <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Pengajuan Terbaru ({filteredApplications.slice(0, 8).length})
                  </h2>
                  <button
                    className="text-xs font-semibold text-[#17158c] hover:underline"
                    onClick={() => setActiveMenu('applications')}
                    type="button"
                  >
                    Lihat Semua Pengajuan →
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                        <th className="whitespace-nowrap px-4 py-3">ID Pengajuan</th>
                        <th className="whitespace-nowrap px-4 py-3">Tanggal</th>
                        <th className="whitespace-nowrap px-4 py-3">Nama Siswa</th>
                        <th className="whitespace-nowrap px-4 py-3">LPK & Tujuan</th>
                        <th className="whitespace-nowrap px-4 py-3">Produk</th>
                        <th className="whitespace-nowrap px-4 py-3">Berkas</th>
                        <th className="whitespace-nowrap px-4 py-3">Status</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredApplications.slice(0, 8).map((app) => {
                        const uploaded = app.documents.filter((d) => Boolean(d.fileId)).length
                        return (
                          <tr className="hover:bg-slate-50/80" key={app.id}>
                            <td className="whitespace-nowrap px-4 py-3 font-bold text-[#17158c]">
                              {app.applicationId}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                              {formatDateShort(app.createdAt)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                              {app.applicantName}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                              {app.lpkName} · {app.destination === 'JAPAN' ? 'Jepang' : 'Turki'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                              {app.product === 'FULL_COVER' ? 'Full Cover' : 'Dana Keberangkatan'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                              {uploaded}/{app.documents.length}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
                                  STATUS_BADGE_STYLES[app.status] ??
                                  'bg-slate-100 text-slate-700 ring-slate-200'
                                }`}
                              >
                                {STATUS_LABELS[app.status as keyof typeof STATUS_LABELS] ??
                                  app.status}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              <DrawerAction
                                ariaLabel={`Kelola pengajuan ${app.applicationId}`}
                                label="Kelola"
                                onClick={() => openApplicationDrawer(app.id, 'profile')}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* 2. MENU: PENGAJUAN (Multi-column 1-row Table) */}
          {activeMenu === 'applications' && (
            <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                      <th className="whitespace-nowrap px-4 py-3">ID Pengajuan</th>
                      <th className="whitespace-nowrap px-4 py-3">Tgl Masuk</th>
                      <th className="whitespace-nowrap px-4 py-3">Nama Siswa</th>
                      <th className="whitespace-nowrap px-4 py-3">LPK Mitra</th>
                      <th className="whitespace-nowrap px-4 py-3">Tujuan</th>
                      <th className="whitespace-nowrap px-4 py-3">Produk</th>
                      <th className="whitespace-nowrap px-4 py-3">Berkas</th>
                      <th className="whitespace-nowrap px-4 py-3">Status Biaya</th>
                      <th className="whitespace-nowrap px-4 py-3">Status Pengajuan</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredApplications.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-slate-400" colSpan={10}>
                          Tidak ada data pengajuan yang sesuai filter.
                        </td>
                      </tr>
                    ) : (
                      filteredApplications.map((app) => {
                        const uploaded = app.documents.filter((d) => Boolean(d.fileId)).length
                        const pricing = String(app.financialPlan?.pricingStatus ?? 'ESTIMATED')
                        return (
                          <tr className="hover:bg-slate-50/80" key={app.id}>
                            <td className="whitespace-nowrap px-4 py-3 font-bold text-[#17158c]">
                              {app.applicationId}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                              {formatDateShort(app.createdAt)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                              {app.applicantName}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {app.lpkName}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                              {app.destination === 'JAPAN' ? 'Jepang' : 'Turki'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                              {app.product === 'FULL_COVER' ? 'Full Cover' : 'Dana Keberangkatan'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                              {uploaded}/{app.documents.length}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  PRICING_BADGE_STYLES[pricing] ?? 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {PRICING_STATUS_LABELS[
                                  pricing as keyof typeof PRICING_STATUS_LABELS
                                ] ?? pricing}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
                                  STATUS_BADGE_STYLES[app.status] ??
                                  'bg-slate-100 text-slate-700 ring-slate-200'
                                }`}
                              >
                                {STATUS_LABELS[app.status as keyof typeof STATUS_LABELS] ??
                                  app.status}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              <DrawerAction
                                ariaLabel={`Kelola pengajuan ${app.applicationId}`}
                                label="Kelola"
                                onClick={() => openApplicationDrawer(app.id, 'profile')}
                              />
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 3. MENU: DATA SISWA (Student Directory & Document Readiness Table) */}
          {activeMenu === 'students' && (
            <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                      <th className="whitespace-nowrap px-4 py-3">Nama Siswa</th>
                      <th className="whitespace-nowrap px-4 py-3">No. WhatsApp</th>
                      <th className="whitespace-nowrap px-4 py-3">TTL & Gender</th>
                      <th className="whitespace-nowrap px-4 py-3">LPK & Negara</th>
                      <th className="whitespace-nowrap px-4 py-3">Status COE / Visa</th>
                      <th className="whitespace-nowrap px-4 py-3">Est. Keberangkatan</th>
                      <th className="whitespace-nowrap px-4 py-3">Berkas Terunggah</th>
                      <th className="whitespace-nowrap px-4 py-3">Diverifikasi</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredApplications.map((app) => {
                      const personal = app.personalDetails ?? {}
                      const eligibility = app.eligibility ?? {}
                      const uploaded = app.documents.filter((d) => Boolean(d.fileId)).length
                      const verified = app.documents.filter((d) => d.status === 'VERIFIED').length
                      return (
                        <tr className="hover:bg-slate-50/80" key={app.id}>
                          <td className="whitespace-nowrap px-4 py-3">
                            <p className="font-semibold text-slate-900">{app.applicantName}</p>
                            <p className="text-[11px] text-slate-400">{app.applicationId}</p>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                            {app.phone}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                            {String(personal.birthPlace ?? '—')},{' '}
                            {String(personal.birthDate ?? '—')} ·{' '}
                            {personal.gender === 'FEMALE' ? 'P' : 'L'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                            {app.lpkName} ({app.destination === 'JAPAN' ? 'Jepang' : 'Turki'})
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                            COE: {DOC_PROGRESS_LABELS[String(eligibility.coeStatus ?? '')] ?? '—'} ·
                            Visa: {DOC_PROGRESS_LABELS[String(eligibility.visaStatus ?? '')] ?? '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                            {String(eligibility.estimatedDeparture ?? '—')}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">
                            {uploaded}/{app.documents.length}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              {verified} berkas
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              <DrawerAction
                                ariaLabel={`Buka biodata ${app.applicationId}`}
                                label="Biodata"
                                onClick={() => openApplicationDrawer(app.id, 'profile')}
                              />
                              <DrawerAction
                                ariaLabel={`Buka berkas ${app.applicationId}`}
                                label="Berkas"
                                onClick={() => openApplicationDrawer(app.id, 'documents')}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 4. MENU: DRAFT & AKAD (Financial Plan & Shariah Contract Table) */}
          {activeMenu === 'contracts' && (
            <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                      <th className="whitespace-nowrap px-4 py-3">ID Pengajuan</th>
                      <th className="whitespace-nowrap px-4 py-3">Nama Siswa</th>
                      <th className="whitespace-nowrap px-4 py-3">Produk & Skema</th>
                      <th className="whitespace-nowrap px-4 py-3">Pengajuan Awal</th>
                      <th className="whitespace-nowrap px-4 py-3">Nafaqah + Ujrah</th>
                      <th className="whitespace-nowrap px-4 py-3">Total Akad</th>
                      <th className="whitespace-nowrap px-4 py-3">Status Biaya</th>
                      <th className="whitespace-nowrap px-4 py-3">Persetujuan Siswa</th>
                      <th className="whitespace-nowrap px-4 py-3">Referensi Akad</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredApplications.map((app) => {
                      const plan = app.financialPlan ?? {}
                      const pricing = String(plan.pricingStatus ?? 'ESTIMATED')
                      const nafaqah = Number(plan.nafaqahTotal) || 0
                      const ujrah = Number(plan.ujrahTotal) || 0
                      const requested = app.departureDetails?.requestedFinancingAmount
                      const accepted = Boolean(app.userFinancingAcceptance?.acceptedAt)

                      return (
                        <tr className="hover:bg-slate-50/80" key={app.id}>
                          <td className="whitespace-nowrap px-4 py-3 font-bold text-[#17158c]">
                            {app.applicationId}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                            {app.applicantName}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                            {app.product === 'FULL_COVER' ? 'Full Cover' : 'Dana Keberangkatan'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                            {formatRupiah(requested)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {nafaqah + ujrah > 0 ? formatRupiah(nafaqah + ujrah) : '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-900">
                            {formatRupiah(plan.totalObligation)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                PRICING_BADGE_STYLES[pricing] ?? 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {PRICING_STATUS_LABELS[
                                pricing as keyof typeof PRICING_STATUS_LABELS
                              ] ?? pricing}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                accepted
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {accepted ? '✓ Disetujui' : 'Menunggu'}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                            {plan.finalAgreementReference
                              ? String(plan.finalAgreementReference)
                              : '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <DrawerAction
                              ariaLabel={`Susun akad ${app.applicationId}`}
                              label="Susun Akad"
                              onClick={() => openApplicationDrawer(app.id, 'pricing')}
                              variant="primary"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 5. MENU: ANGSURAN & KAS (Installment Schedule & Xendit Table) */}
          {activeMenu === 'installments' && (
            <div className="space-y-5">
              <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
                <div className="border-b border-slate-100 px-5 py-3.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Monitoring Angsuran Siswa
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                        <th className="whitespace-nowrap px-4 py-3">ID Pengajuan</th>
                        <th className="whitespace-nowrap px-4 py-3">Nama Siswa</th>
                        <th className="whitespace-nowrap px-4 py-3">Total Kewajiban</th>
                        <th className="whitespace-nowrap px-4 py-3">Tenor</th>
                        <th className="whitespace-nowrap px-4 py-3">Progres Cicilan</th>
                        <th className="whitespace-nowrap px-4 py-3">Total Terbayar</th>
                        <th className="whitespace-nowrap px-4 py-3">Sisa Kewajiban</th>
                        <th className="whitespace-nowrap px-4 py-3">Keringanan</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredApplications.map((app) => {
                        const schedule = readScheduleRows(app.financialPlan?.schedule)
                        const paidSet = new Set(
                          Array.isArray(app.paidInstallments) ? app.paidInstallments : [],
                        )
                        const paidCount = schedule.filter((r) => paidSet.has(r.installment)).length
                        const paidAmount = schedule
                          .filter((r) => paidSet.has(r.installment))
                          .reduce((s, r) => s + r.amount, 0)
                        const obligation =
                          typeof app.financialPlan?.totalObligation === 'number'
                            ? app.financialPlan.totalObligation
                            : null
                        const openRelief = (app.supportRequests ?? []).filter(
                          (r) => r.status === 'OPEN',
                        ).length

                        return (
                          <tr className="hover:bg-slate-50/80" key={app.id}>
                            <td className="whitespace-nowrap px-4 py-3 font-bold text-[#17158c]">
                              {app.applicationId}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                              {app.applicantName}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                              {formatRupiah(obligation)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                              {schedule.length > 0 ? `${schedule.length} bln` : '—'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">
                              {schedule.length > 0 ? `${paidCount}/${schedule.length} lunas` : '—'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-emerald-700">
                              {paidAmount > 0 ? formatRupiah(paidAmount) : 'Rp0'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                              {obligation !== null
                                ? formatRupiah(Math.max(0, obligation - paidAmount))
                                : '—'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              {openRelief > 0 ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                                  {openRelief} menunggu
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              <DrawerAction
                                ariaLabel={`Lihat rincian angsuran ${app.applicationId}`}
                                label="Rincian"
                                onClick={() =>
                                  openApplicationDrawer(
                                    app.id,
                                    openRelief > 0 ? 'support' : 'installments',
                                  )
                                }
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* 6. MENU: ANGSURAN AKTIF (Outstanding & Active Installments) */}
          {activeMenu === 'activeInstallments' && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                  <span className="text-xs font-medium text-slate-500">
                    Siswa dengan Tanggungan
                  </span>
                  <strong className="mt-1.5 block text-2xl font-extrabold text-[#17158c]">
                    {activeInstallmentMetrics.count}
                  </strong>
                  <span className="mt-1 block text-[11px] text-slate-400">
                    Aktif mengangsur atau sisa tanggungan
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                  <span className="text-xs font-medium text-slate-500">Total Sisa Kewajiban</span>
                  <strong className="mt-1.5 block text-2xl font-extrabold text-slate-900">
                    {formatRupiah(activeInstallmentMetrics.totalRemaining)}
                  </strong>
                  <span className="mt-1 block text-[11px] text-slate-400">
                    Akumulasi seluruh tanggungan
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                  <span className="text-xs font-medium text-slate-500">Terlambat Bayar</span>
                  <strong
                    className={`mt-1.5 block text-2xl font-extrabold ${
                      activeInstallmentMetrics.overdue > 0 ? 'text-red-600' : 'text-slate-900'
                    }`}
                  >
                    {activeInstallmentMetrics.overdue}
                  </strong>
                  <span className="mt-1 block text-[11px] text-slate-400">
                    Lewat tanggal jatuh tempo
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                  <span className="text-xs font-medium text-slate-500">Jatuh Tempo ≤ 7 Hari</span>
                  <strong
                    className={`mt-1.5 block text-2xl font-extrabold ${
                      activeInstallmentMetrics.dueSoon > 0 ? 'text-amber-600' : 'text-slate-900'
                    }`}
                  >
                    {activeInstallmentMetrics.dueSoon}
                  </strong>
                  <span className="mt-1 block text-[11px] text-amber-700">
                    {activeInstallmentMetrics.openRelief} permohonan keringanan terbuka
                  </span>
                </div>
              </div>

              <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Siswa dengan Tanggungan ({visibleActiveInstallments.length}
                    {activeInstallmentFilter !== 'ALL'
                      ? ` dari ${activeInstallmentMetrics.count}`
                      : ''}
                    )
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {ACTIVE_INSTALLMENT_FILTERS.map((filter) => (
                      <button
                        className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17158c] ${
                          activeInstallmentFilter === filter.id
                            ? 'bg-[#17158c] text-white'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                        key={filter.id}
                        onClick={() => setActiveInstallmentFilter(filter.id)}
                        type="button"
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>

                {visibleActiveInstallments.length === 0 ? (
                  <p className="px-5 py-8 text-center text-xs text-slate-400">
                    Tidak ada siswa dengan tanggungan pada filter ini.
                  </p>
                ) : (
                  <>
                    {/* Mobile cards */}
                    <ul className="divide-y divide-slate-100 lg:hidden">
                      {visibleActiveInstallments.map(({ app, summary }) => {
                        const today = getLocalIsoDate()
                        const overdueDays =
                          summary.nextDue && summary.overdueCount > 0
                            ? getDaysBetween(summary.nextDue.dueDate, today)
                            : 0
                        return (
                          <li className="p-4" key={app.id}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900">
                                  {app.applicantName}
                                </p>
                                <p className="truncate text-[11px] text-slate-400">
                                  {app.applicationId} · {app.lpkName}
                                </p>
                              </div>
                              <span
                                className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
                                  STATUS_BADGE_STYLES[app.status] ??
                                  'bg-slate-100 text-slate-700 ring-slate-200'
                                }`}
                              >
                                {STATUS_LABELS[app.status as keyof typeof STATUS_LABELS] ??
                                  app.status}
                              </span>
                            </div>
                            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-lg bg-slate-50 p-2">
                                <dt className="text-slate-400">Sisa Kewajiban</dt>
                                <dd className="mt-0.5 font-bold text-slate-900">
                                  {formatRupiah(summary.remaining)}
                                </dd>
                              </div>
                              <div className="rounded-lg bg-slate-50 p-2">
                                <dt className="text-slate-400">Progres</dt>
                                <dd className="mt-0.5 font-bold text-slate-900">
                                  {summary.paidCount}/{summary.schedule.length} lunas
                                </dd>
                              </div>
                              <div className="col-span-2 rounded-lg bg-slate-50 p-2">
                                <dt className="text-slate-400">Jatuh Tempo Berikutnya</dt>
                                <dd className="mt-0.5 flex flex-wrap items-center gap-1.5 font-bold text-slate-900">
                                  {summary.nextDue ? formatDateShort(summary.nextDue.dueDate) : '—'}
                                  {overdueDays > 0 && (
                                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                      Terlambat {overdueDays} hr
                                    </span>
                                  )}
                                  {overdueDays === 0 && summary.dueSoon && (
                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                      ≤7 hari
                                    </span>
                                  )}
                                </dd>
                              </div>
                            </dl>
                            <div className="mt-3">
                              <DrawerAction
                                ariaLabel={`Lihat rincian angsuran ${app.applicationId}`}
                                label="Rincian"
                                onClick={() => openApplicationDrawer(app.id, 'installments')}
                              />
                            </div>
                          </li>
                        )
                      })}
                    </ul>

                    {/* Desktop table */}
                    <div className="hidden overflow-x-auto lg:block">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                            <th className="whitespace-nowrap px-4 py-3">ID Pengajuan</th>
                            <th className="whitespace-nowrap px-4 py-3">Nama Siswa</th>
                            <th className="whitespace-nowrap px-4 py-3">LPK Mitra</th>
                            <th className="whitespace-nowrap px-4 py-3">Status</th>
                            <th className="whitespace-nowrap px-4 py-3">Total Kewajiban</th>
                            <th className="whitespace-nowrap px-4 py-3">Terbayar</th>
                            <th className="whitespace-nowrap px-4 py-3">Sisa & Progres</th>
                            <th className="whitespace-nowrap px-4 py-3">Jatuh Tempo</th>
                            <th className="whitespace-nowrap px-4 py-3">Keringanan</th>
                            <th className="whitespace-nowrap px-4 py-3 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {visibleActiveInstallments.map(({ app, summary }) => {
                            const today = getLocalIsoDate()
                            const overdueDays =
                              summary.nextDue && summary.overdueCount > 0
                                ? getDaysBetween(summary.nextDue.dueDate, today)
                                : 0
                            const progressPercent =
                              summary.schedule.length > 0
                                ? Math.round((summary.paidCount / summary.schedule.length) * 100)
                                : 0
                            return (
                              <tr className="hover:bg-slate-50/80" key={app.id}>
                                <td className="whitespace-nowrap px-4 py-3 font-bold text-[#17158c]">
                                  {app.applicationId}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                                  {app.applicantName}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                                  {app.lpkName}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
                                      STATUS_BADGE_STYLES[app.status] ??
                                      'bg-slate-100 text-slate-700 ring-slate-200'
                                    }`}
                                  >
                                    {STATUS_LABELS[app.status as keyof typeof STATUS_LABELS] ??
                                      app.status}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                                  {formatRupiah(summary.obligation)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 font-semibold text-emerald-700">
                                  {summary.paidAmount > 0
                                    ? formatRupiah(summary.paidAmount)
                                    : 'Rp0'}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">
                                  <span className="font-bold text-slate-900">
                                    {formatRupiah(summary.remaining)}
                                  </span>
                                  <span className="mt-0.5 block text-[11px] text-slate-400">
                                    {summary.paidCount}/{summary.schedule.length} lunas
                                  </span>
                                  {summary.schedule.length > 0 && (
                                    <span className="mt-1 block h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                                      <span
                                        className="block h-full rounded-full bg-[#17158c]"
                                        style={{ width: `${progressPercent}%` }}
                                      />
                                    </span>
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">
                                  <span className="font-medium text-slate-700">
                                    {summary.nextDue
                                      ? formatDateShort(summary.nextDue.dueDate)
                                      : '—'}
                                  </span>
                                  {overdueDays > 0 && (
                                    <span className="ml-1.5 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                      Terlambat {overdueDays} hr
                                    </span>
                                  )}
                                  {overdueDays === 0 && summary.dueSoon && (
                                    <span className="ml-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                      ≤7 hari
                                    </span>
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">
                                  {summary.openRelief > 0 ? (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                                      {summary.openRelief} menunggu
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right">
                                  <DrawerAction
                                    ariaLabel={`Lihat rincian angsuran ${app.applicationId}`}
                                    label="Rincian"
                                    onClick={() => openApplicationDrawer(app.id, 'installments')}
                                  />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            </div>
          )}

          {/* 7. MENU: STATISTIK (Portfolio Analytics & LPK Partner Table) */}
          {activeMenu === 'statistics' && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <span className="text-xs text-slate-500">Produk Dana Keberangkatan</span>
                  <strong className="mt-1 block text-xl font-extrabold text-slate-900">
                    {applications.filter((a) => a.product === 'DEPARTURE_BRIDGING').length} siswa
                  </strong>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <span className="text-xs text-slate-500">Produk Full Cover</span>
                  <strong className="mt-1 block text-xl font-extrabold text-slate-900">
                    {applications.filter((a) => a.product === 'FULL_COVER').length} siswa
                  </strong>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <span className="text-xs text-slate-500">Negara Tujuan (Jepang / Turki)</span>
                  <strong className="mt-1 block text-xl font-extrabold text-slate-900">
                    {applications.filter((a) => a.destination === 'JAPAN').length} Jepang ·{' '}
                    {applications.filter((a) => a.destination === 'TURKEY').length} Turki
                  </strong>
                </div>
              </div>

              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
                <div className="border-b border-slate-100 px-5 py-3.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Rekapitulasi per LPK Mitra ({lpkStats.length})
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                        <th className="px-4 py-3">Nama LPK Mitra</th>
                        <th className="px-4 py-3">Jumlah Siswa</th>
                        <th className="px-4 py-3">Siswa Aktif / Selesai</th>
                        <th className="px-4 py-3">Total Nilai Kewajiban Tercatat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lpkStats.map((row) => (
                        <tr className="hover:bg-slate-50" key={row.lpkName}>
                          <td className="px-4 py-3 font-semibold text-slate-900">{row.lpkName}</td>
                          <td className="px-4 py-3 text-slate-700">{row.count} pengajuan</td>
                          <td className="px-4 py-3 text-emerald-700">{row.active} aktif</td>
                          <td className="px-4 py-3 font-bold text-slate-900">
                            {formatRupiah(row.totalObligation)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* 8. MENU: LOG AUDIT (Financial Plan History Table) */}
          {activeMenu === 'audit' && (
            <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                      <th className="whitespace-nowrap px-4 py-3">Waktu Perubahan</th>
                      <th className="whitespace-nowrap px-4 py-3">ID Pengajuan & Siswa</th>
                      <th className="whitespace-nowrap px-4 py-3">Staf Pemeriksa</th>
                      <th className="whitespace-nowrap px-4 py-3">Status Biaya</th>
                      <th className="whitespace-nowrap px-4 py-3">Total Kewajiban</th>
                      <th className="whitespace-nowrap px-4 py-3">Referensi Akad & Catatan</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditEntries.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-slate-400" colSpan={7}>
                          Belum ada riwayat perubahan biaya yang tercatat.
                        </td>
                      </tr>
                    ) : (
                      auditEntries.map((item, idx) => (
                        <tr
                          className="hover:bg-slate-50/80"
                          key={`${item.app.id}-${item.changedAt}-${idx}`}
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                            {formatDateTime(item.changedAt)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className="font-bold text-[#17158c]">
                              {item.app.applicationId}
                            </span>{' '}
                            ·{' '}
                            <span className="font-medium text-slate-900">
                              {item.app.applicantName}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {item.changedBy}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                PRICING_BADGE_STYLES[item.pricingStatus] ??
                                'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {PRICING_STATUS_LABELS[
                                item.pricingStatus as keyof typeof PRICING_STATUS_LABELS
                              ] ?? item.pricingStatus}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                            {formatRupiah(item.totalObligation)}
                          </td>
                          <td className="max-w-xs truncate px-4 py-3 text-slate-500">
                            {item.finalAgreementReference || item.settlementNotes || '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <DrawerAction
                              ariaLabel={`Lihat detail audit ${item.app.applicationId}`}
                              label="Detail"
                              onClick={() => openApplicationDrawer(item.app.id, 'support')}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* SLIDE-OVER DRAWER FOR APPLICATION MANAGEMENT */}
      {drawerApplication && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[1px]">
          <div className="h-dvh w-full max-w-4xl shadow-2xl">
            <ApplicationDrawerForm
              activeTab={drawerTab}
              application={drawerApplication}
              key={drawerApplication.id}
              onClose={() => setDrawerAppId(null)}
              onSave={save}
              onUploadAgreement={uploadAgreement}
              payments={drawerPayments}
              pending={pending}
              setActiveTab={setDrawerTab}
            />
          </div>
        </div>
      )}
    </div>
  )
}
