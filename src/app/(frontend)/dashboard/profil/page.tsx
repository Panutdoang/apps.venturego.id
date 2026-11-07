'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { getFirebaseClientAuth } from '@/lib/firebase-client'
import { getUserActivityFeed, type UserApplicationDetail } from '../actions'
import {
  DashboardCard,
  DashboardIcon,
  DashboardMenuRow,
  DashboardScaffold,
  SkeletonBlock,
} from '../_components/dashboard-ui'

export default function ProfilePage() {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [error, setError] = useState('')
  const [account, setAccount] = useState<{
    name: string
    email: string
    method: 'Google' | 'Email & Password'
  } | null>(null)
  const [latestApp, setLatestApp] = useState<UserApplicationDetail | null>(null)

  useEffect(() => {
    let active = true
    const unsubscribe = onAuthStateChanged(getFirebaseClientAuth(), async (user) => {
      if (!user || !active) {
        if (active) setProfileLoading(false)
        return
      }
      const isPassword = user.providerData.some((entry) => entry.providerId === 'password')
      setAccount({
        name: user.displayName?.trim() || 'Pengguna',
        email: user.email ?? '',
        method: isPassword ? 'Email & Password' : 'Google',
      })
      try {
        const token = await user.getIdToken()
        if (!active) return
        const feed = await getUserActivityFeed(token)
        if (active && feed.ok) {
          setLatestApp(feed.applications[0] ?? null)
        }
      } catch {
        // Keep Firebase Auth profile info if feed fails
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

  const displayName = latestApp?.applicantName || account?.name || ''

  return (
    <DashboardScaffold active="profil" subtitle="Kelola akun dan identitas" title="Profil saya">
      <DashboardCard>
        <div className="flex items-center gap-4 p-5">
          <span className="grid size-16 place-items-center rounded-full bg-indigo-50 text-[var(--primary)]">
            <DashboardIcon name="profile" className="size-8" />
          </span>
          <div className="min-w-0 flex-1">
            {profileLoading ? (
              <div aria-label="Memuat profil" className="space-y-2" role="status">
                <span className="sr-only">Memuat profil…</span>
                <SkeletonBlock className="h-5 w-36" />
                <SkeletonBlock className="h-3 w-44" />
              </div>
            ) : (
              <>
                <h2 className="truncate text-lg font-bold text-slate-900">{displayName}</h2>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {account?.email || 'Akun Terautentikasi'}
                </p>
              </>
            )}
            {latestApp && (
              <span className="mt-1.5 inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-[var(--primary)]">
                {latestApp.applicationId} · {latestApp.lpkName}
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-slate-100">
          <div className="p-4">
            <span className="text-[10px] text-slate-400">Email</span>
            <strong className="mt-1 block truncate text-xs text-slate-700">
              {profileLoading ? <SkeletonBlock className="h-3 w-28" /> : account?.email || '—'}
            </strong>
          </div>
          <div className="border-l border-slate-100 p-4">
            <span className="text-[10px] text-slate-400">Metode masuk</span>
            <strong className="mt-1 block text-xs text-slate-700">
              {profileLoading ? (
                <SkeletonBlock className="h-3 w-24" />
              ) : (
                (account?.method ?? 'Google')
              )}
            </strong>
          </div>
        </div>
      </DashboardCard>

      {profileLoading ? (
        <DashboardCard>
          <div aria-label="Memuat data identitas" className="space-y-4 p-4" role="status">
            <span className="sr-only">Memuat data identitas…</span>
            <SkeletonBlock className="h-3 w-40" />
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-4/5" />
            <SkeletonBlock className="h-12 w-full" />
          </div>
        </DashboardCard>
      ) : latestApp ? (
        <section>
          <h2 className="mb-3 text-sm font-bold text-slate-900">Data identitas pengajuan</h2>
          <DashboardCard className="divide-y divide-slate-100 text-xs">
            <div className="flex justify-between px-4 py-3">
              <span className="text-slate-400">Nomor WhatsApp</span>
              <strong className="text-slate-800">{latestApp.phone || '—'}</strong>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-slate-400">LPK & Tujuan</span>
              <strong className="text-slate-800">
                {latestApp.lpkName} · {latestApp.destination === 'JAPAN' ? 'Jepang' : 'Turki'}
              </strong>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-slate-400">Tempat, tanggal lahir</span>
              <strong className="text-slate-800">
                {latestApp.personalDetails.birthPlace || '—'}
                {latestApp.personalDetails.birthDate
                  ? `, ${latestApp.personalDetails.birthDate}`
                  : ''}
              </strong>
            </div>
            <div className="px-4 py-3">
              <span className="block text-slate-400">Alamat korespondensi</span>
              <strong className="mt-1 block leading-5 text-slate-800">
                {latestApp.personalDetails.domicileAddress ||
                  latestApp.personalDetails.idCardAddress ||
                  '—'}
                {latestApp.personalDetails.domicilePostalCode
                  ? ` (${latestApp.personalDetails.domicilePostalCode})`
                  : ''}
              </strong>
            </div>
          </DashboardCard>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-bold text-slate-900">Akses cepat</h2>
        <DashboardCard>
          <DashboardMenuRow
            detail="Berkas persyaratan dan ringkasan akad"
            href="/dashboard/dokumen"
            icon="document"
            title="Dokumen saya"
          />
          <DashboardMenuRow
            detail="Unggah atau perbarui berkas persyaratan"
            href="/dashboard/unggah-berkas"
            icon="plus"
            title="Unggah berkas"
          />
          <DashboardMenuRow
            detail="Hubungi tim layanan VSV"
            href="/dashboard/bantuan"
            icon="help"
            title="Pusat bantuan"
          />
        </DashboardCard>
      </section>

      {error && (
        <p className="text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        className="w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
        disabled={isLoggingOut}
        onClick={logout}
        type="button"
      >
        {isLoggingOut ? 'Keluar…' : 'Keluar'}
      </button>

      <p className="text-center text-[10px] text-slate-400">VentureGo VSV</p>
    </DashboardScaffold>
  )
}
