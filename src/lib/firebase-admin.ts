import 'server-only'

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const useEmulators = process.env.NODE_ENV === 'development'
const localProjectId = 'demo-venturego-local'

const getAdminApp = () => {
  const projectId = useEmulators ? localProjectId : process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId) {
    throw new Error('Firebase project configuration is missing.')
  }
  if (!useEmulators && (!clientEmail || !privateKey)) {
    throw new Error('Firebase Admin credentials are not configured.')
  }

  const appName = useEmulators ? 'venturego-local-emulator' : '[DEFAULT]'

  const existingApp = getApps().find((app) => app.name === appName)
  if (existingApp) return existingApp

  return initializeApp(
    {
      ...(useEmulators ? {} : { credential: cert({ projectId, clientEmail, privateKey }) }),
      projectId,
    },
    appName,
  )
}

export const getFirebaseAuth = () => getAuth(getAdminApp())
export const getFirebaseFirestore = () => getFirestore(getAdminApp())

export const isStaffEmail = (email: string | undefined) => {
  if (!email) return false
  const allowlist = (process.env.FIREBASE_ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
  return allowlist.includes(email.toLowerCase())
}
