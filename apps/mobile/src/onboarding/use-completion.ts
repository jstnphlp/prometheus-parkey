import { useCallback, useRef, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'

import { useOnboarding } from './provider'

export function useCompletion(destination: '/register' | '/') {
  const router = useRouter()
  const { complete } = useOnboarding()
  const inFlight = useRef(false)
  const focused = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      focused.current = true
      return () => {
        focused.current = false
      }
    }, []),
  )

  async function finish() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      await complete()
      if (!focused.current) return
      // Remove the introduction history so Back cannot replay completed steps.
      if (router.canDismiss()) router.dismissAll()
      router.replace(destination)
    } catch {
      setError('Could not save your progress. Please try again.')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return { finish, busy, error }
}
