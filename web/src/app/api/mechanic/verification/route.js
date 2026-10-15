import { query } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/localAuth'
import { NextResponse } from 'next/server'

export async function GET() {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (authenticated.profile.role !== 'mechanic') {
    return NextResponse.json({ error: 'Only mechanics can view verification status.' }, { status: 403 })
  }

  try {
    const { rows } = await query(
      `SELECT mp.verification_status, mv.rejection_reason,
              p.is_suspended, p.suspension_reason
         FROM profiles p
         LEFT JOIN mechanic_profiles mp ON mp.user_id = p.id
         LEFT JOIN LATERAL (
           SELECT rejection_reason FROM mechanic_verifications
            WHERE mechanic_id = p.id ORDER BY created_at DESC LIMIT 1
         ) mv ON true
        WHERE p.id = $1`,
      [authenticated.user.id]
    )
    if (!rows[0]) return NextResponse.json({ error: 'Mechanic profile not found.' }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (error) {
    console.error('[GET /api/mechanic/verification] Local status lookup failed:', error)
    return NextResponse.json({ error: 'Unable to load verification status.' }, { status: 500 })
  }
}
