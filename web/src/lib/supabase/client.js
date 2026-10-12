import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let browserClient

const missingConfigError = () =>
  new Error('Supabase is not configured in this environment. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to continue.')

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

function createFallbackClient() {
  const createQueryChain = () => {
    const chain = {
      select: () => chain,
      update: () => chain,
      insert: () => chain,
      delete: () => chain,
      eq: () => chain,
      in: () => chain,
      limit: () => chain,
      order: () => chain,
      or: () => chain,
      match: () => chain,
      maybeSingle: async () => ({ data: null, error: missingConfigError() }),
      single: async () => ({ data: null, error: missingConfigError() }),
      then: (resolve) => resolve({ data: null, error: missingConfigError() }),
      catch: (onRejected) => {
        if (typeof onRejected === 'function') {
          return onRejected(missingConfigError())
        }
        return chain
      },
      finally: (callback) => {
        if (typeof callback === 'function') callback()
        return chain
      },
    }
    return chain
  }

  const auth = {
    signUp: async () => {
      throw missingConfigError()
    },
    signInWithPassword: async () => {
      throw missingConfigError()
    },
    resetPasswordForEmail: async () => {
      throw missingConfigError()
    },
    updateUser: async () => {
      throw missingConfigError()
    },
    signOut: async () => ({ error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({
      data: {
        subscription: {
          unsubscribe: () => {},
        },
      },
      error: null,
    }),
  }

  return {
    auth,
    from: () => createQueryChain(),
  }
}

export function createClient() {
  if (!hasSupabaseConfig()) {
    console.warn('Supabase credentials are not configured. Running without a live backend client.')
    return createFallbackClient()
  }

  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey)
  }

  return browserClient
}

// Export singleton instance wrapper cleanly
export const supabase = typeof window !== 'undefined' ? createClient() : null