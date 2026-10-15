import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAdmin, createErrorResponse } from '@/lib/rbac'

export async function GET(req) {
  const auth = await requireAdmin()
  if (auth.error) return createErrorResponse(auth.error, auth.status)

  const params = new URL(req.url).searchParams
  const status = params.get('status')
  const flagged = params.get('flagged') === 'true' || status === 'flagged'
  const limitParam = Number.parseInt(params.get('limit') || '50', 10)
  const offsetParam = Number.parseInt(params.get('offset') || '0', 10)
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50
  const offset = Number.isFinite(offsetParam) ? Math.max(offsetParam, 0) : 0

  try {
    const values = []
    const filters = []
    if (status && status !== 'flagged') {
      values.push(status)
      filters.push(`r.status = $${values.length}`)
    }
    if (flagged) filters.push('EXISTS (SELECT 1 FROM issue_reports ir WHERE ir.request_id = r.id)')

    values.push(limit, offset)
    const { rows } = await query(
      `SELECT r.*,
              jsonb_build_object('id', d.id, 'full_name', d.full_name, 'phone', d.phone) AS driver,
              CASE WHEN m.id IS NULL THEN NULL
                   ELSE jsonb_build_object('id', m.id, 'full_name', m.full_name, 'phone', m.phone)
              END AS mechanic,
              COALESCE(issues.reports, '[]'::jsonb) AS issue_reports
         FROM rescue_requests r
         JOIN profiles d ON d.id = r.driver_id
         LEFT JOIN profiles m ON m.id = r.mechanic_id
         LEFT JOIN LATERAL (
           SELECT jsonb_agg(jsonb_build_object('id', ir.id, 'comment', ir.comment)) AS reports
             FROM issue_reports ir
            WHERE ir.request_id = r.id
         ) issues ON true
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
        ORDER BY r.created_at DESC
        LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    )
    return NextResponse.json({ requests: rows })
  } catch (error) {
    console.error('[GET /api/admin/requests] Local database query failed:', error)
    return createErrorResponse('Unable to load rescue requests.', 500)
  }
}
