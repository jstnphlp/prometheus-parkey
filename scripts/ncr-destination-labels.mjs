/**
 * Source-attributed context labels for *private* NCR parking research.
 *
 * A nearby restaurant, mall or attraction is a trip destination, not the
 * parking facility's legal name, ownership, visitor rights or verified entrance.
 * Never use this to approve publication or replace an OSM/Overture name.
 */
import { URL } from 'node:url'

import { geometryBounds, pointInNcrGeometry } from './ncr-geography.mjs'
import { meaningfulParkingName } from './ncr-name-reconciliation.mjs'

const FACILITY_TYPES = new Set(['lot', 'garage', 'facility_unspecified'])
const RULES = new Map([
  ['shop:mall', [100, 130]],
  ['shop:shopping_centre', [98, 130]],
  ['tourism:attraction', [97, 90]],
  ['tourism:museum', [96, 90]],
  ['tourism:gallery', [93, 80]],
  ['tourism:zoo', [95, 110]],
  ['tourism:theme_park', [95, 110]],
  ['tourism:aquarium', [92, 100]],
  ['leisure:park', [91, 100]],
  ['leisure:stadium', [93, 110]],
  ['amenity:theatre', [92, 90]],
  ['amenity:cinema', [92, 90]],
  ['amenity:arts_centre', [90, 80]],
  ['amenity:restaurant', [88, 75]],
  ['amenity:fast_food', [74, 65]],
  ['amenity:pub', [73, 60]],
  ['amenity:bar', [73, 60]],
  ['amenity:ice_cream', [68, 50]],
  ['amenity:cafe', [77, 60]],
  ['amenity:food_court', [83, 80]],
  ['amenity:marketplace', [88, 95]],
  ['amenity:hospital', [85, 100]],
  ['amenity:university', [81, 100]],
  ['amenity:college', [78, 85]],
  ['amenity:library', [78, 70]],
  ['amenity:clinic', [72, 60]],
  ['amenity:conference_centre', [87, 100]],
  ['amenity:community_centre', [76, 70]],
  ['amenity:events_venue', [82, 80]],
  ['shop:department_store', [86, 95]],
  ['shop:supermarket', [81, 85]],
  ['tourism:hotel', [76, 75]],
  ['tourism:motel', [70, 65]],
  ['leisure:sports_centre', [74, 75]],
  ['leisure:garden', [81, 80]],
  ['leisure:water_park', [91, 100]],
  ['leisure:fitness_centre', [69, 60]],
  ['leisure:swimming_pool', [70, 60]],
  ['leisure:bowling_alley', [77, 70]],
  ['leisure:golf_course', [77, 90]],
  ['tourism:hostel', [68, 60]],
  ['tourism:guest_house', [67, 55]],
  ['historic:castle', [85, 90]],
  ['historic:fort', [85, 90]],
  ['historic:ruins', [76, 70]],
  ['historic:archaeological_site', [81, 80]],
  ['historic:monument', [73, 65]],
  ['historic:memorial', [71, 65]],
  ['building:hotel', [58, 45]],
  ['building:supermarket', [60, 50]],
  ['building:hospital', [65, 60]],
])
for (const kind of [
  'convenience',
  'doityourself',
  'hardware',
  'furniture',
  'electronics',
  'clothes',
  'shoes',
  'books',
  'sports',
  'garden_centre',
  'wholesale',
  'outdoor',
  'toys',
  'variety_store',
  'beauty',
  'chemist',
  'bakery',
  'butcher',
  'seafood',
  'greengrocer',
  'car',
  'motorcycle',
  'bicycle',
  'pet',
])
  RULES.set('shop:' + kind, [66, 55])

const RESTRICTED_ACCESS = new Set([
  'private',
  'no',
  'permit',
  'residents',
  'military',
  'emergency',
  'delivery',
  'destination',
  'psv',
  'designated',
  'members',
  'agricultural',
  'forestry',
])
const normalize = (name) =>
  String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
