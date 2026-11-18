import { queryableViewport } from './model.ts'
import type { Viewport } from './model.ts'

type Bounds = Omit<Viewport, 'zoom'>

/** Compare with the last committed area so a series of small pans still catches up. */
export function boundsChanged(previous: Bounds, next: Bounds) {
  const longitudeTolerance = Math.max(
    0.00001,
    (previous.east - previous.west) * 0.03,
  )
  const latitudeTolerance = Math.max(
    0.00001,
    (previous.north - previous.south) * 0.03,
  )
  return (
    Math.abs(next.west - previous.west) >= longitudeTolerance ||
    Math.abs(next.east - previous.east) >= longitudeTolerance ||
    Math.abs(next.south - previous.south) >= latitudeTolerance ||
    Math.abs(next.north - previous.north) >= latitudeTolerance
  )
}

export function viewportChanged(previous: Viewport, next: Viewport) {
  return (
    queryableViewport(previous) !== queryableViewport(next) ||
    Math.abs(next.zoom - previous.zoom) >= 0.1 ||
    boundsChanged(previous, next)
  )
}

export function createViewportSettler(commit: (viewport: Viewport) => void) {
  let pending: ReturnType<typeof setTimeout> | undefined

  function cancel() {
    clearTimeout(pending)
    pending = undefined
  }

  return {
    cancel,
    settle(viewport: Viewport) {
      cancel()
      pending = setTimeout(() => {
        pending = undefined
        commit(viewport)
      }, 120)
    },
  }
}
