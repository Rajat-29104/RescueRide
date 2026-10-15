import { pool, query } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/localAuth'
import { NextResponse } from 'next/server'
import { sanitizeInput } from '@/lib/validate'

async function getParticipantRequest(requestId, userId) {
  const { rows } = await query(
    `SELECT id, driver_id, mechanic_id, status FROM rescue_requests WHERE id = $1`,
    [requestId]
  )
  const request = rows[0]
  if (!request) return { error: 'Request not found', status: 404 }
  if (request.driver_id !== userId && request.mechanic_id !== userId) {
    return { error: 'Not authorized', status: 403 }
  }
  return { request }
}

export async function GET(_request, { params }) {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'requestId parameter is required' }, { status: 400 })

  try {
    const access = await getParticipantRequest(id, authenticated.user.id)
    if (access.error) return NextResponse.json({ error: access.error }, { status: access.status })
    const { rows } = await query(
      `SELECT id, sender_id, message, created_at
         FROM messages WHERE request_id = $1
        ORDER BY created_at ASC LIMIT 1000`,
      [id]
    )
    await query(
      `UPDATE notifications SET is_read = true
        WHERE profile_id = $1 AND request_id = $2 AND is_read = false`,
      [authenticated.user.id, id]
    )
    return NextResponse.json({
      messages: rows,
      requestStatus: access.request.status,
      driverId: access.request.driver_id,
      mechanicId: access.request.mechanic_id,
      currentUserId: authenticated.user.id,
      currentUserRole: authenticated.profile.role,
    })
  } catch (error) {
    console.error('[GET /api/requests/[id]/messages] Local message read failed:', error)
    return NextResponse.json({ error: 'Failed to load messages.' }, { status: 500 })
  }
}

export async function POST(request, { params }) {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'requestId parameter is required' }, { status: 400 })

  let body
  try {
    body = sanitizeInput(await request.json()) || {}
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
  if (message.length > 1000) return NextResponse.json({ error: 'Message cannot exceed 1000 characters.' }, { status: 400 })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `SELECT id, driver_id, mechanic_id, status
         FROM rescue_requests WHERE id = $1 FOR UPDATE`,
      [id]
    )
    const rescueRequest = rows[0]
    if (!rescueRequest) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
    }
    if (rescueRequest.driver_id !== authenticated.user.id && rescueRequest.mechanic_id !== authenticated.user.id) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
    }
    if (['completed', 'cancelled'].includes(rescueRequest.status)) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: `Cannot send messages on a ${rescueRequest.status} rescue request.` }, { status: 400 })
    }

    const inserted = await client.query(
      `INSERT INTO messages (request_id, sender_id, message)
       VALUES ($1, $2, $3) RETURNING id, sender_id, message, created_at`,
      [id, authenticated.user.id, message]
    )
    const recipientId = rescueRequest.driver_id === authenticated.user.id
      ? rescueRequest.mechanic_id
      : rescueRequest.driver_id
    if (recipientId) {
      const senderType = authenticated.profile.role === 'driver' ? 'Driver' : 'Mechanic'
      await client.query(
        `INSERT INTO notifications (profile_id, request_id, title, body, type)
         VALUES ($1, $2, $3, $4, 'chat')`,
        [recipientId, id, `New Message from ${senderType}`, `${message} [req_id: ${id}]`]
      )
    }
    await client.query('COMMIT')
    return NextResponse.json({ message: inserted.rows[0] }, { status: 201 })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[POST /api/requests/[id]/messages] Local message write failed:', error)
    return NextResponse.json({ error: 'Failed to send message.' }, { status: 500 })
  } finally {
    client.release()
  }
}