const validPoint = (point) =>
  Array.isArray(point) &&
  point.length === 2 &&
  point.every(Number.isFinite) &&
  Math.abs(point[0]) <= 180 &&
  Math.abs(point[1]) <= 90
const round = (number) => Math.round(number * 10) / 10
const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
function validSourceGeometry(geometry) {
  if (!geometry) return false
  if (geometry.type === 'Point') return validPoint(geometry.coordinates)
  const line = (coordinates, ring = false) =>
    Array.isArray(coordinates) &&
    coordinates.length >= (ring ? 4 : 2) &&
    coordinates.every(validPoint) &&
    (!ring ||
      (coordinates[0][0] === coordinates.at(-1)[0] &&
        coordinates[0][1] === coordinates.at(-1)[1]))
  const polygon = (coordinates) =>
    Array.isArray(coordinates) &&
    coordinates.length > 0 &&
    coordinates.every((ring) => line(ring, true))
  if (geometry.type === 'LineString') return line(geometry.coordinates)
  if (geometry.type === 'MultiLineString')
    return (
      Array.isArray(geometry.coordinates) &&
      geometry.coordinates.length > 0 &&
      geometry.coordinates.every((coordinates) => line(coordinates))
    )
  if (geometry.type === 'Polygon') return polygon(geometry.coordinates)
  if (geometry.type === 'MultiPolygon')
    return (
      Array.isArray(geometry.coordinates) &&
      geometry.coordinates.length > 0 &&
      geometry.coordinates.every(polygon)
    )
  return false
}
// Haversine on the retained source anchors; neither anchor is a vehicle entrance.
export function destinationDistanceMeters(a, b) {
  if (!validPoint(a) || !validPoint(b))
    throw new Error('Invalid geographic anchor')
  const radians = Math.PI / 180
  const sine =
    Math.sin(((b[1] - a[1]) * radians) / 2) ** 2 +
    Math.cos(a[1] * radians) *
      Math.cos(b[1] * radians) *
      Math.sin(((b[0] - a[0]) * radians) / 2) ** 2
  return (
    6371000 * 2 * Math.atan2(Math.sqrt(sine), Math.sqrt(Math.max(0, 1 - sine)))
  )
}

const hasUnsafeStatus = (record) =>
  [
    'closed',
    'permanently_closed',
    'temporarily_closed',
    'disused',
    'abandoned',
    'construction',
    'proposed',
  ].includes(record.operatingStatus) ||
  (record.flags || []).some((flag) =>
    /(closed|disused|prior_human_exclusion|prohibited|unsafe)/.test(flag),
  )

const restricted = (record) =>
  record.restrictedAccess ||
  RESTRICTED_ACCESS.has(record.accessClass) ||
  hasUnsafeStatus(record)
const unsafeTags = (tags = {}) =>
  RESTRICTED_ACCESS.has(String(tags.access || '').toLowerCase()) ||
  Object.entries(tags).some(
    ([key, value]) =>
      (/^(?:disused|abandoned|demolished|razed|construction|proposed)(?::|$)/.test(
        key,
      ) &&
        !['no', 'false', '0', ''].includes(String(value).toLowerCase())) ||
      (['closed', 'disused', 'abandoned', 'construction', 'proposed'].includes(
        String(value).toLowerCase(),
      ) &&
        [
          'amenity',
          'shop',
          'tourism',
          'leisure',
          'building',
          'status',
          'operational_status',
        ].includes(key)) ||
      (key === 'opening_hours' &&
        /^(?:closed|off|24\/7 off)$/i.test(String(value).trim())) ||
      (['source', 'source:name', 'source:geometry', 'attribution'].includes(
        key,
      ) &&
        /\b(google|gmap|waze)\b/i.test(String(value))),
  )

/** Shared original/refreshed parking safety check; it grants no access rights. */
export function parkingDestinationUnsuitable(record) {
  return Boolean(
    record && (restricted(record) || unsafeTags(record.sourceTags)),
  )
}

