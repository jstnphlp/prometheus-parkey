import { createContext, use, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { createOnboardingStore } from './persistence'

const store = createOnboardingStore(AsyncStorage)
type LoadState = 'loading' | 'ready' | 'error'
type OnboardingContextValue = {
  completed: boolean
  loadState: LoadState
  retry: () => void
  continueThisTime: () => void
  complete: () => Promise<void>
}
const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [completed, setCompleted] = useState(false)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [sessionOnly, setSessionOnly] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    store.read().then(
      (value) => {
        if (!active) return
        setCompleted(value)
        setLoadState('ready')
      },
      () => {
        if (active) setLoadState('error')
      },
    )
    return () => {
      active = false
    }
  }, [attempt])

  const complete = useCallback(async () => {
    if (!sessionOnly) await store.complete()
    setCompleted(true)
  }, [sessionOnly])

  return (
    <OnboardingContext
      value={{
        completed,
        loadState,
        complete,
        retry: () => {
          setLoadState('loading')
          setAttempt((value) => value + 1)
        },
        continueThisTime: () => {
          setSessionOnly(true)
          setLoadState('ready')
        },
      }}
    >
      {children}
    </OnboardingContext>
  )
}

export function useOnboarding() {
  const value = use(OnboardingContext)
  if (!value) throw new Error('OnboardingProvider is missing.')
  return value
}
