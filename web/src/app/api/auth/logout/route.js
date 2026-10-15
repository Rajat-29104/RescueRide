import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { query } from '@/lib/db'
import { hashToken, SESSION_COOKIE } from '@/lib/localAuth'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token) {
    const { rows } = await query(
      `SELECT user_id FROM profile_sessions
        WHERE token_hash = $1 AND expires_at > now()`,
      [hashToken(token)]
    )
    if (rows[0]) {
      await query(
        `UPDATE mechanic_profiles mp
            SET is_available = false,
                current_status = CASE WHEN EXISTS (
                  SELECT 1 FROM rescue_requests rr
                   WHERE rr.mechanic_id = mp.user_id
                     AND rr.status IN ('accepted', 'en_route', 'arrived', 'in_progress')
                ) THEN now()::text ELSE NULL END
          WHERE mp.user_id = $1`,
        [rows[0].user_id]
      )
    }
    await query('DELETE FROM profile_sessions WHERE token_hash = $1', [hashToken(token)])
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  })
  return response
}
