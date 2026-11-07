'use client'

import { GoogleAuthProvider, signInWithPopup, signOut, type User } from 'firebase/auth'
import { getFirebaseClientAuth } from './firebase-client'

export const isGoogleAccount = (user: User | null): user is User =>
  Boolean(user?.providerData.some((entry) => entry.providerId === 'google.com'))

export async function signInWithGoogleAccount(): Promise<User> {
  const auth = getFirebaseClientAuth()
  const current = auth.currentUser
  if (isGoogleAccount(current)) return current
  if (current) await signOut(auth)
  const credential = await signInWithPopup(auth, new GoogleAuthProvider())
  return credential.user
}

export async function establishAdminSession(user: User): Promise<boolean> {
  try {
    const response = await fetch('/api/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: await user.getIdToken() }),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function resolveUserDestination(user: User): Promise<'/admin' | '/dashboard'> {
  return (await establishAdminSession(user)) ? '/admin' : '/dashboard'
}
