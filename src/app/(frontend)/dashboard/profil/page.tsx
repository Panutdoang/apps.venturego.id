'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { getFirebaseClientAuth } from '@/lib/firebase-client'
import { getStudentNumber, getUserActivityFeed, type UserApplicationDetail } from '../actions'
import {
  DashboardCard,
  DashboardIcon,
  DashboardMenuRow,
  DashboardScaffold,
  SkeletonBlock,
  type DashboardIconName,
} from '../_components/dashboard-ui'

const PROFILE_MENU: { href: string; label: string; detail: string; icon: DashboardIconName }[] = [
  {
    href: '/dashboard/profil/data-diri',
    label: 'Data Diri',
    detail: 'Nama, kontak, dan alamat sesuai KTP',
    icon: 'profile',
  },
  {
    href: '/dashboard/profil/dokumen',
    label: 'Dokumen Saya',
    detail: 'PDF Akad Wakalah bil Ujrah',
    icon: 'document',
  },
  {
    href: '/dashboard/profil/akad',
    label: 'Akad Wakalah bil Ujrah',
    detail: 'Penjelasan skema dan istilah akad',
    icon: 'receipt',
  },
  {
    href: '/dashboard/profil/keamanan',
    label: 'Keamanan Akun',
    detail: 'Verifikasi email dan kata sandi',
    icon: 'lock',
  },
  {
    href: '/dashboard/profil/persetujuan',
    label: 'Kebijakan & Persetujuan',
    detail: 'Salinan persetujuan dan kebijakan data',
    icon: 'check',
  },
  {
    href: '/dashboard/profil/kartu',
    label: 'Kartu Identitas Siswa',
    detail: 'Kartu ringkas NIS untuk dicetak',
    icon: 'card',
  },
  {
    href: '/dashboard/profil/tentang',
    label: 'Tentang Aplikasi',
    detail: 'Identitas, situs, dan kontak',
    icon: 'info',
  },
  {
    href: '/dashboard/bantuan',
    label: 'Pusat Bantuan',
    detail: 'FAQ dan kontak layanan',
    icon: 'help',
  },
]

export default function ProfilePage() {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [error, setError] = useState('')
  const [studentNumberError, setStudentNumberError] = useState('')
  const [account, setAccount] = useState<{
    name: string
    email: string
    emailVerified: boolean
    photoUrl: string
  } | null>(null)
  const [studentNumber, setStudentNumber] = useState('')
  const [applications, setApplications] = useState<UserApplicationDetail[]>([])
  const [photoFailed, setPhotoFailed] = useState(false)

  useEffect(() => {
    let active = true
    const unsubscribe = onAuthStateChanged(getFirebaseClientAuth(), async (user) => {
      if (!user || !active) {
        if (active) setProfileLoading(false)
        return
      }
      const photoUrl = user.photoURL?.startsWith('https://') ? user.photoURL : ''
      setAccount({
        name: user.displayName?.trim() || 'Pengguna',
        email: user.email ?? '',
        emailVerified: user.emailVerified,
        photoUrl,
      })
      setPhotoFailed(false)
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
        if (active) setError('Data profil belum dapat dimuat. Silakan coba lagi.')
      } finally {
        if (active) setProfileLoading(false)
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const logout = async () => {
    setIsLoggingOut(true)
    setError('')
    try {
      await signOut(getFirebaseClientAuth())
      router.replace('/')
    } catch {
      setError('Tidak dapat keluar saat ini. Silakan coba lagi.')
      setIsLoggingOut(false)
    }
  }

  const firstApplication = applications[0] ?? null
  const displayName = firstApplication?.applicantName || account?.name || 'Pengguna'

  return (
    <DashboardScaffold active="profil" showHeader={false} title="Profil saya">
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-700" role="alert">
          {error}
        </p>
      )}

      <DashboardCard>
        <div className="flex items-center gap-4 p-5">
          {account?.photoUrl && !photoFailed ? (
            <Image
              alt={`Foto profil ${displayName}`}
              className="size-16 shrink-0 rounded-full object-cover ring-2 ring-indigo-100"
              height={64}
              onError={() => setPhotoFailed(true)}
              src={account.photoUrl}
              unoptimized
              width={64}
            />
          ) : (
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-indigo-50 text-[var(--primary)]">
              <DashboardIcon name="profile" className="size-8" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            {profileLoading ? (
              <div aria-label="Memuat profil" className="space-y-2" role="status">
                <span className="sr-only">Memuat profil…</span>
                <SkeletonBlock className="h-5 w-36" />
                <SkeletonBlock className="h-4 w-36 rounded-full" />
              </div>
            ) : (
              <>
                <h1 className="truncate text-lg font-bold text-slate-900">{displayName}</h1>
                {account?.email && (
                  <p className="mt-1 truncate text-xs text-slate-500">{account.email}</p>
                )}
              </>
            )}
            {firstApplication && (
              <span className="mt-1.5 inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-[var(--primary)]">
                {firstApplication.applicationId} · {firstApplication.lpkName}
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-slate-100">
          <div className="p-4">
            <span className="text-[10px] text-slate-400">Nomor Induk Siswa VSV</span>
            {profileLoading ? (
              <SkeletonBlock className="mt-2 h-4 w-32" />
            ) : (
              <>
                <strong className="mt-1 block truncate text-sm font-bold tracking-wide text-[var(--primary)]">
                  {studentNumber || 'Belum tersedia'}
                </strong>
                {!studentNumber && (
                  <span className="mt-1 block text-[10px] leading-4 text-slate-400">
                    Terbit setelah pengajuan berstatus Aktif.
                  </span>
                )}
              </>
            )}
            {studentNumberError && !profileLoading && (
              <span className="mt-1 block text-[10px] leading-4 text-amber-700">
                Nomor belum dapat dimuat. Coba segarkan halaman.
              </span>
            )}
          </div>
          <div className="border-l border-slate-100 p-4">
            <span className="text-[10px] text-slate-400">Status Akun</span>
            {profileLoading ? (
              <SkeletonBlock className="mt-2 h-5 w-24 rounded-full" />
            ) : (
              <span
                className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  account?.emailVerified
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-800'
                }`}
              >
                {account?.emailVerified ? 'Terverifikasi' : 'Belum terverifikasi'}
              </span>
            )}
          </div>
        </div>
      </DashboardCard>

      <section>
        <h2 className="mb-3 text-sm font-bold text-slate-900">Menu profil</h2>
        <DashboardCard>
          {PROFILE_MENU.map((item) => (
            <DashboardMenuRow
              detail={item.detail}
              href={item.href}
              icon={item.icon}
              key={item.href}
              title={item.label}
            />
          ))}
        </DashboardCard>
      </section>

      <section className="border-t border-slate-200 pt-4">
        <button
          className="w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
          disabled={isLoggingOut}
          onClick={logout}
          type="button"
        >
          {isLoggingOut ? 'Keluar…' : 'Keluar dari akun'}
        </button>
      </section>
    </DashboardScaffold>
  )
}
