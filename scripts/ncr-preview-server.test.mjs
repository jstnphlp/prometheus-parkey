import assert from 'node:assert/strict'
import { createServer, request as httpRequest } from 'node:http'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { URLSearchParams } from 'node:url'
import process from 'node:process'
import { gzipSync } from 'node:zlib'

import {
  createNcrHandler,
  geometryIntersectsViewport,
  loadFrozenResearch,
  loadNcrEnrichment,
  parseNcrQuery,
  queryNcrResearch,
  validateNcrEnrichment,
} from './ncr-preview-server.mjs'
import { appendPublicationEvent, contentHash } from './ncr-publication.mjs'

const now = Date.parse('2026-11-05T12:00:00.000Z')
const candidate = (id, type = 'lot', x = 121.03) => ({
  id,
  name: 'Synthetic parking ' + id,
  type,
  geometry: { type: 'Point', coordinates: [x, 14.565] },
  representativePoint: [x, 14.565],
  accessClass: 'unknown',
  restrictedAccess: false,
  operatingStatus: 'unknown',
  flags: [],
  sourceKind: 'osm',
  sourceRecordUrl: 'https://www.openstreetmap.org/node/1',
  sourceLicense: 'ODbL-1.0',
  sourceAttribution: '© OpenStreetMap contributors',
  sourceProviders: [
    { dataset: 'OpenStreetMap', license: 'ODbL-1.0', record_id: id },
  ],
  researchStatus: 'researched',
  onlineCorroborated: false,
})
const research = {
  schemaVersion: 1,
  scope: 'Synthetic test NCR',
  sourceAsOf: '2026-11-03T00:00:00Z',
  sourceHashes: {},
  sourceMetadata: {},
  candidates: [
    candidate('a'),
    candidate('b', 'entrance'),
    candidate('c', 'space'),
    candidate('d', 'lot', 121.0301),
  ],
  facilityGroups: [{ id: 'one', sourceCandidateIds: ['a', 'd'] }],
}
const emptyLedger = () => ({ schemaVersion: 1, events: [] })
const reviewLedger = (sourceHashes) => ({
  schemaVersion: 1,
  issues: [],
  catalogHash: contentHash([]),
  events: [],
  sourceSnapshots: [],
  sourceHashes,
})
const query = (extra) =>
  parseNcrQuery(
    new URLSearchParams({
      bbox: '121.02,14.55,121.05,14.58',
      zoom: '15',
      ...extra,
    }),
  )
const approval = (record, index = 0) => ({
  eventId: 'approve-' + record.id,
  recordId: record.id,
  action: 'approve_publication',
  actorKind: 'human_reviewer',
  actorId: 'synthetic-test-reviewer',
  recordedAt: new Date(now - 100000 + index).toISOString(),
  reason: 'Synthetic test only',
  evidenceReferences: ['test:approval'],
  recordHash: contentHash(record),
  reviewDueAt: new Date(now + 86400000).toISOString(),
  scope: 'unverified_discovery',
  approvedFields: ['name', 'geometry', 'source', 'evidence', 'access'],
  licenseApproved: true,
  accessApproved: true,
  safetyApproved: true,
  accessDecision: 'public_visitor_access',
})
const queryOptions = (preview = true) => ({
  ledger: emptyLedger(),
  reviewLedger: reviewLedger(research.sourceHashes),
  preview,
  now,
})
const enrichmentReport = (source = research) => ({
  schemaVersion: 1,
  sourceHashes: source.sourceHashes,
  records: source.facilityGroups.map((group) => ({
    groupId: group.id,
    candidateIds: group.sourceCandidateIds,
    classification: 'credible_name_pending_review',
    proposedName: 'Synthetic proposed garage',
    nameTagLeads: [
      {
        name: 'Synthetic proposed garage',
        sourceId: group.sourceCandidateIds[0],
      },
    ],
    nearbyParkingLeads: [],
    operatorClues: [],
    contextClues: [],
    reviewLinks: [],
    publicationApproved: false,
    nameConfirmed: false,
    operatorConfirmed: false,
    physicalVerified: false,
    visitorAccessConfirmed: false,
    approvedDisplayName: null,
  })),
})

