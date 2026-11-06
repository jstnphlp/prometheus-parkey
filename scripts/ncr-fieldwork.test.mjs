import assert from 'node:assert/strict'
import test from 'node:test'
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  openSync,
  closeSync,
  unlinkSync,
  existsSync,
  readdirSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  buildFieldwork,
  csvCell,
  navigationSearchLink,
} from './ncr-fieldwork.mjs'
import {
  reconcileFieldSubmission,
  validateFieldSubmission,
  persistFieldSubmission,
} from './ncr-fieldwork-submit.mjs'
import { updateReviewLedger, digest } from './ncr-quality-review.mjs'

const candidate = {
  id: 'osm:node/1:Point',
  name: 'Synthetic fieldwork fixture',
  type: 'facility_unspecified',
  geometry: { type: 'Point', coordinates: [121.03, 14.567] },
  representativePoint: [121.03, 14.567],
  sourceKind: 'osm',
  sourceRecordUrl: 'https://www.openstreetmap.org/node/1',
  sourceLicense: 'ODbL-1.0',
  sourceProviders: [],
  sourceTags: { amenity: 'parking' },
  sourceRecordEditedAt: '2020-01-01T00:00:00Z',
  accessClass: 'unknown',
  flags: [],
  lgus: ['Makati'],
  researchStatus: 'online_corroborated',
  verification: 'unverified',
  priorHumanReview: {
    reviewStatus: 'online_corroborated',
    siteVisitRequired: true,
    siteVisitReferenceUrl: 'owner-original-reference',
    publicationApproved: false,
  },
}
const research = {
  sourceHashes: { osm: 'synthetic' },
  sourceAsOf: '2026-11-05T00:00:00Z',
  candidates: [candidate],
  duplicateReviewPairs: [],
  facilityGroups: [],
}
const ledger = updateReviewLedger(research).ledger
const checklist = buildFieldwork(research, ledger)
const valid = {
  schemaVersion: 1,
  status: 'submitted_unreviewed',
  candidateId: candidate.id,
  sourceHashes: research.sourceHashes,
  observerReference: 'synthetic-test-observer',
  observedAt: '2026-11-05T00:01:00Z',
  attestedOnSite: true,
  privacyReviewed: true,
  facts: {
    existence: 'exists',
    access: 'unknown',
    operation: 'unknown',
    entranceCoordinates: null,
    ratesText: null,
    hoursText: null,
    operatorEvidence: null,
    signageText: null,
  },
  notes: 'Synthetic test fixture only; no actual site visit occurred.',
  photos: [],
}
const now = Date.parse('2026-11-05T00:05:00Z')

test('fieldwork retains owner visit requirements and constructs navigation only from permitted source coordinates', () => {
  assert.equal(checklist.summary.legacyOwnerVisitTasks, 1)
  assert.equal(checklist.summary.ownerNavigationReferences, 1)
  const task = checklist.tasks[0]
  assert.equal(task.ownerNavigationReference, 'owner-original-reference')
  assert.equal(task.researchStatus, 'online_corroborated')
  assert.equal(task.verificationStatus, 'unverified')
  assert.equal(task.publicationApproved, false)
  assert.equal(
    task.navigationSearchUrl,
    'https://www.google.com/maps/search/?api=1&query=14.567%2C121.03',
  )
  assert.ok(task.questionKeys.includes('entrance'))
  assert.ok(
    checklist.routes[0].distanceCaveat.includes(
      'not walking/driving directions',
    ),
  )
  assert.throws(() => navigationSearchLink([121, 95]), /invalid source/)
  assert.equal(csvCell('=untrusted()'), '"\'=untrusted()"')
})

