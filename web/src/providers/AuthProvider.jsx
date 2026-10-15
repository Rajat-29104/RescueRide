'use client'

import { useCallback, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

export default function AuthProvider({ children }) {
  const {
    setAuthState,
    setLoading,
    setError,
    setNetworkStatus,
    resetAuth,
  } = useAuthStore()

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('Unable to check local sign-in session.')
      const result = await response.json()

      if (result.user && result.profile) {
        setAuthState({ user: result.user, profile: result.profile })
      } else {
        resetAuth()
      }
      setNetworkStatus('connected')
      setError(null)
    } catch (error) {
      console.error('[LOCAL AUTH] Session check failed:', error)
      setError('Unable to initialize authentication')
      setNetworkStatus('degraded')
      setLoading(false)
    }
  }, [resetAuth, setAuthState, setError, setLoading, setNetworkStatus])

  useEffect(() => {
    const handleAuthChange = (event) => {
      if (event.detail === 'SIGNED_OUT' || event.detail === 'USER_DELETED') {
        resetAuth()
        setNetworkStatus('connected')
      } else {
        void refreshSession()
      }
    }

    window.addEventListener('roadrescue:auth-change', handleAuthChange)
    void refreshSession()

    return () => {
      window.removeEventListener('roadrescue:auth-change', handleAuthChange)
    }
  }, [refreshSession, resetAuth, setNetworkStatus])

  return children
}
