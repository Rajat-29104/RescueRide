import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) throw profileError
    if (profile?.role !== 'driver') {
      return NextResponse.json({ error: 'Only drivers can select a mechanic for a request.' }, { status: 403 })
    }

    let serviceSupabase
    try {
      serviceSupabase = await createServiceClient()
    } catch (error) {
      console.error('[AVAILABLE MECHANICS CONFIGURATION]', error.message)
      return NextResponse.json(
        { error: 'Provider lookup is not configured. Contact RescueRide support.' },
        { status: 503 }
      )
    }
    const { data: mechanics, error } = await serviceSupabase
      .from('mechanic_profiles')
      .select('user_id, business_name, specializations, rating_avg, rating_count, location_label')
      .eq('verification_status', 'approved')
      .eq('is_available', true)
      .order('business_name', { ascending: true })
      .limit(50)

    if (error) throw error
    return NextResponse.json({ mechanics: mechanics || [] }, { status: 200 })
  } catch (error) {
    console.error('[GET /api/mechanics/available]', error)
    return NextResponse.json({ error: 'Unable to load verified, available mechanics.' }, { status: 500 })
  }
}
