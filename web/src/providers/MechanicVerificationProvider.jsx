'use client'

import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

export const MechanicVerificationContext = createContext(null)

export function MechanicVerificationProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.id || null
  const [verificationStatus, setVerificationStatus] = useState('unverified')
  const [rejectionReason, setRejectionReason] = useState(null)
  const [isSuspended, setIsSuspended] = useState(false)
  const [suspensionReason, setSuspensionReason] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchVerificationStatus = useCallback(async () => {
    if (!userId) {
      setVerificationStatus('unverified')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/mechanic/verification', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to load verification status.')
      setVerificationStatus((result.verification_status || 'unverified').toLowerCase())
      setRejectionReason(result.rejection_reason || null)
      setIsSuspended(Boolean(result.is_suspended))
      setSuspensionReason(result.suspension_reason || null)
      setError(null)
    } catch (fetchError) {
      console.error('[MECHANIC VERIFICATION] Local status lookup failed:', fetchError)
      setError(fetchError)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    let active = true
    const refresh = () => {
      if (active) fetchVerificationStatus()
    }
    Promise.resolve().then(refresh)
    const interval = setInterval(refresh, 30000)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      active = false
      clearInterval(interval)
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [fetchVerificationStatus])

  const isApproved = verificationStatus === 'approved' || verificationStatus === 'verified'
  const isRejected = verificationStatus === 'rejected'
  const isPending = verificationStatus === 'pending' || verificationStatus === 'more_info'
  const isUnverified = !isApproved && !isRejected && !isPending
  const value = useMemo(() => ({
    verificationStatus,
    rejectionReason,
    isSuspended,
    suspensionReason,
    isApproved,
    isRejected,
    isPending,
    isUnverified,
    loading,
    error,
    refetch: fetchVerificationStatus,
  }), [
    verificationStatus,
    rejectionReason,
    isSuspended,
    suspensionReason,
    isApproved,
    isRejected,
    isPending,
    isUnverified,
    loading,
    error,
    fetchVerificationStatus,
  ])

  return (
    <MechanicVerificationContext.Provider value={value}>
      {children}
    </MechanicVerificationContext.Provider>
  )
}
