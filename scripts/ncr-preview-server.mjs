import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL, URL } from 'node:url'
import { gunzipSync } from 'node:zlib'

import {
  geometryBounds,
  pointInNcrGeometry,
  RESEARCH_EXTENT,
} from './ncr-geography.mjs'
import {
  contentHash,
  publicationState,
  validatePublicationLedger,
} from './ncr-publication.mjs'
import { validateReviewLedger } from './ncr-quality-review.mjs'
import { chooseNearbyDestinationLabel } from './ncr-destination-labels.mjs'
import {
  buildNameReconciliation,
  meaningfulParkingName,
} from './ncr-name-reconciliation.mjs'

export const NCR_FEATURE_TYPES = [
  'lot',
  'garage',
  'facility_unspecified',
  'street_segment',
  'space',
  'entrance',
]
const facilityTypes = new Set(['lot', 'garage', 'facility_unspecified'])
const nameReviewCache = new WeakMap()
function nameReviews(research) {
  if (!nameReviewCache.has(research)) {
    const report = buildNameReconciliation(research)
    const index = new Map(
      report.groups.flatMap((group) =>
        group.candidateIds.map((id) => [id, group.nameStatus]),
      ),
    )
    nameReviewCache.set(research, index)
  }
  return nameReviewCache.get(research)
}

/** Enrichment is a source-bound private review attachment, never authority to publish. */
export function validateNcrEnrichment(research, report) {
  if (
    report?.schemaVersion !== 1 ||
    !Array.isArray(report.records) ||
    contentHash(report.sourceHashes) !== contentHash(research.sourceHashes) ||
    report.records.length !== research.facilityGroups.length
  )
    throw new Error(
      'Enrichment belongs to another or incomplete source snapshot.',
    )
  const groups = new Map(
    research.facilityGroups.map((group) => [group.id, group]),
  )
  const index = new Map()
  const seen = new Set()
  for (const record of report.records) {
    const group = groups.get(record.groupId)
    if (
      !group ||
      seen.has(record.groupId) ||
      !Array.isArray(record.candidateIds) ||
      contentHash([...record.candidateIds].sort()) !==
        contentHash([...group.sourceCandidateIds].sort()) ||
      ![
        'publicationApproved',
        'nameConfirmed',
        'operatorConfirmed',
        'physicalVerified',
        'visitorAccessConfirmed',
      ].every((field) => record[field] === false) ||
      record.approvedDisplayName !== null ||
      typeof record.classification !== 'string' ||
      !(
        record.proposedName === null || typeof record.proposedName === 'string'
      ) ||
      ![
        'nameTagLeads',
        'nearbyParkingLeads',
        'operatorClues',
        'contextClues',
        'reviewLinks',
      ].every((field) => Array.isArray(record[field]))
    )
      throw new Error(
        'Enrichment contains invalid group identities or review approvals.',
      )
    seen.add(record.groupId)
    const attachment = {
      groupId: record.groupId,
      classification: record.classification,
      proposedName: record.proposedName,
      nameTagLeads: record.nameTagLeads,
      nearbyParkingLeads: record.nearbyParkingLeads,
      operatorClues: record.operatorClues,
      contextClues: record.contextClues,
      reviewLinks: record.reviewLinks,
    }
    for (const id of record.candidateIds) index.set(id, attachment)
  }
  return index
}

export function loadNcrEnrichment(filename, research) {
  const bytes = readFileSync(filename)
  const raw = filename.endsWith('.gz') ? gunzipSync(bytes) : bytes
  const report = JSON.parse(raw.toString('utf8'))
  validateNcrEnrichment(research, report)
  return report
}
const loopbackHost = (hostname) =>
  ['localhost', '127.0.0.1', '[::1]'].includes(hostname)
const loopbackAddress = (value) =>
  ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(value)
const overlap = (a, b) =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]
const inBox = (p, b) =>
  p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3]
const badQuery = (message) => Object.assign(new Error(message), { status: 400 })

