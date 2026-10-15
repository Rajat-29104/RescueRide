import { query } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/localAuth'
import { NextResponse } from 'next/server'

export async function GET(_req, { params }) {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (authenticated.profile.role !== 'driver') {
    return NextResponse.json({ error: 'Only drivers can view mechanic details.' }, { status: 403 })
  }

  const { id } = await params
  try {
    const { rows } = await query(
      `SELECT mp.user_id, mp.business_name, mp.specializations, mp.rating_avg,
              mp.rating_count, mp.location_label
         FROM mechanic_profiles mp
         JOIN profiles p ON p.id = mp.user_id
        WHERE mp.user_id = $1
          AND mp.verification_status = 'approved'
          AND p.is_active = true`,
      [id]
    )
    if (!rows[0]) return NextResponse.json({ error: 'Verified mechanic not found.' }, { status: 404 })
    return NextResponse.json({ mechanic: rows[0] })
  } catch (error) {
    console.error('[GET /api/mechanics/[id]] Local mechanic lookup failed:', error)
    return NextResponse.json({ error: 'Unable to load mechanic details.' }, { status: 500 })
  }
}
