import { NextResponse } from 'next/server'
import { pool, query } from '@/lib/db'
import { requireAdmin, createErrorResponse } from '@/lib/rbac'
import { sanitizeInput } from '@/lib/validate'

const editableFields = {
  profiles: new Set(['full_name', 'phone']),
  driver_profiles: new Set([
    'vehicle_make', 'vehicle_model', 'vehicle_year', 'vehicle_color',
    'vehicle_plate', 'emergency_contact_name', 'emergency_contact_phone', 'home_area',
  ]),
  mechanic_profiles: new Set([
    'business_name', 'specializations', 'years_experience', 'license_number',
    'license_expiry', 'service_radius', 'location_label',
  ]),
}

function toDatabaseValue(targetTable, fieldKey, newValue) {
  if (newValue && typeof newValue === 'object' && !Array.isArray(newValue) &&
      Object.prototype.hasOwnProperty.call(newValue, fieldKey)) {
    newValue = newValue[fieldKey]
  }

  if (newValue === null || newValue === undefined || newValue === '') return null
  if (targetTable === 'mechanic_profiles' && fieldKey === 'specializations') {
    return JSON.stringify(Array.isArray(newValue) ? newValue : [String(newValue)])
  }
  if (
    (targetTable === 'driver_profiles' && fieldKey === 'vehicle_year') ||
    (targetTable === 'mechanic_profiles' && ['years_experience', 'service_radius'].includes(fieldKey))
  ) {
    const value = Number(newValue)
    if (!Number.isInteger(value)) throw new Error(`The proposed value for ${fieldKey} must be a whole number.`)
    return value
  }
  return String(newValue)
}

export async function GET(request) {
  const auth = await requireAdmin()
  if (auth.error) return createErrorResponse(auth.error, auth.status)

  const status = new URL(request.url).searchParams.get('status') || 'pending'
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return createErrorResponse('Invalid profile change request status.', 400)
  }

  try {
    const { rows } = await query(
      `SELECT r.*,
              jsonb_build_object(
                'id', p.id, 'full_name', p.full_name, 'email', p.email,
                'phone', p.phone, 'role', p.role
              ) AS "user",
              CASE WHEN reviewer.id IS NULL THEN NULL ELSE
                jsonb_build_object('id', reviewer.id, 'full_name', reviewer.full_name)
              END AS "reviewer"
         FROM profile_change_requests r
         JOIN profiles p ON p.id = r.user_id
         LEFT JOIN profiles reviewer ON reviewer.id = r.reviewed_by
        WHERE r.status = $1
        ORDER BY r.created_at DESC`,
      [status]
    )
    return NextResponse.json({ requests: rows })
  } catch (error) {
    console.error('[GET /api/admin/profile-change-requests] Local query failed:', error)
    return createErrorResponse('Unable to load profile change requests.', 500)
  }
}

export async function PATCH(request) {
  const auth = await requireAdmin()
  if (auth.error) return createErrorResponse(auth.error, auth.status)

  let body
  try {
    body = sanitizeInput(await request.json())
  } catch {
    return createErrorResponse('Invalid request body.', 400)
  }

  const { requestId, action } = body
  if (!requestId || !['approved', 'rejected'].includes(action)) {
    return createErrorResponse('requestId and a valid action state are required.', 400)
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `SELECT r.*, p.full_name, p.email, p.phone, p.role
         FROM profile_change_requests r
         JOIN profiles p ON p.id = r.user_id
        WHERE r.id = $1
        FOR UPDATE OF r`,
      [requestId]
    )
    const changeRequest = rows[0]
    if (!changeRequest) {
      await client.query('ROLLBACK')
      return createErrorResponse('Target profile change request was not found.', 404)
    }
    if (changeRequest.status !== 'pending') {
      await client.query('ROLLBACK')
      return createErrorResponse('This profile change request has already been reviewed.', 409)
    }

    if (action === 'approved') {
      const allowedFields = editableFields[changeRequest.target_table]
      if (!allowedFields?.has(changeRequest.field_key)) {
        await client.query('ROLLBACK')
        return createErrorResponse('This profile field cannot be changed through the review workflow.', 400)
      }
      const value = toDatabaseValue(
        changeRequest.target_table,
        changeRequest.field_key,
        changeRequest.new_value
      )
      const cast = changeRequest.target_table === 'mechanic_profiles' &&
        changeRequest.field_key === 'specializations' ? '::jsonb' : ''
      const idColumn = changeRequest.target_table === 'profiles' ? 'id' : 'user_id'

      await client.query(
        `UPDATE ${changeRequest.target_table}
            SET ${changeRequest.field_key} = $1${cast}
          WHERE ${idColumn} = $2`,
        [value, changeRequest.user_id]
      )
    }

    const reviewNotes = String(body.reviewNotes || '').trim() ||
      (action === 'approved' ? 'Approved by operations command' : 'Rejected by operations command')
    const updated = await client.query(
      `UPDATE profile_change_requests
          SET status = $2, review_notes = $3, reviewed_by = $4, reviewed_at = now()
        WHERE id = $1
        RETURNING *`,
      [requestId, action, reviewNotes, auth.user.id]
    )
    await client.query(
      `INSERT INTO notifications (profile_id, type, title, body)
       VALUES ($1, 'system', $2, $3)`,
      [
        changeRequest.user_id,
        action === 'approved' ? 'Change Request Approved' : 'Change Request Rejected',
        `Your request to update your ${changeRequest.field_key} has been ${action}. ${reviewNotes}`,
      ]
    )
    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      request: {
        ...updated.rows[0],
        user: {
          id: changeRequest.user_id,
          full_name: changeRequest.full_name,
          email: changeRequest.email,
          phone: changeRequest.phone,
          role: changeRequest.role,
        },
      },
    })
  } catch (error) {
    await client.query('ROLLBACK')
    if (error instanceof Error && error.message.startsWith('The proposed value')) {
      return createErrorResponse(error.message, 400)
    }
    console.error('[PATCH /api/admin/profile-change-requests] Local review failed:', error)
    return createErrorResponse('Unable to process this profile change request.', 500)
  } finally {
    client.release()
  }
}