function segmentIntersects(a, b, box) {
  let lower = 0,
    upper = 1
  const dx = b[0] - a[0],
    dy = b[1] - a[1]
  const p = [-dx, dx, -dy, dy],
    q = [a[0] - box[0], box[2] - a[0], a[1] - box[1], box[3] - a[1]]
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false
      continue
    }
    const ratio = q[i] / p[i]
    if (p[i] < 0) lower = Math.max(lower, ratio)
    else upper = Math.min(upper, ratio)
    if (lower > upper) return false
  }
  return true
}
export function geometryIntersectsViewport(geometry, box) {
  if (!overlap(geometryBounds(geometry), box)) return false
  if (geometry.type === 'Point') return inBox(geometry.coordinates, box)
  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : null
  const lines = polygons
    ? polygons.flat()
    : geometry.type === 'LineString'
      ? [geometry.coordinates]
      : geometry.coordinates
  if (
    lines.some(
      (line) =>
        line.some((p) => inBox(p, box)) ||
        line.slice(1).some((p, i) => segmentIntersects(line[i], p, box)),
    )
  )
    return true
  return (
    !!polygons &&
    [
      [box[0], box[1]],
      [box[2], box[1]],
      [box[2], box[3]],
      [box[0], box[3]],
    ].some((p) => pointInNcrGeometry(p, geometry))
  )
}

export function parseNcrQuery(searchParams) {
  const allowed = new Set(['bbox', 'zoom', 'category', 'limit', 'cursor'])
  for (const key of searchParams.keys())
    if (!allowed.has(key) || searchParams.getAll(key).length !== 1)
      throw badQuery('Unsupported or repeated query parameter.')
  const rawBox = searchParams.get('bbox'),
    rawZoom = searchParams.get('zoom')
  if (!rawBox || !rawZoom || rawBox.split(',').some((part) => !part.trim()))
    throw badQuery('bbox and zoom are required.')
  const bbox = rawBox.split(',').map(Number),
    zoom = Number(rawZoom)
  if (
    bbox.length !== 4 ||
    !bbox.every(Number.isFinite) ||
    !Number.isFinite(zoom) ||
    zoom < 0 ||
    zoom > 22 ||
    bbox[0] < -180 ||
    bbox[2] > 180 ||
    bbox[1] < -85.051129 ||
    bbox[3] > 85.051129 ||
    bbox[0] >= bbox[2] ||
    bbox[1] >= bbox[3] ||
    bbox[2] - bbox[0] > 0.6 ||
    bbox[3] - bbox[1] > 0.7 ||
    !overlap(bbox, [
      RESEARCH_EXTENT.west,
      RESEARCH_EXTENT.south,
      RESEARCH_EXTENT.east,
      RESEARCH_EXTENT.north,
    ])
  )
    throw badQuery('Expected a finite NCR viewport at most 0.6 by 0.7 degrees.')
  const category = searchParams.get('category') || 'all',
    limit = Number(searchParams.get('limit') || '200')
  if (
    (category !== 'all' && !NCR_FEATURE_TYPES.includes(category)) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 500
  )
    throw badQuery('Unsupported category or result limit.')
  return { bbox, zoom, category, limit, cursor: searchParams.get('cursor') }
}

function projection(
  candidate,
  state,
  research,
  preview,
  nameIndex,
  enrichmentIndex,
) {
  const enriched = preview ? enrichmentIndex?.get(candidate.id) : null
  const destinationLabel = chooseNearbyDestinationLabel(candidate, enriched, {
    privatePreview: preview,
  })
  return {
    id: candidate.id,
    name: candidate.name,
    nameReview: {
      status: nameIndex.get(candidate.id) || 'not_independent_facility',
      sourceNameIsDistinctive: meaningfulParkingName(candidate.name),
      // Independent OSM/Overture name agreement is an unverified research lead.
      crossSourceCandidate:
        nameIndex.get(candidate.id) === 'cross_source_name_candidate' &&
        meaningfulParkingName(candidate.name),
      ...(enriched ? { enrichment: enriched } : {}),
      ...(destinationLabel ? { destinationLabel } : {}),
    },
    featureType: candidate.type,
    geometry: candidate.geometry,
    representativePoint: candidate.representativePoint,
    pointIsVehicleEntrance: false,
    canNavigate: false,
    accessClass: candidate.accessClass,
    restrictedAccess: candidate.restrictedAccess,
    evidence: state.evidence,
    publicationReview: {
      approvedAt: state.approvedAt,
      reviewDueAt: state.reviewDueAt,
    },
    source: {
      kind: candidate.sourceKind,
      url: candidate.sourceRecordUrl,
      license: candidate.sourceLicense,
      attribution: candidate.sourceAttribution,
      observedAt:
        research.sourceMetadata?.[candidate.sourceKind]?.observedAt ||
        research.sourceMetadata?.[candidate.sourceKind]?.downloadedAt ||
        research.sourceAsOf ||
        null,
    },
    warnings: [
      ...new Set([
        'Unverified parking research. Visitor access, operation and legal use are not guaranteed.',
        'Research anchor is not a confirmed vehicle entrance. Navigation is unavailable.',
        ...(candidate.restrictedAccess
          ? ['Restricted access: not publicly usable parking.']
          : []),
        ...(candidate.accessClass === 'customers'
          ? ['Customer-only access conditions have not been confirmed.']
          : []),
        ...(candidate.type === 'street_segment'
          ? ['Street parking legality and time restrictions need review.']
          : []),
        ...(preview && meaningfulParkingName(candidate.name)
          ? [
              'Source name has not been independently confirmed with the operator or an on-site check.',
            ]
          : []),
        ...(candidate.flags || []),
      ]),
    ],
    reviewIssueIds: preview ? state.reviewIssueIds : [],
    fees: null,
    hours: null,
    capacity: null,
    liveAvailability: null,
  }
}

