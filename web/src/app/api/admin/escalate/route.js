import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { requireAdmin, createErrorResponse } from '@/lib/rbac'

export async function POST(request) {
  const auth = await requireAdmin()
  if (auth.error) return createErrorResponse(auth.error, auth.status)

  let body
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('Invalid request body.', 400)
  }

  const email = String(body.email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return createErrorResponse('A valid user email is required.', 400)
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `SELECT id, role, is_active, is_suspended
         FROM profiles
        WHERE lower(email) = $1
        FOR UPDATE`,
      [email]
    )
    const target = rows[0]
    if (!target) {
      await client.query('ROLLBACK')
      return createErrorResponse('User not found.', 404)
    }
    if (!target.is_active || target.is_suspended) {
      await client.query('ROLLBACK')
      return createErrorResponse('Inactive or suspended accounts cannot be promoted.', 409)
    }
    if (target.role !== 'admin') {
      await client.query(
        `UPDATE profiles SET role = 'admin', updated_at = now() WHERE id = $1`,
        [target.id]
      )
    }
    await client.query(
      'INSERT INTO admin_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
      [target.id]
    )
    await client.query('COMMIT')

    return NextResponse.json({
      message: 'User promoted to admin successfully.',
      userId: target.id,
      email,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[POST /api/admin/escalate] Local role update failed:', error)
    return createErrorResponse('Unable to promote this user to admin.', 500)
  } finally {
    client.release()
  }
}
