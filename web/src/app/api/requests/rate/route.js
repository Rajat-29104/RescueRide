import { getAuthenticatedUser } from '@/lib/localAuth'
import { submitLocalRating } from '@/lib/localRequestRating'
import { sanitizeInput } from '@/lib/validate'
import { NextResponse } from 'next/server'

export async function PATCH(req) {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (authenticated.profile.role !== 'driver') {
    return NextResponse.json({ error: 'Only drivers can submit request ratings.' }, { status: 403 })
  }

  let body
  try {
    body = sanitizeInput(await req.json()) || {}
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const rating = Number(body.rating)
  if (!body.requestId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'A request ID and whole-number rating from 1 to 5 are required.' }, { status: 400 })
  }

  try {
    const result = await submitLocalRating({
      requestId: body.requestId,
      driverId: authenticated.user.id,
      rating,
      review: String(body.review || '').trim().slice(0, 2000),
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[PATCH /api/requests/rate] Local rating write failed:', error)
    return NextResponse.json(
      { error: error.message || 'Unable to submit rating.' },
      { status: error.status || 500 }
    )
  }
}
