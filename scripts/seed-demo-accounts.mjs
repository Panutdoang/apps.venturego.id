import { readFileSync } from 'node:fs'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const accounts = JSON.parse(
  readFileSync(new URL('../src/lib/demo-accounts.json', import.meta.url), 'utf8'),
)

const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST
const projectId = emulatorHost
  ? (process.env.FIREBASE_PROJECT_ID ?? 'demo-venturego-local')
  : process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (!projectId || (!emulatorHost && (!clientEmail || !privateKey))) {
  console.error('Firebase Admin environment variables are missing.')
  process.exit(1)
}

const appName = 'demo-account-seed'
const app =
  getApps().find((existing) => existing.name === appName) ??
  initializeApp(
    emulatorHost
      ? { projectId }
      : { credential: cert({ projectId, clientEmail, privateKey }), projectId },
    appName,
  )

const auth = getAuth(app)

for (const [role, account] of Object.entries(accounts)) {
  const displayName = role === 'admin' ? 'Admin Demo' : 'User Demo'
  try {
    const existing = await auth.getUserByEmail(account.email)
    await auth.updateUser(existing.uid, {
      password: account.password,
      displayName,
      emailVerified: true,
    })
    console.log(`Updated ${role} account: ${account.email}`)
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error
    await auth.createUser({
      email: account.email,
      password: account.password,
      displayName,
      emailVerified: true,
    })
    console.log(`Created ${role} account: ${account.email}`)
  }
}
