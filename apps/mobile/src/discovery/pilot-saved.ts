import type {
  Coordinate,
  NcrFeatureType,
  PilotCity,
  PilotMode,
  PilotParking,
} from '@parkey/shared-types'

import { isCoordinate, isObject } from './model.ts'
import { isPilotParking, pilotRecordCanDisplay } from './pilot-client.ts'

export type PilotSavedPlace = {
  key: string
  id: string
  city: PilotCity
  name: string
  featureType: NcrFeatureType
  coordinate: Coordinate
  sourceUrl: string | null
}

export const PILOT_SAVED_KEY = 'parkey.discovery.public-pilot-saved.v1'
export const MAX_PILOT_SAVED = 50
const maximumEnvelopeLength = 327680
const fields = [
  'key',
  'id',
  'city',
  'name',
  'featureType',
  'coordinate',
  'sourceUrl',
]
const featureTypes: readonly NcrFeatureType[] = [
  'lot',
  'garage',
  'facility_unspecified',
  'street_segment',
  'space',
  'entrance',
]

function cityIsValid(value: unknown): value is PilotCity {
  return value === 'Manila' || value === 'Mandaluyong'
}

function sourceIsValid(value: unknown): value is string | null {
  if (value === null) return true
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

function identity(id: string, sourceUrl: string | null, city: PilotCity) {
  return JSON.stringify([city, sourceUrl ? 'source' : 'id', sourceUrl || id])
}

/** Source identity survives the change from an imported ID to a server UUID. */
export function pilotSavedKey(
  record: Pick<PilotParking, 'id' | 'source'>,
  city: PilotCity,
) {
  return identity(record.id, record.source.url, city)
}

function copy(items: readonly PilotSavedPlace[]): PilotSavedPlace[] {
  return items.map((item) => ({
    ...item,
    coordinate: [item.coordinate[0], item.coordinate[1]],
  }))
}

export function publicPilotSavedPlace(
  record: PilotParking,
  city: PilotCity,
  mode: PilotMode,
  now = Date.now(),
): PilotSavedPlace {
  const name = [record.officialName, record.descriptiveLabel].find(
    (value) => typeof value === 'string' && value.trim().length > 0,
  )
  if (
    mode !== 'public' ||
    !cityIsValid(city) ||
    !Number.isFinite(now) ||
    !isPilotParking(record) ||
    !pilotRecordCanDisplay(record, 'public', now) ||
    !['unknown', 'yes', 'public', 'permissive', 'public_visitors'].includes(
      record.accessClass.trim().toLowerCase(),
    ) ||
    !name ||
    name.length > 200 ||
    !record.id.trim() ||
    record.id.length > 512 ||
    !sourceIsValid(record.source.url)
  )
    throw new Error('Only current approved public parking can be saved.')
  return {
    key: pilotSavedKey(record, city),
    id: record.id,
    city,
    name,
    featureType: record.featureType,
    coordinate: [record.representativePoint[0], record.representativePoint[1]],
    sourceUrl: record.source.url,
  }
}

/** Hydration accepts metadata only, never persisted record bodies or approvals. */
export function parsePilotSaved(value: unknown): PilotSavedPlace[] {
  if (
    !isObject(value) ||
    value.version !== 1 ||
    Object.keys(value).some((key) => !['version', 'items'].includes(key)) ||
    !Array.isArray(value.items) ||
    value.items.length > MAX_PILOT_SAVED
  )
    throw new Error(
      'Saved parking has an unsupported format. Retry or clear saved parking.',
    )
  const items = value.items.map((item: unknown): PilotSavedPlace => {
    if (
      !isObject(item) ||
      Object.keys(item).length !== fields.length ||
      Object.keys(item).some((key) => !fields.includes(key)) ||
      typeof item.id !== 'string' ||
      !item.id.trim() ||
      item.id.length > 512 ||
      !cityIsValid(item.city) ||
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      item.name.length > 200 ||
      !featureTypes.some((type) => type === item.featureType) ||
      !isCoordinate(item.coordinate) ||
      !sourceIsValid(item.sourceUrl) ||
      item.key !== identity(item.id, item.sourceUrl, item.city)
    )
      throw new Error(
        'Saved parking could not be read. Retry or clear saved parking.',
      )
    // Preserve the exact classification rather than guessing a lot or garage.
    const featureType = featureTypes.find((type) => type === item.featureType)
    if (!featureType)
      throw new Error('Saved parking classification is unsupported.')
    return {
      key: item.key,
      id: item.id,
      city: item.city,
      name: item.name,
      featureType,
      coordinate: [item.coordinate[0], item.coordinate[1]],
      sourceUrl: item.sourceUrl,
    }
  })
  if (new Set(items.map((item) => item.key)).size !== items.length)
    throw new Error(
      'Saved parking contains duplicate records. Retry or clear saved parking.',
    )
  return items
}

type Storage = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<unknown>
  removeItem: (key: string) => Promise<unknown>
}

/** One queue serializes reads, writes and explicit recovery after failures. */
export function createPilotSavedStore(storage: Storage) {
  let queue: Promise<unknown> = Promise.resolve()
  let current: PilotSavedPlace[] | null = null
  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const task = queue.then(operation, operation)
    queue = task.catch(() => undefined)
    return task
  }
  async function read() {
    const raw = await storage.getItem(PILOT_SAVED_KEY)
    if (raw !== null && raw.length > maximumEnvelopeLength)
      throw new Error(
        'Saved parking is too large. Retry or clear saved parking.',
      )
    const items = raw === null ? [] : parsePilotSaved(JSON.parse(raw))
    current = items
    return copy(items)
  }
  async function write(items: PilotSavedPlace[]) {
    const parsed = parsePilotSaved({ version: 1, items })
    await storage.setItem(
      PILOT_SAVED_KEY,
      JSON.stringify({ version: 1, items: parsed }),
    )
    current = parsed
    return copy(parsed)
  }
  return {
    load: () => enqueue(read),
    toggle: (
      record: PilotParking,
      city: PilotCity,
      mode: PilotMode,
      now?: number,
    ) =>
      enqueue(async () => {
        const entry = publicPilotSavedPlace(record, city, mode, now)
        const items = current ?? (await read())
        const exists = items.some((item) => item.key === entry.key)
        return write(
          exists
            ? items.filter((item) => item.key !== entry.key)
            : [entry, ...items].slice(0, MAX_PILOT_SAVED),
        )
      }),
    remove: (key: string) =>
      enqueue(async () => {
        const items = current ?? (await read())
        return write(items.filter((item) => item.key !== key))
      }),
    clear: () =>
      enqueue(async () => {
        await storage.removeItem(PILOT_SAVED_KEY)
        current = []
        return []
      }),
  }
}
