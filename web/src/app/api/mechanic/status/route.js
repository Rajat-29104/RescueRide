import { query } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/localAuth'
import { NextResponse } from 'next/server'

async function requireMechanic() {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (authenticated.profile.role !== 'mechanic') {
    return { error: NextResponse.json({ error: 'Only mechanics can access their status.' }, { status: 403 }) }
  }
  return { userId: authenticated.user.id }
}

export async function GET() {
  const mechanic = await requireMechanic()
  if (mechanic.error) return mechanic.error

  try {
    const { rows } = await query(
      'SELECT is_available FROM mechanic_profiles WHERE user_id = $1',
      [mechanic.userId]
    )
    if (!rows[0]) return NextResponse.json({ error: 'Mechanic profile not found.' }, { status: 404 })
    return NextResponse.json({ is_available: rows[0].is_available })
  } catch (error) {
    console.error('[GET /api/mechanic/status] Local status lookup failed:', error)
    return NextResponse.json({ error: 'Unable to load mechanic status.' }, { status: 500 })
  }
}

export async function PATCH(request) {
  const mechanic = await requireMechanic()
  if (mechanic.error) return mechanic.error

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  if (!body || typeof body.is_available !== 'boolean') {
    return NextResponse.json({ error: 'is_available must be a boolean.' }, { status: 400 })
  }

  try {
    const { rows } = await query(
      `UPDATE mechanic_profiles
          SET is_available = $1,
              current_status = CASE WHEN $1 THEN 'available' ELSE NULL END
        WHERE user_id = $2
        RETURNING is_available`,
      [body.is_available, mechanic.userId]
    )
    if (!rows[0]) return NextResponse.json({ error: 'Mechanic profile not found.' }, { status: 404 })
    return NextResponse.json({ is_available: rows[0].is_available })
  } catch (error) {
    console.error('[PATCH /api/mechanic/status] Local status update failed:', error)
    return NextResponse.json({ error: 'Unable to update mechanic status.' }, { status: 500 })
  }
}
