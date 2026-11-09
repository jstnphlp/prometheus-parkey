import type {
  Coordinate,
  PilotBounds,
  PilotCity,
  PilotDestination,
  PilotMode,
  PilotPage,
  PilotParking,
} from '@parkey/shared-types'

import { isCoordinate, isObject } from './model.ts'
import {
  isParkingNavigationApproval,
  publicParkingAccess,
} from './parking-navigation.ts'
import { createPublicRequestPool } from './public-request-pool.ts'

export const pilotAreas: Record<
  PilotCity,
  { coordinate: Coordinate; bounds: PilotBounds }
> = {
  Manila: {
    coordinate: [120.9842, 14.5995],
    bounds: { west: 120.94, south: 14.54, east: 121.03, north: 14.66 },
  },
  Mandaluyong: {
    coordinate: [121.039, 14.583],
    bounds: { west: 121.005, south: 14.55, east: 121.075, north: 14.615 },
  },
}
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 5000
const date = (value: unknown) =>
  value === null ||
  (typeof value === 'string' && Number.isFinite(Date.parse(value)))
const nullableText = (value: unknown) => value === null || text(value)
const texts = (value: unknown) =>
  Array.isArray(value) && value.length <= 200 && value.every(text)
const safeUrl = (value: unknown) =>
  value === null ||
  (typeof value === 'string' && /^https:\/\/[^\s]+$/.test(value))
