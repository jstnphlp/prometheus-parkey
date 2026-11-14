import { useEffect } from 'react'
import { usePathname } from 'expo-router'
import { useIsFocused } from 'expo-router/react-navigation'

import { usePopup } from '../components/popup-provider'

import { useAuth } from './provider'

export function useAuthSystemPopup() {
  const auth = useAuth()
  const popup = usePopup()
  const focused = useIsFocused()
  const path = usePathname()
  useEffect(() => {
    if (
      !focused ||
      auth.busy ||
      (auth.state.status !== 'error' && auth.state.status !== 'unavailable')
    )
      return
    const onceKey = `${path}:auth:${auth.state.status}`
    popup.show({
      title:
        auth.state.status === 'error'
          ? 'Session unavailable'
          : 'Sign-in unavailable',
      message:
        auth.state.status === 'error'
          ? 'Reconnect to check your session. You can still explore parking.'
          : 'Try again later. Parking discovery is available without an account.',
      tone: 'warning',
      group: 'auth-system',
      onceKey,
      primary: {
        title: 'Retry',
        restoreFocus: false,
        onPress: () => {
          popup.allowAgain(onceKey)
          void auth.retry()
        },
      },
      secondary: { title: 'Not now' },
    })
  }, [auth, popup, focused, path])
}
