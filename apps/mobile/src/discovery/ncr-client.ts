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
const boundedText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 1000
const boundedArray = (value: unknown, maximum = 100): value is unknown[] =>
  Array.isArray(value) && value.length <= maximum
function validEnrichment(value: unknown) {
  if (!isObject(value)) return false
  const evidence = (clue: unknown) =>
    isObject(clue) &&
    boundedText(clue.name) &&
    boundedText(clue.sourceId) &&
    boundedText(clue.sourceLicense) &&
    safeUrl(clue.sourceRecordUrl)
  return (
    boundedText(value.groupId) &&
    [
      'credible_reusable_name_pending_review',
      'proposed_name_incomplete_or_conflicting',
      'nearby_named_property_only',
      'operator_or_brand_only',
      'no_reliable_name_evidence',
      'unsuitable_for_public_discovery',
    ].includes(String(value.classification)) &&
    (value.proposedName === null || boundedText(value.proposedName)) &&
    boundedArray(value.nameTagLeads) &&
    value.nameTagLeads.every(
      (c) =>
        isObject(c) &&
        evidence(c) &&
        boundedText(c.basis) &&
        c.approvedForPublication === false,
    ) &&
    boundedArray(value.nearbyParkingLeads) &&
    value.nearbyParkingLeads.every(
      (c) =>
        isObject(c) &&
        evidence(c) &&
        typeof c.sourceIndependent === 'boolean' &&
        c.samePhysicalFacilityConfirmed === false &&
        c.usableAsParkingName === false,
    ) &&
    boundedArray(value.contextClues, 512) &&
    value.contextClues.every(
      (c) =>
        isObject(c) &&
        evidence(c) &&
        boundedText(c.relation) &&
        c.usableAsParkingName === false,
    ) &&
    boundedArray(value.operatorClues) &&
    value.operatorClues.every(
      (c) =>
        isObject(c) &&
        boundedText(c.name) &&
        ['operator', 'brand'].includes(String(c.kind)) &&
        boundedText(c.recordId) &&
        c.usableAsFacilityName === false,
    ) &&
    boundedArray(value.reviewLinks) &&
    value.reviewLinks.every((link) => {
      if (
        !isObject(link) ||
        !boundedText(link.recordId) ||
        !isCoordinate(link.coordinate)
      )
        return false
      const q = encodeURIComponent(
        link.coordinate[1] + ',' + link.coordinate[0],
      )
      return (
        link.googleMaps ===
          'https://www.google.com/maps/search/?api=1&query=' + q &&
        link.waze === 'https://www.waze.com/ul?ll=' + q + '&z=18'
      )
    })
  )
}
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
function validDestinationLabel(value: unknown): boolean {
  const components =
    isObject(value) && isObject(value.scoreComponents)
      ? value.scoreComponents
      : null
  return (
    isObject(value) &&
    typeof value.label === 'string' &&
    value.label.startsWith('Parking near ') &&
    value.label.length <= 100 &&
    typeof value.destination === 'string' &&
    value.destination.length > 0 &&
    typeof value.category === 'string' &&
    /^osm:(node|way|relation)\/[1-9]\d*$/.test(String(value.sourceId)) &&
    (value.sourceRecordUrl ===
      'https://www.openstreetmap.org/' + String(value.sourceId).slice(4) ||
      value.sourceRecordUrl ===
        'https://openstreetmap.org/' + String(value.sourceId).slice(4)) &&
    typeof value.approximateStraightLineMeters === 'number' &&
    Number.isFinite(value.approximateStraightLineMeters) &&
    value.approximateStraightLineMeters >= 0 &&
    typeof value.insideSourcePropertyFootprint === 'boolean' &&
    (value.sourceLicense === undefined || value.sourceLicense === 'ODbL-1.0') &&
    (value.sourceSnapshotSha256 === undefined ||
      value.sourceSnapshotSha256 === null ||
      (typeof value.sourceSnapshotSha256 === 'string' &&
        /^[a-f0-9]{64}$/.test(value.sourceSnapshotSha256))) &&
    (value.sourceRecordEditedAt === undefined ||
      value.sourceRecordEditedAt === null ||
      (typeof value.sourceRecordEditedAt === 'string' &&
        Number.isFinite(Date.parse(value.sourceRecordEditedAt)))) &&
    (value.sourceVersion === undefined ||
      value.sourceVersion === null ||
      (typeof value.sourceVersion === 'number' &&
        nonnegative(value.sourceVersion) &&
        value.sourceVersion > 0)) &&
    (value.sourceCoordinate === undefined ||
      value.sourceCoordinate === null ||
      isCoordinate(value.sourceCoordinate)) &&
    (value.anchorCoordinate === undefined ||
      value.anchorCoordinate === null ||
      isCoordinate(value.anchorCoordinate)) &&
    (value.parkingRecordId === undefined ||
      value.parkingRecordId === null ||
      boundedText(value.parkingRecordId)) &&
    (value.distanceBasis === undefined ||
      ['source_geometry_anchor_haversine', 'legacy_context_estimate'].includes(
        String(value.distanceBasis),
      )) &&
    (value.score === undefined ||
      (typeof value.score === 'number' && Number.isFinite(value.score))) &&
    (value.scoreComponents === undefined ||
      (components !== null &&
        ['category', 'proximity', 'containment'].every(
          (key) =>
            typeof components[key] === 'number' &&
            Number.isFinite(components[key]),
        ))) &&
    (value.duplicateSourceIds === undefined ||
      (boundedArray(value.duplicateSourceIds) &&
        value.duplicateSourceIds.every((id) =>
          /^osm:(node|way|relation)\/[1-9]\d*$/.test(String(id)),
        ))) &&
    (value.uncertainties === undefined ||
      (boundedArray(value.uncertainties) &&
        value.uncertainties.every(boundedText))) &&
    value.status === 'research_context_only' &&
    value.parkingNameConfirmed === false &&
    value.visitorAccessConfirmed === false &&
    value.navigationEntranceConfirmed === false &&
    value.publicationApproved === false
  )
}
function validDestinationReview(value: unknown): boolean {
  return (
    isObject(value) &&
    [
      'described',
      'ambiguous',
      'restricted_or_unsuitable',
      'no_suitable_destination',
      'previously_named',
      'not_facility',
    ].includes(String(value.outcome)) &&
    boundedArray(value.alternatives) &&
    value.alternatives.every(validDestinationLabel) &&
    boundedArray(value.reasons) &&
    value.reasons.every(boundedText)
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
    (value.nameReview === undefined ||
      (isObject(value.nameReview) &&
        [
          'cross_source_name_candidate',
          'source_named_requires_cross_reference',
          'unnamed_pending_reference',
          'identity_or_name_conflict',
          'not_independent_facility',
        ].includes(String(value.nameReview.status)) &&
        typeof value.nameReview.sourceNameIsDistinctive === 'boolean' &&
        typeof value.nameReview.crossSourceCandidate === 'boolean' &&
        (value.nameReview.destinationLabel === undefined ||
          validDestinationLabel(value.nameReview.destinationLabel)) &&
        (value.nameReview.destinationReview === undefined ||
          validDestinationReview(value.nameReview.destinationReview)) &&
        (value.nameReview.enrichment === undefined ||
          validEnrichment(value.nameReview.enrichment)))) &&
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
          item.nameReview?.enrichment === undefined &&
          item.nameReview?.destinationLabel === undefined &&
          item.nameReview?.destinationReview === undefined &&
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
    (value.mode !== 'public' ||
      value.items.every(
        (item) =>
          item.nameReview?.enrichment === undefined &&
          item.nameReview?.destinationLabel === undefined &&
          item.nameReview?.destinationReview === undefined,
      )) &&
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
  limit = 200,
): Promise<NcrDiscoveryResponse> {
  signal.throwIfAborted()
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
  url.searchParams.set('limit', String(limit))
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
  signal.throwIfAborted()
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

const ncrDatasetViewport: Viewport = {
  west: 120.85,
  south: 14.3,
  east: 121.27,
  north: 14.86,
  zoom: 20,
}

function snapshotMetadata(page: NcrDiscoveryResponse) {
  return JSON.stringify([
    page.dataVersion,
    page.totalMatched,
    page.coverage.sourceAsOf,
    page.coverage.boundarySource,
    page.coverage.scope,
    page.reviewDueAt,
    page.notice,
    page.attribution.map(({ label, url }) => [label, url]),
  ])
}

/** Load one complete, consistent NCR snapshot; panning and filtering stay local. */
export async function fetchNcrDataset(
  baseUrl: string,
  mode: NcrDiscoveryResponse['mode'],
  signal: AbortSignal,
  onProgress?: (loaded: number, total: number) => void,
): Promise<NcrDiscoveryResponse> {
  const items: NcrDiscoveryItem[] = []
  const ids = new Set<string>()
  const cursors = new Set<string>()
  let first: NcrDiscoveryResponse | null = null
  let cursor: string | null = null
  let latestGeneratedAt: string
  do {
    signal.throwIfAborted()
    const page = await fetchNcrPage(
      baseUrl,
      ncrDatasetViewport,
      'all',
      mode,
      signal,
      cursor,
      500,
    )
    if (!first) first = page
    if (!page.dataVersion || snapshotMetadata(page) !== snapshotMetadata(first))
      throw new Error(
        'The NCR snapshot changed while loading. Retry to load a complete dataset.',
      )
    if (
      page.clusters.length ||
      page.truncated !== (page.nextCursor !== null) ||
      (page.nextCursor !== null && !page.nextCursor)
    )
      throw new Error('The NCR service returned invalid detail pagination.')
    for (const item of page.items) {
      if (ids.has(item.id))
        throw new Error('The NCR service returned duplicate record IDs.')
      ids.add(item.id)
      items.push(item)
    }
    if (
      items.length > first.totalMatched ||
      (page.nextCursor !== null &&
        (!page.items.length || items.length >= first.totalMatched)) ||
      (page.nextCursor === null && items.length !== first.totalMatched)
    )
      throw new Error('The NCR service returned an incomplete dataset.')
    if (page.nextCursor !== null) {
      if (cursors.has(page.nextCursor))
        throw new Error('The NCR service repeated a pagination cursor.')
      cursors.add(page.nextCursor)
    }
    latestGeneratedAt = page.generatedAt
    onProgress?.(items.length, first.totalMatched)
    signal.throwIfAborted()
    cursor = page.nextCursor
  } while (cursor !== null)

  const complete = {
    ...first,
    generatedAt: latestGeneratedAt,
    items,
    clusters: [],
    nextCursor: null,
    truncated: false,
  }
  if (mode === 'public' && !ncrResponseCanDisplay(complete, mode))
    throw new Error(
      'Public display approval expired while loading. No records were displayed.',
    )
  return complete
}
