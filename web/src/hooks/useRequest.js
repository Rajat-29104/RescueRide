import { useState, useEffect, useCallback } from 'react'

export function useRequestStatus(requestId) {
  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchRequest = useCallback(async () => {
    if (!requestId) return
    try {
      const response = await fetch(`/api/requests/${requestId}`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to load request.')
      setRequest(result.request)
      setError(null)
    } catch (fetchError) {
      console.error('[useRequestStatus] Local request load failed:', fetchError)
      setError(fetchError.message)
    } finally {
      setLoading(false)
    }
  }, [requestId])

  useEffect(() => {
    if (!requestId) return
    let active = true
    const refresh = async () => {
      if (active) await fetchRequest()
    }

    refresh()
    const interval = setInterval(refresh, 5000)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const handleOnline = () => refresh()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)

    return () => {
      active = false
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
    }
  }, [requestId, fetchRequest])

  return { request, loading, error, refetch: fetchRequest }
}
