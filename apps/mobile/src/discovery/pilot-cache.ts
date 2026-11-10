import type {
  Coordinate,
  NcrGeometry,
  PilotBounds,
  PilotCity,
  PilotParking,
} from '@parkey/shared-types'

import { isObject } from './model.ts'
import {
  isPilotParking,
  pilotRecordCanDisplay,
  validPilotBounds,
} from './pilot-client.ts'
import type { PilotRequest } from './pilot-client.ts'
import { publicEndpointProblem } from './pilot-config.ts'

export const PUBLIC_PILOT_CACHE_TTL_MS = 5 * 60 * 1000
const maximumEntries = 6
const maximumRecords = 1000
const maximumBytes = 1024 * 1024
type Request = Pick<PilotRequest, 'city' | 'mode' | 'bounds' | 'token'>
type Entry = {
  city: PilotCity
  bounds: PilotBounds
  records: PilotParking[]
  fetchedAt: number
}
type Storage = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<unknown>
  removeItem: (key: string) => Promise<unknown>
}

function exactKeys(value: unknown, keys: readonly string[]) {
  return (
    isObject(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  )
}

/** Count UTF-8 bytes without relying on a platform TextEncoder polyfill. */
function byteLength(value: string) {
  let bytes = 0
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4
    if (bytes > maximumBytes) break
  }
  return bytes
}

function validTime(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 8640000000000000
  )
}

function namespaceOrigin(value: string): string | null {
  if (
    typeof value !== 'string' ||
    !value ||
    publicEndpointProblem(value, false, true)
  )
    return null
  return new URL(value).origin
}

function viewport(
  request: Request,
): { city: PilotCity; bounds: PilotBounds } | null {
  if (
    !request ||
    request.mode !== 'public' ||
    request.token !== null ||
    !['Manila', 'Mandaluyong'].includes(request.city) ||
    !isObject(request.bounds) ||
    !validPilotBounds(request.bounds)
  )
    return null
  const round = (value: number) => Math.round(value * 100000) / 100000
  const bounds = {
    west: round(request.bounds.west),
    south: round(request.bounds.south),
    east: round(request.bounds.east),
    north: round(request.bounds.north),
  }
  return validPilotBounds(bounds) ? { city: request.city, bounds } : null
}

function viewportKey(value: { city: PilotCity; bounds: PilotBounds }) {
  return JSON.stringify([
    value.city,
    value.bounds.west,
    value.bounds.south,
    value.bounds.east,
    value.bounds.north,
  ])
}

function pointCopy(point: Coordinate): Coordinate {
  return [point[0], point[1]]
}

function geometryCopy(geometry: NcrGeometry): NcrGeometry {
  switch (geometry.type) {
    case 'Point':
      return {
        type: geometry.type,
        coordinates: pointCopy(geometry.coordinates),
      }
    case 'LineString':
      return {
        type: geometry.type,
        coordinates: geometry.coordinates.map(pointCopy),
      }
    case 'MultiLineString':
    case 'Polygon':
      return {
        type: geometry.type,
        coordinates: geometry.coordinates.map((line) => line.map(pointCopy)),
      }
    case 'MultiPolygon':
      return {
        type: geometry.type,
        coordinates: geometry.coordinates.map((polygon) =>
          polygon.map((line) => line.map(pointCopy)),
        ),
      }
  }
}

const recordKeys = [
  'id',
  'sourceObservationId',
  'name',
  'officialName',
  'descriptiveLabel',
  'featureType',
  'geometry',
  'representativePoint',
  'accessClass',
  'restrictedAccess',
  'source',
  'evidence',
  'navigationApproval',
  'reviewDueAt',
  'fees',
  'hours',
  'destinationContext',
  'warnings',
]