test('enrichment attaches only to private facility details and never replaces source names or approvals', () => {
  const enrichment = enrichmentReport()
  const before = JSON.stringify(research)
  const result = queryNcrResearch(research, query(), {
    ...queryOptions(),
    enrichment,
  })
  assert.equal(result.items[0].name, research.candidates[0].name)
  assert.equal(
    result.items[0].nameReview.enrichment.proposedName,
    'Synthetic proposed garage',
  )
  assert.equal(result.items[0].nameReview.enrichment.groupId, 'one')
  assert.equal(result.items[0].evidence.publicationApproved, false)
  assert.equal(result.items[1].nameReview.enrichment, undefined)
  assert.equal(result.items[3].nameReview.enrichment.groupId, 'one')
  assert.equal(JSON.stringify(research), before)

  const approvedSource = {
    ...research,
    candidates: [candidate('a')],
    facilityGroups: [{ id: 'only', sourceCandidateIds: ['a'] }],
  }
  const ledger = appendPublicationEvent(
    emptyLedger(),
    approval(approvedSource.candidates[0]),
    { authorizedHuman: true, now },
  )
  const options = { ...queryOptions(false), ledger }
  const plain = queryNcrResearch(approvedSource, query(), options)
  const attached = queryNcrResearch(approvedSource, query(), {
    ...options,
    enrichment: enrichmentReport(approvedSource),
  })
  assert.deepEqual(attached, plain)
  assert.equal(attached.items[0].nameReview.enrichment, undefined)
  assert.equal(attached.items[0].name, 'Synthetic parking a')
})

test('enrichment revision invalidates private paging cursors without affecting public versions', () => {
  const enrichment = enrichmentReport()
  const options = { ...queryOptions(), enrichment }
  const first = queryNcrResearch(research, query({ limit: '1' }), options)
  const revised = globalThis.structuredClone(enrichment)
  revised.records[0].proposedName = 'Synthetic revised garage'
  assert.throws(
    () =>
      queryNcrResearch(
        research,
        query({ limit: '1', cursor: first.nextCursor }),
        { ...options, enrichment: revised },
      ),
    /Cursor/,
  )
  const plain = queryNcrResearch(research, query(), queryOptions())
  assert.notEqual(first.dataVersion, plain.dataVersion)
})

test('enrichment rejects mismatched snapshots, missing/duplicate groups, foreign members and claimed approvals', () => {
  const invalid = [
    (r) => {
      r.sourceHashes = { other: 'snapshot' }
    },
    (r) => {
      r.records = []
    },
    (r) => {
      r.records[0].candidateIds = ['foreign']
    },
    (r) => {
      r.records[0].candidateIds.push('a')
    },
    (r) => {
      r.records[0].publicationApproved = true
    },
    (r) => {
      r.records[0].physicalVerified = true
    },
    (r) => {
      r.records[0].approvedDisplayName = 'Synthetic approved name'
    },
    (r) => {
      delete r.records[0].contextClues
    },
  ]
  for (const mutate of invalid) {
    const r = globalThis.structuredClone(enrichmentReport())
    mutate(r)
    assert.throws(() => validateNcrEnrichment(research, r), /Enrichment/)
  }
  const source = {
    ...research,
    facilityGroups: [
      { id: 'first', sourceCandidateIds: ['a'] },
      { id: 'second', sourceCandidateIds: ['d'] },
    ],
  }
  const duplicated = enrichmentReport(source)
  duplicated.records[1] = duplicated.records[0]
  assert.throws(() => validateNcrEnrichment(source, duplicated), /Enrichment/)
})

test('plain and gzipped enrichment load with the same snapshot validation', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'parkey-enrichment-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const report = enrichmentReport()
  const raw = JSON.stringify(report)
  const plain = join(directory, 'report.json')
  const compressed = join(directory, 'report.json.gz')
  writeFileSync(plain, raw)
  writeFileSync(compressed, gzipSync(raw))
  assert.deepEqual(loadNcrEnrichment(plain, research), report)
  assert.deepEqual(loadNcrEnrichment(compressed, research), report)
  assert.throws(
    () =>
      loadNcrEnrichment(plain, {
        ...research,
        sourceHashes: { different: 'snapshot' },
      }),
    /Enrichment/,
  )
})

