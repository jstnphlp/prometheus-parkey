import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import type { Coordinate } from '@parkey/shared-types'

import { config } from './config'
import { fetchDrivingRoute } from './routing'
import type { DrivingRoute } from './routing'

export type RouteState = {
  status: 'idle' | 'locating' | 'loading' | 'ready' | 'error'
  route: DrivingRoute | null
  error: string | null
}
const empty: RouteState = { status: 'idle', route: null, error: null }

export function useRoute() {
  const [state, setState] = useState<RouteState>(empty)
  const controller = useRef<AbortController | null>(null)
  const nextRequestAt = useRef(0)
  const clear = useCallback(() => {
    controller.current?.abort()
    controller.current = null
    setState(empty)
  }, [])
  useEffect(() => () => controller.current?.abort(), [])

  const load = useCallback(
    async (
      destination: Coordinate | ((origin: Coordinate) => Coordinate),
      locate: (signal: AbortSignal) => Promise<Coordinate | null>,
      rerouting = false,
      heading?: number,
    ) => {
      controller.current?.abort()
      const request = new AbortController()
      controller.current = request
      setState((current) => ({
        status: 'locating',
        route: rerouting ? current.route : null,
        error: null,
      }))
      try {
        if (!config.routingUrl)
          throw new Error(
            'Directions aren’t available right now. Please try again later.',
          )
        const from = await locate(request.signal)
        if (request.signal.aborted) return
        if (!from)
          throw new Error(
            'Your location is unavailable. Enable location access and try again.',
          )
        if (Date.now() < nextRequestAt.current) {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(
              resolve,
              nextRequestAt.current - Date.now(),
            )
            request.signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timer)
                resolve()
              },
              { once: true },
            )
          })
          if (request.signal.aborted) return null
        }
        nextRequestAt.current = Date.now() + 1100
        setState((current) => ({
          status: 'loading',
          route: rerouting ? current.route : null,
          error: null,
        }))
        const route = await fetchDrivingRoute(
          from,
          typeof destination === 'function' ? destination(from) : destination,
          request.signal,
          {
            ...(heading === undefined ? {} : { heading }),
            ...(Platform.OS === 'web'
              ? {}
              : { userAgent: 'Parkey/0.1 (route preview)' }),
          },
        )
        if (!request.signal.aborted)
          setState({ status: 'ready', route, error: null })
        return request.signal.aborted ? null : route
      } catch (error) {
        if (!request.signal.aborted)
          setState((current) => ({
            status: 'error',
            route: rerouting ? current.route : null,
            error:
              error instanceof Error
                ? error.message
                : 'Directions could not be loaded. Please try again.',
          }))
        return null
      }
    },
    [],
  )

  const cancel = useCallback(() => controller.current?.abort(), [])
  return { ...state, load, clear, cancel }
}
