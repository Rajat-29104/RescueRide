import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireDriver } from '@/lib/rbac'
import { sanitizeInput } from '@/lib/validate'
import { validateVehicleInput } from '@/lib/vehicleValidation'

export async function GET() {
  const auth = await requireDriver()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vehicles')
    .select('id, vehicle_type, make, model, year, fuel_type, color, registration_number, created_at, updated_at')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[VEHICLES] Failed to list vehicles:', error.message)
    return NextResponse.json({ error: 'Unable to load vehicles.' }, { status: 500 })
  }

  return NextResponse.json({ vehicles: data }, { status: 200 })
}

export async function POST(request) {
  const auth = await requireDriver()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

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
    .insert({ ...validation.value, user_id: auth.user.id })
    .select('id, vehicle_type, make, model, year, fuel_type, color, registration_number, created_at, updated_at')
    .single()

  if (error?.code === '23505') {
    return NextResponse.json({ error: 'That registration number is already saved to your account.' }, { status: 409 })
  }
  if (error) {
    console.error('[VEHICLES] Failed to create vehicle:', error.message)
    return NextResponse.json({ error: 'Unable to save vehicle.' }, { status: 500 })
  }

  return NextResponse.json({ vehicle: data }, { status: 201 })
}
