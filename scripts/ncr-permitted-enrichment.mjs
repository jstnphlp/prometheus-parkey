/**
 * Permitted-source parking-name enrichment for NCR.
 *
 * Never scrapes Google/Waze or copies their business names. Refresh matches
 * and nearby OSM POIs are evidence for a human reviewer, never auto-verified
 * parking identities, site access, directions, or publication approval.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'

import { HOTSPOT_WINDOWS } from './ncr-coverage.mjs'
import { geometryBounds, pointInNcrGeometry } from './ncr-geography.mjs'
import { classifyGeojson } from './ncr-parking-research.mjs'
import {
  buildNameReconciliation,
  meaningfulParkingName,
} from './ncr-name-reconciliation.mjs'
import { loadNcrResearch } from './ncr-quality-review.mjs'
import { distanceMeters } from './parking-open-data.mjs'

const POINT_TYPES = new Set([
  'Point',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
])
const CONTEXT_KINDS = {
  shop: new Set(['mall', 'department_store', 'supermarket', 'shopping_centre']),
  amenity: new Set([
    'hospital',
    'university',
    'college',
    'marketplace',
    'school',
    'restaurant',
    'cafe',
    'food_court',
    'theatre',
    'cinema',
    'arts_centre',
  ]),
  tourism: new Set(['hotel', 'motel', 'attraction', 'museum', 'gallery', 'zoo', 'theme_park']),
  leisure: new Set(['park', 'stadium', 'sports_centre']),
  historic: new Set(['monument', 'memorial']),
  building: new Set([
    'commercial',
    'retail',
    'office',
    'hotel',
    'supermarket',
    'hospital',
  ]),
}
const geoPoint = (geometry) => {
  if (!geometry || !POINT_TYPES.has(geometry.type)) return null
  if (geometry.type === 'Point') return geometry.coordinates
  const [west, south, east, north] = geometryBounds(geometry)
  return [(west + east) / 2, (south + north) / 2]
}
const validPoint = (p) =>
  Array.isArray(p) &&
  p.length === 2 &&
  p.every(Number.isFinite) &&
  p[0] >= -180 &&
  p[0] <= 180 &&
  p[1] >= -90 &&
  p[1] <= 90
const textName = (value) =>
  meaningfulParkingName(value)
    ? String(value).trim().replace(/\s+/g, ' ')
    : null
const norm = (value) =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
const csv = (value) =>
  '"' +
  String(value ?? '')
    .replace(/^([\s]*[=+@-])/, "'$1")
    .replaceAll('"', '""')
    .replace(/\r?\n/g, ' ') +
  '"'
const osmIdentity = (feature) => {
  const p = feature?.properties || {}
  const type = p['@type'] || p.osm_type,
    id = p['@id'] ?? p.osm_id
  return ['node', 'way', 'relation'].includes(type) &&
    /^[1-9]\d*$/.test(String(id ?? ''))
    ? 'osm:' + type + '/' + id
    : null
}
const baseIdentity = (id) => {
  const m = /^osm:(node|way|relation)\/([1-9]\d*):/.exec(String(id))
  return m ? 'osm:' + m[1] + '/' + m[2] : null
}
const coordinateLinks = (p) => {
  if (!validPoint(p)) throw new Error('Invalid source coordinate')
  const q = encodeURIComponent(p[1] + ',' + p[0])
  return {
    googleMaps: 'https://www.google.com/maps/search/?api=1&query=' + q,
    waze: 'https://www.waze.com/ul?ll=' + q + '&z=18',
  }
}
const ensureGeojson = (input) => {
  if (
    input?.type !== 'FeatureCollection' ||
    !Array.isArray(input.features) ||
    input.features.length > 100000
  )
    throw new Error('Expected bounded OSM GeoJSON collection.')
}
const rejectGoogleWazeOrigin = (tags) => {
  for (const key of [
    'source',
    'source:name',
    'source:geometry',
    'attribution',
  ]) {
    if (/\b(google|gmap|waze)\b/i.test(String(tags[key] || '')))
      throw new Error(
        'Unsupported Google/Waze-derived record in OSM enrichment input.',
      )
  }
}
const licenseAllowed = (record) => {
  const allowed = new Set(['ODbL-1.0', 'CDLA-Permissive-2.0', 'Apache-2.0'])
  return (
    !record.requiresLicenseReview &&
    String(record.sourceLicense || '')
      .split(',')
      .every((l) => allowed.has(l.trim())) &&
    record.sourceProviders?.length > 0 &&
    record.sourceProviders.every((s) => allowed.has(s.license))
  )
}
const unsuitable = (record) =>
  record.restrictedAccess ||
  [
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
  ].includes(record.accessClass) ||
  [
    'closed',
    'permanently_closed',
    'temporarily_closed',
    'disused',
    'construction',
  ].includes(record.operatingStatus) ||
  record.flags?.some((f) =>
    [
      'mapped_closed_or_disused',
      'prior_human_exclusion_requires_resolution',
      'unsafe',
      'prohibited',
    ].includes(f),
  )

function extractRefreshedOsm(refreshed) {
  if (!refreshed) return new Map()
  ensureGeojson(refreshed)
  const byId = new Map()
  for (const f of refreshed.features) {
    const p = f?.properties || {},
      id = osmIdentity(f)
    if (!id) throw new Error('OSM refresh feature lacks stable @type/@id.')
    rejectGoogleWazeOrigin(p)
    // Same ID alone is insufficient if the object has ceased being parking.
    const normalized = classifyGeojson(
      { type: 'FeatureCollection', features: [f] },
      'osm',
    )[0]
    if (
      !normalized ||
      !['lot', 'garage', 'facility_unspecified'].includes(normalized.type)
    )
      continue
    const field = ['name', 'official_name', 'name:en', 'alt_name'].find((k) =>
      textName(p[k]),
    )
    const name = field ? textName(p[field]) : null
    if (byId.has(id) && norm(byId.get(id).name) !== norm(name))
      throw new Error(
        'Contradictory OSM names for a single source identity: ' + id,
      )
    byId.set(id, {
      name,
      sourceField: field,
      sourceId: id,
      sourceLicense: 'ODbL-1.0',
      coordinate: geoPoint(f.geometry),
      accessClass: normalized.accessClass,
      unsuitable: !!unsuitable(normalized),
      sourceRecordUrl: 'https://www.openstreetmap.org/' + id.slice(4),
      sourceEditedAt: p['@timestamp'] || null,
    })
  }
  return byId
}
function osmContext(context) {
  if (!context) return []
  ensureGeojson(context)
  const result = [],
    seen = new Set()
  for (const f of context.features) {
    const p = f?.properties || {},
      id = osmIdentity(f),
      name = textName(p.name)
    if (!id || !name) continue
    rejectGoogleWazeOrigin(p)
    const kind = Object.keys(CONTEXT_KINDS).find((key) =>
      CONTEXT_KINDS[key].has(String(p[key] || '')),
    )
    if (!kind || seen.has(id)) continue
    seen.add(id)
    const point = geoPoint(f.geometry)
    if (!validPoint(point)) continue
    result.push({
      sourceId: id,
      name,
      point,
      geometry: f.geometry,
      placeKind: kind + ':' + p[kind],
      sourceRecordUrl: 'https://www.openstreetmap.org/' + id.slice(4),
      sourceLicense: 'ODbL-1.0',
    })
  }
  return result
}
function sourceClues(member, refreshedById) {
  const clues = [],
    p = member.sourceTags || {}
  const offer = (value, field, basis, evidence = {}) => {
    const name = textName(value)
    if (!name || norm(name) === norm(member.name)) return
    if (clues.some((x) => norm(x.name) === norm(name))) return
    clues.push({
      name,
      basis,
      sourceField: field,
      sourceId: member.id,
      sourceRecordUrl: member.sourceRecordUrl,
      sourceLicense: member.sourceLicense,
      reusable: licenseAllowed(member),
      ...evidence,
      // Tag values are attributed source data, not independent verification.
      approvedForPublication: false,
    })
  }
  if (member.sourceKind === 'osm') {
    for (const field of [
      'official_name',
      'name:en',
      'alt_name',
      'loc_name',
      'short_name',
    ])
      offer(p[field], field, 'osm_alternate_name_tag')
    const fresh = refreshedById.get(baseIdentity(member.id))
    if (fresh)
      offer(fresh.name, fresh.sourceField, 'same_osm_identity_new_snapshot', {
        ...fresh,
        reusable: true,
        locationConflict:
          !validPoint(fresh.coordinate) ||
          distanceMeters(member.representativePoint, fresh.coordinate) > 100,
      })
  } else if (member.sourceKind === 'overture') {
    const n = p.names || {}
    offer(n.primary, 'names.primary', 'overture_source_name')
    if (typeof n.common === 'string')
      offer(n.common, 'names.common', 'overture_alternate_name')
    if (Array.isArray(n.common))
      for (const value of n.common)
        offer(value, 'names.common', 'overture_alternate_name')
    // No arbitrary language-object flattening: schema might change between releases.
  }
  const operator = textName(p.operator),
    brand = textName(p.brand)
  return {
    clues,
    operatorContext: operator || null,
    brandContext: brand || null,
  }
}
function contextIndex(contexts) {
  const bins = new Map()
  for (const c of contexts) {
    const [west, south, east, north] = geometryBounds(c.geometry)
    const left = Math.floor(west * 1000),
      right = Math.floor(east * 1000),
      bottom = Math.floor(south * 1000),
      top = Math.floor(north * 1000)
    // Index footprints, not just their centers: a university/mall can contain
    // parking hundreds of meters from its bounding-box center.
    if ((right - left + 1) * (top - bottom + 1) > 2500) {
      if (!bins.has('*')) bins.set('*', [])
      bins.get('*').push(c)
      continue
    }
    for (let ix = left; ix <= right; ix++)
      for (let iy = bottom; iy <= top; iy++) {
        const key = ix + ':' + iy
        if (!bins.has(key)) bins.set(key, [])
        bins.get(key).push(c)
      }
  }
  return bins
}
function nearbyContexts(member, contexts) {
  const [x, y] = member.representativePoint
  const ix = Math.floor(x * 1000),
    iy = Math.floor(y * 1000)
  const results = [],
    seen = new Set()
  const possible = [...(contexts.get('*') || [])]
  for (let dx = -2; dx <= 2; dx++)
    for (let dy = -2; dy <= 2; dy++)
      possible.push(...(contexts.get(ix + dx + ':' + (iy + dy)) || []))
  for (const c of possible) {
    if (seen.has(c.sourceId)) continue
    seen.add(c.sourceId)
    let contains = false
    if (['Polygon', 'MultiPolygon'].includes(c.geometry.type))
      contains = pointInNcrGeometry(member.representativePoint, c.geometry)
    const meters = distanceMeters(member.representativePoint, c.point)
    if (!contains && meters > 90) continue
    results.push({
      name: c.name,
      sourceId: c.sourceId,
      sourceRecordUrl: c.sourceRecordUrl,
      sourceLicense: c.sourceLicense,
      placeKind: c.placeKind,
      relation: contains
        ? 'parking_anchor_inside_named_property'
        : 'nearby_named_property_only',
      approximateMeters: Math.round(meters),
      // A mall/hotel name is not the parking facility's name.
      usableAsParkingName: false,
    })
  }
  return results
    .sort(
      (a, b) =>
        Number(b.relation.includes('inside')) -
          Number(a.relation.includes('inside')) ||
        a.approximateMeters - b.approximateMeters ||
        a.sourceId.localeCompare(b.sourceId),
    )
    .slice(0, 5)
}
const providerKeys = (record) =>
  (record.sourceProviders || []).map((p) => {
    const dataset = String(p.dataset || '').toLowerCase()
    const id = String(p.record_id || '').replace(
      /^https?:\/\/(?:www\.)?openstreetmap.org\//,
      '',
    )
    return (
      (['osm', 'openstreetmap'].includes(dataset) ? 'osm' : dataset) + ':' + id
    )
  })
function parkingEvidence(research, refreshedOsm, refreshedOverture) {
  const current = [
    ...research.candidates,
    ...(refreshedOsm ? classifyGeojson(refreshedOsm, 'osm') : []),
    ...(refreshedOverture
      ? classifyGeojson(refreshedOverture, 'overture')
      : []),
  ]
  return [
    ...new Map(
      current
        .filter(
          (c) =>
            ['lot', 'garage', 'facility_unspecified'].includes(c.type) &&
            textName(c.name) &&
            licenseAllowed(c),
        )
        .map((c) => [
          c.id,
          {
            ...c,
            representativePoint: c.representativePoint || geoPoint(c.geometry),
          },
        ]),
    ).values(),
  ].filter((c) => validPoint(c.representativePoint))
}
function overtureRefreshIndex(collection) {
  if (!collection) return new Map()
  ensureGeojson(collection)
  for (const f of collection.features) {
    const p = f.properties || {}
    rejectGoogleWazeOrigin(p)
    if (
      Array.isArray(p.sources) &&
      p.sources.some((s) => /google|waze/i.test(String(s.dataset || '')))
    )
      throw new Error(
        'Unsupported Google/Waze-derived Overture enrichment input.',
      )
  }
  const records = new Map()
  for (const c of classifyGeojson(collection, 'overture')) {
    const record = { ...c, representativePoint: geoPoint(c.geometry) }
    if (!validPoint(record.representativePoint))
      throw new Error('Invalid refreshed Overture coordinate')
    const prior = records.get(record.id)
    if (
      prior &&
      (norm(prior.name) !== norm(record.name) ||
        distanceMeters(prior.representativePoint, record.representativePoint) >
          0 ||
        prior.operatingStatus !== record.operatingStatus)
    )
      throw new Error(
        'Contradictory Overture records for a single source identity: ' +
          record.id,
      )
    records.set(record.id, record)
  }
  return records
}
function nearbyParking(members, namedParking, groupIds) {
  const results = new Map()
  for (const member of members)
    for (const other of namedParking) {
      if (
        groupIds.includes(other.id) ||
        (baseIdentity(member.id) &&
          baseIdentity(member.id) === baseIdentity(other.id))
      )
        continue
      const meters = distanceMeters(
        member.representativePoint,
        other.representativePoint,
      )
      const contains =
        ['Polygon', 'MultiPolygon'].includes(member.geometry?.type) &&
        pointInNcrGeometry(other.representativePoint, member.geometry)
      const contained =
        ['Polygon', 'MultiPolygon'].includes(other.geometry?.type) &&
        pointInNcrGeometry(member.representativePoint, other.geometry)
      if (!contains && !contained && meters > 35) continue
      const sharedProvider = providerKeys(member).some((id) =>
        providerKeys(other).includes(id),
      )
      const independent =
        member.sourceKind !== other.sourceKind &&
        !sharedProvider &&
        ![member, other].some(
          (c) =>
            c.sourceKind === 'overture' &&
            c.sourceProviders?.some((p) =>
              /^(osm|openstreetmap)$/i.test(p.dataset),
            ),
        )
      const old = results.get(other.id)
      if (old && old.approximateMeters <= meters) continue
      results.set(other.id, {
        name: other.name,
        sourceId: other.id,
        sourceRecordUrl: other.sourceRecordUrl,
        sourceLicense: other.sourceLicense,
        sourceProviders: other.sourceProviders,
        coordinate: other.representativePoint,
        approximateMeters: meters,
        relation:
          contains || contained
            ? 'parking_footprints_or_anchors_overlap'
            : 'nearby_named_parking_only',
        sourceIndependent: independent,
        samePhysicalFacilityConfirmed: false,
        unsuitable: !!unsuitable(other),
        usableAsParkingName: false,
      })
    }
  return [...results.values()]
    .sort(
      (a, b) =>
        a.approximateMeters - b.approximateMeters ||
        a.sourceId.localeCompare(b.sourceId),
    )
    .slice(0, 5)
}
function reviewArea(members) {
  return (
    HOTSPOT_WINDOWS.find(([, , b]) =>
      members.some((m) => {
        const [x, y] = m.representativePoint
        return x >= b[0] && x < b[2] && y >= b[1] && y < b[3]
      }),
    )?.[0] || 'other-ncr'
  )
}
export function onSiteChecks(record) {
  return [
    ...(record.classification === 'unsuitable_for_public_discovery'
      ? [
          'Observe from a lawful public place only; do not enter a restricted facility. Ask an authorized operator whether ordinary visitor parking is permitted before considering any change to exclusion.',
        ]
      : []),
    'At each retained source coordinate, identify the actual parking boundary and posted facility name; record dated first-party signage evidence where permitted. The anchor is not a vehicle entrance.',
    ...(record.identityConflict || record.nearbyParkingLeads.length
      ? [
          'Compare every conflicting or nearby parking source separately. Establish whether these are the same lot/garage, separate branches, floors or entrances; do not merge by proximity or matching labels.',
        ]
      : []),
    ...(record.contextClues.length
      ? [
          'Check whether each named nearby property actually operates this parking facility and whether its parking has its own visitor name. A property name alone does not name this lot.',
        ]
      : []),
    ...(record.operatorClues.length
      ? [
          'Confirm the operating entity and facility-specific visitor name separately; a brand or manager is not the facility identity.',
        ]
      : []),
    'Confirm current operation, ordinary visitor eligibility, customer/resident/permit conditions, restrictions and posted hours with signs or an authorized operator. Leave unconfirmed facts unknown.',
    'Record the separately observed lawful vehicle entrance, approach direction and coordinates; record posted rates only with date and permission. Do not infer vacancy, capacity or booking rights.',
    ...(record.priorHumanDecisions.length
      ? [
          'Retain and reconcile the linked prior Poblacion decisions; do not mark prior exclusions or pending visits resolved without new human evidence.',
        ]
      : []),
    'Submit dated observations and evidence references for identity/access review. Operator reuse permission and final publication approval require separate human decisions; this task remains uncompleted.',
  ]
}
/** Produce traceable leads for independent human/operator review only. */
export function buildPermittedEnrichment(
  research,
  {
    refreshedOsm = null,
    contextOsm = null,
    refreshedOverture = null,
    osmUpdates = null,
  } = {},
) {
  const base = buildNameReconciliation(research)
  const sourceById = new Map(research.candidates.map((c) => [c.id, c]))
  const refreshed = extractRefreshedOsm(refreshedOsm)
  for (const [id, update] of extractRefreshedOsm(osmUpdates)) {
    const prior = refreshed.get(id)
    if (
      !update.sourceEditedAt ||
      !Number.isFinite(Date.parse(update.sourceEditedAt))
    )
      throw new Error('OSM update audit requires an edit timestamp')
    if (
      !prior?.sourceEditedAt ||
      Date.parse(update.sourceEditedAt) >= Date.parse(prior.sourceEditedAt)
    )
      refreshed.set(id, update)
  }
  const overtureById = overtureRefreshIndex(refreshedOverture)
  const namedParking = parkingEvidence(
    research,
    osmUpdates
      ? {
          type: 'FeatureCollection',
          features: [...(refreshedOsm?.features || []), ...osmUpdates.features],
        }
      : refreshedOsm,
    refreshedOverture,
  )
  const contexts = osmContext(contextOsm),
    index = contextIndex(contexts)
  const records = []
  for (const group of base.groups) {
    const members = group.candidateIds.map((id) => sourceById.get(id))
    const clues = [],
      contextClues = [],
      operatorClues = [],
      reviewLinks = []
    for (const member of members) {
      const o = sourceClues(member, refreshed)
      clues.push(...o.clues)
      const latest = overtureById.get(member.id)
      if (
        latest &&
        textName(latest.name) &&
        licenseAllowed(latest) &&
        norm(latest.name) !== norm(member.name)
      )
        clues.push({
          name: latest.name,
          basis: 'same_overture_identity_new_snapshot',
          sourceField: 'names.primary',
          sourceId: latest.id,
          sourceRecordUrl: latest.sourceRecordUrl,
          sourceLicense: latest.sourceLicense,
          sourceProviders: latest.sourceProviders,
          coordinate: latest.representativePoint,
          locationConflict:
            distanceMeters(
              member.representativePoint,
              latest.representativePoint,
            ) > 100,
          reusable: true,
          unsuitable: !!unsuitable(latest),
          approvedForPublication: false,
        })
      if (o.operatorContext)
        operatorClues.push({
          kind: 'operator',
          name: o.operatorContext,
          recordId: member.id,
          usableAsFacilityName: false,
        })
      if (o.brandContext)
        operatorClues.push({
          kind: 'brand',
          name: o.brandContext,
          recordId: member.id,
          usableAsFacilityName: false,
        })
      contextClues.push(...nearbyContexts(member, index))
      reviewLinks.push({
        recordId: member.id,
        sourceRecordUrl: member.sourceRecordUrl,
        sourceLicense: member.sourceLicense,
        sourceRecordEditedAt: member.sourceRecordEditedAt || null,
        accessClass: member.accessClass || 'unknown',
        coordinate: member.representativePoint,
        ...coordinateLinks(member.representativePoint),
      })
    }
    const uniqueClues = [
      ...new Map(
        clues.map((c) => [c.sourceId + '|' + norm(c.name), c]),
      ).values(),
    ]
    // A group is the unit of discovery; repeated aliases or existing member
    // names never create an additional discovery.
    const existingNames = new Set(
      members.map((m) => norm(textName(m.name))).filter(Boolean),
    )
    const newClues = uniqueClues.filter((c) => !existingNames.has(norm(c.name)))
    const nearbyParkingLeads = nearbyParking(
      members,
      namedParking,
      group.candidateIds,
    )
    const uniqueContexts = [
      ...new Map(contextClues.map((c) => [c.sourceId, c])).values(),
    ]
      .sort((a, b) => a.approximateMeters - b.approximateMeters)
      .slice(0, 5)
    // Priority is for reviewer efficiency only, NOT market demand or a probability.
    const priority = group.sourceIdentityConflict
      ? 'identity_conflict'
      : group.nameStatus === 'cross_source_name_candidate'
        ? 'cross_source_named_lead'
        : group.nameStatus === 'source_named_requires_cross_reference'
          ? 'existing_source_named'
          : newClues.length
            ? 'name_tag_or_refresh_lead'
            : nearbyParkingLeads.length
              ? 'nearby_parking_identity_review'
              : uniqueContexts.length
                ? 'property_context_only'
                : operatorClues.length
                  ? 'operator_or_brand_only'
                  : 'no_reusable_name_lead'
    const unsuitableMembers = members.filter(
      (m) =>
        unsuitable(m) ||
        refreshed.get(baseIdentity(m.id))?.unsuitable ||
        unsuitable(overtureById.get(m.id) || {}),
    )
    const names = [
      ...new Set([...existingNames, ...newClues.map((c) => norm(c.name))]),
    ]
    const conflict =
      group.sourceIdentityConflict ||
      names.length > 1 ||
      members.some((m) => {
        const latest =
          m.sourceKind === 'osm'
            ? refreshed.get(baseIdentity(m.id))
            : overtureById.get(m.id)
        const point = latest?.coordinate || latest?.representativePoint
        return (
          latest &&
          (!validPoint(point) ||
            distanceMeters(m.representativePoint, point) > 100)
        )
      }) ||
      newClues.some((c) => c.locationConflict)
    const reusableNames = newClues.filter(
      (c) => c.reusable && !c.locationConflict && !c.unsuitable,
    )
    const classification = unsuitableMembers.length
      ? 'unsuitable_for_public_discovery'
      : conflict
        ? 'proposed_name_incomplete_or_conflicting'
        : reusableNames.length ||
            (group.proposedName &&
              members.some((m) => textName(m.name) && licenseAllowed(m)))
          ? 'credible_reusable_name_pending_review'
          : newClues.length || group.proposedName || nearbyParkingLeads.length
            ? 'proposed_name_incomplete_or_conflicting'
            : uniqueContexts.length
              ? 'nearby_named_property_only'
              : operatorClues.length
                ? 'operator_or_brand_only'
                : 'no_reliable_name_evidence'
    const proposedName =
      !conflict && classification === 'credible_reusable_name_pending_review'
        ? group.proposedName || reusableNames[0]?.name || null
        : null
    records.push({
      groupId: group.groupId,
      candidateIds: group.candidateIds,
      originalStatus: group.nameStatus,
      originalSourceName: group.proposedName,
      nameTagLeads: newClues,
      nearbyParkingLeads,
      operatorClues,
      contextClues: uniqueContexts,
      reviewLinks,
      priority,
      classification,
      proposedName,
      identityConflict: !!conflict,
      area: reviewArea(members),
      accessPriority: unsuitableMembers.length
        ? 'restricted_or_unsuitable'
        : members.some((m) =>
              ['yes', 'public', 'permissive'].includes(m.accessClass),
            )
          ? 'mapped_public_access'
          : members.some((m) => m.accessClass === 'customers')
            ? 'customer_conditions_unconfirmed'
            : 'access_unknown',
      unsuitableSourceIds: unsuitableMembers.map((m) => m.id),
      priorHumanDecisions: members
        .filter((m) => m.priorHumanReview)
        .map((m) => ({ recordId: m.id, decision: m.priorHumanReview })),
      nameConfirmed: false,
      operatorConfirmed: false,
      physicalVerified: false,
      visitorAccessConfirmed: false,
      publicationApproved: false,
      disposition: 'pending_human_or_authorized_operator_review',
      // Never replace a missing parking name with a nearby property name.
      approvedDisplayName: null,
    })
  }
  const statuses = [...new Set(records.map((r) => r.priority))]
  const counts = Object.fromEntries(
    statuses
      .sort()
      .map((s) => [s, records.filter((r) => r.priority === s).length]),
  )
  const unnamed = records.filter(
    (r) => r.originalStatus === 'unnamed_pending_reference',
  )
  const unnamedBreakdown = {
    groups: unnamed.length,
    withUnusedNameTagLead: unnamed.filter((r) => r.nameTagLeads.length > 0)
      .length,
    withOperatorOrBrandClue: unnamed.filter((r) => r.operatorClues.length > 0)
      .length,
    withNamedPropertyContext: unnamed.filter((r) => r.contextClues.length > 0)
      .length,
    withNearbyParkingLead: unnamed.filter(
      (r) => r.nearbyParkingLeads.length > 0,
    ).length,
    withIndependentNearbyParkingLead: unnamed.filter((r) =>
      r.nearbyParkingLeads.some((c) => c.sourceIndependent),
    ).length,
    credibleNameProposals: unnamed.filter(
      (r) => r.classification === 'credible_reusable_name_pending_review',
    ).length,
    conflicts: unnamed.filter((r) => r.identityConflict).length,
    withoutCredibleNameProposal: unnamed.filter(
      (r) => r.classification !== 'credible_reusable_name_pending_review',
    ).length,
    withNoAdditionalClue: unnamed.filter(
      (r) =>
        !r.nameTagLeads.length &&
        !r.operatorClues.length &&
        !r.nearbyParkingLeads.length &&
        !r.contextClues.length,
    ).length,
  }
  for (const record of records) {
    record.uncertainties = [
      'Physical identity, operation, visitor access and vehicle entrance remain unverified.',
      ...(record.identityConflict
        ? ['Conflicting names or locations require an identity decision.']
        : []),
      ...(record.nearbyParkingLeads.length
        ? [
            'Nearby named parking is an unconfirmed association, even with independent source provenance.',
          ]
        : []),
      ...(record.contextClues.length
        ? ['Nearby property names do not establish a parking-facility name.']
        : []),
    ]
    record.onSiteChecks = onSiteChecks(record)
  }
  return {
    schemaVersion: 1,
    sourceHashes: research.sourceHashes,
    sourceAsOf: research.sourceAsOf,
    sourceOptions: {
      sameIdentityOsmRefresh: !!refreshedOsm,
      namedOsmPropertyContext: !!contextOsm,
      sameIdentityOvertureRefresh: !!refreshedOverture,
      datedOsmUpdateAudit: !!osmUpdates,
    },
    sourceNotice:
      'OSM name tags and independently supplied OSM contextual POIs are ODbL; contextual mall/hotel names never establish the name of a parking facility. No Google or Waze content ingested. Confirm provider/owner rights and visit data before public display.',
    baseNameTotals: base.totals,
    totals: {
      facilityGroups: records.length,
      priorityGroups: counts,
      groupNameClues: records.filter((r) => r.nameTagLeads.length).length,
      propertyContextGroups: records.filter((r) => r.contextClues.length)
        .length,
      approvedForPublication: 0,
      classifications: Object.fromEntries(
        [...new Set(records.map((r) => r.classification))]
          .sort()
          .map((s) => [
            s,
            records.filter((r) => r.classification === s).length,
          ]),
      ),
      identityConflicts: records.filter((r) => r.identityConflict).length,
      unnamedBefore: unnamed.length,
      unnamedAfter: unnamed.length,
      unnamedWithoutCredibleProposal:
        unnamedBreakdown.withoutCredibleNameProposal,
      allGroupsAwaitingFinalReview: records.length,
      unnamedBreakdown,
    },
    records: records.sort((a, b) => a.groupId.localeCompare(b.groupId)),
  }
}
function csvRows(report) {
  const cols = [
    'groupId',
    'priority',
    'area',
    'accessPriority',
    'classification',
    'proposedName',
    'originalStatus',
    'originalSourceName',
    'nameTagLeads',
    'operatorClues',
    'contextClues',
    'nearbyParkingLeads',
    'candidateIds',
    'sourceCoordinates',
    'evidenceLinks',
    'googleMaps',
    'waze',
    'disposition',
    'uncertainties',
    'onSiteChecks',
  ]
  return (
    cols.join(',') +
    '\n' +
    report.records
      .map((r) => {
        const row = {
          ...r,
          candidateIds: r.candidateIds.join(' | '),
          sourceCoordinates: r.reviewLinks
            .map((x) => x.recordId + ': ' + x.coordinate.join(','))
            .join(' | '),
          evidenceLinks: [
            ...new Set(
              [
                ...r.reviewLinks,
                ...r.nameTagLeads,
                ...r.contextClues,
                ...r.nearbyParkingLeads,
              ]
                .map((x) => x.sourceRecordUrl)
                .filter(Boolean),
            ),
          ].join(' | '),
          uncertainties: r.uncertainties.join(' | '),
          onSiteChecks: r.onSiteChecks
            .map((s, i) => i + 1 + '. ' + s)
            .join(' | '),
          nearbyParkingLeads: r.nearbyParkingLeads
            .map((x) => x.name + ' [' + x.sourceId + '; identity unconfirmed]')
            .join(' | '),
          nameTagLeads: r.nameTagLeads
            .map((x) => x.name + ' [' + x.basis + ']')
            .join(' | '),
          operatorClues: r.operatorClues
            .map((x) => x.name + ' [' + x.kind + ']')
            .join(' | '),
          contextClues: r.contextClues
            .map((x) => x.name + ' [' + x.relation + ']')
            .join(' | '),
          googleMaps: r.reviewLinks.map((x) => x.googleMaps).join(' | '),
          waze: r.reviewLinks.map((x) => x.waze).join(' | '),
        }
        return cols.map((c) => csv(row[c])).join(',')
      })
      .join('\n') +
    '\n'
  )
}
const areaOrder = [
  'poblacion',
  'bgc',
  'cubao',
  ...HOTSPOT_WINDOWS.map(([id]) => id),
  'other-ncr',
]
export function prioritizedRecords(report) {
  const rank = (r) =>
    r.accessPriority === 'restricted_or_unsuitable'
      ? 100
      : (r.nameTagLeads.length
          ? 0
          : r.nearbyParkingLeads.some((c) => c.sourceIndependent)
            ? 5
            : r.nearbyParkingLeads.length
              ? 10
              : r.contextClues.length
                ? 15
                : r.operatorClues.length
                  ? 20
                  : 30) +
        (r.accessPriority === 'mapped_public_access'
          ? 0
          : r.accessPriority === 'customer_conditions_unconfirmed'
            ? 2
            : 4)
  return [...report.records].sort(
    (a, b) =>
      areaOrder.indexOf(a.area) - areaOrder.indexOf(b.area) ||
      rank(a) - rank(b) ||
      a.groupId.localeCompare(b.groupId),
  )
}
export function humanChecklist(report) {
  const lines = [
    '# NCR human-only parking identity checklist',
    '',
    'Research proposals only. All tasks remain pending. Coordinate links are review references, not verified vehicle entrances. No Google/Waze names were ingested.',
    '',
    'Within each area, name evidence and mapped public/customer access clues precede unknown-access and unsuitable records. This is an inspection priority, not a demand or vacancy ranking.',
    '',
  ]
  let area = null
  for (const r of prioritizedRecords(report)) {
    if (area !== r.area) {
      area = r.area
      lines.push('## ' + area, '')
    }
    lines.push(
      '### [ ] ' + r.groupId,
      '',
      'Classification: ' +
        r.classification +
        '. Access priority: ' +
        r.accessPriority +
        '.',
      '',
      'Potential name: ' +
        (r.proposedName ||
          r.nameTagLeads.map((x) => x.name).join(' / ') ||
          'unconfirmed; see nearby clues below') +
        '.',
      '',
    )
    for (const link of r.reviewLinks)
      lines.push(
        '- Source ' +
          link.recordId +
          ' [original evidence](' +
          link.sourceRecordUrl +
          ')' +
          ' at longitude/latitude ' +
          link.coordinate.join(', ') +
          ': [Google Maps](' +
          link.googleMaps +
          '), [Waze](' +
          link.waze +
          ').',
      )
    for (const clue of [
      ...r.nameTagLeads,
      ...r.nearbyParkingLeads,
      ...r.contextClues,
    ])
      lines.push(
        '- Evidence: ' +
          clue.name +
          ' (' +
          (clue.basis || clue.relation) +
          '), source ' +
          clue.sourceId +
          ': ' +
          clue.sourceRecordUrl +
          '.',
      )
    for (const clue of r.operatorClues)
      lines.push(
        '- Operator/brand clue only: ' +
          clue.name +
          ', source ' +
          clue.recordId +
          '.',
      )
    lines.push(
      '',
      'Uncertainties: ' + r.uncertainties.join(' '),
      '',
      'On site:',
      '',
    )
    for (const check of r.onSiteChecks) lines.push('- [ ] ' + check)
    lines.push('')
  }
  return lines.join('\n') + '\n'
}
function main() {
  const args = process.argv.slice(2),
    values = new Map()
  const flags = new Set([
    '--out',
    '--csv',
    '--refreshed-osm',
    '--context-osm',
    '--refreshed-overture',
    '--osm-updates',
    '--checklist',
  ])
  if (args.length % 2) throw new Error('Flags require a value')
  for (let i = 0; i < args.length; i += 2) {
    if (
      !flags.has(args[i]) ||
      values.has(args[i]) ||
      !args[i + 1] ||
      args[i + 1].startsWith('--')
    )
      throw new Error('Invalid enrichment options')
    values.set(args[i], args[i + 1])
  }
  if (!values.has('--out') || !values.has('--csv'))
    throw new Error(
      'Usage: node scripts/ncr-permitted-enrichment.mjs --out output/ncr/names.json --csv output/ncr/names.csv [--refreshed-osm output/ncr/latest-osm.geojson] [--context-osm output/ncr/osm-context.geojson]',
    )
  const provenance = {}
  const load = (key) => {
    if (!values.has(key)) return null
    const filename = values.get(key),
      bytes = readFileSync(filename)
    const raw = filename.endsWith('.gz') ? gunzipSync(bytes) : bytes
    const parsed = JSON.parse(raw.toString('utf8'))
    provenance[key.slice(2)] = {
      filename,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      uncompressedSha256: createHash('sha256').update(raw).digest('hex'),
      sourceMetadata: parsed.sourceMetadata || null,
    }
    return parsed
  }
  const report = buildPermittedEnrichment(loadNcrResearch(), {
    refreshedOsm: load('--refreshed-osm'),
    contextOsm: load('--context-osm'),
    refreshedOverture: load('--refreshed-overture'),
    osmUpdates: load('--osm-updates'),
  })
  report.additionalSourceProvenance = provenance
  const outputs = [
    [values.get('--out'), JSON.stringify(report, null, 2) + '\n'],
    [
      values.get('--csv'),
      csvRows({ ...report, records: prioritizedRecords(report) }),
    ],
  ]
  if (values.has('--checklist'))
    outputs.push([values.get('--checklist'), humanChecklist(report)])
  if (
    new Set(outputs.map(([filename]) => filename)).size !== outputs.length ||
    outputs.some(([filename]) => existsSync(filename))
  )
    throw new Error('Output paths must be distinct and new; refusing overwrite')
  for (const [filename] of outputs)
    mkdirSync(dirname(filename), { recursive: true })
  for (const [filename, contents] of outputs)
    writeFileSync(
      filename,
      filename.endsWith('.gz') ? gzipSync(contents) : contents,
      { flag: 'wx' },
    )
  process.stdout.write(JSON.stringify(report.totals, null, 2) + '\n')
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main()
  } catch (error) {
    process.stderr.write(error.message + '\n')
    process.exitCode = 1
  }
}
