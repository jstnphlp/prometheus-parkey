import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import { createViewportSettler } from './viewport-changes'
import type { Viewport } from './model'

/** Keep map event props stable while dispatching to the latest committed UI. */
export function useMapCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
) {
  const current = useRef(callback)
  useLayoutEffect(() => {
    current.current = callback
  }, [callback])
  return useCallback((...args: Args) => current.current(...args), [])
}

export function useSettledViewport(
  enabled: boolean,
  onSettled: (viewport: Viewport) => void,
) {
  const commit = useMapCallback((viewport: Viewport) => {
    if (enabled) onSettled(viewport)
  })
  const [settler] = useState(() => createViewportSettler(commit))
  useLayoutEffect(() => settler.cancel, [enabled, settler])
  return settler
}
