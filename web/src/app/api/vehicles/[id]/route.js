import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireDriver } from '@/lib/rbac'
import { sanitizeInput } from '@/lib/validate'
import { validateVehiclePayload, archiveVehicle } from '@/lib/vehicle'

export async function GET(_request, { params }) {
  try {
    const auth = await requireDriver()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { id } = await params
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('driver_vehicles')
      .select('*')
      .eq('id', id)
      .eq('driver_id', auth.user.id)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 })
    }

    return NextResponse.json({ vehicle: data }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to load vehicle.' }, { status: 500 })
  }
}

export async function PATCH(request, { params }) {
  try {
    const auth = await requireDriver()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { id } = await params
    const body = sanitizeInput(await request.json())
    const validation = validateVehiclePayload(body)

    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors[0] }, { status: 400 })
    }

    const supabase = await createClient()
    const payload = {
      make: validation.normalized.make,
      model: validation.normalized.model,
      year: validation.normalized.year,
      color: validation.normalized.color,
      plate: validation.normalized.plate,
      vin: validation.normalized.vin,
      registration_expiry: validation.normalized.registration_expiry,
      notes: validation.normalized.notes,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('driver_vehicles')
      .update(payload)
      .eq('id', id)
      .eq('driver_id', auth.user.id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505' || /plate/i.test(error.message || '')) {
        return NextResponse.json({ error: 'A vehicle with this plate number already exists for this driver.' }, { status: 409 })
      }
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 })
    }

    return NextResponse.json({ vehicle: data }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to update vehicle.' }, { status: 500 })
  }
}

export async function DELETE(_request, { params }) {
  try {
    const auth = await requireDriver()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { id } = await params
    const supabase = await createClient()
    const existingResult = await supabase
      .from('driver_vehicles')
      .select('*')
      .eq('id', id)
      .eq('driver_id', auth.user.id)
      .maybeSingle()

    if (existingResult.error) {
      throw existingResult.error
    }

    if (!existingResult.data) {
      return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 })
    }

    const archived = archiveVehicle(existingResult.data)
    const { data, error } = await supabase
      .from('driver_vehicles')
      .update({
        is_archived: archived.is_archived,
        updated_at: archived.updated_at,
      })
      .eq('id', id)
      .eq('driver_id', auth.user.id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ vehicle: data, archived: true }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to archive vehicle.' }, { status: 500 })
  }
}
