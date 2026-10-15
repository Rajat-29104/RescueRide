import { pool } from '@/lib/db'
import { isValidTransition, normalizeStatus, formatRequestRow } from '@/lib/rescueLifecycle'
import { isValidFinalCost } from '@/lib/requestCost'

const TERMINAL_STATUSES = ['completed', 'cancelled']

export async function updateLocalRequestStatus({
  requestId,
  actorId,
  actorRole,
  newStatus: requestedStatus,
  completionNotes,
  performedServices,
  cancellationReason,
  finalCost,
  paymentMethod,
}) {
  const newStatus = normalizeStatus(requestedStatus)
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      'SELECT * FROM rescue_requests WHERE id = $1 FOR UPDATE',
      [requestId]
    )
    const request = rows[0]
    if (!request) throw Object.assign(new Error('Request not found'), { status: 404 })

    if (!isValidTransition(request.status, newStatus)) {
      throw Object.assign(
        new Error(`Cannot transition from ${request.status} to ${newStatus} - invalid state change`),
        { status: 400 }
      )
    }

    if (newStatus === 'accepted') {
      if (!['mechanic', 'admin'].includes(actorRole)) {
        throw Object.assign(new Error('Only mechanics can accept requests'), { status: 403 })
      }
      if (actorRole === 'mechanic') {
        if (request.mechanic_id && request.mechanic_id !== actorId) {
          throw Object.assign(new Error('Another mechanic already accepted this request'), { status: 409 })
        }
        const { rows: mechanics } = await client.query(
          `SELECT verification_status
             FROM mechanic_profiles
            WHERE user_id = $1
            FOR UPDATE`,
          [actorId]
        )
        if (mechanics[0]?.verification_status !== 'approved') {
          throw Object.assign(new Error('Mechanic account is not verified to accept requests'), { status: 403 })
        }
        const { rows: otherActive } = await client.query(
          `SELECT id FROM rescue_requests
            WHERE mechanic_id = $1
              AND status = ANY($2::text[])
              AND id <> $3
            LIMIT 1`,
          [actorId, ['accepted', 'en_route', 'arrived', 'in_progress'], requestId]
        )
        if (otherActive.length) {
          throw Object.assign(new Error('Mechanic already has an active rescue request'), { status: 409 })
        }
      }
    } else if (newStatus === 'cancelled') {
      const isDriverOwner = actorRole === 'driver' && request.driver_id === actorId
      const isAssignedMechanic = actorRole === 'mechanic' && request.mechanic_id === actorId
      const isAdmin = actorRole === 'admin'
      const isSystem = actorRole === 'system'
      if (!isDriverOwner && !isAssignedMechanic && !isAdmin && !isSystem) {
        throw Object.assign(new Error('Not authorized to cancel this request'), { status: 403 })
      }
      if (isDriverOwner && !['pending', 'offered', 'accepted', 'en_route'].includes(request.status)) {
        throw Object.assign(new Error('Drivers cannot cancel after the mechanic has arrived or work has started'), { status: 403 })
      }
      if (isAssignedMechanic && !['pending', 'offered', 'accepted', 'en_route', 'arrived'].includes(request.status)) {
        throw Object.assign(new Error('Mechanics cannot cancel once work is in progress'), { status: 403 })
      }
      if (isAssignedMechanic && !cancellationReason) {
        throw Object.assign(new Error('A cancellation reason is required for mechanic cancellations'), { status: 400 })
      }
    } else {
      if (!['mechanic', 'admin'].includes(actorRole)) {
        throw Object.assign(new Error('Only mechanics can update rescue status'), { status: 403 })
      }
      if (actorRole === 'mechanic' && request.mechanic_id !== actorId) {
        throw Object.assign(new Error('Not authorized - you do not own this request'), { status: 403 })
      }
    }

    if (newStatus === 'completed' && actorRole === 'mechanic') {
      if (!isValidFinalCost(finalCost)) {
        throw Object.assign(new Error('A valid final service cost is required to complete this request'), { status: 400 })
      }
      if (!['cash', 'upi'].includes(paymentMethod)) {
        throw Object.assign(new Error('Choose a valid payment method'), { status: 400 })
      }
    }

    const values = [requestId, newStatus]
    const assignments = ['status = $2', 'updated_at = now()']
    const setValue = (column, value) => {
      values.push(value)
      assignments.push(`${column} = $${values.length}`)
    }

    if (newStatus === 'accepted') {
      if (actorRole === 'mechanic') setValue('mechanic_id', actorId)
      assignments.push('accepted_at = COALESCE(accepted_at, now())')
    } else if (newStatus === 'en_route') {
      assignments.push('en_route_at = COALESCE(en_route_at, now())')
    } else if (newStatus === 'arrived') {
      assignments.push('arrived_at = COALESCE(arrived_at, now())')
    } else if (newStatus === 'in_progress') {
      assignments.push('started_at = COALESCE(started_at, now())')
    } else if (newStatus === 'completed') {
      assignments.push('completed_at = now()')
      if (completionNotes) setValue('completion_notes', completionNotes)
      if (Array.isArray(performedServices)) setValue('performed_services', JSON.stringify(performedServices))
      if (actorRole === 'mechanic') {
        setValue('final_cost', Number(finalCost))
        setValue('payment_method', paymentMethod)
        setValue('payment_status', paymentMethod === 'upi' ? 'pending' : 'unpaid')
      }
    } else if (newStatus === 'cancelled') {
      assignments.push('cancelled_at = now()')
      setValue('cancelled_by', actorId)
      setValue('cancellation_reason', cancellationReason || null)
    }

    const updated = await client.query(
      `UPDATE rescue_requests SET ${assignments.join(', ')}
        WHERE id = $1 AND status = $${values.length > 2 ? values.length + 1 : 3}
        RETURNING *`,
      [...values, request.status]
    )
    if (!updated.rowCount) {
      throw Object.assign(new Error('Request status changed before this update could be applied'), { status: 409 })
    }

    await client.query(
      'INSERT INTO request_status_history (request_id, status, changed_by) VALUES ($1, $2, $3)',
      [requestId, newStatus, actorId]
    )
    const metricTimestamp = newStatus === 'accepted' ? 'accepted_at'
      : newStatus === 'completed' ? 'completed_at'
        : newStatus === 'cancelled' ? 'cancelled_at' : null
    if (metricTimestamp) {
      await client.query(
        `INSERT INTO request_metrics (request_id, status, ${metricTimestamp}, updated_at)
         VALUES ($1, $2, now(), now())
         ON CONFLICT (request_id) DO UPDATE SET
           status = EXCLUDED.status, ${metricTimestamp} = now(), updated_at = now()`,
        [requestId, newStatus]
      )
    } else {
      await client.query(
        `INSERT INTO request_metrics (request_id, status, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (request_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now()`,
        [requestId, newStatus]
      )
    }

    if (newStatus === 'accepted') {
      await client.query(
        `UPDATE mechanic_profiles SET is_available = false, current_status = NULL
          WHERE user_id = $1`,
        [actorRole === 'mechanic' ? actorId : updated.rows[0].mechanic_id]
      )
    }
    if (TERMINAL_STATUSES.includes(newStatus) && request.mechanic_id) {
      await client.query(
        `UPDATE mechanic_profiles SET is_available = true, current_status = NULL
          WHERE user_id = $1`,
        [request.mechanic_id]
      )
    }

    const recipientId = actorRole === 'driver' ? request.mechanic_id : request.driver_id
    if (recipientId && recipientId !== actorId) {
      const title = newStatus === 'accepted' ? 'Mechanic accepted your request'
        : newStatus === 'completed' ? 'Rescue request completed'
          : newStatus === 'cancelled' ? 'Rescue request cancelled'
            : `Request ${newStatus.replace('_', ' ')}`
      await client.query(
        `INSERT INTO notifications (profile_id, request_id, type, title, body)
         VALUES ($1, $2, 'request', $3, $4)`,
        [recipientId, requestId, title, cancellationReason || `Request status changed to ${newStatus.replace('_', ' ')}.`]
      )
    }

    const detail = await client.query(
      `SELECT r.*,
              jsonb_build_object('id', d.id, 'full_name', d.full_name, 'phone', d.phone, 'avatar_url', d.avatar_url) AS driver,
              CASE WHEN m.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', m.id, 'full_name', m.full_name, 'phone', m.phone, 'avatar_url', m.avatar_url
              ) END AS mechanic
         FROM rescue_requests r
         JOIN profiles d ON d.id = r.driver_id
         LEFT JOIN profiles m ON m.id = r.mechanic_id
        WHERE r.id = $1`,
      [requestId]
    )
    await client.query('COMMIT')
    const updatedRequest = detail.rows[0]
    return {
      success: true,
      newStatus,
      request: formatRequestRow(updatedRequest, {
        driver: updatedRequest.driver,
        assignedMechanic: updatedRequest.mechanic,
      }),
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