export function queryNcrResearch(
  research,
  query,
  {
    ledger,
    reviewLedger,
    preview = false,
    now = Date.now(),
    enrichment = null,
  },
) {
  validatePublicationLedger(ledger, now)
  validateReviewLedger(reviewLedger)
  if (
    contentHash(reviewLedger.sourceHashes) !==
    contentHash(research.sourceHashes)
  )
    throw new Error(
      'Research review ledger belongs to another source snapshot.',
    )
  const enrichmentIndex =
    preview && enrichment ? validateNcrEnrichment(research, enrichment) : null
  const issueIndex = new Map()
  const rejectedIssues = new Set(
    reviewLedger.events
      .filter((event) => event.action === 'human_rejection')
      .map((event) => event.issueId),
  )
  for (const original of reviewLedger.issues) {
    const issue = rejectedIssues.has(original.id)
      ? { ...original, status: 'human_rejected', blockingPublicDisplay: true }
      : original
    for (const id of issue.candidateIds || []) {
      if (!issueIndex.has(id)) issueIndex.set(id, [])
      issueIndex.get(id).push(issue)
    }
  }
  const dataVersion = contentHash({
    sourceHashes: research.sourceHashes,
    ledger,
    reviewLedger,
    ...(preview && enrichment ? { enrichment } : {}),
  })
  const fingerprint = contentHash({
    dataVersion,
    mode: preview ? 'research_preview' : 'public',
    ...query,
    cursor: null,
  })
  let offset = 0
  if (query.cursor) {
    try {
      if (query.cursor.length > 512) throw new Error('cursor too long')
      const parsed = JSON.parse(
        Buffer.from(query.cursor, 'base64url').toString('utf8'),
      )
      if (
        !Number.isSafeInteger(parsed.offset) ||
        parsed.offset < 0 ||
        parsed.fingerprint !== fingerprint
      )
        throw new Error('cursor mismatch')
      offset = parsed.offset
    } catch {
      throw badQuery('Cursor is invalid or belongs to another snapshot/query.')
    }
  }
  const nameIndex = nameReviews(research)
  const matched = []
  for (const candidate of research.candidates) {
    // Source research is retained privately. A future human approval cannot
    // accidentally publish a placeholder like "Unnamed parking facility".
    if (!preview && !meaningfulParkingName(candidate.name)) continue
    if (
      (query.category !== 'all' && candidate.type !== query.category) ||
      !geometryIntersectsViewport(candidate.geometry, query.bbox)
    )
      continue
    const state = publicationState(candidate, ledger, {
      now,
      issues: issueIndex.get(candidate.id) || [],
    })
    if (preview || state.eligible) matched.push({ candidate, state })
  }
  matched.sort((a, b) => a.candidate.id.localeCompare(b.candidate.id))
  const groups = new Map(
    research.facilityGroups.flatMap((group) =>
      group.sourceCandidateIds.map((id) => [id, group.id]),
    ),
  )
  const clusters = []
  let items = [],
    nextCursor = null,
    truncated = false
  if (query.zoom < 14) {
    if (offset) throw badQuery('Cluster queries do not accept a detail cursor.')
    const step = Math.min(0.05, 0.005 * 2 ** (14 - query.zoom)),
      bins = new Map()
    for (const { candidate } of matched) {
      const [x, y] = candidate.representativePoint,
        cellX = Math.floor(x / step),
        cellY = Math.floor(y / step)
      const key = `${cellX}:${cellY}`
      if (!bins.has(key))
        bins.set(key, {
          id: `cluster:${key}`,
          coordinate: [(cellX + 0.5) * step, (cellY + 0.5) * step],
          sourceObservationCount: 0,
          facilityCandidateCount: 0,
          byType: {},
          facilities: new Set(),
        })
      const cluster = bins.get(key)
      cluster.sourceObservationCount++
      cluster.byType[candidate.type] = (cluster.byType[candidate.type] || 0) + 1
      if (facilityTypes.has(candidate.type))
        cluster.facilities.add(groups.get(candidate.id) || candidate.id)
    }
    for (const { facilities, ...cluster } of [...bins.values()].sort((a, b) =>
      a.id.localeCompare(b.id),
    ))
      clusters.push({ ...cluster, facilityCandidateCount: facilities.size })
  } else {
    if (offset > matched.length)
      throw badQuery('Cursor offset exceeds this result set.')
    items = matched
      .slice(offset, offset + query.limit)
      .map(({ candidate, state }) =>
        projection(
          candidate,
          state,
          research,
          preview,
          nameIndex,
          enrichmentIndex,
        ),
      )
    truncated = offset + items.length < matched.length
    if (truncated)
      nextCursor = Buffer.from(
        JSON.stringify({ offset: offset + items.length, fingerprint }),
      ).toString('base64url')
  }
  return {
    schemaVersion: 1,
    mode: preview ? 'research_preview' : 'public',
    dataVersion,
    generatedAt: new Date(now).toISOString(),
    reviewDueAt:
      !preview && matched.length
        ? new Date(
            Math.min(
              ...matched.map((item) => Date.parse(item.state.reviewDueAt)),
            ),
          ).toISOString()
        : null,
    coverage: {
      sourceAsOf: research.sourceAsOf,
      boundarySource:
        research.sourceMetadata?.boundaries?.boundarySource ||
        research.sourceMetadata?.boundaries?.provider ||
        'Recorded source boundaries',
      scope: research.scope,
    },
    items,
    clusters,
    nextCursor,
    truncated,
    totalMatched: matched.length,
    attribution: [
      {
        label: '© OpenStreetMap contributors · ODbL 1.0',
        url: 'https://www.openstreetmap.org/copyright',
      },
      {
        label:
          'Overture Maps Foundation · record-level CDLA-Permissive-2.0 / Apache-2.0',
        url: 'https://docs.overturemaps.org/attribution/',
      },
      {
        label: 'Foursquare Places NOTICE',
        url: 'https://opensource.foursquare.com/places-notice-txt/',
      },
    ],
    notice: preview
      ? 'Private local research preview. These candidates are unpublished, unverified and not guaranteed usable parking.'
      : 'Only currently approved NCR display records are returned. Empty results do not establish that parking is absent.',
  }
}

