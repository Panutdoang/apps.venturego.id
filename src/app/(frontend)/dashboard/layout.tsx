'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { getFirebaseClientAuth } from '@/lib/firebase-client'
import { isGoogleAccount, resolveUserDestination } from '@/lib/auth-client'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = onAuthStateChanged(getFirebaseClientAuth(), async (user) => {
        if (!active) return
        if (!isGoogleAccount(user)) {
          router.replace('/')
          return
        }
        const destination = await resolveUserDestination(user)
        if (!active) return
        if (destination === '/admin') {
          router.replace('/admin')
          return
        }
        setReady(true)
      })
    } catch {
      router.replace('/')
    }
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [router])

  if (!ready) {
    return (
      <main className="dashboard-app min-h-dvh bg-[var(--canvas)]">
        <div className="mx-auto flex min-h-dvh w-full max-w-[430px] items-center justify-center bg-[#f8f9fd] px-5">
          <p className="text-sm text-slate-500" role="status">
            Memuat akun…
          </p>
        </div>
      </main>
    )
  }

  return <>{children}</>
}
