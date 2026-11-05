import type {
  NcrDiscoveryResponse,
  NcrDiscoveryItem,
  NcrFeatureType,
} from '@parkey/shared-types'

import { isCoordinate, isObject } from './model.ts'
import type { Viewport } from './model.ts'

export const ncrCategories: { value: 'all' | NcrFeatureType; label: string }[] =
  [
    { value: 'all', label: 'All features' },
    { value: 'lot', label: 'Lots' },
    { value: 'garage', label: 'Garages' },
    { value: 'facility_unspecified', label: 'Type unknown' },
    { value: 'street_segment', label: 'Streets' },
    { value: 'entrance', label: 'Entrances' },
    { value: 'space', label: 'Individual bays' },
  ]
const featureTypes = new Set<string>(ncrCategories.map((c) => c.value))
const loopback = (host: string) =>
  ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host)
export function ncrPreviewEnabled(
  environment: string | undefined,
  baseUrl: string,
  appHostname: string,
) {
  try {
    const url = new URL(baseUrl)
    return (
      environment === 'development' &&
      loopback(appHostname) &&
      loopback(url.hostname) &&
      url.protocol === 'http:' &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
    )
  } catch {
    return false
  }
}
const texts = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === 'string')
const safeUrl = (value: unknown) =>
  typeof value === 'string' && /^https:\/\//.test(value)
