import { query } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/localAuth'
import { NextResponse } from 'next/server'

export async function PATCH(req) {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (authenticated.profile.role !== 'mechanic') {
    return NextResponse.json({ error: 'Only mechanics can update their location.' }, { status: 403 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const latitude = Number(body.latitude)
  const longitude = Number(body.longitude)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: 'Valid latitude and longitude are required.' }, { status: 400 })
  }

  try {
    const result = await query(
      `UPDATE mechanic_profiles
          SET current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326),
              location_updated_at = now()
        WHERE user_id = $3
        RETURNING user_id, location_updated_at`,
      [longitude, latitude, authenticated.user.id]
    )
    if (!result.rowCount) return NextResponse.json({ error: 'Mechanic profile not found.' }, { status: 404 })
    return NextResponse.json({ location: result.rows[0] })
  } catch (error) {
    console.error('[PATCH /api/mechanic/location] Local location update failed:', error)
    return NextResponse.json({ error: 'Unable to update mechanic location.' }, { status: 500 })
  }
}
