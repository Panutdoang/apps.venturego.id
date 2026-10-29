import 'server-only'

import { cookies } from 'next/headers'
import { getFirebaseAuth, isStaffEmail } from './firebase-admin'

export const ADMIN_SESSION_COOKIE = 'venturego-admin-session'
export const ADMIN_SESSION_LIFETIME_MS = 5 * 24 * 60 * 60 * 1000

export async function getStaffSession() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  if (!token) return null
  try {
    const user = await getFirebaseAuth().verifySessionCookie(token, true)
    return isStaffEmail(user.email) ? user : null
  } catch {
    return null
  }
}