const nonnegative = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
function validGeometry(value: unknown) {
  if (!isObject(value)) return false
  const line = (v: unknown): boolean =>
    Array.isArray(v) && v.length >= 2 && v.every(isCoordinate)
  const polygon = (v: unknown): boolean =>
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((r) => line(r) && Array.isArray(r) && r.length >= 4)
  if (value.type === 'Point') return isCoordinate(value.coordinates)
  if (value.type === 'LineString') return line(value.coordinates)
  if (value.type === 'MultiLineString')
    return (
      Array.isArray(value.coordinates) &&
      value.coordinates.length > 0 &&
      value.coordinates.every(line)
    )
  if (value.type === 'Polygon') return polygon(value.coordinates)
  return (
    value.type === 'MultiPolygon' &&
    Array.isArray(value.coordinates) &&
    value.coordinates.length > 0 &&
    value.coordinates.every(polygon)
  )
}
function validItem(value: unknown): value is NcrDiscoveryItem {
  if (
    !isObject(value) ||
    !isObject(value.evidence) ||
    !isObject(value.source) ||
    !isObject(value.publicationReview)
  )
    return false
  const e = value.evidence,
    s = value.source
  const review = value.publicationReview
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    typeof value.featureType === 'string' &&
    value.featureType !== 'all' &&
    featureTypes.has(value.featureType) &&
    validGeometry(value.geometry) &&
    isCoordinate(value.representativePoint) &&
    value.pointIsVehicleEntrance === false &&
    value.canNavigate === false &&
    typeof value.accessClass === 'string' &&
    typeof value.restrictedAccess === 'boolean' &&
    ['approvedAt', 'reviewDueAt'].every(
      (k) =>
        review[k] === null ||
        (typeof review[k] === 'string' &&
          Number.isFinite(Date.parse(review[k]))),
    ) &&
    typeof e.researchStatus === 'string' &&
    [
      'onlineCorroborated',
      'operatorConfirmed',
      'physicallyVerified',
      'publicationApproved',
    ].every((k) => typeof e[k] === 'boolean') &&
    ['osm', 'overture'].includes(String(s.kind)) &&
    safeUrl(s.url) &&
    typeof s.license === 'string' &&
    typeof s.attribution === 'string' &&
    (s.observedAt === null ||
      (typeof s.observedAt === 'string' &&
        Number.isFinite(Date.parse(s.observedAt)))) &&
    texts(value.warnings) &&
    texts(value.reviewIssueIds) &&
    ['fees', 'hours', 'capacity', 'liveAvailability'].every(
      (k) => value[k] === null,
    )
  )
}
export function ncrResponseCanDisplay(
  value: NcrDiscoveryResponse | null,
  mode: NcrDiscoveryResponse['mode'],
  now = Date.now(),
) {
  return (
    value !== null &&
    value.mode === mode &&
    (mode === 'research_preview' ||
      value.totalMatched === 0 ||
      (typeof value.reviewDueAt === 'string' &&
        Date.parse(value.reviewDueAt) > now)) &&
    (mode === 'research_preview' ||
      value.items.every(
        (item) =>
          item.evidence.publicationApproved &&
          !item.restrictedAccess &&
          item.reviewIssueIds.length === 0 &&
          typeof item.publicationReview.approvedAt === 'string' &&
          typeof item.publicationReview.reviewDueAt === 'string' &&
          Date.parse(item.publicationReview.reviewDueAt) > now &&
          Date.parse(item.publicationReview.approvedAt) <= now,
      ))
  )
}
export function isNcrResponse(value: unknown): value is NcrDiscoveryResponse {
  if (!isObject(value) || !isObject(value.coverage)) return false
  const coverage = value.coverage
  return (
    value.schemaVersion === 1 &&
    ['public', 'research_preview'].includes(String(value.mode)) &&
    typeof value.dataVersion === 'string' &&
    typeof value.generatedAt === 'string' &&
    (value.reviewDueAt === null ||
      (typeof value.reviewDueAt === 'string' &&
        Number.isFinite(Date.parse(value.reviewDueAt)))) &&
    Number.isFinite(Date.parse(value.generatedAt)) &&
    ['sourceAsOf', 'boundarySource', 'scope'].every(
      (k) => typeof coverage[k] === 'string',
    ) &&
    Array.isArray(value.items) &&
    value.items.length <= 500 &&
    value.items.every(validItem) &&
    Array.isArray(value.clusters) &&
    value.clusters.length <= 2000 &&
    value.clusters.every(
      (c) =>
        isObject(c) &&
        typeof c.id === 'string' &&
        isCoordinate(c.coordinate) &&
        nonnegative(c.sourceObservationCount) &&
        nonnegative(c.facilityCandidateCount) &&
        isObject(c.byType) &&
        Object.entries(c.byType).every(
          ([k, v]) => k !== 'all' && featureTypes.has(k) && nonnegative(v),
        ),
    ) &&
    (value.nextCursor === null || typeof value.nextCursor === 'string') &&
    typeof value.truncated === 'boolean' &&
    nonnegative(value.totalMatched) &&
    typeof value.notice === 'string' &&
    Array.isArray(value.attribution) &&
    value.attribution.every(
      (a) => isObject(a) && typeof a.label === 'string' && safeUrl(a.url),
    )
  )
}
export async function fetchNcrPage(
  baseUrl: string,
  viewport: Viewport,
  category: 'all' | NcrFeatureType,
  mode: 'public' | 'research_preview',
  signal: AbortSignal,
  cursor: string | null = null,
  names: 'all' | 'named' | 'corroborated' = 'all',
): Promise<NcrDiscoveryResponse> {
  const url = new URL(
    mode === 'public' ? '/api/ncr/discovery' : '/api/ncr/research-preview',
    baseUrl,
  )
  url.searchParams.set(
    'bbox',
    [viewport.west, viewport.south, viewport.east, viewport.north].join(','),
  )
  url.searchParams.set('zoom', String(viewport.zoom))
  url.searchParams.set('category', category)
  url.searchParams.set('names', names)
  url.searchParams.set('limit', '200')
  if (cursor) url.searchParams.set('cursor', cursor)
  const response = await fetch(url.toString(), {
    signal,
    cache: 'no-store',
    headers:
      mode === 'research_preview'
        ? { 'X-Parkey-Research-Preview': 'local-development' }
        : {},
  })
  if (!response.ok)
    throw new Error(
      `NCR research service returned ${response.status}. Start the local preview server or retry.`,
    )
  const value: unknown = await response.json()
  if (!isNcrResponse(value) || value.mode !== mode)
    throw new Error(
      'The NCR service returned an unsupported response. No records were displayed.',
    )
  if (mode === 'public' && !ncrResponseCanDisplay(value, mode))
    throw new Error(
      'The public response failed publication checks. No records were displayed.',
    )
  return value
}
