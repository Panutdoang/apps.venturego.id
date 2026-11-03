import 'server-only'

import { cookies, headers } from 'next/headers'
import { getFirebaseAuth, isStaffEmail } from './firebase-admin'

export const ADMIN_SESSION_COOKIE = 'venturego-admin-session'
export const ADMIN_SESSION_LIFETIME_MS = 5 * 24 * 60 * 60 * 1000

async function getLocalDevelopmentStaff() {
  if (process.env.NODE_ENV !== 'development') return null
  const host = (await headers()).get('host')?.toLowerCase()
  if (!host || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(host)) {
    return null
  }
  return { email: 'local-development@localhost', uid: 'local-development' }
}

export async function getStaffSession() {
  const localStaff = await getLocalDevelopmentStaff()
  if (localStaff) return localStaff

  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  if (!token) return null
  try {
    const user = await getFirebaseAuth().verifySessionCookie(token, true)
    return isStaffEmail(user.email) ? user : null
  } catch {
    return null
  }
}
