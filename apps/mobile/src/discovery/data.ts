import type {
  Coordinate,
  DiscoveryParking,
  HostedDiscoveryResponse,
} from '@parkey/shared-types'

import { validHostedConfig } from './hosted-mode.ts'

import {
  geometryMatchesKind,
  isCoordinate,
  isGeometry,
  isObject,
} from './model.ts'
import type { Viewport } from './model.ts'

const nullableText = (value: unknown) =>
  value === null || typeof value === 'string'
const nullableDate = (value: unknown) =>
  value === null ||
  (typeof value === 'string' && Number.isFinite(Date.parse(value)))
const safeUrl = (value: unknown) =>
  value === null || (typeof value === 'string' && /^https?:\/\//.test(value))

const publicEvidenceUrl = (value: string | null) => {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

export function isParking(value: unknown): value is DiscoveryParking {
  if (!isObject(value)) return false
  if (
    value.kind !== 'street' &&
    value.kind !== 'lot' &&
    value.kind !== 'garage'
  )
    return false
  return (
    (value.osmTags === undefined ||
      (isObject(value.osmTags) &&
        Object.values(value.osmTags).every(
          (tag) => typeof tag === 'string',
        ))) &&
    (value.osmEditedAt === undefined || nullableDate(value.osmEditedAt)) &&
    (value.entrances === undefined ||
      (Array.isArray(value.entrances) &&
        value.entrances.every(isCoordinate))) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    isGeometry(value.geometry) &&
    geometryMatchesKind(value.geometry, value.kind) &&
    ['left', 'right', 'both', 'unknown'].includes(String(value.side)) &&
    nullableText(value.address) &&
    nullableText(value.fees) &&
    nullableText(value.hours) &&
    ['osm', 'parkey', 'community', 'sample'].includes(
      String(value.sourceKind),
    ) &&
    typeof value.sourceLabel === 'string' &&
    typeof value.license === 'string' &&
    safeUrl(value.sourceUrl) &&
    nullableDate(value.sourceUpdatedAt) &&
    nullableDate(value.verifiedAt) &&
    (value.verification === 'unverified' ||
      (value.verification === 'verified' &&
        typeof value.verifiedAt === 'string')) &&
    Array.isArray(value.regulations) &&
    value.regulations.every(
      (rule) =>
        isObject(rule) &&
        typeof rule.description === 'string' &&
        typeof rule.sourceLabel === 'string' &&
        safeUrl(rule.sourceUrl) &&
        nullableDate(rule.observedAt),
    )
  )
}

export async function fetchParking(
  url: string,
  key: string,
  bounds: Viewport,
  signal: AbortSignal,
): Promise<{ records: DiscoveryParking[]; truncated: boolean }> {
  const response = await fetch(
    `${url.replace(/\/$/, '')}/rest/v1/rpc/discover_parking`,
    {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        west: bounds.west,
        south: bounds.south,
        east: bounds.east,
        north: bounds.north,
      }),
      signal,
    },
  )
  if (!response.ok)
    throw new Error('Parking records could not be loaded. Try again.')
  const payload: unknown = await response.json()
  if (
    !isObject(payload) ||
    !Array.isArray(payload.records) ||
    !payload.records.every(isParking) ||
    typeof payload.truncated !== 'boolean'
  )
    throw new Error('The parking service returned an unsupported response.')
  return { records: payload.records, truncated: payload.truncated }
}

export async function fetchApprovedParking(
  url: string,
  key: string,
  bounds: Viewport,
  signal: AbortSignal,
): Promise<HostedDiscoveryResponse> {
  if (!validHostedConfig(url, key))
    throw new Error('Hosted discovery is not configured safely.')
  const response = await fetch(
    `${url.replace(/\/$/, '')}/rest/v1/rpc/discover_approved_parking`,
    {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        west: bounds.west,
        south: bounds.south,
        east: bounds.east,
        north: bounds.north,
      }),
      signal,
    },
  )
  if (!response.ok)
    throw new Error('Approved parking could not be loaded. Try again.')
  const payload: unknown = await response.json()
  if (
    !isObject(payload) ||
    payload.contractVersion !== 1 ||
    typeof payload.truncated !== 'boolean' ||
    !Array.isArray(payload.records) ||
    payload.records.length > 250 ||
    !payload.records.every(
      (record) =>
        isParking(record) &&
        record.verification === 'verified' &&
        record.sourceKind !== 'sample' &&
        publicEvidenceUrl(record.sourceUrl) &&
        record.sourceLabel.trim().length > 0 &&
        record.license.trim().length > 0 &&
        !['unknown', 'pending', 'none'].includes(
          record.license.trim().toLowerCase(),
        ) &&
        record.verifiedAt !== null &&
        Date.parse(record.verifiedAt) <= Date.now(),
    )
  )
    throw new Error(
      'The approved parking service returned an unsupported response.',
    )
  return {
    contractVersion: 1,
    records: payload.records,
    truncated: payload.truncated,
  }
}

export type Destination = {
  id: string
  name: string
  address: string
  coordinate: Coordinate
}

export function parseDestinations(payload: unknown): Destination[] {
  if (!isObject(payload) || !Array.isArray(payload.features))
    throw new Error('The search service returned an unsupported response.')
  const results: Destination[] = []
  for (const [index, item] of payload.features.entries()) {
    if (
      !isObject(item) ||
      !isObject(item.geometry) ||
      item.geometry.type !== 'Point' ||
      !isCoordinate(item.geometry.coordinates) ||
      !isObject(item.properties)
    )
      continue
    const p = item.properties
    const parts = [
      p.housenumber,
      p.street,
      p.district,
      p.city,
      p.country,
    ].filter((part): part is string => typeof part === 'string')
    const name = typeof p.name === 'string' ? p.name : parts[0] || 'Destination'
    results.push({
      id: `${String(p.osm_id ?? index)}-${index}`,
      name,
      address: parts.join(', '),
      coordinate: item.geometry.coordinates,
    })
  }
  return results
}

export async function searchDestinations(
  endpoint: string,
  query: string,
  center: Coordinate,
  signal: AbortSignal,
) {
  const url = new URL(endpoint)
  url.searchParams.set('q', query.trim())
  url.searchParams.set('limit', '6')
  url.searchParams.set('lang', 'en')
  url.searchParams.set('lon', String(center[0]))
  url.searchParams.set('lat', String(center[1]))
  const response = await fetch(url.toString(), { signal })
  if (!response.ok)
    throw new Error(
      'Destination search is unavailable. Try again or explore the map.',
    )
  return parseDestinations(await response.json())
}