/** Explicit source warnings remain review evidence rather than geographic proof. */
export function destinationEvidenceUncertainties(tags = {}) {
  return Object.entries(tags).flatMap(([key, value]) => {
    const normalizedKey = key.toLowerCase()
    const text = String(value).trim()
    if (!text || ['no', 'false', '0'].includes(text.toLowerCase())) return []
    if (
      /^fixme(?::|$)/.test(normalizedKey) ||
      (/^note(?::|$)/.test(normalizedKey) &&
        /(?:verif|improv|estimat|uncertain|approx|incorrect|wrong|check).*(?:location|position|boundary|boundaries|area|exist)|(?:location|position|boundary|boundaries|area).*(?:verif|improv|estimat|uncertain|approx|incorrect|wrong|check)/i.test(
          text,
        ))
    )
      return ['Unresolved OpenStreetMap source warning (' + key + '): ' + text]
    return []
  })
}

const isOsmSource = (clue) => {
  if (
    clue.sourceLicense !== 'ODbL-1.0' ||
    !/^osm:(?:node|way|relation)\/[1-9]\d*$/.test(clue.sourceId || '')
  )
    return false
  try {
    const url = new URL(clue.sourceRecordUrl)
    return (
      url.protocol === 'https:' &&
      ['openstreetmap.org', 'www.openstreetmap.org'].includes(url.hostname) &&
      url.pathname === '/' + clue.sourceId.slice(4) &&
      !url.search &&
      !url.hash
    )
  } catch {
    return false
  }
}

/**
 * An optional contextual phrase, NOT a replacement name or a parking offer.
 * Distances are source-geometry straight-line approximations, not walking routes.
 */
