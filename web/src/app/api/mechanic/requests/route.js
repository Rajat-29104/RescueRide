import { query } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/localAuth'
import { NextResponse } from 'next/server'

export async function GET() {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (authenticated.profile.role !== 'mechanic') {
    return NextResponse.json({ error: 'Only mechanics can view the dispatch feed.' }, { status: 403 })
  }
  if (authenticated.profile.mechanic_profile?.verification_status !== 'approved') {
    return NextResponse.json({ requests: [] })
  }

  try {
    const { rows } = await query(
      `SELECT r.id, r.status, r.priority, r.service_type, r.problem_description,
              r.incident_address, r.created_at, r.mechanic_id,
              r.estimated_cost_min, r.estimated_cost_max,
              jsonb_build_object('id', p.id, 'full_name', p.full_name, 'phone', p.phone) AS driver
         FROM rescue_requests r
         JOIN profiles p ON p.id = r.driver_id
        WHERE r.status = 'pending'
          AND (r.mechanic_id IS NULL OR r.mechanic_id = $1)
        ORDER BY CASE r.priority WHEN 'critical' THEN 0 WHEN 'emergency' THEN 1 ELSE 2 END,
                 r.created_at DESC
        LIMIT 20`,
      [authenticated.user.id]
    )
    return NextResponse.json({ requests: rows })
  } catch (error) {
    console.error('[GET /api/mechanic/requests] Local dispatch feed query failed:', error)
    return NextResponse.json({ error: 'Unable to load available requests.' }, { status: 500 })
  }
}
