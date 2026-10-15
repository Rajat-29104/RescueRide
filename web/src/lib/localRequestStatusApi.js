import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/localAuth'
import { normalizeString, normalizeStatus } from '@/lib/rescueLifecycle'
import { sanitizeInput } from '@/lib/validate'
import { updateLocalRequestStatus } from '@/lib/localRequestStatus'

export async function handleLocalRequestStatus(req, requestId) {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user, profile } = authenticated
  if (profile.is_suspended) {
    return NextResponse.json(
      { error: `Account suspended: ${profile.suspension_reason || 'Policy violations'}.` },
      { status: 403 }
    )
  }

  let body
  try {
    body = sanitizeInput(await req.json()) || {}
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const newStatus = normalizeStatus(body.newStatus || body.status)
  if (!requestId || !newStatus) {
    return NextResponse.json({ error: 'requestId and status are required.' }, { status: 400 })
  }
  const rawReason = normalizeString(body.reason ?? body.cancellationReason ?? body.cancellation_reason)
  const cancellationReason = newStatus === 'cancelled' && rawReason &&
    !rawReason.startsWith('user:') && !rawReason.startsWith('system_timeout:')
    ? `user: ${rawReason}`
    : rawReason

  try {
    const result = await updateLocalRequestStatus({
      requestId,
      actorId: user.id,
      actorRole: profile.role,
      newStatus,
      completionNotes: normalizeString(body.completionNotes ?? body.completion_notes),
      performedServices: Array.isArray(body.performedServices)
        ? body.performedServices
        : Array.isArray(body.performed_services) ? body.performed_services : undefined,
      cancellationReason,
      finalCost: body.finalCost ?? body.final_cost,
      paymentMethod: body.paymentMethod ?? body.payment_method,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[LOCAL REQUEST STATUS] Update failed:', error)
    const status = error.status || (
      /not found/i.test(error.message) ? 404 :
        /not authorized|only mechanics|not verified|cannot cancel/i.test(error.message) ? 403 :
          /valid|invalid|required/i.test(error.message) ? 400 :
            /already|active|changed|conflict/i.test(error.message) ? 409 : 500
    )
    return NextResponse.json({ error: error.message || 'Unable to update request status.' }, { status })
  }
}
