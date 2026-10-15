import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/localAuth'
import { requestLimiter } from '@/lib/rateLimit'
import { sendNotificationEmail } from '@/lib/email'
import { sanitizeInput } from '@/lib/validate'
import { isUuid, VEHICLE_TYPES } from '@/lib/vehicleValidation'
import { SERVICE_TYPE } from '@/lib/constants'
import { getRequestCostEstimate, isValidRequestPriority } from '@/lib/requestCost'

const ACTIVE_STATUSES = ['pending', 'offered', 'accepted', 'en_route', 'arrived', 'in_progress']

export async function GET(req) {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (authenticated.profile.role !== 'driver') {
    return NextResponse.json({ error: 'Only drivers can view driver request history.' }, { status: 403 })
  }

  const requestedLimit = Number(new URL(req.url).searchParams.get('limit') || 100)
  const limit = Number.isInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : 100

  try {
    const { rows } = await pool.query(
      `SELECT id, status, service_type, problem_description, incident_address,
              created_at, accepted_at, priority, estimated_cost_min,
              estimated_cost_max, final_cost
         FROM rescue_requests
        WHERE driver_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [authenticated.user.id, limit]
    )
    return NextResponse.json({ requests: rows })
  } catch (error) {
    console.error('[GET /api/requests] Failed to load local request history:', error)
    return NextResponse.json({ error: 'Unable to load request history.' }, { status: 500 })
  }
}

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous'
  if (!requestLimiter(ip).allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again in a minute.' },
      { status: 429 }
    )
  }

  const authenticated = await getAuthenticatedUser()
  if (!authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { user, profile } = authenticated
  if (profile.is_suspended) {
    return NextResponse.json(
      { error: `Account suspended: ${profile.suspension_reason || 'Policy violations'}. Cannot create rescue requests.` },
      { status: 403 }
    )
  }
  if (profile.role !== 'driver') {
    const error = profile.role === 'mechanic'
      ? 'Mechanic accounts receive rescue requests but cannot create them. Sign out and log in with your driver account.'
      : 'Only driver accounts can create rescue requests. Sign out and log in with your driver account.'
    return NextResponse.json(
      { error },
      { status: 403 }
    )
  }

  let body
  try {
    body = sanitizeInput(await req.json()) || {}
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { incidentLat, incidentLng, serviceType } = body
  if (incidentLat == null || incidentLng == null || !serviceType) {
    return NextResponse.json(
      { error: 'incidentLat, incidentLng, and serviceType are required' },
      { status: 400 }
    )
  }
  if (!Object.values(SERVICE_TYPE).includes(serviceType)) {
    return NextResponse.json({ error: 'Choose a valid service type.' }, { status: 400 })
  }

  const priority = body.priority || 'normal'
  if (!isValidRequestPriority(priority)) {
    return NextResponse.json({ error: 'Choose a valid request priority.' }, { status: 400 })
  }

  const lat = Number(incidentLat)
  const lng = Number(incidentLng)
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return NextResponse.json(
      { error: 'incidentLat must be a valid latitude between -90 and 90 degrees' },
      { status: 400 }
    )
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return NextResponse.json(
      { error: 'incidentLng must be a valid longitude between -180 and 180 degrees' },
      { status: 400 }
    )
  }

  const targetMechanicId =
    body.target_mechanic_id ||
    body.targetMechanicId ||
    body.preferredMechanicId ||
    body.preferred_mechanic_id ||
    null
  if (targetMechanicId && !isUuid(targetMechanicId)) {
    return NextResponse.json({ error: 'Choose a valid mechanic.' }, { status: 400 })
  }

  const vehicleId = body.vehicleId || body.vehicle_id || null
  if (vehicleId && !isUuid(vehicleId)) {
    return NextResponse.json({ error: 'A valid saved vehicle must be selected.' }, { status: 400 })
  }

  const client = await pool.connect()
  let request
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [user.id])

    const { rows: activeRequests } = await client.query(
      `SELECT id FROM rescue_requests
        WHERE driver_id = $1 AND status = ANY($2::text[])
        LIMIT 1`,
      [user.id, ACTIVE_STATUSES]
    )
    if (activeRequests.length) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { error: 'You already have an active rescue request.' },
        { status: 400 }
      )
    }

    const { rows: requestCounts } = await client.query(
      `SELECT count(*)::integer AS count FROM rescue_requests
        WHERE driver_id = $1 AND created_at > now() - interval '1 hour'`,
      [user.id]
    )
    if (requestCounts[0].count >= 3) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { error: 'Maximum request threshold exceeded. Limit 3 requests per hour.' },
        { status: 429 }
      )
    }

    let vehicle = null
    if (vehicleId) {
      const { rows } = await client.query(
        `SELECT id, vehicle_type, make, model, year, color, registration_number
           FROM vehicles WHERE id = $1 AND user_id = $2`,
        [vehicleId, user.id]
      )
      vehicle = rows[0]
      if (!vehicle) {
        await client.query('ROLLBACK')
        return NextResponse.json(
          { error: 'The selected vehicle does not belong to your account.' },
          { status: 400 }
        )
      }
    }

    if (targetMechanicId) {
      const { rows } = await client.query(
        `SELECT verification_status, is_available
           FROM mechanic_profiles
          WHERE user_id = $1
          FOR UPDATE`,
        [targetMechanicId]
      )
      const mechanic = rows[0]
      if (!mechanic) {
        await client.query('ROLLBACK')
        return NextResponse.json(
          { error: 'The selected mechanic profile could not be verified.', code: 'MECHANIC_NOT_FOUND' },
          { status: 404 }
        )
      }
      if (mechanic.verification_status !== 'approved') {
        await client.query('ROLLBACK')
        return NextResponse.json(
          { error: 'The selected mechanic is not verified for direct dispatch.', code: 'MECHANIC_NOT_APPROVED' },
          { status: 400 }
        )
      }
      if (!mechanic.is_available) {
        await client.query('ROLLBACK')
        return NextResponse.json(
          { error: 'Selected mechanic is currently unavailable.', code: 'PROVIDER_OFFLINE' },
          { status: 409 }
        )
      }
    }

    const vehicleType = vehicle?.vehicle_type || body.vehicleType || 'car'
    if (!VEHICLE_TYPES.includes(vehicleType)) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Choose a valid vehicle type.' }, { status: 400 })
    }

    const cost = getRequestCostEstimate(serviceType, vehicleType)
    const id = randomUUID()
    const insertResult = await client.query(
      `INSERT INTO rescue_requests (
         id, driver_id, mechanic_id, vehicle_id, status, priority, service_type,
         incident_location, incident_lat, incident_lng, incident_address,
         problem_description, vehicle_make, vehicle_model, vehicle_type,
         vehicle_year, vehicle_color, vehicle_plate, estimated_cost_min,
         estimated_cost_max, cost_currency, vehicle_image_url, ai_diagnostic_result
       )
       VALUES (
         $1, $2, $3, $4, 'pending', $5, $6,
         ST_SetSRID(ST_MakePoint($7, $8), 4326), $8, $7, $9,
         $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
       )
       RETURNING *`,
      [
        id,
        user.id,
        targetMechanicId,
        vehicle?.id || null,
        priority,
        serviceType,
        lng,
        lat,
        body.incidentAddress || null,
        body.problemDescription || '',
        vehicle?.make || body.vehicleMake || null,
        vehicle?.model || body.vehicleModel || null,
        vehicleType,
        vehicle?.year ?? (body.vehicleYear ? Number(body.vehicleYear) : null),
        vehicle?.color || body.vehicleColor || null,
        vehicle?.registration_number || body.vehiclePlate || null,
        cost.minimum,
        cost.maximum,
        cost.currency,
        body.vehicle_image_url || body.vehicleImageUrl || null,
        body.aiDiagnosticResult ? JSON.stringify(body.aiDiagnosticResult) : null,
      ]
    )
    request = insertResult.rows[0]

    if (targetMechanicId) {
      await client.query(
        `UPDATE mechanic_profiles
            SET is_available = false, current_status = 'dispatched'
          WHERE user_id = $1`,
        [targetMechanicId]
      )
    }
    await client.query(
      `INSERT INTO request_metrics (request_id, created_at, status)
       VALUES ($1, $2, 'pending')`,
      [request.id, request.created_at]
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[POST /api/requests] Local database operation failed:', error)
    return NextResponse.json({ error: 'Unable to create rescue request.' }, { status: 500 })
  } finally {
    client.release()
  }

  try {
    const { rows: candidates } = targetMechanicId
      ? await pool.query(
        `SELECT id AS user_id, full_name, email, 'Direct'::text AS distance_km
           FROM profiles WHERE id = $1`,
        [targetMechanicId]
      )
      : await pool.query(
        'SELECT * FROM get_nearby_verified_mechanics($1, $2, 10)',
        [lat, lng]
      )

    await pool.query(
      `UPDATE request_metrics
          SET matched_at = now(), candidate_mechanics_count = $2, updated_at = now()
        WHERE request_id = $1`,
      [request.id, candidates.length]
    )

    if (candidates.length) {
      const notificationTitle = priority === 'critical'
        ? 'Critical SOS request'
        : priority === 'emergency'
          ? 'Emergency rescue request'
          : targetMechanicId ? 'Direct rescue request' : 'New rescue request'
      const location = body.incidentAddress || 'location pinned'
      const notifications = candidates.map((mechanic) => [
        mechanic.user_id,
        priority === 'critical' ? 'emergency' : 'new_request',
        notificationTitle,
        targetMechanicId
          ? `${serviceType} request dispatched to you - ${location}`
          : `${serviceType} request ${mechanic.distance_km}km away - ${location}`,
        request.id,
      ])
      const notificationValues = []
      const notificationRows = notifications.map((values, rowIndex) => {
        const offset = rowIndex * 5
        notificationValues.push(...values)
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`
      })
      await pool.query(
        `INSERT INTO notifications (profile_id, type, title, body, request_id)
         VALUES ${notificationRows.join(', ')}`,
        notificationValues
      )

      for (const mechanic of candidates) {
        sendNotificationEmail({
          to: mechanic.email || `mechanic-${mechanic.user_id}@roadrescue.com`,
          subject: `${priority === 'critical' ? 'CRITICAL SOS: ' : priority === 'emergency' ? 'EMERGENCY: ' : ''}${serviceType} request`,
          type: 'new_request',
          data: {
            mechanicName: mechanic.full_name || 'Mechanic',
            issueDescription: body.problemDescription,
            location,
            distance: typeof mechanic.distance_km === 'number'
              ? `${mechanic.distance_km} km`
              : `${mechanic.distance_km}`,
            appUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/mechanic/job/${request.id}`,
          },
        }).catch((error) => {
          console.warn(`[REQUEST EMAIL] Failed for mechanic ${mechanic.user_id}:`, error)
        })
      }
    }

    return NextResponse.json({ request, notifiedCount: candidates.length }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/requests] Dispatch matching failed:', error)
    return NextResponse.json(
      {
        request,
        notifiedCount: 0,
        warning: 'The request was created, but mechanic matching or notifications failed.',
      },
      { status: 202 }
    )
  }
}
