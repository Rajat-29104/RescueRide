import { query } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAdmin, createErrorResponse } from '@/lib/rbac'

export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return createErrorResponse(auth.error, auth.status)

  try {
    const { rows } = await query(
      `SELECT
         (SELECT count(*)::integer FROM rescue_requests) AS total_requests,
         (SELECT count(*)::integer FROM rescue_requests
           WHERE status IN ('pending', 'offered', 'accepted', 'en_route', 'arrived', 'in_progress')) AS active_requests,
         (SELECT count(*)::integer FROM rescue_requests WHERE status = 'completed') AS completed_requests,
         (SELECT count(*)::integer FROM rescue_requests WHERE status = 'cancelled') AS cancelled_requests,
         (SELECT count(*)::integer FROM mechanic_profiles) AS total_mechanics,
         (SELECT count(*)::integer FROM mechanic_profiles WHERE verification_status = 'approved') AS verified_mechanics,
         (SELECT count(*)::integer FROM mechanic_profiles WHERE is_available = true) AS active_mechanics,
         (SELECT count(*)::integer FROM mechanic_profiles WHERE verification_status = 'pending') AS pending_verifications,
         (SELECT count(*)::integer FROM profiles WHERE role = 'driver') AS total_drivers,
         (SELECT COALESCE(AVG(rating), 0)::numeric(4,2) FROM request_reviews) AS average_rating,
         (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (accepted_at - created_at)) / 60), 0)::numeric(10,1)
            FROM rescue_requests WHERE accepted_at IS NOT NULL) AS average_response_time,
         (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - accepted_at)) / 60), 0)::numeric(10,1)
            FROM rescue_requests WHERE accepted_at IS NOT NULL AND completed_at IS NOT NULL) AS average_completion_time,
         (SELECT COALESCE(jsonb_agg(jsonb_build_object('service_type', service_type, 'count', n)), '[]'::jsonb)
            FROM (SELECT service_type, count(*)::integer AS n FROM rescue_requests GROUP BY service_type) s) AS service_breakdown,
         (SELECT COALESCE(jsonb_agg(jsonb_build_object('status', status, 'count', n)), '[]'::jsonb)
            FROM (SELECT status, count(*)::integer AS n FROM rescue_requests GROUP BY status) s) AS status_breakdown,
         (SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'user_id', mp.user_id, 'business_name', mp.business_name, 'rating_avg', mp.rating_avg,
            'rating_count', mp.rating_count,
            'profile', jsonb_build_object('full_name', p.full_name, 'phone', p.phone, 'avatar_url', p.avatar_url)
          ) ORDER BY mp.rating_avg DESC), '[]'::jsonb)
            FROM (SELECT * FROM mechanic_profiles ORDER BY rating_avg DESC LIMIT 5) mp
            JOIN profiles p ON p.id = mp.user_id) AS top_mechanics,
         (SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'user_id', mp.user_id, 'business_name', mp.business_name, 'is_available', mp.is_available,
            'current_location', ST_AsGeoJSON(mp.current_location)::jsonb,
            'profiles', jsonb_build_object('full_name', p.full_name, 'phone', p.phone, 'avatar_url', p.avatar_url)
          )), '[]'::jsonb)
            FROM mechanic_profiles mp JOIN profiles p ON p.id = mp.user_id
           WHERE mp.verification_status = 'approved' AND mp.is_available = true
             AND mp.current_location IS NOT NULL) AS active_mechanic_locations,
         (SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', id, 'status', status, 'service_type', service_type,
            'problem_description', problem_description,
            'incident_location', ST_AsGeoJSON(incident_location)::jsonb,
            'mechanic_id', mechanic_id
          )), '[]'::jsonb)
            FROM rescue_requests
           WHERE status IN ('pending', 'offered', 'accepted', 'en_route', 'arrived', 'in_progress')) AS active_incidents,
         (SELECT count(*) FILTER (WHERE rating = 1)::integer FROM request_reviews) AS rating_1,
         (SELECT count(*) FILTER (WHERE rating = 2)::integer FROM request_reviews) AS rating_2,
         (SELECT count(*) FILTER (WHERE rating = 3)::integer FROM request_reviews) AS rating_3,
         (SELECT count(*) FILTER (WHERE rating = 4)::integer FROM request_reviews) AS rating_4,
         (SELECT count(*) FILTER (WHERE rating = 5)::integer FROM request_reviews) AS rating_5`
    )
    const row = rows[0]
    const stats = {
      totalRequests: row.total_requests,
      activeRequests: row.active_requests,
      completedRequests: row.completed_requests,
      cancelledRequests: row.cancelled_requests,
      avgResponseTime: Number(row.average_response_time),
      avgCompletionTime: Number(row.average_completion_time),
      verifiedMechanics: row.verified_mechanics,
      activeMechanics: row.active_mechanics,
      pendingVerifications: row.pending_verifications,
      totalDrivers: row.total_drivers,
      totalUsers: row.total_mechanics + row.total_drivers,
      avgRating: Number(row.average_rating) || 5,
      ratingsDistribution: {
        1: row.rating_1,
        2: row.rating_2,
        3: row.rating_3,
        4: row.rating_4,
        5: row.rating_5,
      },
      serviceTypeBreakdown: row.service_breakdown,
      statusBreakdown: row.status_breakdown,
      topMechanics: row.top_mechanics,
      activeMechanicLocations: row.active_mechanic_locations,
      activeIncidents: row.active_incidents,
    }
    return NextResponse.json({ stats })
  } catch (error) {
    console.error('[GET /api/admin/stats] Local database query failed:', error)
    return createErrorResponse('Unable to load admin dashboard statistics.', 500)
  }
}
