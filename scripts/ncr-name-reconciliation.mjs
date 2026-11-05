/**
 * Source-permitted Metro Manila parking name reconciliation.
 *
 * This is research staging, not a Google/Waze scraper or publication workflow.
 * A nearby matching name is corroboration to review, not proof that two
 * physically distinct garages/entrances represent the same parking facility.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import process from 'node:process'
import { distanceMeters } from './parking-open-data.mjs'
import { loadNcrResearch } from './ncr-quality-review.mjs'

const facilityTypes = new Set(['lot', 'garage', 'facility_unspecified'])
const normalized = (value) =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** True means a *distinctive source name*, not an independently verified name. */
export function meaningfulParkingName(value) {
  if (typeof value !== 'string' || value.length > 160) return false
  const clean = normalized(value)
  if (
    clean.length < 3 ||
    /^(unnamed|mapped|unknown|unidentified|no name)\b/.test(clean)
  )
    return false
  if (
    /^(?:parking|parking area|parking lot|parking garage|parking building|parking space|parking entrance|car park|carpark|car parking|vehicle parking|street parking|open parking|underground parking|public parking|private parking|basement parking|parking facility|multi storey parking)$/.test(
      clean,
    )
  )
    return false
  if (/^(?:p|b|level|floor)\s?\d+[a-z]?$/.test(clean)) return false
  return true
}

const navigationLinks = (point) => {
  if (
    !Array.isArray(point) ||
    point.length !== 2 ||
    !point.every(Number.isFinite) ||
    point[0] < -180 ||
    point[0] > 180 ||
    point[1] < -90 ||
    point[1] > 90
  )
    throw new Error('Source coordinate missing or invalid.')
  const query = encodeURIComponent(point[1] + ',' + point[0])
  return {
    googleMaps: 'https://www.google.com/maps/search/?api=1&query=' + query,
    waze: 'https://www.waze.com/ul?ll=' + query + '&z=18',
  }
}
const validSources = new Set(['osm', 'overture'])
const srcName = (member) =>
  meaningfulParkingName(member.name)
    ? String(member.name).trim().replace(/\s+/g, ' ')
    : null
const originKeys = (candidate) =>
  (candidate.sourceProviders || [])
    .map(
      (p) =>
        String(p.dataset || '').toLowerCase() + ':' + String(p.record_id || ''),
    )
    .filter((s) => s && !s.endsWith(':'))

function sourceIndependent(first, second) {
  if (first.sourceKind === second.sourceKind) return false
  const a = new Set(originKeys(first)),
    b = new Set(originKeys(second))
  if ([...a].some((id) => b.has(id))) return false
  // Overture records that identify OSM among their input providers are not an
  // independent OSM corroboration.
  if (
    [first, second].some(
      (c) =>
        c.sourceKind === 'overture' &&
        (c.sourceProviders || []).some((p) =>
          /^(osm|openstreetmap)$/i.test(p.dataset || ''),
        ),
    )
  )
    return false
  return true
}

/**
 * No source snapshots or manual decisions are modified.
 * Cross-source names are candidate corroborations, not automatically verified.
 */
