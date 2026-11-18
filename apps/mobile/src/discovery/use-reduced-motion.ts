import { useSyncExternalStore } from 'react'
import { AccessibilityInfo, AppState } from 'react-native'

// Share one preference subscription across sheets and interactive controls.
let reduced = true
let foreground = true
let unsubscribe: (() => void) | undefined
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

function update(value: boolean) {
  reduced = value
  notify()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    let active = true
    let receivedPreference = false
    foreground =
      AppState.currentState == null || AppState.currentState === 'active'
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => {
        receivedPreference = true
        update(value)
      },
    )
    const appState = AppState.addEventListener('change', (value) => {
      foreground = value === 'active'
      notify()
    })
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => {
        if (active && !receivedPreference) update(value)
      },
      () => {},
    )
    unsubscribe = () => {
      active = false
      subscription.remove()
      appState.remove()
      reduced = true
    }
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      unsubscribe?.()
      unsubscribe = undefined
    }
  }
}

export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => reduced || !foreground,
    () => true,
  )
}
