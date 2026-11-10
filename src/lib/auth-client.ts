'use client'

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithCredential,
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

// ---------------------------------------------------------------------------
// Login Google langsung (Google Identity Services).
// Popup dibuka oleh accounts.google.com dari domain kita sendiri, sehingga
// pengguna melihat "lanjutkan ke VentureGo" — bukan alamat firebaseapp.com.
// Token Google lalu diserahkan ke Firebase Auth di balik layar, jadi UID,
// data siswa (ownerFirebaseUid), dan sesi admin tetap sama seperti sebelumnya.
// Bila NEXT_PUBLIC_GOOGLE_CLIENT_ID belum diisi, kembali ke popup Firebase.
// ---------------------------------------------------------------------------

type GoogleTokenResponse = { access_token?: string; error?: string }
type GoogleTokenClient = { requestAccessToken: () => void }
type GoogleIdentity = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string
        scope: string
        prompt?: string
        callback: (response: GoogleTokenResponse) => void
        error_callback?: (error: { type: string }) => void
      }) => GoogleTokenClient
    }
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''
const GOOGLE_IDENTITY_SRC = 'https://accounts.google.com/gsi/client'
let googleIdentityPromise: Promise<GoogleIdentity> | null = null

const readGoogleIdentity = () =>
  (window as unknown as { google?: GoogleIdentity }).google?.accounts?.oauth2
    ? (window as unknown as { google: GoogleIdentity }).google
    : null

/** Muat skrip Google lebih awal agar popup terbuka langsung saat tombol ditekan. */
export function preloadGoogleSignIn(): Promise<GoogleIdentity> | null {
  if (!GOOGLE_CLIENT_ID || typeof window === 'undefined') return null
  const loaded = readGoogleIdentity()
  if (loaded) return Promise.resolve(loaded)
  googleIdentityPromise ??= new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GOOGLE_IDENTITY_SRC
    script.async = true
    script.onload = () => {
      const google = readGoogleIdentity()
      if (google) resolve(google)
      else reject(Object.assign(new Error('Google tidak tersedia'), { code: 'gis/unavailable' }))
    }
    script.onerror = () => {
      googleIdentityPromise = null
      reject(Object.assign(new Error('Google tidak dapat dimuat'), { code: 'gis/load-failed' }))
    }
    document.head.appendChild(script)
  })
  return googleIdentityPromise
}

const requestGoogleAccessToken = (google: GoogleIdentity) =>
  new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      prompt: 'select_account',
      callback: (response) => {
        if (response.access_token) resolve(response.access_token)
        else reject(Object.assign(new Error('Login dibatalkan'), { code: `gis/${response.error}` }))
      },
      // popup_closed = pengguna menutup popup; popup_failed_to_open = diblokir browser
      error_callback: (error) =>
        reject(Object.assign(new Error('Login dibatalkan'), { code: `gis/${error.type}` })),
    })
    client.requestAccessToken()
  })

export async function signInWithGoogleAccount(): Promise<User> {
  const auth = getFirebaseClientAuth()
  const current = auth.currentUser
  if (isGoogleAccount(current)) return current
  if (current) await signOut(auth)

  const googleIdentity = preloadGoogleSignIn()
  if (!googleIdentity) {
    const credential = await signInWithPopup(auth, new GoogleAuthProvider())
    return credential.user
  }
  const accessToken = await requestGoogleAccessToken(await googleIdentity)
  const credential = await signInWithCredential(
    auth,
    GoogleAuthProvider.credential(null, accessToken),
  )
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
