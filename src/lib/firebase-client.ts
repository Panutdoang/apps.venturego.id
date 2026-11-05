'use client'

import { getApp, getApps, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'

const useEmulators = process.env.NODE_ENV === 'development'
const localProjectId = 'demo-venturego-local'

const getFirebaseApp = () => {
  const projectId = useEmulators ? localProjectId : process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const config = {
    apiKey: useEmulators ? 'local-emulator-api-key' : process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: useEmulators
      ? `${localProjectId}.firebaseapp.com`
      : process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId,
    messagingSenderId: useEmulators
      ? '000000000000'
      : process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: useEmulators
      ? '1:000000000000:web:local-emulator'
      : process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }

  if (Object.values(config).some((value) => !value)) {
    throw new Error('Firebase client configuration is not complete.')
  }

  const existingApp = getApps().length > 0
  const app = existingApp ? getApp() : initializeApp(config)
  if (useEmulators && !existingApp) {
    connectAuthEmulator(getAuth(app), 'http://127.0.0.1:9099', { disableWarnings: true })
  }
  return app
}

export const getFirebaseClientAuth = () => getAuth(getFirebaseApp())
