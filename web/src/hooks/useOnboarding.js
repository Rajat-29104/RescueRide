// web/src/hooks/useOnboarding.js
// Role-based onboarding state hook with client upsert under existing RLS

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'

const TERMINAL_STATUSES = ['completed', 'cancelled']

export function useOnboarding(tourKey = 'driver_skip_hint_v1') {
  const { user } = useAuth()
  const userId = user?.id
  const [onboardingState, setOnboardingState] = useState({})
  const [loading, setLoading] = useState(true)
  const [hasActiveRequest, setHasActiveRequest] = useState(false)

  const loadPreferencesAndActiveRequest = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const supabase = createClient()

      // 1. Fetch user onboarding state
      const { data: prefData, error: prefError } = await supabase
        .from('profile_preferences')
        .select('onboarding_state')
        .eq('user_id', userId)
        .maybeSingle()

      if (prefError) {
        console.warn('[useOnboarding] Failed to fetch preferences:', prefError.message)
      } else if (prefData?.onboarding_state) {
        setOnboardingState(prefData.onboarding_state)
      }

      // 2. Check for active non-terminal rescue requests (suppress tour if emergency/job active)
      const { data: activeRequests, error: reqError } = await supabase
        .from('rescue_requests')
        .select('id, status')
        .or(`driver_id.eq.${userId},mechanic_id.eq.${userId}`)
        .not('status', 'in', `(${TERMINAL_STATUSES.join(',')})`)
        .limit(1)

      if (reqError) {
        console.warn('[useOnboarding] Failed to check active requests:', reqError.message)
      } else if (activeRequests && activeRequests.length > 0) {
        setHasActiveRequest(true)
      } else {
        setHasActiveRequest(false)
      }
    } catch (err) {
      console.warn('[useOnboarding] load error:', err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadPreferencesAndActiveRequest()
  }, [loadPreferencesAndActiveRequest])

  const dismiss = useCallback(
    async (keyToDismiss = tourKey) => {
      if (!userId) return

      const updated = {
        ...onboardingState,
        [keyToDismiss]: true,
        [`${keyToDismiss}_completed_at`]: new Date().toISOString(),
      }

      setOnboardingState(updated)

      try {
        const supabase = createClient()
        const { error } = await supabase
          .from('profile_preferences')
          .upsert(
            {
              user_id: userId,
              onboarding_state: updated,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          )

        if (error) {
          console.warn('[useOnboarding] Failed to persist onboarding state:', error.message)
        }
      } catch (err) {
        console.error('[useOnboarding] dismiss upsert error:', err)
      }
    },
    [userId, onboardingState, tourKey]
  )

  const resetTour = useCallback(
    async (keyToReset = tourKey) => {
      if (!userId) return

      const updated = {
        ...onboardingState,
        [keyToReset]: false,
      }

      setOnboardingState(updated)

      try {
        const supabase = createClient()
        const { error } = await supabase
          .from('profile_preferences')
          .upsert(
            {
              user_id: userId,
              onboarding_state: updated,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          )

        if (error) {
          console.warn('[useOnboarding] Failed to reset onboarding state:', error.message)
        }
      } catch (err) {
        console.error('[useOnboarding] resetTour error:', err)
      }
    },
    [userId, onboardingState, tourKey]
  )

  const isCompleted = Boolean(onboardingState[tourKey])
  const shouldShow = !loading && !hasActiveRequest && !isCompleted

  return {
    loading,
    shouldShow,
    isCompleted,
    hasActiveRequest,
    dismiss,
    resetTour,
    refetch: loadPreferencesAndActiveRequest,
  }
}