function source(value: unknown) {
  return (
    isObject(value) &&
    safeUrl(value.url) &&
    text(value.license) &&
    text(value.attribution) &&
    date(value.updatedAt)
  )
}
function geometry(value: unknown): boolean {
  if (!isObject(value)) return false
  let points = 0
  const line = (v: unknown, minimum: number): boolean =>
    Array.isArray(v) &&
    v.length >= minimum &&
    v.every((p) => ++points <= 50000 && isCoordinate(p))
  const polygon = (v: unknown): boolean =>
    Array.isArray(v) && v.length > 0 && v.every((r) => line(r, 4))
  switch (value.type) {
    case 'Point':
      return isCoordinate(value.coordinates)
    case 'LineString':
      return line(value.coordinates, 2)
    case 'MultiLineString':
      return (
        Array.isArray(value.coordinates) &&
        value.coordinates.length > 0 &&
        value.coordinates.every((v) => line(v, 2))
      )
    case 'Polygon':
      return polygon(value.coordinates)
    case 'MultiPolygon':
      return (
        Array.isArray(value.coordinates) &&
        value.coordinates.length > 0 &&
        value.coordinates.every(polygon)
      )
    default:
      return false
  }
}
function context(value: unknown) {
  return (
    isObject(value) &&
    ['label', 'destination', 'sourceId', 'sourceLicense'].every((k) =>
      text(value[k]),
    ) &&
    safeUrl(value.sourceRecordUrl) &&
    value.sourceRecordUrl !== null &&
    (value.category === undefined || text(value.category)) &&
    (value.approximateStraightLineMeters === undefined ||
      value.approximateStraightLineMeters === null ||
      (typeof value.approximateStraightLineMeters === 'number' &&
        Number.isFinite(value.approximateStraightLineMeters) &&
        value.approximateStraightLineMeters >= 0)) &&
    (value.insideSourcePropertyFootprint === undefined ||
      value.insideSourcePropertyFootprint === null ||
      typeof value.insideSourcePropertyFootprint === 'boolean') &&
    (value.uncertainties === undefined || texts(value.uncertainties)) &&
    value.status === 'research_context_only' &&
    [
      'parkingNameConfirmed',
      'visitorAccessConfirmed',
      'navigationEntranceConfirmed',
      'publicationApproved',
    ].every((k) => value[k] === false)
  )
}
export function isPilotParking(value: unknown): value is PilotParking {
  if (!isObject(value) || !isObject(value.evidence) || !isObject(value.source))
    return false
  const evidence = value.evidence
  return (
    text(value.id) &&
    value.id.length > 0 &&
    text(value.sourceObservationId) &&
    text(value.name) &&
    nullableText(value.officialName) &&
    nullableText(value.descriptiveLabel) &&
    [
      'lot',
      'garage',
      'facility_unspecified',
      'street_segment',
      'space',
      'entrance',
    ].includes(String(value.featureType)) &&
    geometry(value.geometry) &&
    isCoordinate(value.representativePoint) &&
    text(value.accessClass) &&
    typeof value.restrictedAccess === 'boolean' &&
    source(value.source) &&
    ['osm', 'overture', 'parkey', 'community'].includes(
      String(value.source.kind),
    ) &&
    text(evidence.researchStatus) &&
    [
      'onlineCorroborated',
      'operatorConfirmed',
      'physicallyVerified',
      'publicationApproved',
    ].every((k) => typeof evidence[k] === 'boolean') &&
    (value.navigationApproval === null ||
      isParkingNavigationApproval(value.navigationApproval)) &&
    date(value.reviewDueAt) &&
    nullableText(value.fees) &&
    nullableText(value.hours) &&
    Array.isArray(value.destinationContext) &&
    value.destinationContext.length <= 100 &&
    value.destinationContext.every(context) &&
    texts(value.warnings)
  )
}
export function isPilotDestination(value: unknown): value is PilotDestination {
  return (
    isObject(value) &&
    text(value.id) &&
    value.id.length > 0 &&
    text(value.name) &&
    text(value.category) &&
    isCoordinate(value.coordinate) &&
    source(value.source) &&
    typeof value.publicationApproved === 'boolean' &&
    date(value.reviewDueAt) &&
    value.parkingIdentity === false &&
    value.parkingAccessConfirmed === false
  )
}
export function pilotRecordCanDisplay(
  record: PilotParking,
  mode: PilotMode,
  now = Date.now(),
) {
  return mode === 'candidate_research'
    ? record.evidence.publicationApproved === false &&
        record.navigationApproval === null
    : record.evidence.publicationApproved &&
        !record.restrictedAccess &&
        publicParkingAccess(record.accessClass) &&
        record.destinationContext.length === 0 &&
        (record.officialName !== null || record.descriptiveLabel !== null) &&
        typeof record.reviewDueAt === 'string' &&
        Date.parse(record.reviewDueAt) > now
}
export function pilotNavigationEntrance(
  record: PilotParking,
  mode: PilotMode,
  now = Date.now(),
): Coordinate | null {
  const approval = record.navigationApproval
  if (
    mode !== 'public' ||
    !pilotRecordCanDisplay(record, mode, now) ||
    !isParkingNavigationApproval(approval) ||
    Date.parse(approval.expiresAt) <= now ||
    Date.parse(approval.expiresAt) > Date.parse(record.reviewDueAt || '') ||
    !publicParkingAccess(record.accessClass)
  )
    return null
  return approval.entrance
}
export type PilotRequest = {
  city: PilotCity
  mode: PilotMode
  bounds: PilotBounds
  token: string | null
}
export type PilotConnection = { supabaseUrl: string; publicKey: string }
export function pilotRequestKey(request: PilotRequest) {
  return JSON.stringify([
    request.city,
    request.mode,
    request.bounds,
    request.token,
  ])
}

/** Map movement changes a query, not the selected observation's access scope. */
export function pilotSelectionKey(request: PilotRequest) {
  return JSON.stringify([request.city, request.mode, request.token])
}
export function pilotSelectedRecord(
  selection: { key: string; record: PilotParking } | null,
  request: PilotRequest,
  now = Date.now(),
): PilotParking | null {
  return selection?.key === pilotSelectionKey(request) &&
    pilotRecordCanDisplay(selection.record, request.mode, now)
    ? selection.record
    : null
}
export function validPilotBounds(bounds: PilotBounds) {
  return (
    Object.values(bounds).every(Number.isFinite) &&
    bounds.west >= -180 &&
    bounds.east <= 180 &&
    bounds.south >= -85.051129 &&
    bounds.north <= 85.051129 &&
    bounds.west < bounds.east &&
    bounds.south < bounds.north &&
    bounds.east - bounds.west <= 0.5 &&
    bounds.north - bounds.south <= 0.5
  )
}
export class PilotAccessError extends Error {}
const publicParkingRequests =
  createPublicRequestPool<PilotPage<PilotParking | PilotDestination>>()

