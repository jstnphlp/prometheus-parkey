import assert from 'node:assert/strict'
import test from 'node:test'

import {
  appendPublicationEvent,
  contentHash,
  publicationState,
  validatePublicationLedger,
} from './ncr-publication.mjs'

const now = Date.parse('2026-11-05T12:00:00.000Z')
const empty = () => ({ schemaVersion: 1, events: [] })
const record = (id = 'osm:node/1:Point') => ({
  id,
  type: 'lot',
  accessClass: 'unknown',
  restrictedAccess: false,
  flags: [],
  sourceLicense: 'ODbL-1.0',
  sourceProviders: [
    { dataset: 'OpenStreetMap', record_id: id, license: 'ODbL-1.0' },
  ],
  researchStatus: 'researched',
  onlineCorroborated: false,
  operatingStatus: 'unknown',
})
const approval = (candidate) => ({
  eventId: 'approval-' + candidate.id,
  recordId: candidate.id,
  action: 'approve_publication',
  actorKind: 'human_reviewer',
  actorId: 'synthetic-test-reviewer',
  recordedAt: '2026-11-05T10:00:00.000Z',
  reason: 'Synthetic test approval; no actual record approved.',
  evidenceReferences: ['test:synthetic-access-license-safety-review'],
  recordHash: contentHash(candidate),
  reviewDueAt: '2026-11-12T10:00:00.000Z',
  scope: 'unverified_discovery',
  approvedFields: ['name', 'geometry', 'source', 'evidence', 'access'],
  licenseApproved: true,
  accessApproved: true,
  safetyApproved: true,
  accessDecision: 'public_visitor_access',
})
const append = (ledger, event) =>
  appendPublicationEvent(ledger, event, { authorizedHuman: true, now })

test('publication or rejection payloads cannot fabricate evidence badges', () => {
  const candidate = record()
  for (const action of [
    'approve_publication',
    'reject',
    'revoke_publication',
  ]) {
    for (const evidenceKind of [
      'physically_verified',
      'operator_confirmed',
      'online_corroborated',
    ])
      assert.throws(
        () => append(empty(), { ...approval(candidate), action, evidenceKind }),
        /record_evidence/,
      )
  }
  const state = publicationState(
    candidate,
    append(empty(), approval(candidate)),
    { now },
  )
  assert.equal(state.evidence.publicationApproved, true)
  assert.equal(state.evidence.physicallyVerified, false)
  assert.equal(state.evidence.operatorConfirmed, false)
  assert.equal(state.evidence.onlineCorroborated, false)
})

test('source verification/publication booleans cannot grant permission without a human ledger', () => {
  const candidate = {
    ...record(),
    publicationApproved: true,
    verification: 'verified',
  }
  const state = publicationState(candidate, empty(), { now })
  assert.equal(state.eligible, false)
  assert.equal(state.evidence.publicationApproved, false)
  assert.equal(state.evidence.physicallyVerified, false)
  assert.throws(
    () => appendPublicationEvent(empty(), approval(candidate)),
    /accountable human/,
  )
})

test('field-scoped approval expires, binds the source revision and remains separate from physical evidence', () => {
  const candidate = record(),
    ledger = append(empty(), approval(candidate))
  const state = publicationState(candidate, ledger, { now })
  assert.equal(state.eligible, true)
  assert.equal(state.evidence.publicationApproved, true)
  assert.equal(state.evidence.physicallyVerified, false)
  assert.ok(
    publicationState(candidate, ledger, {
      now: now + 8 * 86400000,
    }).reasons.includes('review_expired'),
  )
  assert.ok(
    publicationState({ ...candidate, name: 'Changed source' }, ledger, {
      now,
    }).reasons.includes('source_revision_needs_review'),
  )
  for (const patch of [
    { licenseApproved: false },
    { accessApproved: false },
    { safetyApproved: false },
    { approvedFields: ['name'] },
    { reviewDueAt: '2027-12-05T10:00:00.000Z' },
  ])
    assert.throws(
      () => append(empty(), { ...approval(candidate), ...patch }),
      /approval requires/,
    )
})

test('restricted, customer-only, closed, prohibited, child and street records cannot bypass hard exclusions', () => {
  for (const patch of [
    { accessClass: 'private' },
    { accessClass: 'no' },
    { accessClass: 'permit' },
    { accessClass: 'customers' },
    { accessClass: 'delivery' },
    { restrictedAccess: true },
    { operatingStatus: 'permanently_closed' },
    { flags: ['unsafe'] },
    { flags: ['prohibited'] },
    { flags: ['prior_human_exclusion_requires_resolution'] },
    { type: 'space' },
    { type: 'entrance' },
    { type: 'street_segment' },
    { sourceLicense: 'unknown' },
    { sourceProviders: [{ dataset: 'unknown', license: null }] },
  ]) {
    const candidate = { ...record(), ...patch },
      ledger = append(empty(), approval(candidate))
    assert.equal(
      publicationState(candidate, ledger, { now }).eligible,
      false,
      JSON.stringify(patch),
    )
  }
})

test('revocation/rejection win over evidence events and audit changes are rejected', () => {
  const candidate = record()
  let ledger = append(empty(), approval(candidate))
  ledger = append(ledger, {
    eventId: 'revocation',
    recordId: candidate.id,
    action: 'revoke_publication',
    actorKind: 'human_reviewer',
    actorId: 'synthetic-test-reviewer',
    recordedAt: '2026-11-05T11:00:00.000Z',
    reason: 'Synthetic conflict found',
    evidenceReferences: ['test:revoke'],
  })
  ledger = append(ledger, {
    eventId: 'field-evidence',
    recordId: candidate.id,
    action: 'record_evidence',
    actorKind: 'human_reviewer',
    actorId: 'synthetic-test-reviewer',
    recordedAt: '2026-11-05T11:01:00.000Z',
    reason: 'Synthetic observed fact',
    evidenceReferences: ['test:visit'],
    evidenceKind: 'physically_verified',
    observedAt: '2026-11-05T10:59:00.000Z',
    facts: ['entrance observation'],
  })
  const state = publicationState(candidate, ledger, { now })
  assert.equal(state.evidence.physicallyVerified, true)
  assert.equal(state.eligible, false)
  assert.ok(state.reasons.includes('revoke_publication'))
  const changed = globalThis.structuredClone(ledger)
  changed.events[0].reason = 'Altered history'
  assert.throws(() => validatePublicationLedger(changed, now), /chain changed/)
})

test('unresolved review catalog issues block even an otherwise valid approval', () => {
  const candidate = record(),
    ledger = append(empty(), approval(candidate))
  const state = publicationState(candidate, ledger, {
    now,
    issues: [
      {
        id: 'conflict',
        candidateIds: [candidate.id],
        status: 'human_review_required',
        blockingPublicDisplay: true,
      },
    ],
  })
  assert.equal(state.eligible, false)
  assert.deepEqual(state.reviewIssueIds, ['conflict'])
})
