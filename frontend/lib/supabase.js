import { createBrowserClient } from '@supabase/ssr'

let supabase

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !publishableKey) {
    throw new Error('Authentication is not configured. Set the public Supabase URL and key for the frontend.')
  }

  if (!supabase) {
    supabase = createBrowserClient(url, publishableKey)
  }

  return supabase
}
