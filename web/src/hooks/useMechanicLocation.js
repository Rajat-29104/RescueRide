import { useEffect, useState } from 'react'

export function useBroadcastLocation(requestId, mechanicId, status, isOnline = true) {
  const [broadcastError, setBroadcastError] = useState(null)
  const [isLocationAvailable, setIsLocationAvailable] = useState(true)
  const isInactive = !requestId || !mechanicId || !isOnline || !status ||
    ['completed', 'cancelled'].includes(status)

  useEffect(() => {
    if (isInactive || !navigator.geolocation) return

    let active = true
    async function updateLocation() {
      navigator.geolocation.getCurrentPosition(async ({ coords }) => {
        if (!active) return
        try {
          const response = await fetch('/api/mechanic/location', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude }),
          })
          const result = await response.json()
          if (!response.ok) throw new Error(result.error || 'Location update failed.')
          if (active) {
            setBroadcastError(null)
            setIsLocationAvailable(true)
          }
        } catch (error) {
          if (active) {
            setBroadcastError(error.message)
            setIsLocationAvailable(false)
          }
        }
      }, (error) => {
        if (active) {
          setBroadcastError(error.message || 'Location access is unavailable.')
          setIsLocationAvailable(false)
        }
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 })
    }

    updateLocation()
    const interval = setInterval(updateLocation, 15000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [isInactive])

  return { broadcastError, isLocationAvailable }
}

export function useWatchMechanicLocation(requestId, status) {
  const [mechanicLocation, setMechanicLocation] = useState(null)
  const [watchError, setWatchError] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const isInactive = !requestId || (status && ['completed', 'cancelled'].includes(status))

  useEffect(() => {
    if (isInactive) return
    let active = true

    async function refreshLocation() {
      try {
        const response = await fetch(`/api/requests/${requestId}`, { cache: 'no-store' })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Unable to load mechanic location.')
        const mechanic = result.request?.mechanic
        const geometry = mechanic?.mechanic_profiles?.current_location
        if (geometry?.type === 'Point' && Array.isArray(geometry.coordinates)) {
          const [longitude, latitude] = geometry.coordinates
          if (active) {
            setMechanicLocation({
              latitude,
              longitude,
              timestamp: Date.now(),
              mechanicId: mechanic.id,
            })
          }
        }
        if (active) {
          setWatchError(null)
          setIsConnected(true)
        }
      } catch (error) {
        if (active) {
          setWatchError(error.message)
          setIsConnected(false)
        }
      }
    }

    refreshLocation()
    const interval = setInterval(refreshLocation, 5000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [requestId, isInactive])

  return { mechanicLocation, watchError, isConnected }
}
