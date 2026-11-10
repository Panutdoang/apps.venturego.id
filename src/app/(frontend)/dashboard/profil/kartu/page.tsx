'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { getFirebaseClientAuth } from '@/lib/firebase-client'
import { getStudentNumber, getUserActivityFeed, type UserApplicationDetail } from '../../actions'
import { DashboardCard, DashboardScaffold, SkeletonBlock } from '../../_components/dashboard-ui'

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Pengajuan terkirim',
  ELIGIBILITY_REVIEW: 'Tinjauan kelayakan',
  DOCUMENT_REVIEW: 'Berkas diperiksa',
  REVISION_REQUIRED: 'Perlu revisi berkas',
  COST_VERIFICATION: 'Rincian biaya disusun',
  APPROVED: 'Pengajuan disetujui',
  CONTRACT_PREPARATION: 'Persiapan akad',
  ACTIVE: 'Pembiayaan aktif',
  COMPLETED: 'Program selesai',
  REJECTED: 'Belum disetujui',
  CANCELLED: 'Dibatalkan',
}

export default function StudentCardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [studentNumber, setStudentNumber] = useState('')
  const [studentNumberError, setStudentNumberError] = useState('')
  const [applications, setApplications] = useState<UserApplicationDetail[]>([])

  const application = applications[0] ?? null

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
        const [feed, studentProfile] = await Promise.all([
          getUserActivityFeed(token),
          getStudentNumber(token),
        ])
        if (!active) return
        if (feed.ok) {
          setApplications(feed.applications)
          setError('')
        } else {
          setError(feed.message)
        }
        if (studentProfile.ok) {
          setStudentNumber(studentProfile.studentNumber)
          setStudentNumberError('')
        } else {
          setStudentNumberError(studentProfile.message)
        }
      } catch {
        if (active) setError('Kartu belum dapat dimuat. Silakan coba lagi.')
      } finally {
        if (active) setLoading(false)
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const displayName = application?.applicantName || '—'
  const statusLabel = application ? (STATUS_LABELS[application.status] ?? application.status) : ''

  return (
    <DashboardScaffold
      active="profil"
      backHref="/dashboard/profil"
      subtitle="Kartu ringkas NIS VSV"
      title="Kartu Identitas Siswa"
    >
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-700" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <DashboardCard className="p-5">
          <div aria-label="Memuat kartu" className="space-y-3" role="status">
            <span className="sr-only">Memuat kartu…</span>
            <SkeletonBlock className="h-3 w-1/2" />
            <SkeletonBlock className="h-7 w-40" />
            <SkeletonBlock className="h-4 w-2/3" />
            <SkeletonBlock className="h-4 w-1/2" />
          </div>
        </DashboardCard>
      ) : (
        <div
          className="overflow-hidden rounded-3xl brand-card text-white shadow-[0_12px_32px_rgba(11,87,208,0.28)]"
          id="student-card"
        >
          <div className="flex items-center justify-between border-b border-white/15 px-5 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200">
                Vworks Student Venture
              </p>
              <p className="mt-1 text-sm font-bold">Kartu Identitas Siswa</p>
            </div>
            <span className="grid size-10 place-items-center rounded-xl bg-white/15 text-sm font-black">
              VSV
            </span>
          </div>

          <div className="px-5 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-200">
              Nomor Induk Siswa
            </p>
            <p className="mt-1 text-2xl font-black tracking-widest">
              {studentNumber || 'Belum tersedia'}
            </p>
            {!studentNumber && !loading && !studentNumberError && (
              <p className="mt-1 text-[10px] text-blue-200">
                Terbit setelah pengajuan berstatus Aktif.
              </p>
            )}
            {studentNumberError && (
              <p className="mt-1 text-[10px] text-amber-200">Nomor belum dapat dimuat.</p>
            )}

            <div className="mt-5 grid grid-cols-2 gap-4 text-xs">
              <div className="min-w-0">
                <p className="text-[10px] text-blue-200">Nama siswa</p>
                <p className="mt-1 truncate font-bold">{displayName}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-blue-200">LPK</p>
                <p className="mt-1 truncate font-bold">{application?.lpkName || '—'}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-blue-200">Program</p>
                <p className="mt-1 truncate font-bold">
                  {application
                    ? `${application.product === 'FULL_COVER' ? 'Full Cover' : 'Dana Keberangkatan'} · ${
                        application.destination === 'TURKEY' ? 'Turki' : 'Jepang'
                      }`
                    : '—'}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-blue-200">Status</p>
                <p className="mt-1 truncate font-bold">{statusLabel || '—'}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/15 px-5 py-3 text-[10px] text-blue-200">
            <span>{application?.applicationId ?? '—'}</span>
            <span>venturego.id</span>
          </div>
        </div>
      )}

      <p className="text-[11px] leading-5 text-slate-500">
        Tunjukkan kartu ini kepada LPK atau tim VSV sebagai bukti keterdaftarannya. Gunakan tombol
        di bawah untuk mencetak salinan fisik.
      </p>

      <button
        className="w-full rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
        disabled={loading}
        onClick={() => window.print()}
        type="button"
      >
        Cetak kartu
      </button>
    </DashboardScaffold>
  )
}
