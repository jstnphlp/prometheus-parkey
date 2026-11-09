import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Platform } from 'react-native'

import {
  navigationDefaults,
  navigationLayers,
  navigationSearch,
  parseNavigation,
  parsePreferences,
} from './navigation-state'
import type { NavigationState } from './navigation-state'

const PREFERENCES_KEY = 'parkey.discovery.navigation.v1'
const web = Platform.OS === 'web'
function initialNavigation(): NavigationState {
  if (!web || typeof window === 'undefined') return navigationDefaults
  let preferences = {}
  try {
    preferences = parsePreferences(localStorage.getItem(PREFERENCES_KEY))
  } catch {
    /* Storage is optional. */
  }
  const state = parseNavigation(
    window.location.search,
    window.location.search ? {} : preferences,
  )
  // Refresh restores the spot, never starts an external request or a stale confirmation.
  return { ...state, route: false, consent: false }
}
export function useNavigation(onRouteExit?: () => void) {
  const routeExited = useEffectEvent(() => onRouteExit?.())
  const [state, setState] = useState(initialNavigation)
  const [cameraRevision, setCameraRevision] = useState(0)
  const current = useRef(state)
  const pendingClose = useRef<Partial<NavigationState> | null>(null)
  const touched = useRef(false)
  const getState = useCallback(() => current.current, [])
  const update = useCallback(
    (patch: Partial<NavigationState>, mode: 'push' | 'replace' = 'push') => {
      const next = { ...current.current, ...patch }
      const cameraCommand =
        patch.center !== undefined && patch.center !== current.current.center
      if (
        JSON.stringify(next) === JSON.stringify(current.current) &&
        !cameraCommand
      )
        return
      if (patch.center) setCameraRevision((value) => value + 1)
      touched.current = true
      current.current = next
      if (web) {
        const depth =
          Number(window.history.state?.parkeyDepth ?? 0) +
          (mode === 'push' ? 1 : 0)
        window.history[mode === 'push' ? 'pushState' : 'replaceState'](
          { ...window.history.state, parkeyDepth: depth },
          '',
          navigationSearch(next),
        )
      }
      setState(next)
    },
    [],
  )
  const close = useCallback(
    (patch: Partial<NavigationState>) => {
      if (web && Number(window.history.state?.parkeyDepth ?? 0) > 0) {
        pendingClose.current = patch
        window.history.back()
      } else update(patch, 'replace')
    },
    [update],
  )
  useEffect(() => {
    if (!web) {
      void AsyncStorage.getItem(PREFERENCES_KEY)
        .then((value) => {
          if (!touched.current) update(parsePreferences(value), 'replace')
        })
        .catch(() => undefined)
      return
    }
    if (typeof window.history.state?.parkeyDepth !== 'number') {
      navigationLayers(current.current).forEach((layer, index) => {
        window.history[index === 0 ? 'replaceState' : 'pushState'](
          { ...window.history.state, parkeyDepth: index },
          '',
          navigationSearch(layer),
        )
      })
    } else {
      window.history.replaceState(
        window.history.state,
        '',
        navigationSearch(current.current),
      )
    }
    function pop() {
      const next = {
        ...parseNavigation(window.location.search),
        ...pendingClose.current,
      }
      pendingClose.current = null
      if (current.current.route && !next.route) routeExited()
      current.current = next
      window.history.replaceState(
        window.history.state,
        '',
        navigationSearch(next),
      )
      setState(next)
    }
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [update])
  useEffect(() => {
    void AsyncStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({
        filter: state.filter,
        position: state.position,
        fees: state.fees,
      }),
    ).catch(() => undefined)
  }, [state.filter, state.position, state.fees])
  return useMemo(
    () => ({ state, update, close, cameraRevision, getState }),
    [state, update, close, cameraRevision, getState],
  )
}
