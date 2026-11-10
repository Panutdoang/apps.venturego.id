'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { getFirebaseClientAuth } from '@/lib/firebase-client'
import { DOCUMENT_DEFINITIONS, getKtpDocumentIndex } from '@/lib/documents'
import {
  APPLICATION_STATUSES,
  PRICING_STATUSES,
  type AdminPaymentRecord,
  type ApplicationDocumentStatus,
  type FinancingApplicationRecord,
} from '@/lib/firebase-data'
import {
  approveApplicationDocument,
  approveApplicationPricing,
  deleteApplicationDocument,
  issueAkadDocument,
  saveFinancialPlan,
  setApplicationPricingAgreed,
  updateApplicationWorkflow,
  updateSupportRequest,
} from './actions'
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
  SUBMITTED: 'bg-blue-50 text-[#0b57d0] ring-blue-200',
  ELIGIBILITY_REVIEW: 'bg-blue-50 text-[#0b57d0] ring-blue-200',
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

const DOCUMENT_STATUS_LABELS: Record<ApplicationDocumentStatus, string> = {
  NOT_UPLOADED: 'Belum diunggah',
  UPLOADED: 'Menunggu tinjauan',
  VERIFIED: 'Sesuai',
  REVISION_REQUIRED: 'Tidak sesuai',
}

const DOCUMENT_BADGE_STYLES: Record<ApplicationDocumentStatus, string> = {
  NOT_UPLOADED: 'bg-slate-100 text-slate-600',
  UPLOADED: 'bg-amber-50 text-amber-800',
  VERIFIED: 'bg-emerald-50 text-emerald-700',
  REVISION_REQUIRED: 'bg-red-50 text-red-700',
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
  | 'schedule'
  | 'relief'
  | 'statistics'
  | 'audit'

type DetailTabId = 'profile' | 'nominal' | 'documents' | 'pricing' | 'contract'

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
        defaultTab: 'profile',
      },
      {
        id: 'activeInstallments',
        label: 'Angsuran Aktif',
        subtitle: 'Siswa yang sedang mengangsur atau masih memiliki tanggungan',
        defaultTab: 'profile',
      },
      {
        id: 'schedule',
        label: 'Jadwal Angsuran',
        subtitle: 'Detail jadwal cicilan, progres bayar, dan transaksi Xendit per siswa',
        defaultTab: 'profile',
      },
      {
        id: 'relief',
        label: 'Keringanan',
        subtitle: 'Permohonan keringanan pemohon: status tinjauan dan tanggapan staf',
        defaultTab: 'profile',
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
        defaultTab: 'profile',
      },
    ],
  },
]

const DETAIL_TABS: { id: DetailTabId; label: string }[] = [
  { id: 'profile', label: 'Profil' },
  { id: 'documents', label: 'Berkas' },
  { id: 'nominal', label: 'Nominal Pengajuan' },
  { id: 'pricing', label: 'Draft Akad' },
  { id: 'contract', label: 'Status Persetujuan' },
]