function publicParkingRequestKey(
  connection: PilotConnection,
  request: PilotRequest,
) {
  try {
    const url = new URL(connection.supabaseUrl)
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      return null
    return JSON.stringify([
      url.origin,
      connection.publicKey,
      request.city,
      request.bounds.west,
      request.bounds.south,
      request.bounds.east,
      request.bounds.north,
    ])
  } catch {
    return null
  }
}

export function fetchPilotPage(
  connection: PilotConnection,
  request: PilotRequest,
  kind: 'pilot_discovery',
  signal: AbortSignal,
  cursor?: string | null,
  query?: string,
  recordId?: string | null,
): Promise<PilotPage<PilotParking>>
export function fetchPilotPage(
  connection: PilotConnection,
  request: PilotRequest,
  kind: 'pilot_destinations',
  signal: AbortSignal,
  cursor?: string | null,
  query?: string,
): Promise<PilotPage<PilotDestination>>
export async function fetchPilotPage(
  connection: PilotConnection,
  request: PilotRequest,
  kind: 'pilot_discovery' | 'pilot_destinations',
  signal: AbortSignal,
  cursor: string | null = null,
  query = '',
  recordId: string | null = null,
): Promise<PilotPage<PilotParking | PilotDestination>> {
  signal.throwIfAborted()
  const initialPublicViewport =
    request.mode === 'public' &&
    request.token === null &&
    kind === 'pilot_discovery' &&
    cursor === null &&
    query === '' &&
    recordId === null &&
    validPilotBounds(request.bounds)
  const key = initialPublicViewport
    ? publicParkingRequestKey(connection, request)
    : null
  return key
    ? publicParkingRequests.run(key, signal, (sharedSignal) =>
        fetchPilotPageUnshared(
          connection,
          request,
          kind,
          sharedSignal,
          cursor,
          query,
          recordId,
        ),
      )
    : fetchPilotPageUnshared(
        connection,
        request,
        kind,
        signal,
        cursor,
        query,
        recordId,
      )
}

