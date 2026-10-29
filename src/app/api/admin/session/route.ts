import { NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_LIFETIME_MS } from '@/lib/firebase-session'
import { getFirebaseAuth, isStaffEmail } from '@/lib/firebase-admin'

export async function POST(request: Request) {
  try {
    const { idToken } = (await request.json()) as { idToken?: unknown }
    if (typeof idToken !== 'string' || idToken.length > 10_000) {
      return NextResponse.json({ message: 'Sesi masuk tidak valid.' }, { status: 400 })
    }
    const decoded = await getFirebaseAuth().verifyIdToken(idToken, true)
    if (!isStaffEmail(decoded.email)) {
      return NextResponse.json({ message: 'Akun ini tidak memiliki akses staf.' }, { status: 403 })
    }
    const sessionCookie = await getFirebaseAuth().createSessionCookie(idToken, {
      expiresIn: ADMIN_SESSION_LIFETIME_MS,
    })
    const response = NextResponse.json({ ok: true })
    response.cookies.set(ADMIN_SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ADMIN_SESSION_LIFETIME_MS / 1000,
    })
    return response
  } catch {
    return NextResponse.json({ message: 'Tidak dapat membuat sesi staf.' }, { status: 401 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}