function TabIcon({ id }: { id: DetailTabId }) {
  switch (id) {
    case 'profile':
      return (
        <svg
          aria-hidden="true"
          className="size-3 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" strokeLinecap="round" />
        </svg>
      )
    case 'nominal':
      return (
        <svg
          aria-hidden="true"
          className="size-3 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <rect height="14" rx="2" width="20" x="2" y="5" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M6 9h.01M18 15h.01" strokeLinecap="round" />
        </svg>
      )
    case 'documents':
      return (
        <svg
          aria-hidden="true"
          className="size-3 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M8 13h8M8 17h5" strokeLinecap="round" />
        </svg>
      )
    case 'pricing':
      return (
        <svg
          aria-hidden="true"
          className="size-3 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <rect height="16" rx="2" width="18" x="3" y="4" />
          <path d="M7 8h10M7 12h4M13 12h4M7 16h4M13 16h4" strokeLinecap="round" />
        </svg>
      )
    case 'contract':
      return (
        <svg
          aria-hidden="true"
          className="size-3 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      )
  }
}

function DestinationFlag({ destination }: { destination: string }) {
  if (destination === 'JAPAN') {
    return (
      <svg
        aria-hidden="true"
        className="inline-block size-3.5 shrink-0 rounded-[2px] ring-1 ring-slate-200"
        viewBox="0 0 24 24"
      >
        <rect fill="#ffffff" height="24" width="24" />
        <circle cx="12" cy="12" r="6" fill="#bc002d" />
      </svg>
    )
  }
  return (
    <svg
      aria-hidden="true"
      className="inline-block size-3.5 shrink-0 rounded-[2px] ring-1 ring-slate-200"
      viewBox="0 0 24 24"
    >
      <rect fill="#e30a17" height="24" width="24" />
      <path
        d="M15.2 12a5.2 5.2 0 1 1-2.2-4.3A4.2 4.2 0 1 0 16.4 13"
        fill="#ffffff"
        stroke="#ffffff"
        strokeLinejoin="round"
        strokeWidth="0.6"
      />
      <path
        d="M16.8 10.2l2.9.85-1.85 2.35.02-2.92 2.86.9-2.87.88.03 2.92-1.87-2.35z"
        fill="#ffffff"
      />
    </svg>
  )
}

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
    case 'schedule':
      return (
        <svg
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <rect height="16" rx="2" width="18" x="3" y="4" />
          <path d="M3 9h18M8 2v4M16 2v4" strokeLinecap="round" />
          <path d="M7.5 14h3M13.5 14h3M7.5 17.5h3" strokeLinecap="round" />
        </svg>
      )
    case 'relief':
      return (
        <svg
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path
            d="M12 20.5S4 15.5 4 9.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8 3.5c0 6-8 11-8 11z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
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

const formatDateLong = (value: unknown) => {
  if (typeof value !== 'string' || !value) return '—'
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!iso) return value
  const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

const SCHEME_LABELS: Record<string, string> = {
  WAKALAH_BIL_UJRAH: 'Wakalah bil Ujrah',
  WAKALAH_BIL_UJRAH_AND_JUALAH: "Wakalah bil Ujrah + Ju'alah",
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

const addDaysIso = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
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

const summarizeInstallments = (
  app: FinancingApplicationRecord,
  todayIso: string,
): InstallmentSummary => {
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
  const soon = addDaysIso(todayIso, 7)
  const nextDue = unpaidRows[0] ?? null
  const overdueCount = unpaidRows.filter((row) => row.dueDate < todayIso).length
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
    dueSoon: Boolean(nextDue && nextDue.dueDate >= todayIso && nextDue.dueDate <= soon),
    openRelief,
  }
}

const hasActiveInstallment = (app: FinancingApplicationRecord, summary: InstallmentSummary) =>
  app.status === 'ACTIVE' || summary.remaining > 0 || summary.unpaidCount > 0

const compareInstallmentRows = (
  a: { summary: InstallmentSummary },
  b: { summary: InstallmentSummary },
) => {
  const aOverdue = a.summary.overdueCount > 0 ? 0 : 1
  const bOverdue = b.summary.overdueCount > 0 ? 0 : 1
  if (aOverdue !== bOverdue) return aOverdue - bOverdue
  const aDue = a.summary.nextDue?.dueDate ?? '9999-99-99'
  const bDue = b.summary.nextDue?.dueDate ?? '9999-99-99'
  if (aDue !== bDue) return aDue.localeCompare(bDue)
  return b.summary.remaining - a.summary.remaining
}

function DrawerAction({
  label,
  onClick,
  variant = 'secondary',
  ariaLabel,
  disabled = false,
}: {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
  ariaLabel?: string
  disabled?: boolean
}) {
  return (
    <button
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold shadow-xs transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b57d0] disabled:cursor-not-allowed disabled:opacity-60 ${
        variant === 'primary'
          ? 'bg-[#0b57d0] text-white hover:bg-[#0842a0]'
          : 'border border-slate-200 bg-white text-[#0b57d0] hover:border-[#0b57d0]/30 hover:bg-blue-50'
      }`}
      disabled={disabled}
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
  activeTab,
  setActiveTab,
  pending,
  error,
  savedNotice,
  onDismissError,
  onDismissSaved,
  onSave,
  onWorkflow,
  onApproveDocument,
  onDeleteDocument,
  onApprovePricing,
  onAgreePricing,
  onUploadAgreement,
  onClose,
}: {
  application: FinancingApplicationRecord
  activeTab: DetailTabId
  setActiveTab: (tab: DetailTabId) => void
  pending: boolean
  error: string
  savedNotice: string
  onDismissError: () => void
  onDismissSaved: () => void
  onSave: (application: FinancingApplicationRecord, formData: FormData) => void
  onWorkflow: (applicationId: string, status: string, internalNotes: string) => void
  onApproveDocument: (applicationId: string, documentIndex: number) => void
  onDeleteDocument: (applicationId: string, documentIndex: number) => void
  onApprovePricing: (applicationId: string, newNominal: number | null) => void
  onAgreePricing: (applicationId: string) => void
  onUploadAgreement: (applicationId: string, file: File) => Promise<void>
  onClose: () => void
}) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [showNominalInput, setShowNominalInput] = useState(false)
  const [newNominal, setNewNominal] = useState('')
  const [workflowStatus, setWorkflowStatus] = useState(application.status)
  const [workflowNotes, setWorkflowNotes] = useState(application.internalNotes ?? '')
  const [agreementUploading, setAgreementUploading] = useState(false)
  const [agreementUploadError, setAgreementUploadError] = useState('')
  const [akadIssuing, setAkadIssuing] = useState(false)
  const [akadIssueError, setAkadIssueError] = useState('')
  const [akadPreviewOpen, setAkadPreviewOpen] = useState(false)
  const [akadPreviewHtml, setAkadPreviewHtml] = useState<string | null>(null)
  const [akadPreviewLoading, setAkadPreviewLoading] = useState(false)
  const [akadPreviewError, setAkadPreviewError] = useState('')

  const router = useRouter()

  const definitions =
    DOCUMENT_DEFINITIONS[application.product] ?? DOCUMENT_DEFINITIONS.DEPARTURE_BRIDGING
  const uploadedCount = application.documents.filter((doc) => Boolean(doc.fileId)).length
  const verifiedCount = application.documents.filter((doc) => doc.status === 'VERIFIED').length
  const reviewCount = application.documents.filter((doc) => doc.status === 'UPLOADED').length
  const revisionCount = application.documents.filter(
    (doc) => doc.status === 'REVISION_REQUIRED',
  ).length

  const pricingStatus = String(application.financialPlan?.pricingStatus ?? 'ESTIMATED')
  const agreementPdfCurrent = Boolean(
    application.agreementPdf &&
    application.agreementPdf.agreementReference ===
      application.financialPlan?.finalAgreementReference,
  )

  const personal = application.personalDetails ?? {}
  const eligibility = application.eligibility ?? {}
  const fullCover = application.fullCoverDetails ?? {}
  const departure = application.departureDetails ?? {}

  const ktpIndex = getKtpDocumentIndex(application.product)
  const ktpDocument = application.documents[ktpIndex]
  const ktpIsPdf = String(ktpDocument?.mimeType ?? '')
    .toLowerCase()
    .includes('pdf')

  const previewDocument = previewIndex !== null ? application.documents[previewIndex] : null
  const previewIsPdf = String(previewDocument?.mimeType ?? '')
    .toLowerCase()
    .includes('pdf')

  const requestedAmount =
    application.product === 'DEPARTURE_BRIDGING'
      ? Number(departure.requestedFinancingAmount) || 0
      : 0
  const estimatedMonthlyUjrah =
    application.product === 'DEPARTURE_BRIDGING' && requestedAmount > 0
      ? Math.round(requestedAmount * 0.024)
      : null
  const estimatedTotalUjrah = estimatedMonthlyUjrah === null ? null : estimatedMonthlyUjrah * 12
  const estimatedAdminFee =
    application.product === 'DEPARTURE_BRIDGING' && requestedAmount > 0
      ? Math.round(requestedAmount * 0.05)
      : null
  const estimatedCashDisbursed =
    estimatedAdminFee === null ? null : requestedAmount - estimatedAdminFee
  const estimatedFinancingTotal =
    estimatedTotalUjrah === null ? null : requestedAmount + estimatedTotalUjrah

  const nominalCap =
    application.product === 'DEPARTURE_BRIDGING' && requestedAmount > 0 ? requestedAmount : null
  const parsedNewNominal = Number(newNominal.replace(/[^\d]/g, ''))
  const newNominalValid =
    Number.isSafeInteger(parsedNewNominal) &&
    parsedNewNominal > 0 &&
    (nominalCap === null || parsedNewNominal <= nominalCap)

  const pricingStatusLabel =
    pricingStatus === 'ESTIMATED'
      ? 'Nominal'
      : (PRICING_STATUS_LABELS[pricingStatus as keyof typeof PRICING_STATUS_LABELS] ??
        pricingStatus)

  const akadMeta = (application.financialPlan?.akadDocument ?? null) as {
    documentNumber?: string
    studentNumber?: string
    issuedAt?: string
    fileName?: string
  } | null
  const akadIssued = Boolean(akadMeta)
  const akadGateOpen = pricingStatus === 'VERIFIED' || pricingStatus === 'AGREED' || akadIssued

  const openAkadPreview = async () => {
    setAkadPreviewOpen(true)
    setAkadPreviewError('')
    setAkadPreviewLoading(true)
    setAkadPreviewHtml(null)
    try {
      const response = await fetch(`/api/admin/applications/${application.id}/akad`)
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(body?.message || 'Pratinjau dokumen akad belum dapat dimuat.')
      }
      setAkadPreviewHtml(await response.text())
    } catch (err) {
      setAkadPreviewError(
        err instanceof Error ? err.message : 'Pratinjau dokumen akad belum dapat dimuat.',
      )
    } finally {
      setAkadPreviewLoading(false)
    }
  }

  const issueAkad = () => {
    if (
      !window.confirm(
        'Terbitkan dokumen akad? NIS akan diterbitkan dan rincian biaya terkunci permanen.',
      )
    ) {
      return
    }
    setAkadIssueError('')
    setAkadIssuing(true)
    void (async () => {
      try {
        const result = await issueAkadDocument(application.id)
        if (!result.ok) {
          setAkadIssueError(result.message)
          return
        }
        setAkadPreviewOpen(false)
        setAkadPreviewHtml(null)
        router.refresh()
      } catch (err) {
        setAkadIssueError(
          err instanceof Error ? err.message : 'Dokumen akad belum dapat diterbitkan.',
        )
      } finally {
        setAkadIssuing(false)
      }
    })()
  }

  const planNafaqah = Number(application.financialPlan?.nafaqahTotal) || 0
  const planUjrah = Number(application.financialPlan?.ujrahTotal) || 0
  const planTotal = Number(application.financialPlan?.totalObligation) || 0
  const planApproved =
    (pricingStatus === 'VERIFIED' || pricingStatus === 'AGREED') && planNafaqah > 0 && planUjrah > 0

  const workflowDirty =
    workflowStatus !== application.status || workflowNotes !== (application.internalNotes ?? '')

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
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-[#0b57d0] px-2.5 py-1 text-xs font-bold text-white">
              {application.applicationId}
            </span>
            <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#0b57d0] ring-1 ring-inset ring-blue-200">
              {application.product === 'FULL_COVER' ? 'VSV Full Cover' : 'VSV Dana Keberangkatan'}
            </span>
          </div>
          <button
            aria-label="Tutup panel pengajuan"
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b57d0]"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>
        <h2 className="mt-2.5 text-2xl font-extrabold tracking-tight text-slate-900">
          {application.applicantName}
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-slate-700">{application.lpkName}</span>
          <span aria-hidden="true" className="text-slate-300">
            |
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
            <DestinationFlag destination={application.destination} />
            {application.destination === 'JAPAN' ? 'Jepang' : 'Turki'}
          </span>
        </p>
        {error && (
          <div
            className="mt-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-800"
            role="alert"
          >
            <span>{error}</span>
            <button className="underline" onClick={onDismissError} type="button">
              Tutup
            </button>
          </div>
        )}
        {savedNotice && (
          <div
            className="mt-3 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-900"
            role="status"
          >
            <span>✓ {savedNotice}</span>
            <button className="underline" onClick={onDismissSaved} type="button">
              Tutup
            </button>
          </div>
        )}
      </div>

      {/* Drawer Navigation Tabs — solid pill tab bar */}
      <div className="border-b border-slate-200 bg-white px-6 py-3">
        <div
          aria-label="Tab detail pengajuan"
          className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
        >
          {DETAIL_TABS.map((tab) => {
            const isActive = activeTab === tab.id
            let badge = ''
            if (tab.id === 'documents') badge = `${uploadedCount}/${application.documents.length}`

            return (
              <button
                aria-selected={isActive}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b57d0] ${
                  isActive
                    ? 'bg-[#0b57d0] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                type="button"
              >
                <TabIcon id={tab.id} />
                <span>{tab.label}</span>
                {badge && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      isActive ? 'bg-white/15 text-white' : 'bg-slate-200 text-slate-600'
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
        <div className={activeTab === 'profile' ? 'block' : 'hidden'}>
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-bold text-slate-900">Profil Pemohon</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Biodata, dokumen identitas, dan program LPK mitra
              </p>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  KTP Pemohon
                </h4>
                <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  {ktpDocument?.fileId ? (
                    ktpIsPdf ? (
                      <iframe
                        className="h-44 w-full bg-white"
                        src={`/api/admin/applications/${application.id}/documents/${ktpIndex}?inline=1`}
                        title="Pratinjau KTP pemohon"
                      />
                    ) : (
                      <img
                        alt="KTP pemohon"
                        className="h-44 w-full bg-white object-contain"
                        src={`/api/admin/applications/${application.id}/documents/${ktpIndex}?inline=1`}
                      />
                    )
                  ) : (
                    <div className="flex h-44 items-center justify-center px-4 text-center text-xs text-slate-400">
                      KTP belum diunggah
                    </div>
                  )}
                </div>
                {ktpDocument?.fileId && (
                  <a
                    className="mt-1.5 inline-block text-[11px] font-semibold text-[#0b57d0] underline"
                    href={`/api/admin/applications/${application.id}/documents/${ktpIndex}`}
                  >
                    Unduh KTP {formatSizeMb(ktpDocument.size)}
                  </a>
                )}
              </div>

              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Biodata & Kontak
                </h4>
                <dl className="mt-2 grid grid-cols-2 gap-3 text-xs">
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
                      {String(personal.birthPlace ?? '—')}, {formatDateLong(personal.birthDate)}
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
                      {personal.domicilePostalCode
                        ? `(${String(personal.domicilePostalCode)})`
                        : ''}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="border-t border-slate-100 p-5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Program LPK & Kesiapan Keberangkatan
              </h4>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-4">
                <div className="min-w-0">
                  <dt className="truncate text-slate-400">LPK Mitra</dt>
                  <dd
                    className="mt-0.5 truncate font-semibold text-slate-900"
                    title={application.lpkName}
                  >
                    {application.lpkName}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="truncate text-slate-400">Tujuan & Skema</dt>
                  <dd
                    className="mt-0.5 truncate font-semibold text-slate-900"
                    title={`${application.destination === 'JAPAN' ? 'Jepang' : 'Turki'} · ${
                      SCHEME_LABELS[String(application.contractScheme ?? 'WAKALAH_BIL_UJRAH')] ??
                      String(application.contractScheme ?? '—')
                    }`}
                  >
                    {application.destination === 'JAPAN' ? 'Jepang' : 'Turki'} ·{' '}
                    {SCHEME_LABELS[String(application.contractScheme ?? 'WAKALAH_BIL_UJRAH')] ??
                      String(application.contractScheme ?? '—')}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="truncate text-slate-400">Status COE & Visa</dt>
                  <dd
                    className="mt-0.5 truncate font-semibold text-slate-900"
                    title={`COE: ${
                      DOC_PROGRESS_LABELS[String(eligibility.coeStatus ?? '')] ?? '—'
                    } · Visa: ${DOC_PROGRESS_LABELS[String(eligibility.visaStatus ?? '')] ?? '—'}`}
                  >
                    COE: {DOC_PROGRESS_LABELS[String(eligibility.coeStatus ?? '')] ?? '—'} · Visa:{' '}
                    {DOC_PROGRESS_LABELS[String(eligibility.visaStatus ?? '')] ?? '—'}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="truncate text-slate-400">Perkiraan Keberangkatan</dt>
                  <dd className="mt-0.5 truncate font-semibold text-slate-900">
                    {formatDateLong(eligibility.estimatedDeparture)}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                {[
                  ['Pelatihan dimulai', eligibility.trainingStarted],
                  ['Pelatihan selesai', eligibility.trainingCompleted],
                  ['Lulus penempatan', eligibility.placementPassed],
                  ['Paspor tersedia', eligibility.hasPassport],
                  ['Kontrak kerja ada', eligibility.hasWorkContract],
                  ['Izin orang tua/wali', eligibility.guardianApproval],
                ].map(([label, val]) => (
                  <div
                    className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 ${
                      val ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-50 text-slate-500'
                    }`}
                    key={String(label)}
                  >
                    <span className="truncate whitespace-nowrap">{String(label)}</span>
                    <strong className="shrink-0">{val ? 'Ya' : 'Tidak'}</strong>
                  </div>
                ))}
              </div>
              {application.product === 'FULL_COVER' && (
                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
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
            </div>
          </section>
        </div>

        {/* TAB: NOMINAL PENGAJUAN */}
        <div className={activeTab === 'nominal' ? 'block space-y-4' : 'hidden'}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="text-[11px] font-medium text-slate-500">Nominal Diajukan</span>
              <strong className="mt-1 block text-xl font-extrabold text-[#0b57d0]">
                {application.product === 'DEPARTURE_BRIDGING'
                  ? formatRupiah(departure.requestedFinancingAmount)
                  : formatRupiah(
                      typeof fullCover.financingAmount === 'number'
                        ? fullCover.financingAmount
                        : null,
                    )}
              </strong>
              <span className="mt-1 block text-[11px] text-slate-400">
                {application.product === 'DEPARTURE_BRIDGING'
                  ? 'Plafon maksimum persetujuan staf'
                  : 'Perhitungan berbasis Nafaqah + Ujrah'}
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="text-[11px] font-medium text-slate-500">
                {application.product === 'DEPARTURE_BRIDGING'
                  ? 'Sisa Kewajiban LPK'
                  : 'Status Biaya'}
              </span>
              <strong
                className={`mt-1 block text-xl font-extrabold ${
                  application.product === 'DEPARTURE_BRIDGING'
                    ? 'text-slate-900'
                    : pricingStatus === 'AGREED'
                      ? 'text-emerald-700'
                      : pricingStatus === 'VERIFIED'
                        ? 'text-amber-700'
                        : 'text-slate-700'
                }`}
              >
                {application.product === 'DEPARTURE_BRIDGING'
                  ? formatRupiah(departure.outstandingLPKAmount)
                  : pricingStatusLabel}
              </strong>
              <span className="mt-1 block text-[11px] text-slate-400">
                {application.product === 'DEPARTURE_BRIDGING'
                  ? 'Tagihan yang belum ditutup LPK'
                  : 'Tahap verifikasi rincian biaya'}
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="text-[11px] font-medium text-slate-500">Total Kewajiban Akad</span>
              <strong className="mt-1 block text-xl font-extrabold text-slate-900">
                {formatRupiah(application.financialPlan?.totalObligation ?? null)}
              </strong>
              <span className="mt-1 block text-[11px] text-slate-400">
                {application.product === 'DEPARTURE_BRIDGING'
                  ? `Sesuai rincian saat ini · ${String(
                      application.financialPlan?.installmentCount ?? '—',
                    )} angsuran`
                  : 'Nafaqah + Ujrah (di luar Ju’alah)'}
              </span>
            </div>
          </div>

          {application.product === 'DEPARTURE_BRIDGING' && (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="text-sm font-bold text-slate-900">Nominal Wakalah (Sistem)</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {planApproved
                    ? 'Rincian tersimpan sesuai nominal yang disetujui: ujrah 2,4% per bulan dikalikan 12 bulan dan biaya admin 5%.'
                    : 'Perhitungan otomatis berbasis nominal yang diajukan: ujrah 2,4% per bulan dikalikan 12 bulan dan biaya admin 5%.'}
                </p>
              </div>
              <dl className="divide-y divide-slate-100 px-5 text-xs">
                {(planApproved
                  ? ([
                      ['Principal (nominal disetujui)', formatRupiah(planNafaqah)],
                      ['Ujrah per bulan (2,4%)', formatRupiah(Math.round(planUjrah / 12))],
                      ['Ujrah × 12 bulan', formatRupiah(planUjrah)],
                      ['Biaya admin (5%)', formatRupiah(Math.round(planNafaqah * 0.05))],
                      [
                        'Pencairan bersih ke pemohon',
                        formatRupiah(planNafaqah - Math.round(planNafaqah * 0.05)),
                      ],
                      ['Total nominal kewajiban', formatRupiah(planTotal)],
                    ] as const)
                  : ([
                      ['Principal (nominal diajukan)', formatRupiah(requestedAmount)],
                      ['Ujrah per bulan (2,4%)', formatRupiah(estimatedMonthlyUjrah)],
                      ['Ujrah × 12 bulan', formatRupiah(estimatedTotalUjrah)],
                      ['Biaya admin (5%)', formatRupiah(estimatedAdminFee)],
                      ['Pencairan bersih ke pemohon', formatRupiah(estimatedCashDisbursed)],
                      ['Total nominal kewajiban', formatRupiah(estimatedFinancingTotal)],
                    ] as const)
                ).map(([label, value], index, rows) => (
                  <div
                    className={`flex items-center justify-between py-2.5 ${
                      index === rows.length - 1 ? 'font-bold text-[#0b57d0]' : 'text-slate-600'
                    }`}
                    key={label}
                  >
                    <dt>{label}</dt>
                    <dd
                      className={
                        index === rows.length - 1 ? 'text-sm' : 'font-semibold text-slate-900'
                      }
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Rincian Biaya Saat Ini</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Nilai tersimpan yang menjadi dasar penawaran kepada pemohon.
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${
                  PRICING_BADGE_STYLES[pricingStatus] ?? 'bg-slate-100 text-slate-700'
                } ring-slate-200`}
              >
                {pricingStatusLabel}
              </span>
            </div>
            <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
              {application.product === 'DEPARTURE_BRIDGING'
                ? (
                    [
                      [
                        'Total Nafaqah',
                        formatRupiah(application.financialPlan?.nafaqahTotal ?? null),
                      ],
                      ['Total Ujrah', formatRupiah(application.financialPlan?.ujrahTotal ?? null)],
                      ['Qardh', formatRupiah(application.financialPlan?.qardhAmount ?? null)],
                      [
                        'Refund / potongan',
                        formatRupiah(application.financialPlan?.refundTotal ?? null),
                      ],
                      [
                        'Total kewajiban',
                        formatRupiah(application.financialPlan?.totalObligation ?? null),
                      ],
                      [
                        'Jadwal angsuran',
                        application.financialPlan?.firstPaymentDate
                          ? `${String(application.financialPlan.installmentCount ?? '—')}× mulai ${formatDateShort(application.financialPlan.firstPaymentDate)}`
                          : 'Belum diatur',
                      ],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-slate-400">{label}</dt>
                      <dd className="mt-0.5 font-semibold text-slate-900">{value}</dd>
                    </div>
                  ))
                : (
                    [
                      [
                        'Total Nafaqah',
                        formatRupiah(application.financialPlan?.nafaqahTotal ?? null),
                      ],
                      ['Total Ujrah', formatRupiah(application.financialPlan?.ujrahTotal ?? null)],
                      [
                        'Ju’alah (saat COE terbit)',
                        formatRupiah(application.financialPlan?.jualaTotal ?? null),
                      ],
                      [
                        'Tenor setelah keberangkatan',
                        application.financialPlan?.tenorMonths
                          ? `${String(application.financialPlan.tenorMonths)} bulan`
                          : '—',
                      ],
                      [
                        'Total kewajiban (di luar Ju’alah)',
                        formatRupiah(application.financialPlan?.totalObligation ?? null),
                      ],
                      [
                        'Angsuran per bulan (setelah COE)',
                        formatRupiah(application.financialPlan?.monthlyInstallmentAfterCoe ?? null),
                      ],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-slate-400">{label}</dt>
                      <dd className="mt-0.5 font-semibold text-slate-900">{value}</dd>
                    </div>
                  ))}
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-bold text-slate-900">Persetujuan Biaya</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {pricingStatus === 'ESTIMATED'
                ? 'Setujui rincian untuk mengunci status biaya menjadi Terverifikasi. Dengan nominal baru, rincian Nafaqah & Ujrah disesuaikan secara proporsional agar totalnya sama dengan nominal baru, lalu jadwal angsuran dihitung ulang.'
                : pricingStatus === 'VERIFIED'
                  ? 'Rincian telah terverifikasi. Tandai Disepakati setelah pemohon menyetujui penawaran terbaru dan referensi akad final terisi pada tab Draft Akad.'
                  : 'Rincian biaya sudah disepakati dan siap diproses ke tahap akad.'}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              {pricingStatus === 'ESTIMATED' && (
                <>
                  <DrawerAction
                    disabled={pending}
                    label={pending ? 'Menyimpan…' : 'Setujui'}
                    onClick={() => onApprovePricing(application.id, null)}
                    variant="primary"
                  />
                  <DrawerAction
                    disabled={pending}
                    label="Setujui dengan Nominal Baru"
                    onClick={() => setShowNominalInput(true)}
                  />
                </>
              )}
              {pricingStatus === 'VERIFIED' && (
                <>
                  <DrawerAction
                    disabled={pending}
                    label={pending ? 'Menyimpan…' : 'Tandai Disepakati'}
                    onClick={() => onAgreePricing(application.id)}
                    variant="primary"
                  />
                  {!akadIssued && (
                    <DrawerAction
                      disabled={pending}
                      label="Setujui dengan Nominal Baru"
                      onClick={() => setShowNominalInput(true)}
                    />
                  )}
                </>
              )}
              {pricingStatus === 'AGREED' && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                  ✓ Biaya disepakati — lanjutkan ke tahap akad
                </span>
              )}
            </div>
          </section>
        </div>

        {/* TAB: DOCUMENTS */}
        <div className={activeTab === 'documents' ? 'block space-y-4' : 'hidden'}>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
            <span>
              Terunggah:{' '}
              <strong>
                {uploadedCount}/{application.documents.length}
              </strong>
            </span>
            <span>
              Menunggu tinjauan: <strong className="text-amber-700">{reviewCount}</strong>
            </span>
            <span>
              Sesuai: <strong className="text-emerald-700">{verifiedCount}</strong>
            </span>
            <span>
              Tidak sesuai: <strong className="text-red-700">{revisionCount}</strong>
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="px-3.5 py-2.5">No</th>
                  <th className="px-3.5 py-2.5">Dokumen</th>
                  <th className="px-3.5 py-2.5">Kategori</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {application.documents.map((document, index) => {
                  const def = definitions[index]
                  const currentStatus = document.status
                  return (
                    <tr className="hover:bg-slate-50" key={`${document.documentType}-${index}`}>
                      <td className="px-3.5 py-2.5 text-slate-400">{index + 1}</td>
                      <td className="px-3.5 py-2.5">
                        <span className="font-medium text-slate-900">
                          {document.documentType}
                          {def?.required && <span className="ml-1 text-red-500">*</span>}
                        </span>
                        {document.fileId && (
                          <span className="mt-0.5 block text-[11px] text-slate-400">
                            {document.fileName ?? 'berkas'}{' '}
                            {document.size ? `· ${formatSizeMb(document.size)}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-500">
                        {def?.section === 'dokumen-pendukung' ? 'Pendukung' : 'Utama'}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            DOCUMENT_BADGE_STYLES[currentStatus] ?? 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {DOCUMENT_STATUS_LABELS[currentStatus] ?? currentStatus}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            aria-label={`Pratinjau ${document.documentType}`}
                            className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:border-[#0b57d0]/30 hover:text-[#0b57d0] disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={!document.fileId}
                            onClick={() => setPreviewIndex(index)}
                            title="Pratinjau berkas"
                            type="button"
                          >
                            <svg
                              aria-hidden="true"
                              className="size-3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.8}
                              viewBox="0 0 24 24"
                            >
                              <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                              <circle cx="12" cy="12" r="2.5" />
                            </svg>
                          </button>
                          <button
                            aria-label={`Hapus berkas ${document.documentType}`}
                            className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={!document.fileId || pending}
                            onClick={() => onDeleteDocument(application.id, index)}
                            title="Hapus berkas (status menjadi Tidak sesuai)"
                            type="button"
                          >
                            <svg
                              aria-hidden="true"
                              className="size-3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.8}
                              viewBox="0 0 24 24"
                            >
                              <path
                                d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"
                                strokeLinecap="round"
                              />
                              <path d="M10 11v6M14 11v6" strokeLinecap="round" />
                            </svg>
                          </button>
                          <button
                            aria-label={`Tandai sesuai ${document.documentType}`}
                            className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:border-emerald-300 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={!document.fileId || pending}
                            onClick={() => onApproveDocument(application.id, index)}
                            title="Tandai sesuai"
                            type="button"
                          >
                            <svg
                              aria-hidden="true"
                              className="size-3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.8}
                              viewBox="0 0 24 24"
                            >
                              <path
                                d="M5 13l4 4L19 7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        </div>
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
          <fieldset
            className="m-0 min-w-0 border-0 p-0 disabled:opacity-75 [&_button]:disabled:cursor-not-allowed [&_input]:disabled:bg-slate-50"
            disabled={akadIssued}
          >
            <FinanceTermsFields
              financialPlan={application.financialPlan}
              key={JSON.stringify(application.financialPlan ?? {})}
              nikNumber={String(application.personalDetails?.idCardNumber ?? '')}
              product={application.product}
            />
          </fieldset>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Dokumen Akad</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {akadIssued
                    ? 'Dokumen akad final tersimpan di penyimpanan berkas dan tidak dapat diubah lagi.'
                    : 'Susun dokumen akad dari template resmi VSV dengan data pengajuan ini.'}
                </p>
              </div>
              {akadIssued && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  Dokumen akad telah terbit
                </span>
              )}
            </div>

            {akadIssued && akadMeta ? (
              <div className="mt-3 grid gap-3 rounded-xl bg-emerald-50/70 p-4 ring-1 ring-inset ring-emerald-200 sm:grid-cols-3">
                <div>
                  <dt className="text-[11px] font-semibold text-emerald-700">Nomor Dokumen</dt>
                  <dd className="mt-0.5 text-sm font-bold text-emerald-950">
                    {akadMeta.documentNumber || '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-emerald-700">NIS Pemohon</dt>
                  <dd className="mt-0.5 text-sm font-bold text-emerald-950">
                    {akadMeta.studentNumber || '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-emerald-700">Diterbitkan</dt>
                  <dd className="mt-0.5 text-sm font-bold text-emerald-950">
                    {formatDateTime(akadMeta.issuedAt)}
                  </dd>
                </div>
              </div>
            ) : (
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                Nomor dokumen mengikuti urutan NIS pemohon. Status biaya harus Terverifikasi sebelum
                dokumen dapat diterbitkan.
              </p>
            )}

            {akadIssueError && (
              <p className="mt-2 text-xs text-red-700" role="alert">
                {akadIssueError}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b57d0]"
                disabled={akadPreviewLoading}
                onClick={openAkadPreview}
                type="button"
              >
                Preview Dokumen
              </button>
              {akadIssued ? (
                <a
                  className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b57d0]"
                  href={`/api/admin/applications/${application.id}/akad?mode=docx`}
                >
                  Unduh .docx
                </a>
              ) : (
                <button
                  className="rounded-lg bg-[#0b57d0] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#0842a0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b57d0] disabled:opacity-60"
                  disabled={!akadGateOpen || pending || akadIssuing}
                  onClick={issueAkad}
                  type="button"
                >
                  {akadIssuing ? 'Menerbitkan…' : 'Terbitkan Dokumen Akad'}
                </button>
              )}
            </div>
            {!akadIssued && !akadGateOpen && (
              <p className="mt-2 text-[11px] text-amber-700">
                Status biaya harus Terverifikasi sebelum dokumen dapat diterbitkan.
              </p>
            )}
          </section>

          {!akadIssued && (
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button
                className="rounded-lg bg-[#0b57d0] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#0842a0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b57d0] disabled:opacity-60"
                disabled={pending}
                type="submit"
              >
                {pending ? 'Menyimpan…' : 'Simpan Rincian Biaya'}
              </button>
            </div>
          )}
        </div>

        {/* TAB: CONTRACT APPROVAL */}
        <div className={activeTab === 'contract' ? 'block space-y-4' : 'hidden'}>
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Status Pengajuan</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Atur tahap proses pemohon dan simpan catatan internal staf.
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${
                  STATUS_BADGE_STYLES[application.status] ??
                  'bg-slate-100 text-slate-700 ring-slate-200'
                }`}
              >
                {STATUS_LABELS[application.status as keyof typeof STATUS_LABELS] ??
                  application.status}
              </span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-[11px] font-semibold text-slate-600">
                <span>Status Pengajuan</span>
                <select
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-900 focus:border-[#0b57d0] focus:outline-none"
                  onChange={(event) => setWorkflowStatus(event.target.value)}
                  value={workflowStatus}
                >
                  {APPLICATION_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-[11px] font-semibold text-slate-600">
                <span>Catatan Internal</span>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-[11px] font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
                  maxLength={2000}
                  onChange={(event) => setWorkflowNotes(event.target.value)}
                  placeholder="Catatan internal staf…"
                  value={workflowNotes}
                />
              </label>
            </div>
            <div className="mt-3 flex items-center justify-end gap-3">
              <span className="text-[11px] text-slate-400">
                Perubahan disimpan terpisah dari rincian biaya.
              </span>
              <button
                className="rounded-lg bg-[#0b57d0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#0842a0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b57d0] disabled:opacity-60"
                disabled={pending || !workflowDirty}
                onClick={() => onWorkflow(application.id, workflowStatus, workflowNotes)}
                type="button"
              >
                {pending ? 'Menyimpan…' : 'Simpan Status & Catatan'}
              </button>
            </div>
          </section>

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
                  : 'Belum diisi (isi pada tab Draft Akad)'}
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
                  className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-[#0b57d0] hover:bg-blue-100"
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
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#0b57d0] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#0842a0]">
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
      </div>

      {/* Slide-over preview berkas dokumen */}
      {previewIndex !== null && previewDocument && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-slate-900/50">
          <div className="flex h-dvh w-full max-w-5xl flex-col bg-white shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">{previewDocument.documentType}</h3>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {previewDocument.fileName ?? 'berkas'}{' '}
                  {previewDocument.size ? `· ${formatSizeMb(previewDocument.size)}` : ''}
                </p>
                <span
                  className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    DOCUMENT_BADGE_STYLES[previewDocument.status] ?? 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {DOCUMENT_STATUS_LABELS[previewDocument.status] ?? previewDocument.status}
                </span>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                  disabled={pending}
                  onClick={() => {
                    onDeleteDocument(application.id, previewIndex)
                    setPreviewIndex(null)
                  }}
                  type="button"
                >
                  Hapus Berkas
                </button>
                <button
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                  disabled={pending}
                  onClick={() => {
                    onApproveDocument(application.id, previewIndex)
                    setPreviewIndex(null)
                  }}
                  type="button"
                >
                  Tandai Sesuai
                </button>
                <button
                  aria-label="Tutup pratinjau berkas"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                  onClick={() => setPreviewIndex(null)}
                  type="button"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-4">
              {previewIsPdf ? (
                <iframe
                  className="h-full min-h-[60vh] w-full rounded-lg border border-slate-200 bg-white"
                  src={`/api/admin/applications/${application.id}/documents/${previewIndex}?inline=1`}
                  title={`Pratinjau ${previewDocument.documentType}`}
                />
              ) : String(previewDocument.mimeType ?? '').startsWith('image/') ? (
                <img
                  alt={`Pratinjau ${previewDocument.documentType}`}
                  className="mx-auto rounded-lg border border-slate-200 bg-white object-contain"
                  src={`/api/admin/applications/${application.id}/documents/${previewIndex}?inline=1`}
                />
              ) : (
                <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white text-center">
                  <p className="text-xs text-slate-500">
                    Pratinjau tidak tersedia untuk jenis berkas ini.
                  </p>
                  <a
                    className="rounded-lg bg-[#0b57d0] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0842a0]"
                    href={`/api/admin/applications/${application.id}/documents/${previewIndex}`}
                  >
                    Unduh berkas
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Slide-over pratinjau dokumen akad */}
      {akadPreviewOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-slate-900/50">
          <div className="flex h-dvh w-full max-w-4xl flex-col bg-white shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">Pratinjau Dokumen Akad</h3>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {akadIssued
                    ? `No. ${akadMeta?.documentNumber ?? '-'} · ${akadMeta?.fileName ?? 'dokumen akad'}`
                    : 'Draft dari data pengajuan terkini'}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <a
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  href={`/api/admin/applications/${application.id}/akad?mode=docx`}
                >
                  Unduh .docx
                </a>
                {!akadIssued && (
                  <button
                    className="rounded-lg bg-[#0b57d0] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#0842a0] disabled:opacity-60"
                    disabled={!akadGateOpen || pending || akadIssuing}
                    onClick={issueAkad}
                    type="button"
                  >
                    {akadIssuing ? 'Menerbitkan…' : 'Terbitkan Dokumen Akad'}
                  </button>
                )}
                <button
                  aria-label="Tutup pratinjau dokumen akad"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                  onClick={() => setAkadPreviewOpen(false)}
                  type="button"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-4">
              {akadPreviewLoading && (
                <p className="text-sm text-slate-500">Memuat pratinjau dokumen akad…</p>
              )}
              {akadPreviewError && (
                <p className="text-sm text-red-700" role="alert">
                  {akadPreviewError}
                </p>
              )}
              {akadPreviewHtml && !akadPreviewLoading && (
                <iframe
                  className="h-full min-h-[60vh] w-full rounded-lg border border-slate-200 bg-white"
                  srcDoc={akadPreviewHtml}
                  title="Pratinjau dokumen akad"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Slide-over khusus: Setujui dengan Nominal Baru */}
      {showNominalInput && (pricingStatus === 'ESTIMATED' || pricingStatus === 'VERIFIED') && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-slate-900/50">
          <div className="flex h-dvh w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">Setujui dengan Nominal Baru</h3>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {application.applicantName} · {application.applicationId}
                </p>
              </div>
              <button
                aria-label="Tutup pengaturan nominal baru"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                onClick={() => {
                  setShowNominalInput(false)
                  setNewNominal('')
                }}
                type="button"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Nominal diajukan (maksimal)</span>
                  <strong className="text-slate-900">
                    {nominalCap !== null ? formatRupiah(nominalCap) : '—'}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Total kewajiban saat ini</span>
                  <strong className="text-slate-900">
                    {formatRupiah(application.financialPlan?.totalObligation ?? null)}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Status biaya</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${
                      PRICING_BADGE_STYLES[pricingStatus] ?? 'bg-slate-100 text-slate-700'
                    } ring-slate-200`}
                  >
                    {pricingStatusLabel}
                  </span>
                </div>
              </div>
              <p className="text-xs leading-5 text-slate-500">
                Rincian Nafaqah &amp; Ujrah disesuaikan secara proporsional agar totalnya sama
                dengan nominal baru, lalu jadwal angsuran dihitung ulang. Status biaya menjadi
                Terverifikasi.
              </p>
              <label className="block text-xs font-semibold text-slate-700">
                Nominal baru (Rp)
                <input
                  autoFocus
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-[#0b57d0] focus:outline-none"
                  min={1}
                  onChange={(event) => setNewNominal(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.preventDefault()
                  }}
                  placeholder="Contoh: 120000000"
                  step={1}
                  type="number"
                  value={newNominal}
                />
              </label>
              {newNominal !== '' && !newNominalValid && (
                <p className="text-[11px] font-semibold text-red-600" role="alert">
                  Nominal harus lebih dari 0
                  {nominalCap !== null ? ` dan maksimal ${formatRupiah(nominalCap)}.` : '.'}
                </p>
              )}
              <p className="text-[11px] text-slate-500">
                {nominalCap !== null
                  ? `Maksimal ${formatRupiah(nominalCap)} (nominal yang diajukan siswa).`
                  : 'Masukkan nominal baru minimal Rp1.'}
              </p>
              {nominalCap !== null && (
                <button
                  className="text-[11px] font-semibold text-[#0b57d0] underline"
                  onClick={() => setNewNominal(String(nominalCap))}
                  type="button"
                >
                  Gunakan nominal diajukan ({formatRupiah(nominalCap)})
                </button>
              )}
            </div>
            <div className="flex gap-2 border-t border-slate-200 px-5 py-4">
              <button
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-[#0b57d0] px-3.5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#0842a0] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={pending || !newNominalValid}
                onClick={() => {
                  if (!newNominalValid) return
                  onApprovePricing(application.id, parsedNewNominal)
                  setShowNominalInput(false)
                  setNewNominal('')
                }}
                type="button"
              >
                {pending ? 'Menyimpan…' : 'Setujui Nominal Baru'}
              </button>
              <button
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                onClick={() => {
                  setShowNominalInput(false)
                  setNewNominal('')
                }}
                type="button"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}

export function AdminDashboard({
  email,
  applications,
  payments = [],
  todayIso,
}: {
  email: string
  applications: FinancingApplicationRecord[]
  payments?: AdminPaymentRecord[]
  todayIso: string
}) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [savedNotice, setSavedNotice] = useState('')
  const [pending, startTransition] = useTransition()

  const [activeMenu, setActiveMenu] = useState<MenuId>('dashboard')
  const [drawerAppId, setDrawerAppId] = useState<string | null>(null)
  const [drawerTab, setDrawerTab] = useState<DetailTabId>('profile')
  const [expandedScheduleId, setExpandedScheduleId] = useState<string | null>(null)
  const [reliefEdits, setReliefEdits] = useState<
    Record<string, { status: string; response: string }>
  >({})

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

  // Ringkasan angsuran per pengajuan (dasar menu Angsuran Aktif & Jadwal Angsuran)
  const installmentSummaries = useMemo(
    () =>
      filteredApplications.map((app) => ({ app, summary: summarizeInstallments(app, todayIso) })),
    [filteredApplications, todayIso],
  )

  const activeInstallmentSummaries = useMemo(
    () => installmentSummaries.filter(({ app, summary }) => hasActiveInstallment(app, summary)),
    [installmentSummaries],
  )

  const scheduleRows = useMemo(
    () =>
      installmentSummaries
        .filter(({ summary }) => summary.schedule.length > 0)
        .sort(compareInstallmentRows),
    [installmentSummaries],
  )

  const reliefRows = useMemo(() => {
    const rows: {
      app: FinancingApplicationRecord
      request: NonNullable<FinancingApplicationRecord['supportRequests']>[number]
      index: number
    }[] = []
    for (const app of filteredApplications) {
      ;(app.supportRequests ?? []).forEach((request, index) => rows.push({ app, request, index }))
    }
    return rows.sort((a, b) => b.request.requestedAt.localeCompare(a.request.requestedAt))
  }, [filteredApplications])

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
    return rows.sort(compareInstallmentRows)
  }, [activeInstallmentSummaries, activeInstallmentFilter])

  const save = (application: FinancingApplicationRecord, formData: FormData) => {
    setError('')
    setSavedNotice('')
    startTransition(async () => {
      const result = await saveFinancialPlan(application.id, {
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
        nikNumber: String(formData.get('nikNumber') ?? ''),
      })
      if (!result.ok) {
        setError(result.message)
      } else {
        setSavedNotice(`Rincian biaya ${application.applicationId} berhasil disimpan.`)
        router.refresh()
      }
    })
  }

  const saveWorkflow = (applicationId: string, status: string, internalNotes: string) => {
    setError('')
    setSavedNotice('')
    startTransition(async () => {
      const result = await updateApplicationWorkflow(applicationId, status, internalNotes)
      if (!result.ok) {
        setError(result.message)
      } else {
        setSavedNotice(`Status & catatan pengajuan berhasil diperbarui.`)
        router.refresh()
      }
    })
  }

  const approveDocument = (applicationId: string, documentIndex: number) => {
    setError('')
    setSavedNotice('')
    startTransition(async () => {
      const result = await approveApplicationDocument(applicationId, documentIndex)
      if (!result.ok) {
        setError(result.message)
      } else {
        setSavedNotice('Status dokumen ditandai Sesuai.')
        router.refresh()
      }
    })
  }

  const removeDocument = (applicationId: string, documentIndex: number) => {
    if (
      !window.confirm(
        'Hapus berkas dokumen ini dari Google Drive? Status dokumen menjadi "Tidak sesuai" dan pemohon perlu mengunggah ulang.',
      )
    ) {
      return
    }
    setError('')
    setSavedNotice('')
    startTransition(async () => {
      const result = await deleteApplicationDocument(applicationId, documentIndex)
      if (!result.ok) {
        setError(result.message)
      } else {
        setSavedNotice('Berkas dokumen dihapus dan status menjadi Tidak sesuai.')
        router.refresh()
      }
    })
  }

  const approvePricing = (applicationId: string, newNominal: number | null) => {
    setError('')
    setSavedNotice('')
    startTransition(async () => {
      const result = await approveApplicationPricing(applicationId, newNominal)
      if (!result.ok) {
        setError(result.message)
      } else {
        setSavedNotice(
          newNominal !== null
            ? `Rincian biaya disetujui dengan nominal baru ${formatRupiah(newNominal)}.`
            : 'Rincian biaya disetujui menjadi Terverifikasi.',
        )
        router.refresh()
      }
    })
  }

  const agreePricing = (applicationId: string) => {
    setError('')
    setSavedNotice('')
    startTransition(async () => {
      const result = await setApplicationPricingAgreed(applicationId)
      if (!result.ok) {
        setError(result.message)
      } else {
        setSavedNotice('Rincian biaya ditandai Disepakati.')
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

  const reliefKey = (applicationId: string, index: number) => `${applicationId}:${index}`

  const saveRelief = (
    app: FinancingApplicationRecord,
    index: number,
    status: string,
    response: string,
  ) => {
    setError('')
    setSavedNotice('')
    startTransition(async () => {
      const result = await updateSupportRequest(app.id, index, status, response)
      if (!result.ok) {
        setError(result.message)
      } else {
        setSavedNotice(`Permohonan keringanan ${app.applicationId} diperbarui.`)
        setReliefEdits((current) => {
          const next = { ...current }
          delete next[reliefKey(app.id, index)]
          return next
        })
        router.refresh()
      }
    })
  }

  const openScheduleDetail = (appId: string) => {
    setActiveMenu('schedule')
    setExpandedScheduleId(appId)
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
      case 'schedule':
        return scheduleRows.length
      case 'relief':
        return metrics.openReliefCount
      case 'audit':
        return auditEntries.length
      default:
        return null
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#f8fafc] text-slate-900 lg:h-dvh lg:flex-row lg:overflow-hidden">
      {/* FIXED 100dvh SIDEBAR */}
      <aside className="flex w-full flex-col justify-between border-b border-slate-200 bg-[#0b57d0] text-white lg:h-dvh lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r lg:border-[#0842a0]">
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
            <p className="truncate text-[10px] font-medium text-blue-300">Admin Backoffice</p>
          </div>
        </div>

        {/* Compact Menu Groups (Fits inside 1 screen height) */}
        <nav
          aria-label="Navigasi utama backoffice"
          className="flex flex-1 flex-wrap gap-2 overflow-y-auto px-3 py-3 lg:flex-col lg:flex-nowrap lg:gap-4"
        >
          {SIDEBAR_GROUPS.map((group) => (
            <div className="w-full space-y-1" key={group.group}>
              <p className="hidden px-2.5 text-[10px] font-bold uppercase tracking-wider text-blue-300/60 lg:block">
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
                          ? 'bg-[#0842a0] font-semibold text-white shadow-2xs ring-1 ring-white/20'
                          : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
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
                              ? 'bg-white text-[#0b57d0]'
                              : item.id === 'installments' && metrics.openReliefCount > 0
                                ? 'bg-amber-400 text-slate-950'
                                : item.id === 'relief' && metrics.openReliefCount > 0
                                  ? 'bg-amber-400 text-slate-950'
                                  : item.id === 'activeInstallments' &&
                                      activeInstallmentMetrics.overdue > 0
                                    ? 'bg-amber-400 text-slate-950'
                                    : 'bg-white/10 text-blue-200'
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
            <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-300">
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
              className="w-52 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 focus:border-[#0b57d0] focus:bg-white focus:outline-none"
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
                  <strong className="mt-1.5 block text-2xl font-extrabold text-[#0b57d0]">
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
                    className="text-xs font-semibold text-[#0b57d0] hover:underline"
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
                            <td className="whitespace-nowrap px-4 py-3 font-bold text-[#0b57d0]">
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
                            <td className="whitespace-nowrap px-4 py-3 font-bold text-[#0b57d0]">
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
                          <td className="whitespace-nowrap px-4 py-3 font-bold text-[#0b57d0]">
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
                            <td className="whitespace-nowrap px-4 py-3 font-bold text-[#0b57d0]">
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
                                onClick={() => openScheduleDetail(app.id)}
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
                  <strong className="mt-1.5 block text-2xl font-extrabold text-[#0b57d0]">
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
                        className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b57d0] ${
                          activeInstallmentFilter === filter.id
                            ? 'bg-[#0b57d0] text-white'
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
                        const overdueDays =
                          summary.nextDue && summary.overdueCount > 0
                            ? getDaysBetween(summary.nextDue.dueDate, todayIso)
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
                                onClick={() => openScheduleDetail(app.id)}
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
                            const overdueDays =
                              summary.nextDue && summary.overdueCount > 0
                                ? getDaysBetween(summary.nextDue.dueDate, todayIso)
                                : 0
                            const progressPercent =
                              summary.schedule.length > 0
                                ? Math.round((summary.paidCount / summary.schedule.length) * 100)
                                : 0
                            return (
                              <tr className="hover:bg-slate-50/80" key={app.id}>
                                <td className="whitespace-nowrap px-4 py-3 font-bold text-[#0b57d0]">
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
                                        className="block h-full rounded-full bg-[#0b57d0]"
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
                                    onClick={() => openScheduleDetail(app.id)}
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

          {/* 7. MENU: JADWAL ANGSURAN (Per-student Schedule & Xendit Detail) */}
          {activeMenu === 'schedule' && (
            <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
              <header className="border-b border-slate-100 px-5 py-3.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Jadwal Cicilan Siswa ({scheduleRows.length})
                </h2>
              </header>
              {scheduleRows.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-slate-400">
                  Belum ada siswa dengan jadwal angsuran.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {scheduleRows.map(({ app, summary }) => {
                    const expanded = expandedScheduleId === app.id
                    const rowPayments = payments.filter(
                      (p) => p.applicationDocId === app.id || p.applicationId === app.applicationId,
                    )
                    const paidSet = new Set(
                      Array.isArray(app.paidInstallments) ? app.paidInstallments : [],
                    )
                    const overdueDays =
                      summary.nextDue && summary.overdueCount > 0
                        ? getDaysBetween(summary.nextDue.dueDate, todayIso)
                        : 0
                    return (
                      <li key={app.id}>
                        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-[#0b57d0]">{app.applicationId}</span>
                              <span className="font-semibold text-slate-900">
                                {app.applicantName}
                              </span>
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
                                  STATUS_BADGE_STYLES[app.status] ??
                                  'bg-slate-100 text-slate-700 ring-slate-200'
                                }`}
                              >
                                {STATUS_LABELS[app.status as keyof typeof STATUS_LABELS] ??
                                  app.status}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {app.lpkName} · {summary.schedule.length} bulan · {summary.paidCount}/
                              {summary.schedule.length} lunas
                              {overdueDays > 0 && (
                                <span className="ml-1.5 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                  Terlambat {overdueDays} hr
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right text-xs">
                              <span className="block text-slate-400">Sisa Kewajiban</span>
                              <strong className="block font-bold text-slate-900">
                                {formatRupiah(summary.remaining)}
                              </strong>
                            </div>
                            <div className="text-right text-xs">
                              <span className="block text-slate-400">Jatuh Tempo</span>
                              <strong className="block font-bold text-slate-900">
                                {summary.nextDue ? formatDateShort(summary.nextDue.dueDate) : '—'}
                              </strong>
                            </div>
                            <DrawerAction
                              ariaLabel={`${expanded ? 'Tutup' : 'Buka'} detail jadwal ${app.applicationId}`}
                              label={expanded ? 'Tutup' : 'Detail'}
                              onClick={() => setExpandedScheduleId(expanded ? null : app.id)}
                            />
                          </div>
                        </div>

                        {expanded && (
                          <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
                            {/* KPI 4 cards */}
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                                <span className="text-[11px] text-slate-400">
                                  Total Kewajiban Akad
                                </span>
                                <strong className="mt-1 block text-lg font-extrabold text-slate-900">
                                  {formatRupiah(summary.obligation)}
                                </strong>
                              </div>
                              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                                <span className="text-[11px] text-slate-400">Total Terbayar</span>
                                <strong className="mt-1 block text-lg font-extrabold text-emerald-600">
                                  {formatRupiah(summary.paidAmount)}
                                </strong>
                                <span className="mt-0.5 block text-[10px] text-slate-400">
                                  {summary.paidCount} dari {summary.schedule.length} cicilan
                                </span>
                              </div>
                              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                                <span className="text-[11px] text-slate-400">Sisa Kewajiban</span>
                                <strong className="mt-1 block text-lg font-extrabold text-[#0b57d0]">
                                  {formatRupiah(summary.remaining)}
                                </strong>
                              </div>
                              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                                <span className="text-[11px] text-slate-400">
                                  Cicilan Berikutnya
                                </span>
                                {summary.nextDue ? (
                                  <>
                                    <strong
                                      className={`mt-1 block text-lg font-extrabold ${overdueDays > 0 ? 'text-red-600' : 'text-slate-900'}`}
                                    >
                                      {formatRupiah(summary.nextDue.amount)}
                                    </strong>
                                    <span
                                      className={`mt-0.5 block text-[10px] ${overdueDays > 0 ? 'font-bold text-red-600' : 'text-slate-400'}`}
                                    >
                                      {formatDateShort(summary.nextDue.dueDate)}
                                      {overdueDays > 0 && ` · Terlambat ${overdueDays} hr`}
                                    </span>
                                  </>
                                ) : (
                                  <strong className="mt-1 block text-lg font-extrabold text-slate-900">
                                    —
                                  </strong>
                                )}
                              </div>
                            </div>

                            {/* Tabel jadwal cicilan */}
                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                              <table className="w-full border-collapse text-left text-xs">
                                <thead>
                                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    <th className="px-4 py-2.5">Cicilan</th>
                                    <th className="px-4 py-2.5">Jatuh Tempo</th>
                                    <th className="px-4 py-2.5 text-right">Nominal</th>
                                    <th className="px-4 py-2.5 text-right">Sisa</th>
                                    <th className="px-4 py-2.5">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {summary.schedule.map((row) => {
                                    const paid = paidSet.has(row.installment)
                                    return (
                                      <tr
                                        className="border-b border-slate-100 last:border-b-0"
                                        key={row.installment}
                                      >
                                        <td className="px-4 py-2.5 font-semibold text-slate-900">
                                          {row.installment}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-600">
                                          {formatDateShort(row.dueDate)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-slate-900">
                                          {formatRupiah(row.amount)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-slate-600">
                                          {paid ? '—' : formatRupiah(row.amount)}
                                        </td>
                                        <td className="px-4 py-2.5">
                                          <span
                                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                              paid
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : row.dueDate < todayIso
                                                  ? 'bg-red-50 text-red-700'
                                                  : 'bg-amber-50 text-amber-700'
                                            }`}
                                          >
                                            {paid
                                              ? 'Lunas'
                                              : row.dueDate < todayIso
                                                ? 'Terlambat'
                                                : 'Belum dibayar'}
                                          </span>
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* Transaksi Xendit */}
                            {rowPayments.length > 0 ? (
                              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                                <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700">
                                  Transaksi Xendit ({rowPayments.length})
                                </div>
                                <table className="w-full border-collapse text-left text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                      <th className="px-4 py-2.5">Keterangan</th>
                                      <th className="px-4 py-2.5 text-right">Nominal</th>
                                      <th className="px-4 py-2.5">Status</th>
                                      <th className="px-4 py-2.5 text-right">Dibayar</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rowPayments.map((payment) => (
                                      <tr
                                        className="border-b border-slate-100 last:border-b-0"
                                        key={payment.id}
                                      >
                                        <td className="px-4 py-2.5 font-medium text-slate-900">
                                          {payment.description || 'Pembayaran'}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-slate-900">
                                          {formatRupiah(payment.amount)}
                                        </td>
                                        <td className="px-4 py-2.5">
                                          <span
                                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 ${
                                              PAYMENT_BADGE_STYLES[payment.status] ??
                                              'bg-slate-100 text-slate-700 ring-slate-200'
                                            }`}
                                          >
                                            {PAYMENT_STATUS_LABELS[payment.status] ??
                                              payment.status}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-slate-600">
                                          {formatDateTime(payment.paidAt)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500">
                                Belum ada transaksi Xendit untuk siswa ini.
                              </p>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )}

          {/* 8. MENU: KERINGANAN (Support Requests Review) */}
          {activeMenu === 'relief' && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                  <span className="text-xs font-medium text-slate-500">Menunggu Tinjauan</span>
                  <strong
                    className={`mt-1.5 block text-2xl font-extrabold ${
                      reliefRows.some((row) => row.request.status === 'OPEN')
                        ? 'text-amber-600'
                        : 'text-slate-900'
                    }`}
                  >
                    {reliefRows.filter((row) => row.request.status === 'OPEN').length}
                  </strong>
                  <span className="mt-1 block text-[11px] text-slate-400">
                    Permohonan berstatus OPEN
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                  <span className="text-xs font-medium text-slate-500">Ditinjau</span>
                  <strong className="mt-1.5 block text-2xl font-extrabold text-emerald-600">
                    {reliefRows.filter((row) => row.request.status === 'REVIEWED').length}
                  </strong>
                  <span className="mt-1 block text-[11px] text-slate-400">
                    Permohonan sudah ditanggapi
                  </span>
                </div>
              </div>

              <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
                <header className="border-b border-slate-100 px-5 py-3.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Permohonan Keringanan ({reliefRows.length})
                  </h2>
                </header>
                {reliefRows.length === 0 ? (
                  <p className="px-5 py-8 text-center text-xs text-slate-400">
                    Belum ada permohonan keringanan masuk.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="px-4 py-2.5">Siswa</th>
                          <th className="px-4 py-2.5">Waktu</th>
                          <th className="px-4 py-2.5">Pesan</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Tanggapan</th>
                          <th className="px-4 py-2.5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reliefRows.map(({ app, request, index }) => {
                          const key = reliefKey(app.id, index)
                          const edit = reliefEdits[key] ?? {
                            status: request.status,
                            response: request.response ?? '',
                          }
                          const unchanged =
                            edit.status === request.status &&
                            edit.response === (request.response ?? '')
                          return (
                            <tr
                              className="border-b border-slate-100 align-top last:border-b-0"
                              key={key}
                            >
                              <td className="px-4 py-3">
                                <span className="font-semibold text-slate-900">
                                  {app.applicantName}
                                </span>
                                <span className="mt-0.5 block text-[11px] text-slate-400">
                                  {app.applicationId}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                                {formatDateTime(request.requestedAt)}
                              </td>
                              <td className="max-w-xs px-4 py-3 text-slate-600">
                                {request.message || '—'}
                              </td>
                              <td className="px-4 py-3">
                                <select
                                  aria-label={`Status permohonan ${app.applicationId}`}
                                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900"
                                  onChange={(event) =>
                                    setReliefEdits((current) => ({
                                      ...current,
                                      [key]: { ...edit, status: event.target.value },
                                    }))
                                  }
                                  value={edit.status}
                                >
                                  <option value="OPEN">Menunggu tinjauan</option>
                                  <option value="REVIEWED">Ditinjau</option>
                                </select>
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  aria-label={`Tanggapan untuk ${app.applicationId}`}
                                  className="w-full min-w-44 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                                  maxLength={1000}
                                  onChange={(event) =>
                                    setReliefEdits((current) => ({
                                      ...current,
                                      [key]: { ...edit, response: event.target.value },
                                    }))
                                  }
                                  placeholder="Tanggapan untuk pemohon…"
                                  value={edit.response}
                                />
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-right">
                                <DrawerAction
                                  ariaLabel={`Simpan tanggapan ${app.applicationId}`}
                                  disabled={pending || unchanged}
                                  label="Simpan"
                                  onClick={() => saveRelief(app, index, edit.status, edit.response)}
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* 9. MENU: STATISTIK (Portfolio Analytics & LPK Partner Table) */}
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

          {/* 10. MENU: LOG AUDIT (Financial Plan History Table) */}
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
                            <span className="font-bold text-[#0b57d0]">
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
                              onClick={() => openApplicationDrawer(item.app.id, 'pricing')}
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
          <div className="h-dvh w-full max-w-6xl shadow-2xl">
            <ApplicationDrawerForm
              activeTab={drawerTab}
              application={drawerApplication}
              error={error}
              key={drawerApplication.id}
              onAgreePricing={agreePricing}
              onApproveDocument={approveDocument}
              onApprovePricing={approvePricing}
              onClose={() => setDrawerAppId(null)}
              onDeleteDocument={removeDocument}
              onDismissError={() => setError('')}
              onDismissSaved={() => setSavedNotice('')}
              onSave={save}
              onUploadAgreement={uploadAgreement}
              onWorkflow={saveWorkflow}
              pending={pending}
              savedNotice={savedNotice}
              setActiveTab={setDrawerTab}
            />
          </div>
        </div>
      )}
    </div>
  )
}
