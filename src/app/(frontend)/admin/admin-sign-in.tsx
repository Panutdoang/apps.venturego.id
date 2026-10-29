'use client'

import { useState, useTransition } from 'react'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { getFirebaseClientAuth } from '@/lib/firebase-client'

export function AdminSignIn() {
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const submit = (formData: FormData) => {
    setError('')
    startTransition(async () => {
      try {
        const auth = getFirebaseClientAuth()
        const credential = await signInWithEmailAndPassword(
          auth,
          String(formData.get('email') ?? '').trim(),
          String(formData.get('password') ?? ''),
        )
        const response = await fetch('/api/admin/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: await credential.user.getIdToken() }),
        })
        await signOut(auth)
        if (!response.ok) {
          const result = (await response.json()) as { message?: string }
          setError(result.message ?? 'Akun ini tidak dapat masuk sebagai staf.')
          return
        }
        router.refresh()
      } catch {
        setError('Email atau kata sandi tidak valid, atau Firebase belum dikonfigurasi.')
      }
    })
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-5 py-12">
      <form
        action={submit}
        className="w-full space-y-5 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
      >
        <div>
          <p className="text-sm font-semibold text-indigo-700">VentureGo</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Masuk staf</h1>
          <p className="mt-2 text-sm text-slate-600">
            Gunakan akun staf yang terdaftar di Firebase Authentication.
          </p>
        </div>
        <label className="block space-y-1 text-sm font-medium text-slate-700">
          Email
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            name="email"
            type="email"
            autoComplete="username"
            required
          />
        </label>
        <label className="block space-y-1 text-sm font-medium text-slate-700">
          Kata sandi
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <button
          className="w-full rounded-lg bg-indigo-700 px-4 py-3 font-semibold text-white disabled:opacity-60"
          disabled={pending}
        >
          {pending ? 'Memeriksa…' : 'Masuk'}
        </button>
      </form>
    </main>
  )
}
