'use client'

import { useState, useTransition } from 'react'
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { getFirebaseClientAuth } from '@/lib/firebase-client'

export function AdminSignIn() {
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const submit = () => {
    setError('')
    startTransition(async () => {
      const auth = getFirebaseClientAuth()
      try {
        const credential = await signInWithPopup(auth, new GoogleAuthProvider())
        const response = await fetch('/api/admin/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: await credential.user.getIdToken() }),
        })
        if (!response.ok) {
          const result = (await response.json()) as { message?: string }
          setError(result.message ?? 'Akun ini tidak dapat masuk sebagai staf.')
          return
        }
        router.refresh()
      } catch {
        setError(
          'Tidak dapat masuk dengan Google. Pastikan Firebase Authentication telah dikonfigurasi.',
        )
      } finally {
        if (auth.currentUser) await signOut(auth)
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
          <p className="text-sm font-semibold text-[#17158c]">VentureGo</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Masuk staf</h1>
          <p className="mt-2 text-sm text-slate-600">
            Masuk menggunakan akun Google yang telah diberi akses staf.
          </p>
        </div>
        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <button
          className="w-full rounded-lg bg-[#17158c] px-4 py-3 font-semibold text-white disabled:opacity-60"
          disabled={pending}
        >
          {pending ? 'Memeriksa akun…' : 'Masuk dengan Google'}
        </button>
      </form>
    </main>
  )
}
