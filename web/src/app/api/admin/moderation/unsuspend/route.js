import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { requireAdmin, createErrorResponse } from '@/lib/rbac'
import { sanitizeInput } from '@/lib/validate'

export async function POST(request) {
  const auth = await requireAdmin()
  if (auth.error) return createErrorResponse(auth.error, auth.status)

  let body
  try {
    body = sanitizeInput(await request.json())
  } catch {
    return createErrorResponse('Invalid request body.', 400)
  }

  const userId = String(body.userId || '')
  const reason = String(body.reason || '').trim()
  if (!userId || !reason) {
    return createErrorResponse('userId and a non-empty suspension clearance reason are required.', 400)
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `UPDATE profiles
          SET is_suspended = false, is_active = true,
              suspended_at = NULL, suspension_reason = NULL, updated_at = now()
        WHERE id = $1
        RETURNING id, cancellation_count, issue_flag_count`,
      [userId]
    )
    if (!rows[0]) {
      await client.query('ROLLBACK')
      return createErrorResponse('User profile not found.', 404)
    }

    await client.query(
      `INSERT INTO account_moderation_log (user_id, action, reason, actor)
       VALUES ($1, 'unsuspended', $2, $3)`,
      [userId, reason, auth.user.id]
    )
    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      message: 'User has been unsuspended successfully.',
      user: {
        id: userId,
        is_suspended: false,
        cancellation_count: rows[0].cancellation_count,
        issue_flag_count: rows[0].issue_flag_count,
      },
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[POST /api/admin/moderation/unsuspend] Local update failed:', error)
    return createErrorResponse('Unable to unsuspend this account.', 500)
  } finally {
    client.release()
  }
}
