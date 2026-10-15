import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAdmin, createErrorResponse } from '@/lib/rbac'

export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return createErrorResponse(auth.error, auth.status)

  try {
    const [profilesResult, logsResult] = await Promise.all([
      query(
        `SELECT p.id, p.email, p.full_name, p.role, p.avatar_url,
                p.issue_flag_count, p.is_flagged, p.cancellation_count,
                p.is_suspended, p.suspended_at, p.suspension_reason, p.created_at,
                COALESCE(reports.items, '[]'::jsonb) AS reports
           FROM profiles p
           LEFT JOIN LATERAL (
             SELECT jsonb_agg(jsonb_build_object(
               'id', ir.id, 'request_id', ir.request_id, 'reporter_id', ir.reporter_id,
               'reported_user_id', ir.reported_user_id, 'reason_header', ir.reason_header,
               'comment', ir.comment, 'created_at', ir.created_at,
               'reporter', jsonb_build_object(
                 'id', reporter.id, 'full_name', reporter.full_name, 'role', reporter.role
               )
             ) ORDER BY ir.created_at DESC) AS items
               FROM issue_reports ir
               JOIN profiles reporter ON reporter.id = ir.reporter_id
              WHERE ir.reported_user_id = p.id
           ) reports ON true
          WHERE p.is_flagged = true OR p.is_suspended = true
             OR p.issue_flag_count > 0 OR p.cancellation_count > 0
          ORDER BY p.suspended_at DESC NULLS LAST, p.issue_flag_count DESC`
      ),
      query(
        `SELECT l.id, l.user_id, l.action, l.reason, l.actor, l.created_at,
                jsonb_build_object(
                  'id', p.id, 'full_name', p.full_name, 'email', p.email, 'role', p.role
                ) AS "user"
           FROM account_moderation_log l
           JOIN profiles p ON p.id = l.user_id
          ORDER BY l.created_at DESC
          LIMIT 100`
      ),
    ])

    return NextResponse.json({
      profiles: profilesResult.rows,
      logs: logsResult.rows,
    })
  } catch (error) {
    console.error('[GET /api/admin/moderation] Local database query failed:', error)
    return createErrorResponse('Unable to load moderation records.', 500)
  }
}
