import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

export function useReducedMotion() {
  // Avoid motion until the platform preference has resolved.
  const [reduced, setReduced] = useState(true)
  useEffect(() => {
    let active = true
    let receivedEvent = false
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => {
        receivedEvent = true
        setReduced(value)
      },
    )
    AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => {
        if (active && !receivedEvent) setReduced(value)
      },
      () => {},
    )
    return () => {
      active = false
      subscription.remove()
    }
  }, [])
  return reduced
}
