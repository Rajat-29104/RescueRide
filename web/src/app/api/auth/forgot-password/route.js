import { randomBytes } from 'node:crypto'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { hashToken } from '@/lib/localAuth'
import { generalLimiter } from '@/lib/rateLimit'

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!generalLimiter(`forgot-password:${ip}`).allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  const { email: rawEmail } = await request.json()
  const email = String(rawEmail || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  const { rows } = await pool.query(
    'SELECT id, email FROM profiles WHERE email = $1 AND is_active = true',
    [email]
  )
  if (!rows[0]) {
    return NextResponse.json({ success: true })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: 'Password reset email is not configured. Set RESEND_API_KEY to enable password recovery.' },
      { status: 503 }
    )
  }

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)
  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [rows[0].id, hashToken(token), expiresAt]
  )

  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const resetUrl = new URL('/auth/reset-password', origin)
  resetUrl.searchParams.set('token', token)
  const resend = new Resend(process.env.RESEND_API_KEY)
  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'RoadRescue <onboarding@resend.dev>',
    to: rows[0].email,
    subject: 'Reset your RoadRescue password',
    html: `<p>We received a request to reset your RoadRescue password.</p><p><a href="${resetUrl.toString()}">Set a new password</a></p><p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>`,
  })

  if (result.error) {
    console.error('[LOCAL AUTH] Password reset email failed:', result.error)
    return NextResponse.json({ error: 'Unable to send the password reset email.' }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}
