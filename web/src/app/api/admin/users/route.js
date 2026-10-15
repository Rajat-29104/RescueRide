import { NextResponse } from 'next/server'
import { pool, query } from '@/lib/db'
import { requireAdmin, createErrorResponse } from '@/lib/rbac'

export async function GET(request) {
  const auth = await requireAdmin()
  if (auth.error) return createErrorResponse(auth.error, auth.status)

  const params = new URL(request.url).searchParams
  const role = params.get('role')
  const limitValue = Number.parseInt(params.get('limit') || '1000', 10)
  const offsetValue = Number.parseInt(params.get('offset') || '0', 10)
  const limit = Number.isFinite(limitValue) ? Math.min(Math.max(limitValue, 1), 1000) : 1000
  const offset = Number.isFinite(offsetValue) ? Math.max(offsetValue, 0) : 0

  if (role && !['driver', 'mechanic', 'admin', 'non-admin'].includes(role)) {
    return createErrorResponse('Invalid user role filter.', 400)
  }

  try {
    const values = []
    const roleFilter = role === 'non-admin'
      ? "WHERE p.role <> 'admin'"
      : role ? `WHERE p.role = $${values.push(role)}` : ''
    values.push(limit, offset)
    const { rows } = await query(
      `SELECT p.id, p.email, p.role, p.full_name, p.phone, p.avatar_url,
              p.is_active, p.is_suspended, p.suspended_at, p.suspension_reason,
              p.issue_flag_count, p.is_flagged, p.cancellation_count,
              p.created_at, p.updated_at,
              CASE WHEN dp.user_id IS NULL THEN NULL ELSE
                jsonb_build_object(
                  'vehicle_make', dp.vehicle_make, 'vehicle_model', dp.vehicle_model,
                  'vehicle_color', dp.vehicle_color, 'vehicle_year', dp.vehicle_year,
                  'vehicle_plate', dp.vehicle_plate,
                  'emergency_contact_name', dp.emergency_contact_name,
                  'emergency_contact_phone', dp.emergency_contact_phone
                )
              END AS driver_profile,
              CASE WHEN mp.user_id IS NULL THEN NULL ELSE
                jsonb_build_object(
                  'business_name', mp.business_name, 'rating_avg', mp.rating_avg,
                  'years_experience', mp.years_experience,
                  'specializations', mp.specializations,
                  'verification_status', mp.verification_status
                )
              END AS mechanic_profile
         FROM profiles p
         LEFT JOIN driver_profiles dp ON dp.user_id = p.id
         LEFT JOIN mechanic_profiles mp ON mp.user_id = p.id
         ${roleFilter}
        ORDER BY p.created_at DESC
        LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    )
    return NextResponse.json({ users: rows })
  } catch (error) {
    console.error('[GET /api/admin/users] Local database query failed:', error)
    return createErrorResponse('Unable to load user accounts.', 500)
  }
}

export async function DELETE(request) {
  const auth = await requireAdmin()
  if (auth.error) return createErrorResponse(auth.error, auth.status)

  let body
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('Invalid request body.', 400)
  }

  const userId = String(body.userId || '')
  if (!userId) return createErrorResponse('userId is required.', 400)
  if (userId === auth.user.id) return createErrorResponse('You cannot suspend your own account.', 400)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      'SELECT id, role FROM profiles WHERE id = $1 FOR UPDATE',
      [userId]
    )
    if (!rows[0]) {
      await client.query('ROLLBACK')
      return createErrorResponse('User not found.', 404)
    }
    if (rows[0].role === 'admin') {
      await client.query('ROLLBACK')
      return createErrorResponse('Admin accounts cannot be suspended from this page.', 403)
    }

    await client.query(
      `UPDATE profiles
          SET is_active = false, is_suspended = true,
              suspended_at = now(), suspension_reason = 'Suspended by administrator',
              updated_at = now()
        WHERE id = $1`,
      [userId]
    )
    await client.query('DELETE FROM profile_sessions WHERE user_id = $1', [userId])
    await client.query(
      `INSERT INTO account_moderation_log (user_id, action, reason, actor)
       VALUES ($1, 'suspended', 'Suspended by administrator', $2)`,
      [userId, auth.user.id]
    )
    await client.query('COMMIT')
    return NextResponse.json({ success: true })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[DELETE /api/admin/users] Local suspension failed:', error)
    return createErrorResponse('Unable to suspend this account.', 500)
  } finally {
    client.release()
  }
}
