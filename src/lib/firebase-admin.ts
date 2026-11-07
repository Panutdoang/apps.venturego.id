import 'server-only'

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { normalizeEmail, PRIMARY_STAFF_EMAIL } from './auth-shared'
import { DEMO_ADMIN_EMAIL } from './demo-accounts'

const APP_NAME = 'venturego-cloud'

const getAdminApp = () => {
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST
  delete process.env.FIRESTORE_EMULATOR_HOST

  const projectId =
    process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID !== 'demo-venturego-local'
      ? process.env.FIREBASE_PROJECT_ID
      : process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId) {
    throw new Error('Firebase project configuration is missing.')
  }
  if (!clientEmail || !privateKey) {
    throw new Error('Firebase Admin credentials are not configured.')
  }

  const existingApp = getApps().find((app) => app.name === APP_NAME)
  if (existingApp) return existingApp

  return initializeApp(
    {
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    },
    APP_NAME,
  )
}

export const getFirebaseAuth = () => getAuth(getAdminApp())
export const getFirebaseFirestore = () => getFirestore(getAdminApp())

export const isStaffEmail = (email: string | undefined) => {
  const normalized = normalizeEmail(email)
  if (!normalized) return false
  if (normalized === PRIMARY_STAFF_EMAIL || normalized === normalizeEmail(DEMO_ADMIN_EMAIL)) {
    return true
  }
  const allowlist = (process.env.FIREBASE_ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => normalizeEmail(value))
    .filter(Boolean)
  return allowlist.includes(normalized)
}
