import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { createSession, publicUser, verifyPassword, SESSION_COOKIE } from '@/lib/localAuth'
import { generalLimiter } from '@/lib/rateLimit'

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!generalLimiter(`login:${ip}`).allowed) {
    return NextResponse.json({ error: 'Too many login attempts. Try again later.' }, { status: 429 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const { rows } = await query(
    `SELECT id, email, password_hash, role, full_name, phone, is_active, is_suspended, suspension_reason
       FROM profiles WHERE email = $1`,
    [email]
  )
  const profile = rows[0]

  if (!profile || !(await verifyPassword(password, profile.password_hash))) {
    return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 401 })
  }
  if (!profile.is_active) {
    return NextResponse.json({ error: 'This account is inactive. Contact support.' }, { status: 403 })
  }
  if (profile.is_suspended) {
    return NextResponse.json({ error: `This account is suspended: ${profile.suspension_reason || 'Contact support.'}` }, { status: 403 })
  }

  const session = await createSession(profile.id)
  const response = NextResponse.json({
    user: publicUser(profile),
    session: { user: publicUser(profile) },
  })
  response.cookies.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: session.expiresAt,
  })
  return response
}
