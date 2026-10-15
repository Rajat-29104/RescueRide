import { query } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/localAuth'
import { NextResponse } from 'next/server'
import { formatRequestRow } from '@/lib/rescueLifecycle'

export async function GET(request, { params }) {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Missing request identification parameter.' }, { status: 400 })
  }

  try {
    const { rows } = await query(
      `SELECT r.*,
              to_jsonb(d) - 'password_hash' AS driver,
              CASE WHEN m.id IS NULL THEN NULL ELSE to_jsonb(m) - 'password_hash' END AS mechanic,
              CASE WHEN mp.user_id IS NULL THEN NULL ELSE jsonb_build_object(
                'rating_avg', mp.rating_avg, 'rating_count', mp.rating_count,
                'specializations', mp.specializations, 'business_name', mp.business_name,
                'location_label', mp.location_label, 'service_mode', mp.service_mode,
                'current_location', ST_AsGeoJSON(mp.current_location)::jsonb,
                'is_available', mp.is_available, 'current_status', mp.current_status
              ) END AS mechanic_profile,
              review.rating, review.review,
              COALESCE(reports.items, '[]'::jsonb) AS reports
         FROM rescue_requests r
         LEFT JOIN profiles d ON d.id = r.driver_id
         LEFT JOIN profiles m ON m.id = r.mechanic_id
         LEFT JOIN mechanic_profiles mp ON mp.user_id = r.mechanic_id
         LEFT JOIN request_reviews review ON review.request_id = r.id
         LEFT JOIN LATERAL (
           SELECT jsonb_agg(to_jsonb(ir)) AS items
             FROM issue_reports ir WHERE ir.request_id = r.id
         ) reports ON true
        WHERE r.id = $1`,
      [id]
    )
    const row = rows[0]
    if (!row) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

    const { user, profile } = authenticated
    const hasAccess =
      profile.role === 'admin' ||
      row.driver_id === user.id ||
      row.mechanic_id === user.id ||
      (profile.role === 'mechanic' && !row.mechanic_id && ['pending', 'offered'].includes(row.status))
    if (!hasAccess) {
      return NextResponse.json({ error: 'Not authorized to view this request' }, { status: 403 })
    }

    const mechanic = row.mechanic
      ? { ...row.mechanic, mechanic_profiles: row.mechanic_profile }
      : null
    const requestDetails = formatRequestRow(row, {
      driver: row.driver
        ? { id: row.driver.id, full_name: row.driver.full_name, phone: row.driver.phone, avatar_url: row.driver.avatar_url }
        : null,
      assignedMechanic: mechanic,
    })
    requestDetails.mechanic = mechanic
    requestDetails.rating = row.rating || null
    requestDetails.review = row.review || null
    requestDetails.reports = row.reports

    return NextResponse.json({ request: requestDetails })
  } catch (error) {
    console.error('[GET /api/requests/[id]] Local request lookup failed:', error)
    return NextResponse.json({ error: 'Failed to load request.' }, { status: 500 })
  }
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Use PATCH /api/requests/status for rescue status changes' },
    { status: 410 }
  )
}
