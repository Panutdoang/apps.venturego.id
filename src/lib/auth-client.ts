'use client'

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { getFirebaseClientAuth } from './firebase-client'
import { DEMO_ACCOUNTS, type DemoRole } from './demo-accounts'

export const isGoogleAccount = (user: User | null): user is User =>
  Boolean(user?.providerData.some((entry) => entry.providerId === 'google.com'))

export const isAppAccount = (user: User | null): user is User =>
  Boolean(
    user?.providerData.some(
      (entry) =>
        entry.providerId === 'google.com' ||
        (process.env.NODE_ENV !== 'production' && entry.providerId === 'password'),
    ),
  )

export async function signInWithGoogleAccount(): Promise<User> {
  const auth = getFirebaseClientAuth()
  const current = auth.currentUser
  if (isGoogleAccount(current)) return current
  if (current) await signOut(auth)
  const credential = await signInWithPopup(auth, new GoogleAuthProvider())
  return credential.user
}

export async function ensureApplicantAccount(): Promise<User> {
  const auth = getFirebaseClientAuth()
  const current = auth.currentUser
  if (isAppAccount(current)) return current
  return signInWithGoogleAccount()
}

export async function signInWithDemoAccount(role: DemoRole): Promise<User> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Akun demo hanya tersedia di mode lokal.')
  }
  const auth = getFirebaseClientAuth()
  if (auth.currentUser) await signOut(auth)
  const account = DEMO_ACCOUNTS[role]
  try {
    const credential = await signInWithEmailAndPassword(auth, account.email, account.password)
    return credential.user
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code !== 'auth/user-not-found' && code !== 'auth/invalid-credential') {
      throw error
    }
    const created = await createUserWithEmailAndPassword(auth, account.email, account.password)
    await updateProfile(created.user, {
      displayName: role === 'admin' ? 'Admin Demo' : 'User Demo',
    }).catch(() => {})
    return created.user
  }
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