export function buildNameReconciliation(research) {
  if (
    research?.schemaVersion !== 1 ||
    !Array.isArray(research.candidates) ||
    !Array.isArray(research.facilityGroups) ||
    !research.sourceHashes
  )
    throw new Error('Expected frozen NCR research and facility identities.')
  const byId = new Map()
  for (const c of research.candidates) {
    if (
      !c ||
      byId.has(c.id) ||
      !validSources.has(c.sourceKind) ||
      ![
        'lot',
        'garage',
        'facility_unspecified',
        'space',
        'entrance',
        'street_segment',
      ].includes(c.type)
    )
      throw new Error('Duplicate, invalid or unsupported research candidate.')
    byId.set(c.id, c)
  }
  const groupIds = new Set(),
    groups = []
  const groupedMembers = new Set()
  for (const g of research.facilityGroups) {
    if (
      !g ||
      !g.id ||
      groupIds.has(g.id) ||
      !Array.isArray(g.sourceCandidateIds) ||
      !g.sourceCandidateIds.length
    )
      throw new Error('Invalid facility group.')
    groupIds.add(g.id)
    const members = g.sourceCandidateIds.map((id) => {
      if (
        groupedMembers.has(id) ||
        !byId.has(id) ||
        !facilityTypes.has(byId.get(id).type)
      )
        throw new Error(
          'Group must reference unique existing facility observations.',
        )
      groupedMembers.add(id)
      return byId.get(id)
    })
    const distinct = [
      ...new Map(
        members
          .map((m) => [normalized(srcName(m)), srcName(m)])
          .filter(([key, value]) => key && value),
      ).values(),
    ]
    const conflict =
      g.flags?.includes('shared_identity_location_conflict') ||
      g.maximumLocationSpreadMeters > 100 ||
      distinct.length > 1
    groups.push({
      groupId: g.id,
      candidateIds: [...g.sourceCandidateIds].sort(),
      memberNames: members
        .filter((m) => srcName(m))
        .map((m) => ({
          id: m.id,
          name: srcName(m),
          sourceKind: m.sourceKind,
          sourceRecordUrl: m.sourceRecordUrl,
          sourceLicense: m.sourceLicense,
        })),
      proposedName: conflict ? null : distinct[0] || null,
      nameStatus: conflict
        ? 'identity_or_name_conflict'
        : distinct.length
          ? 'source_named_requires_cross_reference'
          : 'unnamed_pending_reference',
      sourceIdentityConflict: !!conflict,
      matches: [],
      reviewLocations: members.map((m) => ({
        id: m.id,
        sourceCoordinate: m.representativePoint,
        navigationOnly: navigationLinks(m.representativePoint),
      })),
      humanNameReviewRequired: true,
      operatingStatusConfirmed: false,
      publicVisitorAccessConfirmed: false,
      publicationApproved: false,
    })
  }
  const facilityMembers = research.candidates.filter((c) =>
    facilityTypes.has(c.type),
  )
  if (facilityMembers.length !== groupedMembers.size)
    throw new Error('Every facility observation must belong to one group.')
  const index = new Map(
    groups.flatMap((g) => g.candidateIds.map((id) => [id, g])),
  )
  const named = facilityMembers.filter((c) => srcName(c))
  // Spatial bins bound the comparisons; no reverse-geocoding, no provider APIs.
  const bins = new Map()
  const binKey = (x, y) => x + ':' + y
  for (const c of named) {
    const [x, y] = c.representativePoint
    const ix = Math.floor(x * 1000),
      iy = Math.floor(y * 1000)
    const key = binKey(ix, iy)
    if (!bins.has(key)) bins.set(key, [])
    bins.get(key).push(c)
  }
  const matchesByGroup = new Map()
  for (const c of named) {
    const [x, y] = c.representativePoint
    const ix = Math.floor(x * 1000),
      iy = Math.floor(y * 1000)
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const other of bins.get(binKey(ix + dx, iy + dy)) || []) {
          if (
            c.id >= other.id ||
            !sourceIndependent(c, other) ||
            normalized(c.name) !== normalized(other.name)
          )
            continue
          const meters = distanceMeters(
            c.representativePoint,
            other.representativePoint,
          )
          if (meters > 75) continue
          for (const group of new Set([index.get(c.id), index.get(other.id)])) {
            if (!matchesByGroup.has(group.groupId))
              matchesByGroup.set(group.groupId, [])
            matchesByGroup.get(group.groupId).push({
              candidateIds: [c.id, other.id].sort(),
              proposedName: srcName(c),
              separationMeters: Math.round(meters),
              evidence: 'independent_named_osm_overture_sources_within_75m',
              sourceUrls: [c.sourceRecordUrl, other.sourceRecordUrl],
              // A matching name alone does not establish one legal facility.
              samePhysicalFacilityVerified: false,
            })
          }
        }
  }
  for (const g of groups) {
    g.matches = (matchesByGroup.get(g.groupId) || []).sort((a, b) =>
      a.candidateIds.join('|').localeCompare(b.candidateIds.join('|')),
    )
    if (
      g.matches.length &&
      g.proposedName &&
      !g.sourceIdentityConflict &&
      g.matches.some(
        (m) => normalized(m.proposedName) === normalized(g.proposedName),
      )
    )
      g.nameStatus = 'cross_source_name_candidate'
  }
  groups.sort((a, b) => a.groupId.localeCompare(b.groupId))
  const byStatus = Object.fromEntries(
    [...new Set(groups.map((g) => g.nameStatus))]
      .sort()
      .map((status) => [
        status,
        groups.filter((g) => g.nameStatus === status).length,
      ]),
  )
  const omittedChildren = research.candidates.length - facilityMembers.length
  return {
    schemaVersion: 1,
    sourceHashes: research.sourceHashes,
    sourceAsOf: research.sourceAsOf,
    policy:
      'Research-only facility-name proposals sourced from OSM/Overture. Google/Waze coordinate links are navigation/review aids, NOT provider lookups or permissions to reproduce provider place names. Source names and cross-source proximity do not verify the same physical facility, operation, visitor access or rights to park. No automatic public listing approvals.',
    totals: {
      sourceObservations: research.candidates.length,
      facilityGroups: groups.length,
      facilityObservations: facilityMembers.length,
      childAndStreetObservationsExcludedFromFacilityNames: omittedChildren,
      ...byStatus,
    },
    groups,
    activePublicFacilityIds: [],
    unmatchedPolicy:
      'Hide unmatched and conflicted groups from active/public discovery, never delete source research or human decisions. Publication requires separate approved display/name evidence.',
  }
}
function main() {
  const args = process.argv.slice(2)
  if (args.length !== 2 || args[0] !== '--out' || !args[1])
    throw new Error(
      'Usage: node scripts/ncr-name-reconciliation.mjs --out output/ncr/name-reconciliation.json',
    )
  const result = buildNameReconciliation(loadNcrResearch())
  mkdirSync(dirname(args[1]), { recursive: true })
  writeFileSync(args[1], JSON.stringify(result, null, 2) + '\n', { flag: 'wx' })
  process.stdout.write(
    JSON.stringify(
      {
        totals: result.totals,
        publicApproved: 0,
        output: args[1],
      },
      null,
      2,
    ) + '\n',
  )
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main()
  } catch (e) {
    process.stderr.write(e.message + '\n')
    process.exitCode = 1
  }
}