export function reviewNearbyDestinations(
  record,
  enrichment,
  { privatePreview = false } = {},
) {
  const result = (outcome, reasons, alternatives = [], label = null) => ({
    outcome,
    label,
    alternatives,
    reasons,
  })
  if (!privatePreview || !record || !enrichment || record.publicationApproved)
    return result('no_suitable_destination', [
      'Private unpublished research context is required.',
    ])
  if (!FACILITY_TYPES.has(record.type))
    return result('not_facility', [
      'Only independent lot, garage or unspecified facility observations are eligible.',
    ])
  if (
    parkingDestinationUnsuitable(record) ||
    enrichment.classification === 'unsuitable_for_public_discovery' ||
    enrichment.unsuitableSourceIds?.length
  )
    return result('restricted_or_unsuitable', [
      'Parking access, operating status or a preserved human exclusion prevents a destination description.',
    ])
  if (
    meaningfulParkingName(record.name) ||
    meaningfulParkingName(enrichment.proposedName)
  )
    return result('previously_named', [
      'An existing distinctive parking source name is retained.',
    ])
  const context = Array.isArray(enrichment.contextClues)
    ? enrichment.contextClues
    : []
  const rejected = new Set()
  const identities = new Map()
  for (const clue of context) {
    if (clue?.parkingRecordId && clue.parkingRecordId !== record.id) continue
    if (!identities.has(clue?.sourceId))
      identities.set(clue?.sourceId, new Set())
    identities.get(clue?.sourceId).add(normalize(clue?.name))
  }
  const conflicts = new Set(
    [...identities].filter(([, names]) => names.size > 1).map(([id]) => id),
  )
  if (conflicts.size)
    rejected.add(
      'Contradictory destination names sharing one source identity were excluded.',
    )
  const candidates = context
    .flatMap((clue) => {
      if (!clue || conflicts.has(clue.sourceId)) return []
      const name = clue?.name?.trim()
      const rule = RULES.get(String(clue?.placeKind || '').toLowerCase())
      if (clue?.parkingRecordId && clue.parkingRecordId !== record.id) return []
      let distance = clue?.approximateMeters
      let contains = clue?.relation === 'parking_anchor_inside_named_property'
      const fresh =
        Object.hasOwn(clue || {}, 'geometry') ||
        Object.hasOwn(clue || {}, 'sourceCoordinate')
      const anchor = record.representativePoint
      if (fresh) {
        if (
          !validPoint(anchor) ||
          !validPoint(clue.sourceCoordinate) ||
          !validPoint(clue.anchorCoordinate) ||
          destinationDistanceMeters(anchor, clue.anchorCoordinate) > 1
        ) {
          rejected.add('Conflicting or missing source anchors were excluded.')
          return []
        }
        try {
          if (!validSourceGeometry(clue.geometry))
            throw new Error('Malformed source geometry')
          const bounds = geometryBounds(clue.geometry)
          if (
            !bounds.every(Number.isFinite) ||
            clue.sourceCoordinate[0] < bounds[0] ||
            clue.sourceCoordinate[0] > bounds[2] ||
            clue.sourceCoordinate[1] < bounds[1] ||
            clue.sourceCoordinate[1] > bounds[3]
          )
            throw new Error('Source anchor outside geometry bounds')
          contains =
            ['Polygon', 'MultiPolygon'].includes(clue.geometry.type) &&
            pointInNcrGeometry(anchor, clue.geometry)
          distance = destinationDistanceMeters(anchor, clue.sourceCoordinate)
        } catch {
          rejected.add('Invalid destination geometry was excluded.')
          return []
        }
      }
      if (
        !name ||
        name.length > 75 ||
        !meaningfulParkingName(name) ||
        /^(?:restaurant|cafe|coffee shop|mall|shopping cent(?:er|re)|food court|hotel|hospital|park|museum|gallery|university|college|shop|store|office|building)$/i.test(
          name,
        ) ||
        !rule ||
        !isOsmSource(clue) ||
        (!fresh &&
          ![
            'parking_anchor_inside_named_property',
            'nearby_named_property_only',
          ].includes(clue.relation)) ||
        unsafeTags(clue.sourceTags) ||
        clue.restrictedAccess ||
        hasUnsafeStatus(clue) ||
        !Number.isFinite(distance) ||
        distance < 0 ||
        (!contains && distance > rule[1])
      )
        return []
      // When source polygon contains the anchor, it is still just a context
      // association; never claim the parking belongs to that property.
      const evidenceUncertainties = destinationEvidenceUncertainties(
        clue.sourceTags,
      )
      if (
        /\b(?:parking(?:\s+(?:lot|area|facility|garage))?|car\s*park)\b/i.test(
          name,
        )
      )
        evidenceUncertainties.push(
          'Destination name refers to parking while the source visitor-destination category suggests a different use; classification requires review.',
        )
      const scoreComponents = {
        category: rule[0] * 0.4,
        proximity: Math.max(0, 60 - distance / 3),
        containment: contains && !evidenceUncertainties.length ? 35 : 0,
      }
      const score = Object.values(scoreComponents).reduce(
        (sum, value) => sum + value,
        0,
      )
      return [
        {
          name,
          score,
          scoreComponents,
          clue,
          distance,
          contains,
          fresh,
          evidenceUncertainties,
          duplicateSourceIds: [clue.sourceId],
        },
      ]
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.distance - b.distance ||
        compareText(a.name, b.name) ||
        compareText(a.clue.sourceId, b.clue.sourceId),
    )
  const unique = []
  for (const candidate of candidates) {
    const duplicate = unique.find(
      (other) =>
        normalize(other.name) === normalize(candidate.name) &&
        (other.clue.sourceId === candidate.clue.sourceId ||
          (validPoint(other.clue.sourceCoordinate) &&
            validPoint(candidate.clue.sourceCoordinate) &&
            (destinationDistanceMeters(
              other.clue.sourceCoordinate,
              candidate.clue.sourceCoordinate,
            ) <= 40 ||
              (['Polygon', 'MultiPolygon'].includes(
                other.clue.geometry?.type,
              ) &&
                pointInNcrGeometry(
                  candidate.clue.sourceCoordinate,
                  other.clue.geometry,
                )) ||
              (['Polygon', 'MultiPolygon'].includes(
                candidate.clue.geometry?.type,
              ) &&
                pointInNcrGeometry(
                  other.clue.sourceCoordinate,
                  candidate.clue.geometry,
                ))))),
    )
    if (duplicate)
      duplicate.duplicateSourceIds.push(...candidate.duplicateSourceIds)
    else unique.push(candidate)
  }
  const describe = (best) => ({
    label: 'Parking near ' + best.name,
    destination: best.name,
    category: best.clue.placeKind,
    sourceId: best.clue.sourceId,
    sourceRecordUrl: best.clue.sourceRecordUrl,
    sourceLicense: best.clue.sourceLicense,
    sourceRecordEditedAt: best.clue.sourceRecordEditedAt || null,
    sourceVersion: best.clue.sourceVersion || null,
    sourceSnapshotSha256: best.clue.sourceSnapshotSha256 || null,
    sourceCoordinate: best.clue.sourceCoordinate || null,
    anchorCoordinate:
      record.representativePoint || best.clue.anchorCoordinate || null,
    parkingRecordId: best.clue.parkingRecordId || record.id || null,
    distanceBasis: best.fresh
      ? 'source_geometry_anchor_haversine'
      : 'legacy_context_estimate',
    approximateStraightLineMeters: round(best.distance),
    insideSourcePropertyFootprint: best.contains,
    score: round(best.score),
    scoreComponents: Object.fromEntries(
      Object.entries(best.scoreComponents).map(([key, value]) => [
        key,
        round(value),
      ]),
    ),
    duplicateSourceIds: [...new Set(best.duplicateSourceIds)].sort(),
    uncertainties: [
      'Nearby destination context does not establish parking ownership or visitor eligibility.',
      'Source anchors are not verified vehicle entrances; straight-line distance is not a walkable route.',
      'Current operation, fees, hours and availability are unverified.',
      ...best.evidenceUncertainties,
      ...(!best.fresh
        ? [
            'Historical context supplies a rounded distance without recomputable geometry in this report.',
          ]
        : []),
      ...(['customers', 'unknown', undefined].includes(record.accessClass)
        ? ['Visitor access conditions require verification.']
        : []),
    ],
    status: 'research_context_only',
    parkingNameConfirmed: false,
    visitorAccessConfirmed: false,
    navigationEntranceConfirmed: false,
    publicationApproved: false,
  })
  const alternatives = unique.slice(0, 10).map(describe)
  const parkingWarnings = destinationEvidenceUncertainties(
    record.sourceTags,
  ).filter((text) =>
    /location|position|boundar|area|outline|geometry|verification required|still exist/i.test(
      text,
    ),
  )
  if (
    enrichment.identityConflict ||
    enrichment.classification === 'proposed_name_incomplete_or_conflicting' ||
    parkingWarnings.length
  )
    return result(
      'ambiguous',
      [
        'Unresolved parking identity or conflicting geographic evidence requires review.',
        ...parkingWarnings,
        ...rejected,
      ],
      alternatives,
    )
  if (!unique.length)
    return result('no_suitable_destination', [
      'No eligible named visitor destination meets the category, geography and safety rules.',
      ...rejected,
    ])
  if (unique[0].evidenceUncertainties.length)
    return result(
      'ambiguous',
      [
        'The leading destination has unresolved source classification, geographic or existence warnings; human review is required.',
        ...unique[0].evidenceUncertainties,
        ...rejected,
      ],
      alternatives,
    )
  if (unique[1] && unique[0].score - unique[1].score <= 7)
    return result(
      'ambiguous',
      [
        'Multiple geographically plausible destinations have scores within 7 points; no single label was selected.',
        ...rejected,
      ],
      alternatives,
    )
  return result(
    'described',
    [
      'Selected by category relevance, straight-line proximity and verified source-polygon containment.',
      ...rejected,
    ],
    alternatives,
    alternatives[0],
  )
}

export function chooseNearbyDestinationLabel(record, enrichment, options) {
  return reviewNearbyDestinations(record, enrichment, options).label
}
