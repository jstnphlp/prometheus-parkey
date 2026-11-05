/**
 * Source-attributed context labels for *private* NCR parking research.
 *
 * A nearby restaurant, mall or attraction is a trip destination, not the
 * parking facility's legal name, ownership, visitor rights or verified entrance.
 * Never use this to approve publication or replace an OSM/Overture name.
 */
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
  ['leisure:park', [91, 100]],
  ['leisure:stadium', [93, 110]],
  ['amenity:theatre', [92, 90]],
  ['amenity:cinema', [92, 90]],
  ['amenity:arts_centre', [90, 80]],
  ['amenity:restaurant', [88, 75]],
  ['amenity:cafe', [77, 60]],
  ['amenity:food_court', [83, 80]],
  ['amenity:marketplace', [88, 95]],
  ['amenity:hospital', [85, 100]],
  ['amenity:university', [81, 100]],
  ['amenity:college', [78, 85]],
  ['shop:department_store', [86, 95]],
  ['shop:supermarket', [81, 85]],
  ['tourism:hotel', [76, 75]],
  ['tourism:motel', [70, 65]],
  ['leisure:sports_centre', [74, 75]],
  ['historic:monument', [73, 65]],
  ['historic:memorial', [71, 65]],
  ['building:retail', [61, 50]],
  ['building:commercial', [55, 40]],
  ['building:office', [48, 35]],
  ['building:hotel', [58, 45]],
  ['building:supermarket', [60, 50]],
  ['building:hospital', [65, 60]],
])
const hasUnsafeStatus = (record) =>
  [
    'closed',
    'permanently_closed',
    'temporarily_closed',
    'disused',
    'abandoned',
  ].includes(record.operatingStatus) ||
  (record.flags || []).some((flag) =>
    /(closed|disused|prior_human_exclusion|prohibited|unsafe)/.test(flag),
  )

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
      ['openstreetmap.org', 'www.openstreetmap.org'].includes(url.hostname)
    )
  } catch {
    return false
  }
}

/**
 * An optional contextual phrase, NOT a replacement name or a parking offer.
 * Distances are source-geometry straight-line approximations, not walking routes.
 */
export function chooseNearbyDestinationLabel(
  record,
  enrichment,
  { privatePreview = false } = {},
) {
  if (
    !privatePreview ||
    !record ||
    !enrichment ||
    !FACILITY_TYPES.has(record.type) ||
    record.restrictedAccess ||
    record.publicationApproved ||
    hasUnsafeStatus(record) ||
    meaningfulParkingName(record.name) ||
    meaningfulParkingName(enrichment.proposedName) ||
    enrichment.classification === 'unsuitable_for_public_discovery' ||
    enrichment.classification === 'proposed_name_incomplete_or_conflicting' ||
    !Array.isArray(enrichment.contextClues)
  )
    return null

  const candidates = enrichment.contextClues
    .flatMap((clue) => {
      const name = clue?.name?.trim()
      const rule = RULES.get(String(clue?.placeKind || '').toLowerCase())
      const distance = clue?.approximateMeters
      const relation = clue?.relation
      if (
        !name ||
        name.length > 75 ||
        !meaningfulParkingName(name) ||
        !rule ||
        !isOsmSource(clue) ||
        ![
          'parking_anchor_inside_named_property',
          'nearby_named_property_only',
        ].includes(relation) ||
        !Number.isFinite(distance) ||
        distance < 0 ||
        (relation !== 'parking_anchor_inside_named_property' &&
          distance > rule[1])
      )
        return []
      // When source polygon contains the anchor, it is still just a context
      // association; never claim the parking belongs to that property.
      const [relevance] = rule
      const score =
        relevance +
        (relation === 'parking_anchor_inside_named_property' ? 5 : 0) -
        Math.min(distance, 200) / 20
      return [{ name, score, clue, distance }]
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.distance - b.distance ||
        a.name.localeCompare(b.name) ||
        a.clue.sourceId.localeCompare(b.clue.sourceId),
    )
  const best = candidates[0]
  if (!best) return null
  return {
    label: 'Parking near ' + best.name,
    destination: best.name,
    category: best.clue.placeKind,
    sourceId: best.clue.sourceId,
    sourceRecordUrl: best.clue.sourceRecordUrl,
    approximateStraightLineMeters: best.distance,
    insideSourcePropertyFootprint:
      best.clue.relation === 'parking_anchor_inside_named_property',
    status: 'research_context_only',
    parkingNameConfirmed: false,
    visitorAccessConfirmed: false,
    navigationEntranceConfirmed: false,
    publicationApproved: false,
  }
}