export function createNcrHandler({
  research,
  loadPublicationLedger,
  loadReviewLedger,
  developmentPreview = false,
  enrichment = null,
  now = Date.now,
}) {
  return (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store, max-age=0')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    const send = (status, value) => {
      response.statusCode = status
      response.end(JSON.stringify(value))
    }
    let target
    try {
      target = new URL(request.url || '/', 'http://' + request.headers.host)
    } catch {
      send(400, { error: 'Invalid request.' })
      return
    }
    if (
      !loopbackHost(target.hostname) ||
      !loopbackAddress(request.socket.remoteAddress)
    ) {
      send(403, {
        error: 'This development server accepts loopback clients only.',
      })
      return
    }
    const origin = request.headers.origin
    if (origin) {
      let parsed
      try {
        parsed = new URL(origin)
      } catch {
        send(403, { error: 'Origin denied.' })
        return
      }
      if (
        parsed.protocol !== 'http:' ||
        !loopbackHost(parsed.hostname) ||
        parsed.username ||
        parsed.password ||
        parsed.pathname !== '/'
      ) {
        send(403, { error: 'Origin denied.' })
        return
      }
      response.setHeader('Access-Control-Allow-Origin', origin)
      response.setHeader('Vary', 'Origin')
      response.setHeader(
        'Access-Control-Allow-Headers',
        'X-Parkey-Research-Preview',
      )
      response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    }
    if (request.method === 'OPTIONS') {
      response.statusCode = 204
      response.end()
      return
    }
    if (request.method !== 'GET') {
      send(405, { error: 'Read-only API.' })
      return
    }
    if (
      !['/api/ncr/discovery', '/api/ncr/research-preview'].includes(
        target.pathname,
      )
    ) {
      send(404, { error: 'Not found.' })
      return
    }
    const preview = target.pathname === '/api/ncr/research-preview'
    if (
      preview &&
      (!developmentPreview ||
        process.env.NODE_ENV === 'production' ||
        request.headers['x-parkey-research-preview'] !== 'local-development')
    ) {
      send(403, { error: 'Private development preview is disabled.' })
      return
    }
    if ((request.url || '').length > 4096) {
      send(400, { error: 'Request too long.' })
      return
    }
    try {
      const query = parseNcrQuery(target.searchParams)
      send(
        200,
        queryNcrResearch(research, query, {
          ledger: loadPublicationLedger(),
          reviewLedger: loadReviewLedger(),
          preview,
          now: now(),
          enrichment,
        }),
      )
    } catch (error) {
      send(error.status === 400 ? 400 : 503, {
        error:
          error.status === 400
            ? error.message
            : 'Research review data is unavailable; no records were released.',
      })
    }
  }
}

