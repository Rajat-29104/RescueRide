import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let browserClient

export function createClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing client-side environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.')
  }

  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseKey)
  }

  return browserClient
}

// Export singleton instance wrapper cleanly
export const supabase = typeof window !== 'undefined' ? createClient() : null