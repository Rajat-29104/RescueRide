import { randomBytes, scrypt as scryptCallback, createHash, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { cookies } from 'next/headers'
import { query } from '@/lib/db'

const scrypt = promisify(scryptCallback)
export const SESSION_COOKIE = 'roadrescue_session'
const SESSION_DAYS = 30

export function publicUser(profile) {
  return {
    id: profile.id,
    email: profile.email,
    phone: profile.phone,
    user_metadata: {
      full_name: profile.full_name,
      phone: profile.phone,
      role: profile.role,
    },
  }
}

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const derived = await scrypt(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

export async function verifyPassword(password, encoded) {
  const [algorithm, saltHex, hashHex] = String(encoded || '').split('$')
  if (algorithm !== 'scrypt' || !saltHex || !hashHex) return false

  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(userId) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  await query(
    'INSERT INTO profile_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, hashToken(token), expiresAt]
  )

  return { token, expiresAt }
}

export async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const { rows } = await query(
    `SELECT p.id, p.email, p.role, p.full_name, p.phone, p.avatar_url,
            p.is_active, p.is_suspended, p.suspended_at, p.suspension_reason,
            p.created_at, p.updated_at
       FROM profile_sessions s
       JOIN profiles p ON p.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
        AND p.is_active = true`,
    [hashToken(token)]
  )

  if (!rows[0]) return null
  const user = publicUser(rows[0])
  const profile = { ...rows[0] }

  if (profile.role === 'driver') {
    const result = await query('SELECT * FROM driver_profiles WHERE user_id = $1', [profile.id])
    if (result.rows[0]) profile.driver_profile = result.rows[0]
  } else if (profile.role === 'mechanic') {
    const result = await query('SELECT * FROM mechanic_profiles WHERE user_id = $1', [profile.id])
    if (result.rows[0]) profile.mechanic_profile = result.rows[0]
  }

  return { user, profile }
}

export function sessionPayload(authenticated) {
  if (!authenticated) return { session: null, user: null, profile: null }
  return {
    session: { user: authenticated.user },
    user: authenticated.user,
    profile: authenticated.profile,
  }
}
