import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { hashPassword, publicUser } from '@/lib/localAuth'
import { generalLimiter } from '@/lib/rateLimit'

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!generalLimiter(`signup:${ip}`).allowed) {
    return NextResponse.json({ error: 'Too many registration attempts. Try again later.' }, { status: 429 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const fullName = String(body.fullName || '').trim()
  const phone = String(body.phone || '').trim()
  const role = body.role

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6 || !fullName || !phone) {
    return NextResponse.json({ error: 'Enter a valid email, name, phone, and password of at least 6 characters.' }, { status: 400 })
  }
  if (!['driver', 'mechanic'].includes(role)) {
    return NextResponse.json({ error: 'Choose a valid account role.' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const blocked = await client.query(
      'SELECT 1 FROM blocked_emails WHERE lower(email) = $1',
      [email]
    )
    if (blocked.rowCount) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'This email is blocked from creating a new account.' }, { status: 403 })
    }

    const id = randomUUID()
    const passwordHash = await hashPassword(password)
    const profileResult = await client.query(
      `INSERT INTO profiles (id, email, password_hash, role, full_name, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, role, full_name, phone, avatar_url, created_at`,
      [id, email, passwordHash, role, fullName, phone]
    )

    if (role === 'driver') {
      const driver = body.driverProfile || {}
      await client.query(
        `INSERT INTO driver_profiles
          (user_id, home_area, vehicle_make, vehicle_model, vehicle_year, vehicle_color,
           vehicle_plate, emergency_contact_name, emergency_contact_phone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          driver.home_area || null,
          driver.vehicle_make || '',
          driver.vehicle_model || '',
          driver.vehicle_year || null,
          driver.vehicle_color || '',
          driver.vehicle_plate || '',
          driver.emergency_contact_name || '',
          driver.emergency_contact_phone || '',
        ]
      )
    } else {
      const mechanic = body.mechanicProfile || {}
      await client.query(
        `INSERT INTO mechanic_profiles
          (user_id, business_name, years_experience, specializations, location_label)
         VALUES ($1, $2, $3, $4::jsonb, $5)`,
        [
          id,
          mechanic.business_name || '',
          Number.isInteger(mechanic.years_experience) ? mechanic.years_experience : 0,
          JSON.stringify(Array.isArray(mechanic.specializations) ? mechanic.specializations : []),
          mechanic.location_label || null,
        ]
      )
      await client.query(
        'INSERT INTO mechanic_verifications (mechanic_id) VALUES ($1)',
        [id]
      )
    }

    await client.query('COMMIT')
    return NextResponse.json({ user: publicUser(profileResult.rows[0]) }, { status: 201 })
  } catch (error) {
    await client.query('ROLLBACK')
    if (error.code === '23505') {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }
    console.error('[LOCAL AUTH] Registration failed:', error)
    return NextResponse.json({ error: 'Unable to create your account right now.' }, { status: 500 })
  } finally {
    client.release()
  }
}
