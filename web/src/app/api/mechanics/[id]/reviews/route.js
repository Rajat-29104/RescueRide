import { query } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/localAuth'
import { NextResponse } from 'next/server'

export async function GET(_request, { params }) {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    const { rows } = await query(
      `SELECT rr.id, rr.rating, rr.review, rr.created_at,
              jsonb_build_object('full_name', p.full_name) AS profiles
         FROM request_reviews rr
         LEFT JOIN profiles p ON p.id = rr.driver_id
        WHERE rr.mechanic_id = $1
        ORDER BY rr.created_at DESC LIMIT 3`,
      [id]
    )
    return NextResponse.json({ reviews: rows })
  } catch (error) {
    console.error('[GET /api/mechanics/[id]/reviews] Local reviews query failed:', error)
    return NextResponse.json({ error: 'Unable to load mechanic reviews.' }, { status: 500 })
  }
}
