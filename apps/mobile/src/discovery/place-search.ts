import type { Coordinate } from '@parkey/shared-types'

import { searchDestinations } from './data.ts'
import type { Destination } from './data.ts'
import { isCoordinate, isObject } from './model.ts'

export const SEARCH_DEBOUNCE_MS = 600
export type SearchCredit = { label: string; url: string }
export class SearchRateLimit extends Error {
  readonly retryAfter: number
  constructor(retryAfter: number) {
    super('Search limit reached')
    this.retryAfter = retryAfter
  }
}
export function parsePlaceSearch(payload: unknown): {
  results: Destination[]
  attribution: SearchCredit
} {
  if (
    !isObject(payload) ||
    !Array.isArray(payload.results) ||
    payload.results.length > 6 ||
    !isObject(payload.attribution)
  )
    throw new Error('Invalid search response')
  const { label, url } = payload.attribution
  if (
    typeof label !== 'string' ||
    !label.trim() ||
    label.length > 100 ||
    typeof url !== 'string'
  )
    throw new Error('Missing attribution')
  const link = new URL(url)
  if (link.protocol !== 'https:' || link.username || link.password)
    throw new Error('Invalid attribution')
  const attribution = { label, url }
  const results = payload.results.map((item): Destination => {
    if (
      !isObject(item) ||
      typeof item.id !== 'string' ||
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      typeof item.address !== 'string' ||
      item.name.length > 500 ||
      item.address.length > 500 ||
      !isCoordinate(item.coordinate)
    )
      throw new Error('Invalid place')
    return {
      id: item.id,
      name: item.name,
      address: item.address,
      coordinate: item.coordinate,
      attribution,
    }
  })
  return { results, attribution }
}

export function placeSearchEndpoint(backend: string) {
  const base = new URL(backend)
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== '/'
  )
    throw new Error('Invalid backend')
  return new URL('/functions/v1/place-search', base).toString()
}

export async function searchPlaces(
  connection: {
    enabled: boolean
    backend: string
    publicKey: string
    legacyEndpoint: string
  },
  query: string,
  center: Coordinate,
  signal: AbortSignal,
) {
  if (!connection.enabled)
    return {
      results: await searchDestinations(
        connection.legacyEndpoint,
        query,
        center,
        signal,
      ),
      attribution: null,
    }
  const response = await fetch(placeSearchEndpoint(connection.backend), {
    method: 'POST',
    headers: {
      apikey: connection.publicKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: query.trim() }),
    signal,
  })
  if (response.status === 429) {
    const seconds = Number(response.headers.get('Retry-After'))
    throw new SearchRateLimit(
      Number.isFinite(seconds) && seconds > 0
        ? Math.min(86400, Math.ceil(seconds))
        : 60,
    )
  }
  if (!response.ok) throw new Error('Search unavailable')
  return parsePlaceSearch(await response.json())
}
