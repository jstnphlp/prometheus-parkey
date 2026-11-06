import AsyncStorage from '@react-native-async-storage/async-storage'
import type { PilotCity, PilotMode, PilotParking } from '@parkey/shared-types'
import { useCallback, useEffect, useRef, useState } from 'react'

import { createPilotSavedStore } from './pilot-saved'
import type { PilotSavedPlace } from './pilot-saved'

const store = createPilotSavedStore(AsyncStorage)

export function usePilotSaved() {
  const [items, setItems] = useState<PilotSavedPlace[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const active = useRef(true)
  const ready = useRef(false)
  const pending = useRef(0)

  const run = useCallback(
    async (operation: () => Promise<PilotSavedPlace[]>, loading = false) => {
      pending.current++
      if (active.current) {
        setBusy(true)
        setError(null)
        if (loading) setStatus('loading')
      }
      try {
        const next = await operation()
        ready.current = true
        if (active.current) {
          setItems(next)
          setStatus('ready')
        }
        return true
      } catch {
        if (loading) ready.current = false
        if (active.current) {
          if (loading) setStatus('error')
          setError(
            loading
              ? 'Saved parking could not be loaded. Retry or explicitly clear saved parking.'
              : 'The saved parking change could not be completed. Please try again.',
          )
        }
        return false
      } finally {
        pending.current--
        if (active.current) setBusy(pending.current > 0)
      }
    },
    [],
  )
  const retry = useCallback(() => {
    ready.current = false
    return run(() => store.load(), true)
  }, [run])
  useEffect(() => {
    active.current = true
    void retry()
    return () => {
      active.current = false
    }
  }, [retry])

  function update(operation: () => Promise<PilotSavedPlace[]>) {
    if (!ready.current) {
      setError('Load saved parking successfully before making changes.')
      return Promise.resolve(false)
    }
    return run(operation)
  }
  return {
    items,
    status,
    error,
    busy,
    toggle: (
      record: PilotParking,
      city: PilotCity,
      mode: PilotMode,
      now?: number,
    ) => update(() => store.toggle(record, city, mode, now)),
    remove: (key: string) => update(() => store.remove(key)),
    retry,
    clear: () => run(() => store.clear()),
  }
}