test('exact geometry intersections preserve crossing streets and polygon holes', () => {
  const box = [121, 14.5, 121.01, 14.51]
  assert.equal(
    geometryIntersectsViewport(
      {
        type: 'LineString',
        coordinates: [
          [120.99, 14.505],
          [121.02, 14.505],
        ],
      },
      box,
    ),
    true,
  )
  assert.equal(
    geometryIntersectsViewport(
      {
        type: 'LineString',
        coordinates: [
          [120.99, 14.509],
          [121.001, 14.52],
        ],
      },
      box,
    ),
    false,
  )
  const polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [120.9, 14.4],
        [121.1, 14.4],
        [121.1, 14.6],
        [120.9, 14.6],
        [120.9, 14.4],
      ],
      [
        [120.99, 14.49],
        [121.02, 14.49],
        [121.02, 14.52],
        [120.99, 14.52],
        [120.99, 14.49],
      ],
    ],
  }
  assert.equal(geometryIntersectsViewport(polygon, box), false)
  assert.equal(
    geometryIntersectsViewport(
      { ...polygon, coordinates: [polygon.coordinates[0]] },
      box,
    ),
    true,
  )
})

test('viewport query rejects malformed, oversized, out-of-NCR and repeated inputs', () => {
  for (const extra of [
    { bbox: '121,,121.05,14.58' },
    { bbox: '0,0,1,1' },
    { bbox: '120,14,122,15' },
    { bbox: '121.05,14.58,121.02,14.55' },
    { limit: '501' },
    { limit: 'NaN' },
    { category: 'available_spaces' },
    { zoom: 'Infinity' },
  ])
    assert.throws(() => query(extra))
  assert.throws(() =>
    parseNcrQuery(
      new URLSearchParams('bbox=121,14.5,121.1,14.6&zoom=15&zoom=16'),
    ),
  )
  assert.throws(() => query({ preview: 'true' }), /Unsupported/)
})

test('research paging preserves feature roles/nulls and clusters deduplicate facility identities only', () => {
  const first = queryNcrResearch(
    research,
    query({ limit: '2' }),
    queryOptions(),
  )
  assert.equal(first.items.length, 2)
  assert.equal(first.totalMatched, 4)
  assert.equal(first.truncated, true)
  assert.equal(first.items[1].featureType, 'entrance')
  assert.ok(
    first.items.every(
      (item) =>
        item.canNavigate === false &&
        item.pointIsVehicleEntrance === false &&
        item.fees === null &&
        item.capacity === null &&
        item.hours === null &&
        item.liveAvailability === null,
    ),
  )
  const second = queryNcrResearch(
    research,
    query({ limit: '2', cursor: first.nextCursor }),
    queryOptions(),
  )
  assert.deepEqual(
    second.items.map((item) => item.id),
    ['c', 'd'],
  )
  assert.equal(second.truncated, false)
  assert.throws(
    () =>
      queryNcrResearch(
        research,
        query({ limit: '2', category: 'lot', cursor: first.nextCursor }),
        queryOptions(),
      ),
    /Cursor/,
  )
  const overview = queryNcrResearch(
    research,
    query({ zoom: '10' }),
    queryOptions(),
  )
  assert.equal(overview.items.length, 0)
  assert.equal(
    overview.clusters.reduce(
      (sum, cluster) => sum + cluster.sourceObservationCount,
      0,
    ),
    4,
  )
  assert.equal(
    overview.clusters.reduce(
      (sum, cluster) => sum + cluster.facilityCandidateCount,
      0,
    ),
    1,
  )
})