async function fetchPilotPageUnshared(
  connection: PilotConnection,
  request: PilotRequest,
  kind: 'pilot_discovery' | 'pilot_destinations',
  signal: AbortSignal,
  cursor: string | null,
  query: string,
  recordId: string | null,
): Promise<PilotPage<PilotParking | PilotDestination>> {
  signal.throwIfAborted()
  if (!validPilotBounds(request.bounds))
    throw new Error(
      'Zoom in or return to the selected city to search this area.',
    )
  if (request.mode === 'candidate_research' && !request.token)
    throw new PilotAccessError('A restricted reviewer session is required.')
  if (query.length > 100 || (cursor !== null && cursor.length > 4096))
    throw new Error('Search input is too long.')
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, 15000)
  try {
    const response = await fetch(
      `${connection.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${recordId !== null ? 'get_pilot_parking' : kind === 'pilot_discovery' ? 'discover_pilot_parking' : 'discover_pilot_destinations'}`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          apikey: connection.publicKey,
          'Content-Type': 'application/json',
          ...(request.mode === 'candidate_research'
            ? { Authorization: `Bearer ${request.token}` }
            : {}),
        },
        body: JSON.stringify(
          recordId !== null
            ? { p_city: request.city, p_mode: request.mode, p_id: recordId }
            : {
                p_city: request.city,
                p_mode: request.mode,
                p_bbox: request.bounds,
                p_limit: 50,
                p_after: cursor,
                ...(kind === 'pilot_destinations'
                  ? { p_query: query.trim() }
                  : {}),
              },
        ),
      },
    )
    if (response.status === 401 || response.status === 403)
      throw new PilotAccessError(
        'Reviewer access was refused or expired. Public discovery remains available.',
      )
    if (!response.ok)
      throw new Error(
        'The selected city service is unavailable. Retry or return to the city center.',
      )
    const raw = await response.text()
    if (raw.length > 8000000)
      throw new Error('The service response exceeds the safe page size.')
    const value: unknown = JSON.parse(raw)
    signal.throwIfAborted()
    function validRecord(v: unknown): v is PilotParking | PilotDestination {
      return kind === 'pilot_discovery'
        ? isPilotParking(v) && pilotRecordCanDisplay(v, request.mode)
        : isPilotDestination(v) &&
            (request.mode === 'candidate_research'
              ? !v.publicationApproved
              : v.publicationApproved &&
                typeof v.reviewDueAt === 'string' &&
                Date.parse(v.reviewDueAt) > Date.now())
    }
    if (
      !isObject(value) ||
      value.schemaVersion !== 1 ||
      value.kind !== kind ||
      value.scopeVersion !== 'manila-mandaluyong-v1' ||
      value.city !== request.city ||
      value.mode !== request.mode ||
      !text(value.notice) ||
      !(
        value.nextCursor === null ||
        (typeof value.nextCursor === 'string' &&
          value.nextCursor.length > 0 &&
          value.nextCursor.length <= 4096)
      ) ||
      !Array.isArray(value.records) ||
      value.records.length > 50 ||
      !value.records.every(validRecord)
    )
      throw new Error(
        'The service returned incompatible or unapproved data. No records were displayed.',
      )
    const ids = value.records.map((v) => v.id)
    if (
      new Set(ids).size !== ids.length ||
      (value.nextCursor !== null && !ids.length)
    )
      throw new Error('The service returned invalid pagination.')
    return {
      schemaVersion: 1,
      kind,
      scopeVersion: 'manila-mandaluyong-v1',
      city: request.city,
      mode: request.mode,
      records: value.records,
      nextCursor: value.nextCursor,
      notice: value.notice,
    }
  } catch (error) {
    if (controller.signal.aborted && !signal.aborted)
      throw new Error(
        'The request timed out. Check your connection and retry.',
        { cause: error },
      )
    throw error
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}

export async function fetchPilotParkingRecord(
  connection: PilotConnection,
  request: PilotRequest,
  id: string,
  signal: AbortSignal,
): Promise<PilotParking | null> {
  if (!id || id.length > 200) throw new Error('Unsupported parking identity.')
  // Call the implementation with the same parser and cancellation as paged queries.
  const page = await fetchPilotPage(
    connection,
    request,
    'pilot_discovery',
    signal,
    null,
    '',
    id,
  )
  if (
    page.records.length > 1 ||
    page.nextCursor !== null ||
    page.records.some((record) => record.id !== id)
  )
    throw new Error('The service returned a different parking identity.')
  return page.records[0] || null
}

/** Each scope replacement aborts its predecessor; completion also checks identity. */
export function createPilotRequestGate() {
  let generation = 0
  let controller: AbortController | null = null
  return {
    begin() {
      controller?.abort()
      controller = new AbortController()
      const id = ++generation
      return {
        signal: controller.signal,
        current: () => id === generation && !controller?.signal.aborted,
      }
    },
    cancel() {
      generation++
      controller?.abort()
      controller = null
    },
  }
}
export function mergePilotPage<T extends { id: string }>(
  previous: T[],
  incoming: T[],
  cursor: string | null,
  seenCursors: Set<string>,
) {
  if (previous.length + incoming.length > 1000)
    throw new Error(
      'This view reached 1,000 loaded records. Zoom in to inspect a smaller area.',
    )
  if (cursor !== null && seenCursors.has(cursor))
    throw new Error('The service repeated a page cursor. Refresh this area.')
  const ids = new Set(previous.map((v) => v.id))
  if (incoming.some((v) => ids.has(v.id)))
    throw new Error('The service repeated record IDs. Refresh this area.')
  if (cursor !== null) seenCursors.add(cursor)
  return [...previous, ...incoming]
}
