import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { hashPassword, hashToken } from '@/lib/localAuth'

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const token = String(body.token || '')
  const password = String(body.password || '')
  if (token.length < 32 || password.length < 6) {
    return NextResponse.json({ error: 'A valid reset link and a password of at least 6 characters are required.' }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query(
      `SELECT user_id FROM password_reset_tokens
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
        FOR UPDATE`,
      [hashToken(token)]
    )
    if (!result.rows[0]) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'This password reset link is invalid or has expired.' }, { status: 400 })
    }

    const userId = result.rows[0].user_id
    await client.query('UPDATE profiles SET password_hash = $1, updated_at = now() WHERE id = $2', [passwordHash, userId])
    await client.query(
      'UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
      [userId]
    )
    await client.query('DELETE FROM profile_sessions WHERE user_id = $1', [userId])
    await client.query('COMMIT')
    return NextResponse.json({ success: true })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[LOCAL AUTH] Password reset failed:', error)
    return NextResponse.json({ error: 'Unable to update the password.' }, { status: 500 })
  } finally {
    client.release()
  }
}