test('public projection excludes unapproved/rejected/expired records before paging, and revocation invalidates cursors', () => {
  const records = [candidate('a'), candidate('b'), candidate('c')],
    source = {
      ...research,
      candidates: records,
      facilityGroups: records.map((record) => ({
        id: 'group:' + record.id,
        sourceCandidateIds: [record.id],
      })),
    }
  let ledger = emptyLedger()
  for (const [index, record] of records.entries())
    ledger = appendPublicationEvent(ledger, approval(record, index), {
      authorizedHuman: true,
      now,
    })
  const options = { ...queryOptions(false), ledger }
  assert.equal(
    queryNcrResearch(source, query(), queryOptions(false)).items.length,
    0,
  )
  const first = queryNcrResearch(source, query({ limit: '1' }), options)
  assert.equal(first.totalMatched, 3)
  assert.equal(first.items[0].evidence.publicationApproved, true)
  assert.equal(
    first.items[0].publicationReview.approvedAt,
    approval(records[0]).recordedAt,
  )
  assert.equal(
    first.items[0].publicationReview.reviewDueAt,
    approval(records[0]).reviewDueAt,
  )
  ledger = appendPublicationEvent(
    ledger,
    {
      eventId: 'revoke-a',
      recordId: 'a',
      action: 'revoke_publication',
      actorKind: 'human_reviewer',
      actorId: 'synthetic-test-reviewer',
      recordedAt: new Date(now - 1000).toISOString(),
      reason: 'Synthetic revocation',
      evidenceReferences: ['test:revoke'],
    },
    { authorizedHuman: true, now },
  )
  assert.throws(
    () =>
      queryNcrResearch(
        source,
        query({ limit: '1', cursor: first.nextCursor }),
        { ...options, ledger },
      ),
    /Cursor/,
  )
  assert.deepEqual(
    queryNcrResearch(source, query(), { ...options, ledger }).items.map(
      (item) => item.id,
    ),
    ['b', 'c'],
  )
  assert.equal(
    queryNcrResearch(source, query(), { ...options, now: now + 2 * 86400000 })
      .items.length,
    0,
  )
})

test('name review annotates all research, but generic names never pass public output', () => {
  const candidateWithNoName = {
    ...candidate('z'),
    name: 'Unnamed parking facility',
  }
  const source = {
    ...research,
    candidates: [candidateWithNoName],
    facilityGroups: [{ id: 'only', sourceCandidateIds: ['z'] }],
  }
  const preview = queryNcrResearch(source, query(), queryOptions())
  assert.equal(preview.totalMatched, 1)
  assert.equal(preview.items[0].nameReview.status, 'unnamed_pending_reference')
  assert.equal(preview.items[0].nameReview.sourceNameIsDistinctive, false)
  assert.equal(preview.items[0].nameReview.crossSourceCandidate, false)
  const approvedLedger = appendPublicationEvent(
    emptyLedger(),
    approval(candidateWithNoName),
    {
      authorizedHuman: true,
      now,
    },
  )
  const publicState = queryNcrResearch(source, query(), {
    ...queryOptions(false),
    ledger: approvedLedger,
  })
  assert.equal(publicState.totalMatched, 0)
  assert.equal(publicState.items.length, 0)
  assert.deepEqual(source.candidates, [candidateWithNoName])
})

test('actual frozen 5,427 observations cannot appear in the public projection', () => {
  const source = loadFrozenResearch('data/ncr-research')
  const review = JSON.parse(
    readFileSync('data/ncr-research/review-ledger.json', 'utf8'),
  )
  const result = queryNcrResearch(
    source,
    parseNcrQuery(
      new URLSearchParams({ bbox: '120.85,14.30,121.27,14.86', zoom: '10' }),
    ),
    {
      ledger: JSON.parse(
        readFileSync('data/ncr-research/publication-ledger.json', 'utf8'),
      ),
      reviewLedger: review,
      preview: false,
      now: Date.now(),
    },
  )
  assert.equal(source.candidates.length, 5427)
  assert.equal(result.totalMatched, 0)
  assert.deepEqual(result.items, [])
  assert.deepEqual(result.clusters, [])
})

async function start(t, options = {}) {
  const server = createServer(
    createNcrHandler({
      research,
      loadPublicationLedger: emptyLedger,
      loadReviewLedger: () => reviewLedger(research.sourceHashes),
      developmentPreview: true,
      now: () => now,
      ...options,
    }),
  )
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections()
        server.close(resolve)
      }),
  )
  return `http://127.0.0.1:${server.address().port}`
}
const path = '/api/ncr/research-preview?bbox=121.02,14.55,121.05,14.58&zoom=15'

