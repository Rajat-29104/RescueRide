'use client'

import { useEffect, useState, useCallback } from 'react'

export function useRescueChat(requestId, initialStatus = null) {
  const [messages, setMessages] = useState([])
  const [requestStatus, setRequestStatus] = useState(initialStatus)
  const [driverId, setDriverId] = useState(null)
  const [mechanicId, setMechanicId] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [currentUserRole, setCurrentRole] = useState(null)
  const [loading, setLoading] = useState(Boolean(requestId))
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  const isCompleted = requestStatus?.toLowerCase() === 'completed'
  const isCancelled = requestStatus?.toLowerCase() === 'cancelled'
  const isTerminal = isCompleted || isCancelled

  const fetchMessagesAndMetadata = useCallback(async (showLoading = false) => {
    if (!requestId) return
    if (showLoading) setLoading(true)

    try {
      const response = await fetch(`/api/requests/${requestId}/messages`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load messages.')
      setMessages(data.messages || [])
      setRequestStatus(data.requestStatus || null)
      setDriverId(data.driverId || null)
      setMechanicId(data.mechanicId || null)
      setCurrentUserId(data.currentUserId || null)
      setCurrentRole(data.currentUserRole || null)
      setError(null)
    } catch (fetchError) {
      console.error('[useRescueChat] Local message fetch failed:', fetchError)
      setError(fetchError.message)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [requestId])

  useEffect(() => {
    if (!requestId) return
    let active = true
    const refresh = () => {
      if (active) fetchMessagesAndMetadata()
    }
    Promise.resolve().then(() => {
      if (active) fetchMessagesAndMetadata(true)
    })
    const interval = setInterval(refresh, 4000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [requestId, fetchMessagesAndMetadata])

  const sendMessage = async (text) => {
    const trimmed = text?.trim()
    if (!trimmed || !requestId || isTerminal || sending) return false
    setSending(true)
    setError(null)
    try {
      const response = await fetch(`/api/requests/${requestId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to send message.')
      if (data.message) {
        setMessages((previous) => previous.some((item) => item.id === data.message.id)
          ? previous
          : [...previous, data.message])
      }
      return true
    } catch (sendError) {
      console.error('[useRescueChat] Local message send failed:', sendError)
      setError(sendError.message)
      return false
    } finally {
      setSending(false)
    }
  }

  return {
    messages,
    requestStatus,
    driverId,
    mechanicId,
    currentUserId,
    currentUserRole,
    isTerminal,
    isCompleted,
    isCancelled,
    loading,
    sending,
    error,
    sendMessage,
    refetch: fetchMessagesAndMetadata,
  }
}
