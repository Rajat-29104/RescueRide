import { NextResponse } from 'next/server'
import { pool, query } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/localAuth'
import { requireAdmin, createErrorResponse } from '@/lib/rbac'
import { sanitizeInput } from '@/lib/validate'

const reportReasons = new Set(['inappropriate_behavior', 'pricing_issue', 'delay', 'other'])

export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return createErrorResponse(auth.error, auth.status)

  try {
    const { rows } = await query(
      `SELECT ir.id, ir.request_id, ir.reporter_id, ir.reported_user_id,
              ir.reason_header, ir.comment, ir.status, ir.updated_at, ir.created_at,
              jsonb_build_object(
                'id', reporter.id, 'full_name', reporter.full_name, 'role', reporter.role
              ) AS reporter,
              CASE WHEN reported.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', reported.id, 'full_name', reported.full_name, 'role', reported.role
              ) END AS reported_user,
              jsonb_build_object(
                'id', r.id, 'service_type', r.service_type,
                'problem_description', r.problem_description,
                'incident_address', r.incident_address, 'status', r.status
              ) AS request
         FROM issue_reports ir
         JOIN profiles reporter ON reporter.id = ir.reporter_id
         LEFT JOIN profiles reported ON reported.id = ir.reported_user_id
         JOIN rescue_requests r ON r.id = ir.request_id
        ORDER BY ir.created_at DESC
        LIMIT 200`
    )
    return NextResponse.json({ reports: rows })
  } catch (error) {
    console.error('[GET /api/reports] Local database query failed:', error)
    return createErrorResponse('Unable to load incident reports.', 500)
  }
}

export async function POST(request) {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) return createErrorResponse('Unauthorized.', 401)

  let body
  try {
    body = sanitizeInput(await request.json())
  } catch {
    return createErrorResponse('Invalid request body.', 400)
  }

  const requestId = String(body.requestId || '')
  const reasonHeader = String(body.reasonHeader || '')
  const comment = String(body.comment || '').trim()
  if (!requestId || !reasonHeader || !comment) {
    return createErrorResponse('requestId, reasonHeader, and comment are required.', 400)
  }
  if (!reportReasons.has(reasonHeader)) return createErrorResponse('Invalid report reason.', 400)
  if (comment.length > 500) return createErrorResponse('Report details must be 500 characters or fewer.', 400)
  if (body.reporterId !== authenticated.user.id) {
    return createErrorResponse('Forbidden: reporter ID mismatch.', 403)
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: requestRows } = await client.query(
      'SELECT driver_id, mechanic_id FROM rescue_requests WHERE id = $1 FOR SHARE',
      [requestId]
    )
    const rescueRequest = requestRows[0]
    if (!rescueRequest) {
      await client.query('ROLLBACK')
      return createErrorResponse('Rescue request not found.', 404)
    }

    const reporterId = authenticated.user.id
    let reportedUserId = null
    if (rescueRequest.driver_id === reporterId) {
      reportedUserId = rescueRequest.mechanic_id
    } else if (rescueRequest.mechanic_id === reporterId) {
      reportedUserId = rescueRequest.driver_id
    } else {
      await client.query('ROLLBACK')
      return createErrorResponse('You may only report a rescue request you participated in.', 403)
    }

    const { rows } = await client.query(
      `INSERT INTO issue_reports
        (request_id, reporter_id, reported_user_id, reason_header, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, request_id, reporter_id, reported_user_id, reason_header, comment, status, created_at`,
      [requestId, reporterId, reportedUserId, reasonHeader, comment]
    )
    await client.query(
      `INSERT INTO notifications (profile_id, type, title, body, request_id)
       SELECT id, 'system', 'New Incident Report',
              $1, $2
         FROM profiles
        WHERE role = 'admin'`,
      [`A new incident report was filed for request #${requestId.slice(0, 8)}. Reason: ${reasonHeader}.`, requestId]
    )
    await client.query('COMMIT')
    return NextResponse.json({ report: rows[0] }, { status: 201 })
  } catch (error) {
    await client.query('ROLLBACK')
    if (error.code === '23505') {
      return createErrorResponse('You have already submitted this report for the rescue request.', 409)
    }
    console.error('[POST /api/reports] Local report creation failed:', error)
    return createErrorResponse('Unable to submit this report.', 500)
  } finally {
    client.release()
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

  const ids = body.ids
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))) {
    return createErrorResponse('A non-empty array of valid report IDs is required.', 400)
  }

  try {
    const { rowCount } = await query(
      'DELETE FROM issue_reports WHERE id = ANY($1::uuid[])',
      [ids]
    )
    return NextResponse.json({ success: true, count: rowCount })
  } catch (error) {
    console.error('[DELETE /api/reports] Local report deletion failed:', error)
    return createErrorResponse('Unable to delete incident reports.', 500)
  }
}
