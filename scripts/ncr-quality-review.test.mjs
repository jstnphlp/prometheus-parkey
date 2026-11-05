import assert from 'node:assert/strict'
import test from 'node:test'

import {
  appendReviewEvent,
  buildQualityFindings,
  updateReviewLedger,
  validateReviewLedger,
} from './ncr-quality-review.mjs'

const square = {
  type: 'Polygon',
  coordinates: [
    [
      [121, 14.5],
      [121.01, 14.5],
      [121.01, 14.51],
      [121, 14.51],
      [121, 14.5],
    ],
  ],
}
const candidate = (id, patch = {}) => ({
  id,
  name: id,
  type: 'lot',
  geometry: square,
  representativePoint: [121.005, 14.505],
  sourceKind: 'osm',
  sourceRecordUrl: 'https://www.openstreetmap.org/way/1',
  sourceLicense: 'ODbL-1.0',
  sourceProviders: [],
  sourceTags: { amenity: 'parking', parking: 'surface' },
  sourceRecordEditedAt: '2020-01-01T00:00:00Z',
  accessClass: 'unknown',
  flags: [],
  ...patch,
})
const base = (records, pairs = [], groups = []) => ({
  sourceHashes: { osm: 'test' },
  sourceAsOf: '2026-11-05T00:00:00Z',
  candidates: records,
  duplicateReviewPairs: pairs,
  facilityGroups: groups,
})

test('proximity and containment stay unresolved; shared source identity can resolve only the source duplicate', () => {
  const a = candidate('a'),
    b = candidate('b')
  const pairs = [{ firstId: 'a', secondId: 'b', meters: 0, basis: 'inside' }]
  let findings = buildQualityFindings(base([a, b], pairs))
  assert.equal(findings.summary.duplicatePairsRequiringHumanReview, 1)
  const source = [{ dataset: 'meta', record_id: 'same-source' }]
  const group = {
    id: 'g',
    sourceCandidateIds: ['a', 'b'],
    flags: [],
    maximumLocationSpreadMeters: 0,
  }
  findings = buildQualityFindings(
    base(
      [
        { ...a, sourceProviders: source },
        { ...b, sourceProviders: source },
      ],
      pairs,
      [group],
    ),
  )
  assert.equal(findings.summary.duplicatePairsResolvedBySourceIdentity, 1)
  assert.equal(findings.summary.physicallyVerified, 0)
  assert.equal(
    findings.issues.find((i) => i.kind === 'candidate_evidence_gap')
      .blockingPublicDisplay,
    true,
  )
  group.flags = ['shared_identity_location_conflict']
  group.maximumLocationSpreadMeters = 400
  findings = buildQualityFindings(
    base(
      [
        { ...a, sourceProviders: source },
        { ...b, sourceProviders: source },
      ],
      pairs,
      [group],
    ),
  )
  assert.equal(findings.summary.duplicatePairsResolvedBySourceIdentity, 0)
  assert.equal(findings.summary.conflictingProviderGroupsInvestigated, 1)
})

test('child geometry creates proposals without turning bays/entrances into independent facilities', () => {
  const facility = candidate('facility'),
    entrance = candidate('entrance', {
      type: 'entrance',
      geometry: { type: 'Point', coordinates: [121.005, 14.505] },
    })
  const findings = buildQualityFindings(base([facility, entrance]))
  assert.deepEqual(findings.relationships[0].parentCandidateIds, ['facility'])
  assert.equal(
    findings.relationships[0].status,
    'parent_match_proposed_not_confirmed',
  )
  assert.equal(findings.relationships[0].changesFacilityCount, false)
  assert.equal(findings.summary.confirmedPhysicalRelationships, 0)
})

test('regeneration preserves append-only events and rejects issue or event tampering', () => {
  const research = base([candidate('a')])
  const { ledger } = updateReviewLedger(research)
  const recorded = appendReviewEvent(ledger, {
    issueId: ledger.issues[0].id,
    action: 'record_field_submission',
    actor: 'submission-import',
    observedAt: '2026-11-05T00:00:00Z',
    evidenceReference: 'internal:submission-1',
  })
  assert.deepEqual(updateReviewLedger(research, recorded).ledger, recorded)
  const catalog = globalThis.structuredClone(recorded)
  catalog.issues[0].reasons.push('fabricated')
  assert.throws(() => validateReviewLedger(catalog), /catalog integrity/)
  const event = globalThis.structuredClone(recorded)
  event.events[0].actor = 'changed'
  assert.throws(() => validateReviewLedger(event), /audit-chain integrity/)
  assert.throws(
    () =>
      appendReviewEvent(ledger, {
        issueId: ledger.issues[0].id,
        action: 'approve_publication',
        actor: 'bot',
        observedAt: '2026-11-05T00:00:00Z',
        evidenceReference: 'fake',
      }),
    /Unsupported/,
  )
})

test('refresh adds evidence versions and retains prior decisions rather than silently editing old issues', () => {
  const original = base([candidate('a')])
  const { ledger } = updateReviewLedger(original)
  const changed = {
    ...original,
    sourceHashes: { osm: 'changed' },
    candidates: [
      candidate('a', { accessClass: 'private', restrictedAccess: true }),
    ],
  }
  const refreshed = updateReviewLedger(changed, ledger).ledger
  assert.ok(refreshed.issues.some((i) => i.id === ledger.issues[0].id))
  assert.equal(refreshed.sourceSnapshots.length, 2)
  assert.equal(refreshed.issues.length, 2)
})
