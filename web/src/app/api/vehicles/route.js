import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireDriver } from '@/lib/rbac'
import { sanitizeInput } from '@/lib/validate'
import { validateVehiclePayload } from '@/lib/vehicle'

export async function GET() {
  try {
    const auth = await requireDriver()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('driver_vehicles')
      .select('*')
      .eq('driver_id', auth.user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ vehicles: data || [] }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to load vehicles.' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const auth = await requireDriver()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = sanitizeInput(await request.json())
    const validation = validateVehiclePayload(body)

    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors[0] }, { status: 400 })
    }

    const supabase = await createClient()
    const payload = {
      driver_id: auth.user.id,
      make: validation.normalized.make,
      model: validation.normalized.model,
      year: validation.normalized.year,
      color: validation.normalized.color,
      plate: validation.normalized.plate,
      vin: validation.normalized.vin,
      registration_expiry: validation.normalized.registration_expiry,
      notes: validation.normalized.notes,
      is_archived: false,
    }

    const { data, error } = await supabase
      .from('driver_vehicles')
      .insert(payload)
      .select()
      .single()

    if (error) {
      if (error.code === '23505' || /plate/i.test(error.message || '')) {
        return NextResponse.json({ error: 'A vehicle with this plate number already exists for this driver.' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ vehicle: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to create vehicle.' }, { status: 500 })
  }
}
