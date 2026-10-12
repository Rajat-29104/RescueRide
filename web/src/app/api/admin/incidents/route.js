import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/rbac'
import { validateIncidentStatusTransition } from '@/lib/safety'

export async function GET() {
  try {
    const adminCheck = await requireAdmin()
    if (adminCheck.error) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('incident_reports')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to load incidents.' }, { status: 500 })
    }

    return NextResponse.json({ incidents: data || [] }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const adminCheck = await requireAdmin()
    if (adminCheck.error) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
    }

    const supabase = await createClient()
    let rawBody = {}
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const { incidentId, status, reviewNotes } = rawBody

    if (!incidentId) {
      return NextResponse.json({ error: 'incidentId is required.' }, { status: 400 })
    }

    const { data: existing, error: existingError } = await supabase
      .from('incident_reports')
      .select('*')
      .eq('id', incidentId)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ error: existingError.message || 'Failed to load incident.' }, { status: 500 })
    }

    if (!existing) {
      return NextResponse.json({ error: 'Incident not found.' }, { status: 404 })
    }

    if (!status) {
      return NextResponse.json({ error: 'status is required.' }, { status: 400 })
    }

    const transition = validateIncidentStatusTransition(existing.status, status)
    if (!transition.valid) {
      return NextResponse.json({ error: transition.reason }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('incident_reports')
      .update({
        status,
        review_notes: reviewNotes || existing.review_notes,
        reviewed_by: (await supabase.auth.getUser()).data.user?.id || existing.reviewed_by,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', incidentId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to update incident.' }, { status: 500 })
    }

    return NextResponse.json({ incident: data }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
