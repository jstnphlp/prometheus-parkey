import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'

import { AUDIT_AS_OF, auditParking, contentHash } from './audit-parking.mjs'
import { buildReviewQueue, validateResearch } from './parking-review-queue.mjs'

const { structuredClone } = globalThis

const snapshot = JSON.parse(
  readFileSync(
    new URL('../apps/mobile/src/discovery/osm-pilot.json', import.meta.url),
    'utf8',
  ),
)
const candidate = {
  id: 'test:candidate',
  name: 'Synthetic test candidate',
  kind: 'lot',
  coordinate: null,
  status: 'researched',
  confidence: 'low',
  confidenceReason: 'Synthetic unit fixture, not a real parking claim.',
  sourceKind: 'first_party',
  sourceUrl: 'https://example.org/parking',
  license: 'Reference only; no reuse permission claimed.',
  observedAt: '2026-11-02T00:00:00Z',
  evidence: 'Synthetic evidence for validation only.',
  fieldVerifiedAt: null,
  fees: null,
  hours: null,
  entrance: null,
  rejectionReason: null,
}
const research = { schemaVersion: 1, candidates: [candidate] }

test('baseline audit counts missing fields without treating snapshot age as field evidence', () => {
  const audit = auditParking(snapshot)
  assert.equal(audit.records, 43)
  assert.deepEqual(audit.kinds, { lot: 35, garage: 2, street: 6 })
  assert.deepEqual(audit.missing, {
    address: 35,
    fees: 41,
    hours: 43,
    facilityEntrances: 36,
    osmEditedAt: 0,
    checkDate: 43,
  })
  assert.equal(audit.independentlyVerified, 0)
  assert.equal(audit.snapshotOlderThan30Days, 0)
  assert.equal(audit.osmEditOlderThan365Days, 34)
  assert.equal(audit.osmEditOlderThan730Days, 25)
  assert.deepEqual(audit.access, {
    private: 3,
    customers: 7,
    no: 0,
    unknown: 33,
    other: 0,
  })
  assert.equal(audit.sourceUrls, 43)
  assert.equal(audit.nearbyFacilitiesWithin30m, 0)
  assert.equal(audit.verticesOutsidePilot, 5)
  assert.equal(audit.recordsWithVerticesOutsidePilot.length, 2)
  assert.equal(audit.asOf, AUDIT_AS_OF)
})

test('audit reports invalid source identities, geography and dates instead of hiding them', () => {
  for (const patch of [
    { id: 'fake:1' },
    { sourceUrl: 'https://example.org/parking' },
    { sourceUpdatedAt: '2099-01-01T00:00:00Z' },
    { geometry: { type: 'Point', coordinates: [14.56, 121.03] } },
    { verification: 'verified', verifiedAt: '2026-11-01T00:00:00Z' },
  ]) {
    assert.throws(() => auditParking([{ ...snapshot[0], ...patch }]))
  }
  assert.throws(() => auditParking([snapshot[0], snapshot[0]]))
  assert.throws(() => auditParking([], 'bad-date'))
})

test('audit as-of and hashes make reports reproducible and changes detectable', () => {
  assert.deepEqual(
    auditParking(snapshot),
    auditParking(structuredClone(snapshot)),
  )
  assert.equal(
    contentHash(snapshot),
    contentHash(JSON.parse(JSON.stringify(snapshot))),
  )
  const changed = structuredClone(snapshot)
  changed[0].name += ' changed'
  assert.notEqual(contentHash(snapshot), contentHash(changed))
  assert.equal(
    auditParking(snapshot, '2027-01-01T00:00:00Z').snapshotOlderThan30Days,
    43,
  )
})

test('queue keeps every source identity, research confidence never becomes verification', () => {
  const queue = buildReviewQueue(snapshot, research)
  assert.deepEqual(queue.counts, {
    researched: 44,
    verified: 0,
    rejected: 0,
    bundled: 43,
    additionalCandidates: 1,
  })
  assert.equal(new Set(queue.researched.map((record) => record.id)).size, 44)
  assert.equal(
    queue.researched.find((record) => record.id === candidate.id).coordinate,
    null,
  )
  assert.equal(
    queue.researched.filter((record) =>
      record.flags.includes('restricted_access_requires_review'),
    ).length,
    10,
  )
  assert.deepEqual(queue.verified, [])
  assert.deepEqual(
    queue,
    buildReviewQueue(structuredClone(snapshot), structuredClone(research)),
  )
})

