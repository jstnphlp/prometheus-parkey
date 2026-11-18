import type { StyleSpecification } from 'maplibre-gl'
import { useEffect, useMemo, useState } from 'react'

import { config, defaultNightMapStyle } from './config'
import { softenDarkMapStyle } from './dark-map-style'
import { isObject } from './model'

let cached: StyleSpecification | undefined
let pending: Promise<StyleSpecification | undefined> | undefined

function isDarkMapStyle(value: unknown): value is StyleSpecification {
  return (
    isObject(value) &&
    value.version === 8 &&
    isObject(value.sources) &&
    Array.isArray(value.layers) &&
    value.layers.every(
      (layer: unknown) =>
        isObject(layer) &&
        typeof layer.id === 'string' &&
        typeof layer.type === 'string' &&
        (layer.paint === undefined || isObject(layer.paint)),
    )
  )
}

function loadSoftenedStyle() {
  if (cached) return Promise.resolve(cached)
  if (pending) return pending
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  pending = fetch(defaultNightMapStyle, { signal: controller.signal })
    .then(async (response) => {
      if (!response.ok) return
      const style: unknown = await response.json()
      if (isDarkMapStyle(style)) cached = softenDarkMapStyle(style)
      return cached
    })
    .catch(() => undefined)
    .finally(() => {
      clearTimeout(timeout)
      pending = undefined
    })
  return pending
}

export function useMapStyle(night?: boolean): string | StyleSpecification {
  const soften = Boolean(night && config.nightMapStyle === defaultNightMapStyle)
  const [softened, setSoftened] = useState(cached)
  useEffect(() => {
    if (!soften || softened) return
    let mounted = true
    void loadSoftenedStyle().then((style) => {
      if (mounted && style) setSoftened(style)
    })
    return () => {
      mounted = false
    }
  }, [soften, softened])

  return night
    ? soften
      ? (softened ?? config.nightMapStyle)
      : config.nightMapStyle
    : config.mapStyle
}

// Native MapLibre accepts a serialized style and uses a separate version of
// the style specification types from the browser renderer.
export function useNativeMapStyle(night?: boolean): string {
  const style = useMapStyle(night)
  return useMemo(
    () => (typeof style === 'string' ? style : JSON.stringify(style)),
    [style],
  )
}
