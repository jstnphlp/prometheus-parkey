import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useFocusEffect, useNavigation, useRouter } from 'expo-router'
import type { Href } from 'expo-router'
import { Animated, Platform } from 'react-native'

import { motionEaseStandard } from '../discovery/motion'
import { useReducedMotion } from '../discovery/use-reduced-motion'
import { createWalkthroughMotion } from './walkthrough-motion-state'

const WalkthroughMotion = createContext<ReturnType<
  typeof createWalkthroughMotion
> | null>(null)

export function WalkthroughMotionProvider({
  children,
}: {
  children: ReactNode
}) {
  const [session] = useState(createWalkthroughMotion)
  return (
    <WalkthroughMotion.Provider value={session}>
      {children}
    </WalkthroughMotion.Provider>
  )
}

export function useWalkthroughMotion(step: number) {
  const session = useContext(WalkthroughMotion)
  if (!session) throw new Error('WalkthroughMotionProvider is required')
  const navigation = useNavigation()
  const router = useRouter()
  const reduced = useReducedMotion()
  const claimed = useRef(false)
  const [progress] = useState(() => new Animated.Value(step))
  useFocusEffect(
    useCallback(() => {
      claimed.current = false
      const start = session.focus(step, reduced)
      progress.setValue(start)
      if (start === step) return

      const animation = Animated.timing(progress, {
        toValue: step,
        duration: 240,
        easing: motionEaseStandard,
        isInteraction: false,
        // Only the three indicator dots exchange width.
        useNativeDriver: false,
      })
      animation.start()
      return () => {
        animation.stop()
        progress.setValue(step)
      }
    }, [progress, reduced, session, step]),
  )

  function advance(next: Href) {
    if (!navigation.isFocused() || claimed.current) return
    const immediate = reduced || Platform.OS === 'web'
    if (!session?.claimAdvance(Date.now(), immediate)) return
    claimed.current = true
    router.push(next)
  }

  return { advance, progress }
}
