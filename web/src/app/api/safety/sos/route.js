import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireDriver } from '@/lib/rbac'
import { SOS_STATUS, validateSosPayload } from '@/lib/safety'

export async function POST(request) {
  try {
    const guard = await requireDriver()
    if (guard.error) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let rawBody = {}
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const validation = validateSosPayload(rawBody)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors[0] }, { status: 400 })
    }

    const { requestId, status, latitude, longitude, message } = validation.normalized
    if (status !== SOS_STATUS.RAISED) {
      return NextResponse.json({ error: 'A new SOS event must start with status RAISED.' }, { status: 400 })
    }

    const { data: requestData, error: requestError } = await supabase
      .from('rescue_requests')
      .select('id, status, driver_id, mechanic_id')
      .eq('id', requestId)
      .maybeSingle()

    if (requestError) {
      return NextResponse.json({ error: requestError.message || 'Failed to load request.' }, { status: 500 })
    }

    if (!requestData) {
      return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
    }

    const allowedOwner = [requestData.driver_id, requestData.mechanic_id].includes(user.id)
    if (!allowedOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const eventInsert = {
      driver_id: user.id,
      related_request_id: requestId,
      latitude,
      longitude,
      status,
      resolution_notes: message || null,
      raised_at: new Date().toISOString(),
      acknowledged_by: status === 'ACKNOWLEDGED' ? user.id : null,
      acknowledged_at: status === 'ACKNOWLEDGED' ? new Date().toISOString() : null,
      resolved_by: status === 'RESOLVED' ? user.id : null,
      resolved_at: status === 'RESOLVED' ? new Date().toISOString() : null,
    }

    const { data, error } = await supabase
      .from('sos_events')
      .insert(eventInsert)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to create SOS event.' }, { status: 500 })
    }

    return NextResponse.json({ sos: data }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/safety/sos]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
