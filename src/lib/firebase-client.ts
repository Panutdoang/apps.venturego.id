'use client'

import { getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const APP_NAME = 'venturego-web'

const getFirebaseApp = () => {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }

  if (Object.values(config).some((value) => !value)) {
    throw new Error('Firebase client configuration is not complete.')
  }

  const existingApp = getApps().find((app) => app.name === APP_NAME)
  if (existingApp) return existingApp

  return initializeApp(config, APP_NAME)
}

export const getFirebaseClientAuth = () => getAuth(getFirebaseApp())
