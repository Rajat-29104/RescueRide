'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

export function useMechanicStatus(mechanicId) {
  const [status, setStatus] = useState('offline')
  const [loading, setLoading] = useState(!!mechanicId)
  const [localCoords, setLocalCoords] = useState(null)

  const refreshStatus = useCallback(async () => {
    if (!mechanicId) return

    try {
      const response = await fetch('/api/mechanic/status', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to load mechanic status.')
      setStatus(result.is_available ? 'available' : 'offline')
    } catch (error) {
      console.error('[MECHANIC STATUS] Local status lookup failed:', error)
    } finally {
      setLoading(false)
    }
  }, [mechanicId])

  useEffect(() => {
    if (!mechanicId) {
      return
    }

    const initialRefresh = setTimeout(refreshStatus, 0)
    const interval = setInterval(refreshStatus, 30000)
    return () => {
      clearTimeout(initialRefresh)
      clearInterval(interval)
    }
  }, [mechanicId, refreshStatus])

  const isAvailable = useMemo(() => Boolean(mechanicId) && status === 'available', [mechanicId, status])
  const isBusy = useMemo(() => Boolean(mechanicId) && status === 'busy', [mechanicId, status])

  useEffect(() => {
    if (!isAvailable || !mechanicId) {
      return
    }

    if (!navigator.geolocation) {
      console.warn('[MECHANIC STATUS] Browser geolocation is unavailable.')
      return
    }

    let lastLocationSync = 0
    const watchId = navigator.geolocation.watchPosition(
      async ({ coords: { latitude, longitude } }) => {
        setLocalCoords({ lat: latitude, lng: longitude })

        if (Date.now() - lastLocationSync < 30000) return
        lastLocationSync = Date.now()

        try {
          const response = await fetch('/api/mechanic/location', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude, longitude }),
          })
          const result = await response.json()
          if (!response.ok) throw new Error(result.error || 'Unable to update mechanic location.')
        } catch (error) {
          console.error('[MECHANIC STATUS] Local location update failed:', error)
        }
      },
      (error) => console.warn('[MECHANIC STATUS] Browser location unavailable:', error.message),
      { enableHighAccuracy: true, maximumAge: 10000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [isAvailable, mechanicId])

  const updateStatus = useCallback(async (nextStatus) => {
    if (!mechanicId) return

    const is_available = nextStatus === 'available'
    const response = await fetch('/api/mechanic/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_available }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Unable to update mechanic status.')

    setStatus(result.is_available ? 'available' : 'offline')
  }, [mechanicId])

  return {
    status,
    isAvailable,
    isBusy,
    loading: mechanicId ? loading : false,
    localCoords: isAvailable ? localCoords : null,
    updateStatus,
  }
}
