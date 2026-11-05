/**
 * Permitted-source parking-name enrichment for NCR.
 *
 * Never scrapes Google/Waze or copies their business names. Refresh matches
 * and nearby OSM POIs are evidence for a human reviewer, never auto-verified
 * parking identities, site access, directions, or publication approval.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import { geometryBounds, pointInNcrGeometry } from './ncr-geography.mjs'
import {
  buildNameReconciliation,
  meaningfulParkingName,
} from './ncr-name-reconciliation.mjs'
import { loadNcrResearch } from './ncr-quality-review.mjs'
import { distanceMeters } from './parking-open-data.mjs'

const POINT_TYPES = new Set(['Point', 'Polygon', 'MultiPolygon'])
const CONTEXT_KINDS = {
  shop: new Set(['mall', 'department_store', 'supermarket', 'shopping_centre']),
  amenity: new Set([
    'hospital',
    'university',
    'college',
    'marketplace',
    'school',
  ]),
  tourism: new Set(['hotel', 'motel']),
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
function extractRefreshedOsm(refreshed) {
  if (!refreshed) return new Map()
  ensureGeojson(refreshed)
  const byId = new Map()
  for (const f of refreshed.features) {
    const p = f?.properties || {},
      id = osmIdentity(f)
    if (!id) throw new Error('OSM refresh feature lacks stable @type/@id.')
    rejectGoogleWazeOrigin(p)
    const name =
      textName(p.name) ||
      textName(p.official_name) ||
      textName(p['name:en']) ||
      textName(p.alt_name)
    if (!name) continue
    if (byId.has(id) && norm(byId.get(id).name) !== norm(name))
      throw new Error(
        'Contradictory OSM names for a single source identity: ' + id,
      )
    byId.set(id, {
      name,
      sourceField: p.name
        ? 'name'
        : p.official_name
          ? 'official_name'
          : p['name:en']
            ? 'name:en'
            : 'alt_name',
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
  const offer = (value, field, basis) => {
    const name = textName(value)
    if (!name || norm(name) === norm(member.name)) return
    if (clues.some((x) => norm(x.name) === norm(name))) return
    clues.push({
      name,
      basis,
      sourceField: field,
      sourceId: member.id,
      sourceRecordUrl: member.sourceRecordUrl,
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
      offer(fresh.name, fresh.sourceField, 'same_osm_identity_new_snapshot')
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
    const [x, y] = c.point,
      ix = Math.floor(x * 1000),
      iy = Math.floor(y * 1000)
    const key = ix + ':' + iy
    if (!bins.has(key)) bins.set(key, [])
    bins.get(key).push(c)
  }
  return bins
}
function nearbyContexts(member, contexts) {
  const [x, y] = member.representativePoint
  const ix = Math.floor(x * 1000),
    iy = Math.floor(y * 1000)
  const results = []
  for (let dx = -2; dx <= 2; dx++)
    for (let dy = -2; dy <= 2; dy++)
      for (const c of contexts.get(ix + dx + ':' + (iy + dy)) || []) {
        let contains = false
        if (c.geometry.type !== 'Point')
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
/** Produce traceable leads for independent human/operator review only. */
export function buildPermittedEnrichment(
  research,
  { refreshedOsm = null, contextOsm = null } = {},
) {
  const base = buildNameReconciliation(research)
  const sourceById = new Map(research.candidates.map((c) => [c.id, c]))
  const refreshed = extractRefreshedOsm(refreshedOsm)
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
        coordinate: member.representativePoint,
        ...coordinateLinks(member.representativePoint),
      })
    }
    const uniqueClues = [
      ...new Map(
        clues.map((c) => [c.sourceId + '|' + norm(c.name), c]),
      ).values(),
    ]
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
          : uniqueClues.length
            ? 'name_tag_or_refresh_lead'
            : uniqueContexts.length
              ? 'property_context_only'
              : operatorClues.length
                ? 'operator_or_brand_only'
                : 'no_reusable_name_lead'
    records.push({
      groupId: group.groupId,
      candidateIds: group.candidateIds,
      originalStatus: group.nameStatus,
      originalSourceName: group.proposedName,
      nameTagLeads: uniqueClues,
      operatorClues,
      contextClues: uniqueContexts,
      reviewLinks,
      priority,
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
    withUnusedNameTagLead: unnamed.filter((r) => r.nameTagLeads.length > 0).length,
    withOperatorOrBrandClue: unnamed.filter((r) => r.operatorClues.length > 0).length,
    withNamedPropertyContext: unnamed.filter((r) => r.contextClues.length > 0).length,
    withNoAdditionalClue: unnamed.filter(
      (r) => !r.nameTagLeads.length && !r.operatorClues.length && !r.contextClues.length,
    ).length,
  }
  return {
    schemaVersion: 1,
    sourceHashes: research.sourceHashes,
    sourceAsOf: research.sourceAsOf,
    sourceOptions: {
      sameIdentityOsmRefresh: !!refreshedOsm,
      namedOsmPropertyContext: !!contextOsm,
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
      unnamedBreakdown,
    },
    records: records.sort((a, b) => a.groupId.localeCompare(b.groupId)),
  }
}
function csvRows(report) {
  const cols = [
    'groupId',
    'priority',
    'originalStatus',
    'originalSourceName',
    'nameTagLeads',
    'operatorClues',
    'contextClues',
    'googleMaps',
    'waze',
    'disposition',
  ]
  return (
    cols.join(',') +
    '\n' +
    report.records
      .map((r) => {
        const row = {
          ...r,
          nameTagLeads: r.nameTagLeads
            .map((x) => x.name + ' [' + x.basis + ']')
            .join(' | '),
          operatorClues: r.operatorClues
            .map((x) => x.name + ' [' + x.kind + ']')
            .join(' | '),
          contextClues: r.contextClues
            .map((x) => x.name + ' [' + x.relation + ']')
            .join(' | '),
          googleMaps: r.reviewLinks[0]?.googleMaps || '',
          waze: r.reviewLinks[0]?.waze || '',
        }
        return cols.map((c) => csv(row[c])).join(',')
      })
      .join('\n') +
    '\n'
  )
}
function main() {
  const args = process.argv.slice(2),
    values = new Map()
  const flags = new Set(['--out', '--csv', '--refreshed-osm', '--context-osm'])
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
  const load = (key) =>
    values.has(key) ? JSON.parse(readFileSync(values.get(key), 'utf8')) : null
  const report = buildPermittedEnrichment(loadNcrResearch(), {
    refreshedOsm: load('--refreshed-osm'),
    contextOsm: load('--context-osm'),
  })
  for (const filename of [values.get('--out'), values.get('--csv')])
    mkdirSync(dirname(filename), { recursive: true })
  writeFileSync(values.get('--out'), JSON.stringify(report, null, 2) + '\n', {
    flag: 'wx',
  })
  writeFileSync(values.get('--csv'), csvRows(report), { flag: 'wx' })
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
