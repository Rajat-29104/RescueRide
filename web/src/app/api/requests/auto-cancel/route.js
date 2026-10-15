import { getAuthenticatedUser } from '@/lib/localAuth'
import { updateLocalRequestStatus } from '@/lib/localRequestStatus'
import { normalizeString } from '@/lib/rescueLifecycle'
import { sanitizeInput } from '@/lib/validate'
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function POST(req) {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try {
    body = sanitizeInput(await req.json()) || {}
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const requestId = body.requestId || body.id
  if (!requestId) return NextResponse.json({ error: 'requestId is required.' }, { status: 400 })

  try {
    const { rows } = await query(
      `SELECT driver_id, mechanic_id FROM rescue_requests WHERE id = $1`,
      [requestId]
    )
    const request = rows[0]
    if (!request) return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
    if (
      authenticated.profile.role !== 'admin' &&
      request.driver_id !== authenticated.user.id &&
      request.mechanic_id !== authenticated.user.id
    ) {
      return NextResponse.json({ error: 'Not authorized to cancel this request.' }, { status: 403 })
    }

    const reason = normalizeString(
      body.reason ?? body.cancellationReason ?? body.cancellation_reason ?? 'mechanic inactivity timeout'
    )
    const result = await updateLocalRequestStatus({
      requestId,
      actorId: authenticated.user.id,
      actorRole: 'system',
      newStatus: 'cancelled',
      cancellationReason: reason.startsWith('system_timeout:') ? reason : `system_timeout: ${reason}`,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[POST /api/requests/auto-cancel] Local status update failed:', error)
    return NextResponse.json(
      { error: error.message || 'Unable to auto-cancel request.' },
      { status: error.status || 500 }
    )
  }
}
