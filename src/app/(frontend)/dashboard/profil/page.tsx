'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { getFirebaseClientAuth } from '@/lib/firebase-client'
import {
  DashboardCard,
  DashboardIcon,
  DashboardMenuRow,
  DashboardScaffold,
} from '../_components/dashboard-ui'

export default function ProfilePage() {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [error, setError] = useState('')
  const [account, setAccount] = useState<{
    name: string
    email: string
    method: 'Google' | 'Email & Password'
  } | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseClientAuth(), (user) => {
      if (!user) return
      const isPassword = user.providerData.some((entry) => entry.providerId === 'password')
      setAccount({
        name: user.displayName?.trim() || 'Pengguna',
        email: user.email ?? '',
        method: isPassword ? 'Email & Password' : 'Google',
      })
    })
    return () => unsubscribe()
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

  return (
    <DashboardScaffold active="profil" subtitle="Kelola akun dan keamanan" title="Profil saya">
      <DashboardCard>
        <div className="flex items-center gap-4 p-5">
          <span className="grid size-16 place-items-center rounded-full bg-indigo-50 text-[var(--primary)]">
            <DashboardIcon name="profile" className="size-8" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-slate-900">{account?.name ?? 'Memuat…'}</h2>
            <p className="mt-1 text-xs text-slate-500">{account?.email || 'Akun Google'}</p>
          </div>
          <span className="grid size-9 place-items-center rounded-full bg-slate-100 text-slate-500">
            <DashboardIcon name="edit" className="size-4" />
          </span>
        </div>
        <div className="grid grid-cols-2 border-t border-slate-100">
          <div className="p-4">
            <span className="text-[10px] text-slate-400">Email</span>
            <strong className="mt-1 block truncate text-xs text-slate-700">
              {account?.email || '—'}
            </strong>
          </div>
          <div className="border-l border-slate-100 p-4">
            <span className="text-[10px] text-slate-400">Metode masuk</span>
            <strong className="mt-1 block text-xs text-slate-700">
              {account?.method ?? 'Google'}
            </strong>
          </div>
        </div>
      </DashboardCard>

      <section>
        <h2 className="mb-3 text-sm font-bold text-slate-900">Akun</h2>
        <DashboardCard>
          <DashboardMenuRow
            detail="Data identitas dan kontak"
            href="/dashboard/profil"
            icon="profile"
            title="Informasi pribadi"
          />
          <DashboardMenuRow
            detail="Akad dan ringkasan pembiayaan"
            href="/dashboard/dokumen"
            icon="document"
            title="Dokumen saya"
          />
          <DashboardMenuRow
            detail="PIN dan perlindungan akun"
            href="/dashboard/profil"
            icon="lock"
            title="Keamanan"
          />
        </DashboardCard>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-slate-900">Dukungan</h2>
        <DashboardCard>
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

      <p className="text-center text-[10px] text-slate-400">VentureGo VSV • Versi demo 1.0</p>
    </DashboardScaffold>
  )
}
