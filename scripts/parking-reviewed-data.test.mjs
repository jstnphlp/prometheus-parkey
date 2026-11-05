import assert from 'node:assert/strict'
import test from 'node:test'
import { buildReviewedParkingData } from './parking-reviewed-data.mjs'

const sourceAsOf = '2026-11-03T13:23:54Z'
const sourceHashes = { bundledOsm: 'bundled-test', overture: 'geojson-test' }
const existing = [
  { id: 'osm:node/1', name: 'Unnamed parking · OpenStreetMap', kind: 'lot',
    geometry: { type: 'Point', coordinates: [121.030, 14.560] } },
]
const feature = (id, name, lon, lat) => ({
  type: 'Feature',
  properties: { id, name, basic_category: 'parking', confidence: 0.5 },
  geometry: { type: 'Point', coordinates: [lon, lat] },
})
const geojson = {
  type: 'FeatureCollection',
  features: [
    feature('a', 'A Parking', 121.03001, 14.56001),
    feature('b', 'B Parking', 121.036, 14.566),
    feature('c', 'C Parking', 121.037, 14.567),
  ],
}
const makeDecision = (id, name, reviewStatus, overrides = {}) => ({
  id: 'overture:' + id,
  sourceName: name,
  reviewStatus,
  reviewedOn: '2026-11-03',
  method: reviewStatus === 'online_corroborated' ? 'google_maps_name_search' : null,
  evidenceReference: null,
  evidenceNote: 'User review notes',
  siteVisitAt: null,
  publicationApproved: false,
  ...overrides,
})
const sharedPin = 'https://www.google.com/maps/place/Test/@14.56001,121.03001,17z/data=!4m4!3m3!8m2!3d14.56001!4d121.03001'
const ledger = {
  schemaVersion: 1,
  decisions: [
    makeDecision('a', 'A Parking', 'online_corroborated', {
      siteVisitRequired: true, siteVisitReferenceUrl: sharedPin,
    }),
    makeDecision('b', 'B Parking', 'needs_site_visit'),
    makeDecision('c', 'C Parking', 'excluded_pending_reason'),
  ],
}
const run = (overrides = {}) => buildReviewedParkingData({
  existing, geojson, ledger, sourceAsOf, sourceHashes, ...overrides,
})

test('retains online corroboration without turning it into field verification', () => {
  const result = run()
  assert.deepEqual(result.counts, {
    existing: 1,
    existingUnnamed: 1,
    sourceCandidates: 3,
    retainedForReview: 2,
    onlineCorroborated: 1,
    needsSiteVisit: 1,
    siteVisitQueue: 2,
    siteVisitReferenceLinks: 1,
    excludedPendingReason: 1,
    potentialNewFacilities: 1,
    potentiallyMatchingUnnamed: 1,
    unknownLicense: 3,
    physicallyVerified: 0,
    publicationApproved: 0,
  })
  assert.equal(result.candidates.length, 3)
  const matched = result.candidates.find((c) => c.id === 'overture:a')
  assert.equal(matched.reviewDecision.method, 'google_maps_name_search')
  assert.equal(matched.reviewDecision.siteVisitRequired, true)
  assert.equal(matched.reviewDecision.siteVisitReferenceUrl, sharedPin)
  assert.equal(result.candidates.find((c) => c.id === 'overture:b').reviewDecision.siteVisitRequired, true)
  assert.equal(matched.verification, 'unverified')
  assert.equal(matched.verifiedAt, null)
  assert.equal(matched.reviewDecision.publicationApproved, false)
  assert.equal(matched.possibleBundledMatches[0].id, 'osm:node/1')
  assert.equal(result.candidates.find((c) => c.id === 'overture:c').reviewDecision.status,
    'excluded_pending_reason')
})

test('rejects missing, duplicate, unauthorized or fabricated human decisions', () => {
  const bad = (patch) => ({ ...ledger, decisions: ledger.decisions.map((x, i) =>
    i === 0 ? { ...x, ...patch } : x) })
  for (const patch of [
    { sourceName: 'Invented Place' },
    { reviewStatus: 'physically_verified' },
    { reviewedOn: '2027-12-31' },
    { method: 'site_visit' },
    { siteVisitAt: '2026-11-03T12:00:00Z' },
    { publicationApproved: true },
    { evidenceReference: 'https://google.com/maps' },
    { evidenceNote: '' },
    { siteVisitRequired: 'yes' },
    { siteVisitReferenceUrl: 'https://www.google.com/maps/place/Test/data=!4m4!3m3!8m2!3d14.5700!4d121.0400' },
    { siteVisitReferenceUrl: 'https://evil.example/maps/place/Test/data=!4m4!3m3!8m2!3d14.56001!4d121.03001' },
    { siteVisitRequired: false, siteVisitReferenceUrl: sharedPin },
  ]) assert.throws(() => run({ ledger: bad(patch) }))
  assert.throws(() => run({ ledger: { ...ledger, decisions: ledger.decisions.slice(1) } }),
    /every Overture source candidate/)
  assert.throws(() => run({ ledger: { ...ledger,
    decisions: [ledger.decisions[0], ...ledger.decisions] } }),
    /Invalid or mismatched/)
})

test('rejects a new candidate without a matching decision; preserves source inputs', () => {
  const original = JSON.stringify({ existing, geojson, ledger })
  const other = structuredClone(geojson)
  other.features.push(feature('d', 'D Parking', 121.038, 14.568))
  assert.throws(() => run({ geojson: other }), /every Overture source candidate/)
  assert.equal(JSON.stringify({ existing, geojson, ledger }), original)
})

test('review output is deterministic and never labels online checks as live parking availability', () => {
  assert.deepEqual(run(), run())
  assert.ok(run().candidates.every((x) =>
    x.fees === null && x.hours === null && x.access === null &&
    x.verification === 'unverified'))
})

test('site-visit pins are only navigation aids, never a claim of field verification', () => {
  const item = run().candidates.find((c) => c.id === 'overture:a')
  assert.equal(item.reviewDecision.status, 'online_corroborated')
  assert.equal(item.reviewDecision.siteVisitAt, null)
  assert.equal(item.verifiedAt, null)
  assert.equal(item.reviewDecision.publicationApproved, false)
  assert.equal(run().counts.physicallyVerified, 0)
})
