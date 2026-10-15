import { pool } from '@/lib/db'

export async function submitLocalRating({ requestId, driverId, rating, review }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `SELECT id, driver_id, mechanic_id, status
         FROM rescue_requests WHERE id = $1 FOR UPDATE`,
      [requestId]
    )
    const rescueRequest = rows[0]
    if (!rescueRequest || rescueRequest.driver_id !== driverId || rescueRequest.status !== 'completed') {
      throw Object.assign(new Error('Request not found or not completed.'), { status: 404 })
    }
    if (!rescueRequest.mechanic_id) {
      throw Object.assign(new Error('This request has no assigned mechanic to rate.'), { status: 400 })
    }
    const inserted = await client.query(
      `INSERT INTO request_reviews (request_id, driver_id, mechanic_id, rating, review)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [requestId, driverId, rescueRequest.mechanic_id, rating, review || null]
    )
    const { rows: averageRows } = await client.query(
      `UPDATE mechanic_profiles mp
          SET rating_avg = stats.average_rating, rating_count = stats.rating_count
         FROM (
           SELECT AVG(rating)::numeric(3,2) AS average_rating, count(*)::integer AS rating_count
             FROM request_reviews WHERE mechanic_id = $1
         ) stats
        WHERE mp.user_id = $1
        RETURNING mp.rating_avg, mp.rating_count`,
      [rescueRequest.mechanic_id]
    )
    await client.query(
      `INSERT INTO notifications (profile_id, request_id, type, title, body)
       VALUES ($1, $2, 'system', 'Rating Submitted',
               'Your review was recorded. Thank you for your feedback.')`,
      [driverId, requestId]
    )
    await client.query('COMMIT')
    return { success: true, ratingId: inserted.rows[0].id, ...averageRows[0] }
  } catch (error) {
    await client.query('ROLLBACK')
    if (error.code === '23505') {
      throw Object.assign(new Error('A rating has already been submitted for this request.'), { status: 409 })
    }
    throw error
  } finally {
    client.release()
  }
}