export function loadFrozenResearch(directory) {
  const manifest = JSON.parse(
    readFileSync(join(directory, 'manifest.json'), 'utf8'),
  )
  const artifact = manifest.artifacts.find((item) => item.role === 'research')
  if (artifact?.filename !== 'metro-parking-research.json.gz')
    throw new Error('Research archive missing from manifest.')
  const compressed = readFileSync(join(directory, artifact.filename)),
    raw = gunzipSync(compressed)
  const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
  if (
    hash(compressed) !== artifact.sha256 ||
    hash(raw) !== artifact.uncompressedSha256
  )
    throw new Error('Research archive integrity check failed.')
  return JSON.parse(raw.toString('utf8'))
}

function main() {
  const args = process.argv.slice(2),
    portAt = args.indexOf('--port'),
    dataAt = args.indexOf('--data'),
    enrichmentAt = args.indexOf('--enrichment')
  const port = Number(portAt < 0 ? '8090' : args[portAt + 1]),
    directory = dataAt < 0 ? 'data/ncr-research' : args[dataAt + 1]
  const developmentPreview = args.includes('--development-preview')
  const validFlags = new Set([
    '--port',
    '--data',
    '--development-preview',
    '--enrichment',
  ])
  for (let i = 0; i < args.length; i++) {
    if (!validFlags.has(args[i])) throw new Error('Unsupported option.')
    if (args[i] !== '--development-preview') {
      if (!args[i + 1] || args[i + 1].startsWith('--'))
        throw new Error('Option requires a value.')
      i++
    }
  }
  if (
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65535 ||
    !directory ||
    (enrichmentAt >= 0 && !developmentPreview) ||
    (developmentPreview && process.env.NODE_ENV === 'production')
  )
    throw new Error(
      'Expected a development-only loopback port and data directory.',
    )
  const readLedger = (filename) => () => {
    const path = join(directory, filename)
    if (!existsSync(path))
      throw new Error('Required review ledger not found: ' + filename)
    return JSON.parse(readFileSync(path, 'utf8'))
  }
  const research = loadFrozenResearch(directory)
  const handler = createNcrHandler({
    research,
    enrichment:
      enrichmentAt < 0
        ? null
        : loadNcrEnrichment(args[enrichmentAt + 1], research),
    loadPublicationLedger: readLedger('publication-ledger.json'),
    loadReviewLedger: readLedger('review-ledger.json'),
    developmentPreview,
  })
  const server = createServer(handler)
  server.listen(port, '127.0.0.1', () =>
    process.stdout.write(
      `NCR ${developmentPreview ? 'private research preview' : 'approved projection'} API: http://127.0.0.1:${port}\n`,
    ),
  )
  server.on('error', (error) => {
    process.stderr.write(error.message + '\n')
    process.exitCode = 1
  })
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
