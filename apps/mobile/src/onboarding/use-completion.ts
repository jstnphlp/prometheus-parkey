import { useCallback, useRef, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'

import { usePopup } from '../components/popup-provider'

import { useOnboarding } from './provider'

export function useCompletion(destination: '/register' | '/') {
  const router = useRouter()
  const { complete } = useOnboarding()
  const popup = usePopup()
  const inFlight = useRef(false)
  const focused = useRef(false)
  const [busy, setBusy] = useState(false)

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
    try {
      await complete()
      if (!focused.current) return
      // Remove the introduction history so Back cannot replay completed steps.
      if (router.canDismiss()) router.dismissAll()
      router.replace(destination)
    } catch {
      if (focused.current)
        popup.show({
          tone: 'error',
          title: 'Could not save progress',
          message: 'Your progress could not be saved on this device.',
          primary: {
            title: 'Retry',
            onPress: () => void finish(),
            restoreFocus: false,
          },
          secondary: { title: 'Not now' },
        })
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return { finish, busy }
}
