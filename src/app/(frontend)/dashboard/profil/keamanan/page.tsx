'use client'

import { useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth'
import { getFirebaseClientAuth } from '@/lib/firebase-client'
import { DashboardCard, DashboardIcon, DashboardScaffold } from '../../_components/dashboard-ui'

const formatDate = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function AccountSecurityPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'verify' | 'reset' | ''>('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const unsubscribe = onAuthStateChanged(getFirebaseClientAuth(), (value) => {
      if (!active) return
      setUser(value)
      setLoading(false)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const providerId = user?.providerData[0]?.providerId ?? ''
  const isGoogle = providerId === 'google.com'
  const isPassword = providerId === 'password'

  const verifyEmail = async () => {
    if (!user) return
    setBusy('verify')
    setNotice('')
    setError('')
    try {
      await sendEmailVerification(user)
      setNotice(`Email verifikasi dikirim ke ${user.email}.`)
    } catch {
      setError('Email verifikasi belum dapat dikirim. Coba lagi beberapa saat.')
    } finally {
      setBusy('')
    }
  }

  const resetPassword = async () => {
    if (!user?.email) return
    setBusy('reset')
    setNotice('')
    setError('')
    try {
      await sendPasswordResetEmail(getFirebaseClientAuth(), user.email)
      setNotice('Tautan ubah kata sandi dikirim ke email Anda.')
    } catch {
      setError('Tautan ubah kata sandi belum dapat dikirim. Coba lagi beberapa saat.')
    } finally {
      setBusy('')
    }
  }

  const rows: { label: string; value: string }[] = [
    { label: 'Email', value: user?.email ?? '—' },
    {
      label: 'Cara masuk',
      value: isGoogle ? 'Google' : isPassword ? 'Email & kata sandi' : '—',
    },
    {
      label: 'Status email',
      value: user?.emailVerified ? 'Terverifikasi' : 'Belum terverifikasi',
    },
    { label: 'Terdaftar', value: formatDate(user?.metadata.creationTime) },
    { label: 'Terakhir masuk', value: formatDate(user?.metadata.lastSignInTime) },
  ]

  return (
    <DashboardScaffold
      active="profil"
      backHref="/dashboard/profil"
      subtitle="Email, verifikasi, dan kata sandi"
      title="Keamanan Akun"
    >
      {notice && (
        <p
          className="rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800"
          role="status"
        >
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-700" role="alert">
          {error}
        </p>
      )}

      <DashboardCard>
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-sm font-bold text-slate-900">Akun Anda</h2>
        </div>
        <dl className="grid grid-cols-2 gap-px bg-slate-100 text-xs">
          {rows.map((row, index) => (
            <div
              className={`bg-white p-4 ${index === rows.length - 1 && rows.length % 2 === 1 ? 'col-span-2' : ''}`}
              key={row.label}
            >
              <dt className="text-slate-400">{row.label}</dt>
              <dd className="mt-1 truncate font-semibold text-slate-800">{row.value}</dd>
            </div>
          ))}
        </dl>
      </DashboardCard>

      <DashboardCard className="p-4">
        <div className="flex items-start gap-3">
          <span
            className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
              user?.emailVerified ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'
            }`}
          >
            <DashboardIcon name={user?.emailVerified ? 'check' : 'mail'} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-slate-900">Verifikasi email</h2>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              {user?.emailVerified
                ? 'Email Anda sudah terverifikasi.'
                : 'Kirim email verifikasi untuk mengonfirmasi alamat email akun ini.'}
            </p>
            {!user?.emailVerified && (
              <button
                className="mt-3 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
                disabled={busy !== '' || loading}
                onClick={() => void verifyEmail()}
                type="button"
              >
                {busy === 'verify' ? 'Mengirim…' : 'Kirim email verifikasi'}
              </button>
            )}
          </div>
        </div>
      </DashboardCard>

      <DashboardCard className="p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-[var(--primary)]">
            <DashboardIcon name="lock" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-slate-900">Kata sandi</h2>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              {isGoogle
                ? 'Akun ini masuk melalui Google — kata sandi dikelola di Akun Google Anda.'
                : isPassword
                  ? 'Kirim tautan ubah kata sandi ke email Anda; tautan berlaku terbatas.'
                  : 'Informasi kata sandi tidak tersedia untuk metode masuk ini.'}
            </p>
            {isPassword && (
              <button
                className="mt-3 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                disabled={busy !== '' || loading}
                onClick={() => void resetPassword()}
                type="button"
              >
                {busy === 'reset' ? 'Mengirim…' : 'Kirim tautan ubah kata sandi'}
              </button>
            )}
          </div>
        </div>
      </DashboardCard>
    </DashboardScaffold>
  )
}