test('rejection requires an explicit reason and stays out of researched queue', () => {
  const rejected = {
    ...candidate,
    status: 'rejected',
    rejectionReason: 'Synthetic fixture: outside pilot.',
  }
  const queue = buildReviewQueue(snapshot, {
    schemaVersion: 1,
    candidates: [rejected],
  })
  assert.equal(queue.rejected.length, 1)
  assert.equal(queue.researched.length, 43)
  assert.throws(() =>
    validateResearch({
      schemaVersion: 1,
      candidates: [{ ...rejected, rejectionReason: null }],
    }),
  )
})

test('candidate ingestion rejects verification, fabricated facts and unsupported provenance', () => {
  for (const patch of [
    { status: 'verified' },
    { fieldVerifiedAt: '2026-11-02T00:00:00Z' },
    { fees: 'Free' },
    { hours: '24/7' },
    { entrance: [121.03, 14.56] },
    { coordinate: [14.56, 121.03] },
    { observedAt: '2099-01-01' },
    { sourceUrl: 'javascript:alert(1)' },
    { sourceUrl: 'https://private:password@example.org' },
    { license: '' },
    { evidence: '' },
    { confidenceReason: '' },
  ])
    assert.throws(() =>
      validateResearch({
        schemaVersion: 1,
        candidates: [{ ...candidate, ...patch }],
      }),
    )
})

test('queue detects collisions within research and against the bundled snapshot', () => {
  assert.throws(() =>
    validateResearch({ schemaVersion: 1, candidates: [candidate, candidate] }),
  )
  assert.throws(() =>
    buildReviewQueue(snapshot, {
      schemaVersion: 1,
      candidates: [{ ...candidate, id: snapshot[0].id }],
    }),
  )
  assert.throws(() =>
    buildReviewQueue(snapshot, {
      schemaVersion: 1,
      candidates: [{ ...candidate, sourceUrl: snapshot[0].sourceUrl }],
    }),
  )
})

test('same-day refresh accepts an explicit audit reference after the new observation', () => {
  const refreshed = structuredClone(snapshot)
  refreshed[0].sourceUpdatedAt = '2026-11-03T11:00:00Z'
  assert.equal(auditParking(refreshed, '2026-11-03T11:01:00Z').records, 43)
  assert.throws(() => auditParking(refreshed, AUDIT_AS_OF), /snapshot date/)
  assert.throws(() => auditParking(snapshot, '2026-02-30T00:00:00Z'))
})

test('OSM research validates calendar, edit chronology, version and canonical evidence URL', () => {
  const osm = {
    ...candidate,
    id: 'research:osm:node/1',
    sourceKind: 'osm',
    sourceUrl: 'https://www.openstreetmap.org/node/1',
    license: 'ODbL-1.0',
    sourceVersion: 2,
    osmEditedAt: '2026-11-01T00:00:00Z',
    evidenceDetails: {
      versionUrl: 'https://api.openstreetmap.org/api/0.6/node/1/2',
    },
  }
  assert.equal(
    validateResearch({ schemaVersion: 1, candidates: [osm] }).length,
    1,
  )
  for (const patch of [
    { observedAt: '2026-02-30T00:00:00Z' },
    { observedAt: '2026-11-02' },
    { osmEditedAt: '2099-99-99' },
    { osmEditedAt: '2026-11-03T00:00:00Z' },
    { sourceVersion: 0 },
    { sourceVersion: 1.5 },
    {
      evidenceDetails: {
        versionUrl: 'https://api.openstreetmap.org/api/0.6/node/2/2',
      },
    },
    { coordinate: [120, 14] },
  ])
    assert.throws(() =>
      validateResearch({
        schemaVersion: 1,
        candidates: [{ ...osm, ...patch }],
      }),
    )
  assert.equal(
    validateResearch({
      schemaVersion: 1,
      candidates: [
        {
          ...osm,
          coordinate: [120, 14],
          status: 'rejected',
          rejectionReason: 'Outside pilot.',
        },
      ],
    }).length,
    1,
  )
})
