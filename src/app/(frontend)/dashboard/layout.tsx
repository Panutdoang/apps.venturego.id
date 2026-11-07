'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { getFirebaseClientAuth } from '@/lib/firebase-client'
import { isAppAccount, resolveUserDestination } from '@/lib/auth-client'
import { DashboardPageSkeleton } from './_components/dashboard-ui'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = onAuthStateChanged(getFirebaseClientAuth(), async (user) => {
        if (!active) return
        if (!isAppAccount(user)) {
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
    return <DashboardPageSkeleton />
  }

  return <>{children}</>
}
