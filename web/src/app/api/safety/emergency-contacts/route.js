import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireDriver } from '@/lib/rbac'
import { validateEmergencyContact } from '@/lib/safety'

async function getLegacyEmergencyContact(supabase, userId) {
  const { data, error } = await supabase
    .from('driver_profiles')
    .select('emergency_contact_name, emergency_contact_phone')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  const name = typeof data.emergency_contact_name === 'string' ? data.emergency_contact_name.trim() : ''
  const phone = typeof data.emergency_contact_phone === 'string' ? data.emergency_contact_phone.trim() : ''

  if (!name && !phone) {
    return null
  }

  return {
    id: userId,
    driver_id: userId,
    name,
    relationship: 'Emergency Contact',
    phone_number: phone,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export async function GET() {
  try {
    const driverCheck = await requireDriver()
    if (driverCheck.error) {
      return NextResponse.json({ error: driverCheck.error }, { status: driverCheck.status })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('driver_id', userId)
      .order('created_at', { ascending: false })

    if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
      const fallback = await getLegacyEmergencyContact(supabase, userId)
      return NextResponse.json({ contacts: fallback ? [fallback] : [] }, { status: 200 })
    }

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to load emergency contacts.' }, { status: 500 })
    }

    return NextResponse.json({ contacts: data || [] }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const driverCheck = await requireDriver()
    if (driverCheck.error) {
      return NextResponse.json({ error: driverCheck.error }, { status: driverCheck.status })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rawBody = await request.json()
    const payload = {
      name: rawBody?.name,
      relationship: rawBody?.relationship,
      phoneNumber: rawBody?.phoneNumber || rawBody?.phone || rawBody?.contactPhone,
    }

    const validation = validateEmergencyContact(payload)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors[0] }, { status: 400 })
    }

    const insertPayload = {
      driver_id: user.id,
      name: validation.normalized.name,
      relationship: validation.normalized.relationship,
      phone_number: validation.normalized.phoneNumber,
    }

    const { data, error } = await supabase
      .from('emergency_contacts')
      .insert(insertPayload)
      .select()
      .single()

    if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
      const { error: legacyError } = await supabase
        .from('driver_profiles')
        .update({
          emergency_contact_name: validation.normalized.name,
          emergency_contact_phone: validation.normalized.phoneNumber,
        })
        .eq('user_id', user.id)

      if (legacyError) {
        return NextResponse.json({ error: legacyError.message || 'Failed to save emergency contact.' }, { status: 500 })
      }

      return NextResponse.json({
        contact: {
          id: user.id,
          driver_id: user.id,
          name: validation.normalized.name,
          relationship: validation.normalized.relationship,
          phone_number: validation.normalized.phoneNumber,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }, { status: 200 })
    }

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to save emergency contact.' }, { status: 500 })
    }

    return NextResponse.json({ contact: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
