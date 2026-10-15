import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireDriver } from '@/lib/rbac'
import { sanitizeInput } from '@/lib/validate'
import { isUuid, validateVehicleInput } from '@/lib/vehicleValidation'

export async function PATCH(request, { params }) {
  const auth = await requireDriver()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid vehicle ID.' }, { status: 400 })

  let body
  try {
    body = sanitizeInput(await request.json())
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }

  const validation = validateVehicleInput(body)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.errors[0], details: validation.errors }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vehicles')
    .update({ ...validation.value, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .select('id, vehicle_type, make, model, year, fuel_type, color, registration_number, created_at, updated_at')
    .maybeSingle()

  if (error?.code === '23505') {
    return NextResponse.json({ error: 'That registration number is already saved to your account.' }, { status: 409 })
  }
  if (error) {
    console.error('[VEHICLES] Failed to update vehicle:', error.message)
    return NextResponse.json({ error: 'Unable to update vehicle.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 })

  return NextResponse.json({ vehicle: data }, { status: 200 })
}

export async function DELETE(_request, { params }) {
  const auth = await requireDriver()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid vehicle ID.' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vehicles')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[VEHICLES] Failed to delete vehicle:', error.message)
    return NextResponse.json({ error: 'Unable to delete vehicle.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 })

  return NextResponse.json({ success: true }, { status: 200 })
}