function publicRecord(
  record: unknown,
  now: number,
  stored = false,
): PilotParking | null {
  if (
    !isPilotParking(record) ||
    !pilotRecordCanDisplay(record, 'public', now) ||
    !['unknown', 'yes', 'public', 'permissive', 'public_visitors'].includes(
      record.accessClass.trim().toLowerCase(),
    )
  )
    return null
  if (record.source.url !== null) {
    try {
      const url = new URL(record.source.url)
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        return null
    } catch {
      return null
    }
  }
  if (
    stored &&
    (!exactKeys(record, recordKeys) ||
      !exactKeys(record.geometry, ['type', 'coordinates']) ||
      !exactKeys(record.source, [
        'kind',
        'url',
        'license',
        'attribution',
        'updatedAt',
      ]) ||
      !exactKeys(record.evidence, [
        'researchStatus',
        'onlineCorroborated',
        'operatorConfirmed',
        'physicallyVerified',
        'publicationApproved',
      ]) ||
      record.navigationApproval !== null)
  )
    return null
  return {
    id: record.id,
    sourceObservationId: record.sourceObservationId,
    name: record.name,
    officialName: record.officialName,
    descriptiveLabel: record.descriptiveLabel,
    featureType: record.featureType,
    geometry: geometryCopy(record.geometry),
    representativePoint: pointCopy(record.representativePoint),
    accessClass: record.accessClass,
    restrictedAccess: false,
    source: {
      kind: record.source.kind,
      url: record.source.url,
      license: record.source.license,
      attribution: record.source.attribution,
      updatedAt: record.source.updatedAt,
    },
    evidence: {
      researchStatus: record.evidence.researchStatus,
      onlineCorroborated: record.evidence.onlineCorroborated,
      operatorConfirmed: record.evidence.operatorConfirmed,
      physicallyVerified: record.evidence.physicallyVerified,
      publicationApproved: true,
    },
    // A cached display projection must never enable vehicle navigation.
    navigationApproval: null,
    reviewDueAt: record.reviewDueAt,
    fees: record.fees,
    hours: record.hours,
    destinationContext: [],
    warnings: [...record.warnings],
  }
}

function publicRecords(
  value: unknown,
  now: number,
  stored = false,
): PilotParking[] | null {
  if (!Array.isArray(value) || value.length > maximumRecords) return null
  const result: PilotParking[] = []
  let bytes = 0
  const ids = new Set<string>()
  for (const record of value) {
    const safe = publicRecord(record, now, stored)
    if (!safe || ids.has(safe.id)) return null
    bytes += byteLength(JSON.stringify(safe))
    if (bytes > maximumBytes) return null
    ids.add(safe.id)
    result.push(safe)
  }
  return result
}

function usable(entry: Entry, now: number) {
  return (
    now >= entry.fetchedAt &&
    now - entry.fetchedAt < PUBLIC_PILOT_CACHE_TTL_MS &&
    entry.records.every((record) =>
      pilotRecordCanDisplay(record, 'public', now),
    )
  )
}