test('HTTP enrichment is private and mismatched attachments fail closed', async (t) => {
  const enrichment = enrichmentReport()
  const url = await start(t, { enrichment })
  const privateResponse = await globalThis.fetch(url + path, {
    headers: { 'X-Parkey-Research-Preview': 'local-development' },
  })
  assert.equal(privateResponse.status, 200)
  const body = await privateResponse.json()
  assert.equal(body.items[0].nameReview.enrichment.groupId, 'one')
  enrichment.sourceHashes = { different: 'snapshot' }
  const invalidResponse = await globalThis.fetch(url + path, {
    headers: { 'X-Parkey-Research-Preview': 'local-development' },
  })
  assert.equal(invalidResponse.status, 503)
  assert.deepEqual(await invalidResponse.json(), {
    error: 'Research review data is unavailable; no records were released.',
  })
  const publicResponse = await globalThis.fetch(
    url + path.replace('research-preview', 'discovery'),
  )
  assert.equal(publicResponse.status, 200)
  assert.equal((await publicResponse.json()).totalMatched, 0)
})

test('HTTP research endpoint requires explicit development opt-in and excludes remote origins', async (t) => {
  const url = await start(t)
  assert.equal((await globalThis.fetch(url + path)).status, 403)
  assert.equal(
    (
      await globalThis.fetch(url + path, {
        headers: {
          'X-Parkey-Research-Preview': 'local-development',
          Origin: 'https://attacker.example',
        },
      })
    ).status,
    403,
  )
  // Undici rewrites Host to the URL authority; use the actual HTTP transport to
  // exercise the DNS-rebinding/Host guard rather than test a rewritten request.
  const hostileHostStatus = await new Promise((resolve, reject) => {
    const request = httpRequest(
      url + path,
      {
        headers: {
          'X-Parkey-Research-Preview': 'local-development',
          Host: 'attacker.example',
        },
      },
      (response) => {
        response.resume()
        resolve(response.statusCode)
      },
    )
    request.on('error', reject)
    request.end()
  })
  assert.equal(hostileHostStatus, 403)
  const allowed = await globalThis.fetch(url + path, {
    headers: {
      'X-Parkey-Research-Preview': 'local-development',
      Origin: 'http://localhost:8088',
    },
  })
  assert.equal(allowed.status, 200)
  assert.equal(allowed.headers.get('cache-control'), 'no-store, max-age=0')
  assert.equal(
    allowed.headers.get('access-control-allow-origin'),
    'http://localhost:8088',
  )
  assert.equal((await allowed.json()).items.length, 4)
  const publicResult = await globalThis.fetch(
    url + path.replace('research-preview', 'discovery'),
  )
  assert.equal((await publicResult.json()).items.length, 0)
  assert.equal(
    (await globalThis.fetch(url + path, { method: 'POST' })).status,
    405,
  )
  const disabled = await start(t, { developmentPreview: false })
  assert.equal(
    (
      await globalThis.fetch(disabled + path, {
        headers: { 'X-Parkey-Research-Preview': 'local-development' },
      })
    ).status,
    403,
  )
})

test('tampered/mismatched ledgers fail closed at the HTTP boundary', async (t) => {
  const url = await start(t, {
    loadReviewLedger: () => ({
      ...reviewLedger({ different: 'snapshot' }),
      issues: [{}],
    }),
  })
  const result = await globalThis.fetch(
    url + path.replace('research-preview', 'discovery'),
  )
  assert.equal(result.status, 503)
  const body = await result.json()
  assert.ok(!JSON.stringify(body).includes('Synthetic parking'))
  const mismatch = await start(t, {
    loadReviewLedger: () => reviewLedger({ different: 'snapshot' }),
  })
  assert.equal(
    (
      await globalThis.fetch(
        mismatch + path.replace('research-preview', 'discovery'),
      )
    ).status,
    503,
  )
})

test('a production runtime cannot opt into the private research endpoint', async (t) => {
  const url = await start(t)
  const previous = process.env.NODE_ENV
  try {
    process.env.NODE_ENV = 'production'
    const result = await globalThis.fetch(url + path, {
      headers: { 'X-Parkey-Research-Preview': 'local-development' },
    })
    assert.equal(result.status, 403)
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previous
  }
})
