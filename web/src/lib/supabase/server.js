import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY

function isValidBackendKeyFormat(key) {
  if (key?.startsWith('sb_secret_')) return true

  if (!key?.startsWith('eyJ')) return false
  const segments = key.split('.')
  return segments.length === 3 && segments.every(Boolean) && key.length > 100
}

// Regular authenticated client — uses cookies for session, respects RLS
export async function createClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing public Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    )
  }

  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Safe to ignore in read-only layouts
        }
      },
    },
  })
}

// Service role client — uses @supabase/supabase-js directly, fully bypasses RLS.
// Do NOT use createServerClient here — threading cookies through it causes it to
// behave like an authenticated user session rather than a true service role bypass.
export function createServiceClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      'Missing backend environment variables. Set SUPABASE_SECRET_KEY in .env.local.'
    )
  }

  if (!isValidBackendKeyFormat(supabaseServiceRoleKey)) {
    throw new Error(
      "Invalid Supabase backend key format. Set SUPABASE_SECRET_KEY to this project's sb_secret_ key, or use its valid legacy service_role JWT. Do not use the publishable/anon key."
    )
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}