/** Bounded display cache only. Live requests remain the source of navigation permission. */
export function createPublicPilotCache(storage: Storage, namespace: string) {
  const origin = namespaceOrigin(namespace)
  const storageKey = origin
    ? `parkey.discovery.public-pilot-cache.v1:${encodeURIComponent(origin)}`
    : ''
  let entries: Entry[] = []
  let loaded = false
  let blocked = false
  let queue: Promise<unknown> = Promise.resolve()
  let epoch = 0
  function enqueue<T>(operation: () => Promise<T>) {
    const task = queue.then(operation, operation)
    queue = task.catch(() => undefined)
    return task
  }
  function envelope(next: Entry[]) {
    return JSON.stringify({ version: 1, namespace: origin, entries: next })
  }
  async function hydrate() {
    if (blocked) {
      entries = []
      loaded = true
      return
    }
    if (loaded) return
    const raw = await storage.getItem(storageKey)
    entries = []
    loaded = true
    if (raw === null || byteLength(raw) > maximumBytes) return
    try {
      const value: unknown = JSON.parse(raw)
      if (
        !exactKeys(value, ['version', 'namespace', 'entries']) ||
        !isObject(value) ||
        value.version !== 1 ||
        value.namespace !== origin ||
        !Array.isArray(value.entries) ||
        value.entries.length > maximumEntries
      )
        return
      const next: Entry[] = []
      let count = 0
      const keys = new Set<string>()
      for (const entry of value.entries) {
        if (
          !exactKeys(entry, ['city', 'bounds', 'records', 'fetchedAt']) ||
          !isObject(entry) ||
          !validTime(entry.fetchedAt) ||
          (entry.city !== 'Manila' && entry.city !== 'Mandaluyong') ||
          !isObject(entry.bounds)
        )
          return
        const area = viewport({
          city: entry.city,
          mode: 'public',
          token: null,
          bounds: {
            west: Number(entry.bounds.west),
            south: Number(entry.bounds.south),
            east: Number(entry.bounds.east),
            north: Number(entry.bounds.north),
          },
        })
        if (
          !area ||
          !exactKeys(entry.bounds, ['west', 'south', 'east', 'north']) ||
          !Object.values(entry.bounds).every(
            (value) => typeof value === 'number',
          ) ||
          JSON.stringify(area.bounds) !== JSON.stringify(entry.bounds)
        )
          return
        const records = publicRecords(entry.records, entry.fetchedAt, true)
        if (!records || keys.has(viewportKey(area))) return
        count += records.length
        if (count > maximumRecords) return
        keys.add(viewportKey(area))
        next.push({ ...area, records, fetchedAt: entry.fetchedAt })
      }
      entries = next
    } catch {
      // Cache corruption never prevents a live request.
    }
  }
  async function persist(next: Entry[]) {
    if (next.length) await storage.setItem(storageKey, envelope(next))
    else await storage.removeItem(storageKey)
    entries = next
    loaded = true
  }
  function failed() {
    loaded = false
    entries = []
  }
  return {
    async get(
      request: Request,
      now = Date.now(),
    ): Promise<{
      records: PilotParking[]
      fetchedAt: number
    } | null> {
      const area = viewport(request),
        generation = epoch
      if (!origin || !area || !validTime(now) || blocked) return null
      return enqueue(async () => {
        try {
          await hydrate()
          if (generation !== epoch) return null
          const current = entries.filter((entry) => usable(entry, now))
          const key = viewportKey(area)
          const index = current.findIndex((entry) => viewportKey(entry) === key)
          const hit = current[index]
          const next = hit
            ? [hit, ...current.filter((entry) => viewportKey(entry) !== key)]
            : current
          if (index > 0 || next.length !== entries.length) await persist(next)
          if (!hit || generation !== epoch) return null
          const records = publicRecords(hit.records, now)
          return records ? { records, fetchedAt: hit.fetchedAt } : null
        } catch {
          failed()
          return null
        }
      })
    },
    async put(
      request: Request,
      records: readonly PilotParking[],
      now = Date.now(),
    ): Promise<boolean> {
      const area = viewport(request),
        generation = epoch
      if (!origin || !area || !validTime(now)) return false
      const safe = publicRecords(records, now)
      if (!safe) return false
      return enqueue(async () => {
        try {
          await hydrate()
          if (generation !== epoch) return false
          const key = viewportKey(area)
          const previous = entries.find((entry) => viewportKey(entry) === key)
          if (previous && previous.fetchedAt > now) return false
          const next = [
            { ...area, records: safe, fetchedAt: now },
            ...entries.filter(
              (entry) => viewportKey(entry) !== key && usable(entry, now),
            ),
          ].slice(0, maximumEntries)
          while (
            next.reduce((sum, entry) => sum + entry.records.length, 0) >
              maximumRecords ||
            byteLength(envelope(next)) > maximumBytes
          ) {
            if (next.length === 1) return false
            next.pop()
          }
          await persist(next)
          blocked = false
          return generation === epoch
        } catch {
          failed()
          return false
        }
      })
    },
    async invalidate(request: Request): Promise<void> {
      const area = viewport(request)
      if (!origin || !area) return
      epoch++
      return enqueue(async () => {
        try {
          await hydrate()
          const key = viewportKey(area)
          await persist(entries.filter((entry) => viewportKey(entry) !== key))
          blocked = false
        } catch {
          failed()
          // A failed revocation/removal must not resurrect old disk entries.
          blocked = true
        }
      })
    },
  }
}
