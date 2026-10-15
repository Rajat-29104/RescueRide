import { pool, query } from '@/lib/db'
import { requireAdmin, createErrorResponse } from '@/lib/rbac'
import { NextResponse } from 'next/server'

const STATUS_MAP = {
  approve: 'approved',
  verified: 'approved',
  approved: 'approved',
  reject: 'rejected',
  rejected: 'rejected',
  more_info: 'pending',
}

export async function GET(req) {
  const auth = await requireAdmin()
  if (auth.error) return createErrorResponse(auth.error, auth.status)

  const status = new URL(req.url).searchParams.get('status') || 'pending'
  if (!['pending', 'approved', 'rejected', 'more_info'].includes(status)) {
    return createErrorResponse('Invalid mechanic verification status.', 400)
  }
  const dbStatus = status === 'more_info' ? 'pending' : status

  try {
    const { rows } = await query(
      `SELECT mp.user_id, mp.business_name, mp.years_experience,
              mp.location_label, mp.specializations,
              mv.status AS verification_status, mv.created_at,
              jsonb_build_object(
                'id', p.id, 'full_name', p.full_name, 'phone', p.phone,
                'avatar_url', p.avatar_url, 'role', p.role
              ) AS "user",
              COALESCE(docs.items, '[]'::jsonb) AS documents
         FROM mechanic_profiles mp
         JOIN profiles p ON p.id = mp.user_id
         LEFT JOIN LATERAL (
           SELECT status, created_at FROM mechanic_verifications
            WHERE mechanic_id = mp.user_id
            ORDER BY created_at DESC LIMIT 1
         ) mv ON true
         LEFT JOIN LATERAL (
           SELECT jsonb_agg(jsonb_build_object(
             'id', md.id, 'document_name', md.document_name,
             'file_url', md.file_url, 'created_at', md.created_at
           ) ORDER BY md.created_at) AS items
             FROM mechanic_documents md WHERE md.mechanic_id = mp.user_id
         ) docs ON true
        WHERE COALESCE(mv.status, mp.verification_status) = $1
        ORDER BY mv.created_at ASC NULLS LAST`,
      [dbStatus]
    )
    return NextResponse.json({
      mechanics: rows.map((row) => ({
        ...row,
        verification_status: status === 'more_info' ? 'more_info' : row.verification_status,
      })),
    })
  } catch (error) {
    console.error('[GET /api/admin/mechanics] Local database query failed:', error)
    return createErrorResponse('Unable to load mechanic verification queue.', 500)
  }
}

export async function PATCH(req) {
  const auth = await requireAdmin()
  if (auth.error) return createErrorResponse(auth.error, auth.status)

  let body
  try {
    body = await req.json()
  } catch {
    return createErrorResponse('Invalid request body.', 400)
  }

  const { mechanicUserId, newStatus, reason } = body
  const dbStatus = STATUS_MAP[newStatus]
  if (!mechanicUserId || !dbStatus) {
    return createErrorResponse('mechanicUserId and a valid newStatus are required.', 400)
  }
  if (dbStatus === 'rejected' && !String(reason || '').trim()) {
    return createErrorResponse('A justification reason is required when rejecting a mechanic application.', 400)
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `SELECT p.email FROM profiles p
        JOIN mechanic_profiles mp ON mp.user_id = p.id
        WHERE p.id = $1 FOR UPDATE OF p`,
      [mechanicUserId]
    )
    if (!rows[0]) {
      await client.query('ROLLBACK')
      return createErrorResponse('Mechanic profile not found.', 404)
    }

    const isMoreInfo = newStatus === 'more_info'
    const auditAction = dbStatus === 'approved'
      ? 'verified'
      : dbStatus === 'rejected' ? 'rejected' : 'more_info_requested'
    const auditReason = isMoreInfo
      ? String(reason || 'Additional information/credentials requested by admin').trim()
      : dbStatus === 'rejected' ? String(reason).trim() : null

    await client.query(
      `INSERT INTO mechanic_verification_audit (admin_id, mechanic_id, action, reason, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        auth.user.id,
        mechanicUserId,
        auditAction,
        auditReason,
        JSON.stringify({ raw_status: newStatus, db_status: dbStatus, reviewed_at: new Date().toISOString() }),
      ]
    )
    const verification = await client.query(
      `UPDATE mechanic_verifications
          SET status = $2, reviewed_by = $3, reviewed_at = now(), rejection_reason = $4
        WHERE id = (
          SELECT id FROM mechanic_verifications
           WHERE mechanic_id = $1 ORDER BY created_at DESC LIMIT 1
        )
        RETURNING id`,
      [mechanicUserId, dbStatus, auth.user.id, auditReason]
    )
    if (!verification.rowCount) {
      await client.query(
        `INSERT INTO mechanic_verifications
          (mechanic_id, status, reviewed_by, reviewed_at, rejection_reason)
         VALUES ($1, $2, $3, now(), $4)`,
        [mechanicUserId, dbStatus, auth.user.id, auditReason]
      )
    }
    await client.query(
      'UPDATE mechanic_profiles SET verification_status = $2 WHERE user_id = $1',
      [mechanicUserId, dbStatus]
    )

    if (dbStatus === 'approved') {
      await client.query(
        `INSERT INTO notifications (profile_id, type, title, body)
         VALUES ($1, 'verification', 'Profile verified',
                 'Your professional profile has been verified. You can now receive rescue requests.')`,
        [mechanicUserId]
      )
    } else if (dbStatus === 'rejected') {
      await client.query(
        `UPDATE profiles SET is_active = false, updated_at = now() WHERE id = $1`,
        [mechanicUserId]
      )
      await client.query('DELETE FROM profile_sessions WHERE user_id = $1', [mechanicUserId])
      await client.query(
        `INSERT INTO blocked_emails (email, reason)
         VALUES ($1, 'Mechanic profile rejected by administrator')
         ON CONFLICT (email) DO UPDATE SET reason = EXCLUDED.reason`,
        [rows[0].email]
      )
    }

    await client.query('COMMIT')
    return NextResponse.json({ success: true, status: newStatus })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[PATCH /api/admin/mechanics] Local verification update failed:', error)
    return createErrorResponse('Unable to update mechanic verification.', 500)
  } finally {
    client.release()
  }
}