test('empty, future, invented approval or missing on-site attestation cannot enter the reconciliation queue', () => {
  for (const patch of [
    { notes: '' },
    { attestedOnSite: false },
    { privacyReviewed: false },
    { observedAt: '2099-01-01T00:00:00Z' },
    { publicationApproved: true },
    { status: 'physically_verified' },
    { candidateId: 'unknown' },
  ])
    assert.throws(() =>
      validateFieldSubmission({ ...valid, ...patch }, checklist, now),
    )
  assert.throws(
    () =>
      validateFieldSubmission(
        { ...valid, facts: { ...valid.facts, liveAvailability: 12 } },
        checklist,
        now,
      ),
    /Unsupported fact/,
  )
  assert.throws(
    () =>
      validateFieldSubmission(
        {
          ...valid,
          photos: [
            {
              id: 'x',
              caption: 'bad external photo',
              dataUrl: 'https://example.com/photo.png',
            },
          ],
        },
        checklist,
        now,
      ),
    /bounded locally/,
  )
})

test('a valid observer submission appends an unreviewed receipt, never a verification or publication approval', () => {
  const result = reconcileFieldSubmission(ledger, checklist, valid, now)
  assert.equal(result.receipt.status, 'received_pending_human_reconciliation')
  assert.equal(result.receipt.verificationStatus, 'unverified')
  assert.equal(result.receipt.publicationApproved, false)
  assert.equal(result.ledger.events.length, 1)
  assert.deepEqual(result.ledger.issues, ledger.issues)
  assert.equal(ledger.events.length, 0)
  assert.throws(
    () => reconcileFieldSubmission(result.ledger, checklist, valid, now),
    /already reconciled/,
  )
})

test('persistent import serializes writers and recovers archived/partial submissions idempotently', () => {
  const directory = mkdtempSync(join(tmpdir(), 'parkey-fieldwork-'))
  const output = join(directory, 'private')
  writeFileSync(join(directory, 'review-ledger.json'), JSON.stringify(ledger))
  writeFileSync(
    join(directory, 'fieldwork-checklist.json'),
    JSON.stringify(checklist),
  )
  const lockPath = join(directory, 'review-ledger.json.lock'),
    lock = openSync(lockPath, 'wx')
  try {
    assert.throws(
      () => persistFieldSubmission(directory, output, valid, now),
      /locked/,
    )
  } finally {
    closeSync(lock)
    unlinkSync(lockPath)
  }
  const first = persistFieldSubmission(directory, output, valid, now)
  const retry = persistFieldSubmission(directory, output, valid, now)
  assert.deepEqual(first.receipt, retry.receipt)
  assert.equal(retry.ledger.events.length, 1)
  assert.equal(existsSync(lockPath), false)
  // Simulate interruption after immutable evidence archive, before ledger commit.
  const second = {
    ...valid,
    notes: 'Another synthetic test observation, never an actual site visit.',
  }
  writeFileSync(join(output, digest(second) + '.json'), JSON.stringify(second))
  assert.equal(
    persistFieldSubmission(directory, output, second, now).ledger.events.length,
    2,
  )
  const third = {
    ...valid,
    notes: 'Third synthetic observation for interrupted archive recovery only.',
  }
  writeFileSync(join(output, digest(third) + '.json'), '{interrupted')
  const recovered = persistFieldSubmission(directory, output, third, now)
  assert.equal(recovered.ledger.events.length, 3)
  assert.ok(readdirSync(output).some((name) => name.includes('.incomplete-')))
  assert.equal(
    JSON.parse(readFileSync(join(directory, 'review-ledger.json'), 'utf8'))
      .events.length,
    3,
  )
  assert.equal(recovered.receipt.verificationStatus, 'unverified')
  assert.equal(recovered.receipt.publicationApproved, false)
  for (const value of [null, false, 0, '']) {
    const invalidArchiveSubmission = {
      ...valid,
      notes: 'Synthetic archive hash mismatch: ' + JSON.stringify(value),
    }
    writeFileSync(
      join(output, digest(invalidArchiveSubmission) + '.json'),
      JSON.stringify(value),
    )
    assert.throws(
      () =>
        persistFieldSubmission(
          directory,
          output,
          invalidArchiveSubmission,
          now,
        ),
      /Archived source content differs/,
    )
    assert.equal(
      JSON.parse(readFileSync(join(directory, 'review-ledger.json'), 'utf8'))
        .events.length,
      3,
    )
  }
})
