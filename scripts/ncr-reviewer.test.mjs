import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import test from 'node:test'

import { isParking } from '../apps/mobile/src/discovery/data.ts'

import { buildFieldwork } from './ncr-fieldwork.mjs'
import { reconcileFieldSubmission } from './ncr-fieldwork-submit.mjs'
import { contentHash, validatePublicationLedger } from './ncr-publication.mjs'
import { updateReviewLedger } from './ncr-quality-review.mjs'
import {
  prepareReviewerImport,
  prepareReviewerDecision,
  reviewerImportSql,
  reviewerDecisionSql,
  validateReviewerPackage,
} from './ncr-reviewer.mjs'

const now = Date.parse('2026-11-05T12:00:00.000Z')
export const reviewerFixture = (
  type = 'lot',
  accessClass = 'unknown',
  rawAccess = undefined,
  parkingAccess = undefined,
) => {
  const candidate = {
    id: 'osm:node/1:Point',
    name: 'Unnamed parking facility',
    type,
    geometry: { type: 'Point', coordinates: [121.03, 14.567] },
    representativePoint: [121.03, 14.567],
    sourceRecordUrl: 'https://www.openstreetmap.org/node/1',
    sourceLicense: 'ODbL-1.0',
    sourceProviders: [
      { dataset: 'OpenStreetMap', record_id: 'node/1', license: 'ODbL-1.0' },
    ],
    sourceTags: {
      amenity: 'parking',
      ...(rawAccess === undefined ? {} : { access: rawAccess }),
      ...(parkingAccess === undefined
        ? {}
        : { 'parking:access': parkingAccess }),
    },
    flags: [],
    accessClass,
    operatingStatus: 'unknown',
  }
  const research = {
    sourceHashes: { osm: 'synthetic-fixture-only' },
    sourceAsOf: '2026-11-05T00:00:00.000Z',
    candidates: [candidate],
    duplicateReviewPairs: [],
    facilityGroups: [],
  }
  const initial = updateReviewLedger(research).ledger
  const checklist = buildFieldwork(research, initial)
  const submission = {
    schemaVersion: 1,
    status: 'submitted_unreviewed',
    candidateId: candidate.id,
    sourceHashes: research.sourceHashes,
    observerReference: 'synthetic-fixture-observer',
    observedAt: '2026-11-05T01:00:00.000Z',
    attestedOnSite: true,
    privacyReviewed: true,
    notes: 'Synthetic fixture only; no actual inspection or human decision.',
    photos: [],
    facts: {
      existence: 'exists',
      access: 'public_visitors',
      operation: 'open_observed',
      entranceCoordinates: [121.0301, 14.5671],
      ratesText: null,
      hoursText: null,
      operatorEvidence: 'Synthetic operator evidence reference',
      signageText: null,
    },
  }
  const review = reconcileFieldSubmission(
    initial,
    checklist,
    submission,
    now,
  ).ledger
  const prepared = prepareReviewerImport(
    research,
    review,
    checklist,
    submission,
    now,
  )
  const { evidence } = validateReviewerPackage(prepared)
  const ref = `internal:field-submission/${evidence.submissionHash}`
  const decision = (value) => ({ decision: value, evidenceReferences: [ref] })
  const approval = {
    eventId: 'synthetic-approval-only',
    recordId: candidate.id,
    action: 'approve_publication',
    actorKind: 'human_reviewer',
    actorId: 'd3000000-0000-4000-8000-000000000001',
    recordedAt: '2026-11-05T10:00:00.000Z',
    reason: 'Synthetic test approval; no actual human approved a record.',
    evidenceReferences: [ref],
    recordHash: contentHash(candidate),
    reviewDueAt: '2026-11-12T10:00:00.000Z',
    scope: 'unverified_discovery',
    approvedFields: ['name', 'geometry', 'source', 'evidence', 'access'],
    licenseApproved: true,
    accessApproved: true,
    safetyApproved: true,
    accessDecision: 'public_visitor_access',
    reviewDecisions: {
      identity: decision('confirmed_original_source'),
      access: decision('public_visitors'),
      entrance: {
        ...decision('safe_visitor_entrance_confirmed'),
        coordinates: submission.facts.entranceCoordinates,
      },
      operatorPermission: {
        ...decision('confirmed'),
        scope: 'unverified_discovery_only',
        visitorNavigationAuthorized: true,
      },
      license: {
        ...decision('approved'),
        scope: 'public_discovery_display',
        publicAttribution: '© OpenStreetMap contributors',
      },
      label: {
        kind: 'descriptive_label',
        text: 'Synthetic parking beside test street',
        evidenceReferences: [ref],
      },
    },
    issueResolutions: evidence.reviewIssues
      .filter((i) => i.blockingPublicDisplay)
      .map((i) => ({
        issueId: i.id,
        outcome: 'human_resolved',
        reason: 'Synthetic reviewer resolution for this fixture only',
        evidenceReferences: [ref],
      })),
  }
  return {
    candidate,
    research,
    initial,
    checklist,
    submission,
    review,
    prepared,
    approval,
  }
}
const empty = { schemaVersion: 1, events: [] }

test('single-record import preserves original source bytes and remains unapproved', () => {
  const f = reviewerFixture()
  const { evidence, candidate, submission } = validateReviewerPackage(
    f.prepared,
  )
  assert.deepEqual(candidate, f.candidate)
  assert.deepEqual(submission, f.submission)
  assert.equal(evidence.reviewSubmissionEvent.action, 'record_field_submission')
  assert.equal(evidence.reviewSubmissionEvent.outcome, undefined)
  assert.equal(candidate.id, 'osm:node/1:Point')
  assert.equal(candidate.name, 'Unnamed parking facility')
  const sql = reviewerImportSql(f.prepared, f.approval.actorId)
  assert.match(sql, /import_discovery_evidence/)
  assert.doesNotMatch(sql, /decide_discovery_evidence|insert into.*reviewers/i)
  assert.deepEqual(empty.events, [])
})

test('tampered archives, unreconciled submissions and source versions are refused', () => {
  const f = reviewerFixture()
  assert.throws(
    () =>
      validateReviewerPackage({
        ...f.prepared,
        packageText: f.prepared.packageText.replace('Unnamed', 'Renamed'),
      }),
    /bytes changed/,
  )
  assert.throws(
    () =>
      prepareReviewerImport(
        f.research,
        f.initial,
        f.checklist,
        f.submission,
        now,
      ),
    /first be reconciled/,
  )
  assert.throws(
    () =>
      prepareReviewerImport(
        f.research,
        f.review,
        f.checklist,
        { ...f.submission, candidateId: 'nearby:mall' },
        now,
      ),
    /Unknown candidate/,
  )
  assert.throws(() =>
    prepareReviewerImport(
      f.research,
      f.review,
      f.checklist,
      { ...f.submission, sourceHashes: { osm: 'changed' } },
      now,
    ),
  )
})

test('unspecified facility types remain immutable private evidence and cannot be classified as lots by publication', () => {
  const f = reviewerFixture('facility_unspecified')
  assert.equal(
    validateReviewerPackage(f.prepared).candidate.type,
    'facility_unspecified',
  )
  assert.match(
    reviewerImportSql(f.prepared, f.approval.actorId),
    /import_discovery_evidence/,
  )
  assert.throws(
    () => prepareReviewerDecision(f.prepared, empty, f.approval, now),
    /supported lot or garage source type; unclassified observations remain private/,
  )
  assert.equal(
    validateReviewerPackage(f.prepared).candidate.type,
    'facility_unspecified',
  )
  const garage = reviewerFixture('garage')
  assert.doesNotThrow(() =>
    prepareReviewerDecision(garage.prepared, empty, garage.approval, now),
  )
})

test('explicit unsupported source access cannot be masked by a human public-visitor approval request', () => {
  for (const access of [
    'members',
    'customers',
    'destination',
    'unrecognized_access',
    '',
    'public;members',
  ]) {
    const f = reviewerFixture('lot', access)
    assert.throws(
      () => prepareReviewerDecision(f.prepared, empty, f.approval, now),
      /Mapped source access is restricted or unsupported/,
    )
    assert.equal(
      validateReviewerPackage(f.prepared).candidate.accessClass,
      access,
    )
  }
  for (const access of [
    null,
    'unknown',
    'yes',
    'public',
    'permissive',
    'PUBLIC',
    ' public ',
  ]) {
    const f = reviewerFixture('lot', access)
    assert.doesNotThrow(() =>
      prepareReviewerDecision(f.prepared, empty, f.approval, now),
    )
  }
  for (const rawAccess of [
    'members',
    'unrecognized_access',
    'public;members',
    '',
  ]) {
    const f = reviewerFixture('lot', 'unknown', rawAccess)
    assert.throws(
      () => prepareReviewerDecision(f.prepared, empty, f.approval, now),
      /Mapped source access is restricted or unsupported/,
    )
    assert.equal(
      validateReviewerPackage(f.prepared).candidate.sourceTags.access,
      rawAccess,
    )
  }
  const recognized = reviewerFixture('lot', 'unknown', ' PUBLIC ')
  const conflicting = reviewerFixture('lot', 'unknown', 'yes', 'members')
  assert.throws(
    () =>
      prepareReviewerDecision(
        conflicting.prepared,
        empty,
        conflicting.approval,
        now,
      ),
    /Mapped source access is restricted or unsupported/,
  )
  assert.equal(
    validateReviewerPackage(conflicting.prepared).candidate.sourceTags[
      'parking:access'
    ],
    'members',
  )
  assert.doesNotThrow(() =>
    prepareReviewerDecision(
      recognized.prepared,
      empty,
      recognized.approval,
      now,
    ),
  )
})

test('approval request binds all human decisions, scoped operator permission, label and issue resolutions', () => {
  const f = reviewerFixture()
  const request = prepareReviewerDecision(f.prepared, empty, f.approval, now)
  const event = JSON.parse(request.eventText)
  assert.equal(event.recordId, f.candidate.id)
  assert.equal(event.reviewDecisions.label.kind, 'descriptive_label')
  validatePublicationLedger(
    { schemaVersion: 1, events: [{ ...event, eventHash: request.eventHash }] },
    now,
  )
  for (const field of [
    'identity',
    'access',
    'entrance',
    'operatorPermission',
    'license',
    'label',
  ]) {
    const changed = globalThis.structuredClone(f.approval)
    delete changed.reviewDecisions[field]
    assert.throws(
      () => prepareReviewerDecision(f.prepared, empty, changed, now),
      /Explicit/,
    )
  }
  const changed = globalThis.structuredClone(f.approval)
  changed.reviewDecisions.operatorPermission.scope = 'reservation_or_payment'
  assert.throws(
    () => prepareReviewerDecision(f.prepared, empty, changed, now),
    /Explicit/,
  )
  assert.throws(
    () =>
      prepareReviewerDecision(
        f.prepared,
        empty,
        { ...f.approval, issueResolutions: [] },
        now,
      ),
    /Every blocking/,
  )
  assert.throws(
    () =>
      reviewerDecisionSql(
        { ...request, eventText: request.eventText + ' ' },
        f.approval.actorId,
      ),
    /hash or reviewer/,
  )
  assert.throws(
    () => reviewerDecisionSql(request, 'd3000000-0000-4000-8000-000000000002'),
    /reviewer identity/,
  )
})

test('rejection, correction request, revocation and expiry remain original-format ledger decisions', () => {
  const f = reviewerFixture()
  for (const outcome of ['rejected', 'correction_requested']) {
    const base = { ...f.approval }
    delete base.reviewDecisions
    delete base.issueResolutions
    const request = prepareReviewerDecision(
      f.prepared,
      empty,
      { ...base, action: 'reject', outcome },
      now,
    )
    assert.equal(JSON.parse(request.eventText).outcome, outcome)
    assert.match(
      reviewerDecisionSql(request, f.approval.actorId),
      /decide_discovery_evidence/,
    )
  }
  assert.throws(
    () =>
      prepareReviewerDecision(
        f.prepared,
        empty,
        { ...f.approval, action: 'reject' },
        now,
      ),
    /Reject explicitly/,
  )
  assert.throws(
    () =>
      prepareReviewerDecision(
        f.prepared,
        empty,
        { ...f.approval, reviewDueAt: '2026-11-04T00:00:00.000Z' },
        now,
      ),
    /expiry/,
  )
  const request = prepareReviewerDecision(
    f.prepared,
    empty,
    { ...f.approval, action: 'revoke_publication' },
    now,
  )
  assert.equal(JSON.parse(request.eventText).action, 'revoke_publication')
})

test(
  'local database accepts JS canonical events and returns a valid original ledger and mobile parking contract',
  { skip: process.env.PARKEY_REVIEWER_LOCAL_DB !== '1' },
  () => {
    const f = reviewerFixture()
    const actor = randomUUID()
    const current = Date.now()
    const approval = {
      ...f.approval,
      actorId: actor,
      recordedAt: new Date(current - 1000).toISOString(),
      reviewDueAt: new Date(current + 7 * 86400000).toISOString(),
      numericEncoding: {
        tiny: 1e-7,
        threshold: 1e-6,
        large: 1e21,
        fixed: 1e20,
        integer: 1000000000000000100,
      },
    }
    const request = prepareReviewerDecision(
      f.prepared,
      empty,
      approval,
      current,
    )
    const sql = `begin;
      insert into auth.users(id) values ('${actor}');
      insert into parkey_private.discovery_reviewers(user_id,can_publish) values ('${actor}',true);
      ${reviewerImportSql(f.prepared, actor)}
      ${reviewerDecisionSql(request, actor)}
      set local role anon;
      select 'PARKEY_RECORDS:' || public.discover_parking(121.02,14.56,121.04,14.58)::text;
      reset role;
      select 'PARKEY_LEDGER:' || public.export_discovery_publication_ledger('${actor}')::text;
      rollback;`
    const engine = process.env.PARKEY_REVIEWER_DB_ENGINE || 'podman'
    assert.ok(
      ['podman', 'docker'].includes(engine),
      'Only the local test container engine is allowed',
    )
    const result = spawnSync(
      engine,
      [
        'exec',
        '-i',
        'supabase_db_prometheus-parkey-cross-platform',
        'psql',
        '-X',
        '-q',
        '-A',
        '-t',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-v',
        'ON_ERROR_STOP=1',
      ],
      { input: sql, encoding: 'utf8', timeout: 60000 },
    )
    assert.equal(result.status, 0, result.stderr || result.error?.message)
    const lines = result.stdout.split(/\r?\n/)
    const exported = JSON.parse(
      lines
        .find((line) => line.startsWith('PARKEY_LEDGER:'))
        .slice('PARKEY_LEDGER:'.length),
    )
    validatePublicationLedger(exported, Date.now())
    assert.deepEqual(exported.events[0], {
      ...JSON.parse(request.eventText),
      eventHash: request.eventHash,
    })
    const response = JSON.parse(
      lines
        .find((line) => line.startsWith('PARKEY_RECORDS:'))
        .slice('PARKEY_RECORDS:'.length),
    )
    assert.ok(
      response.records.every(isParking),
      'actual discovery response must satisfy existing mobile validator',
    )
    const record = response.records.find(
      (p) => p.sourceUrl === f.candidate.sourceRecordUrl,
    )
    assert.ok(
      record,
      'approved individual observation appears in actual anonymous discovery result',
    )
    assert.deepEqual(record.entrances, [f.submission.facts.entranceCoordinates])
    assert.deepEqual(record.navigationApproval, {
      entrance: f.submission.facts.entranceCoordinates,
      entranceConfirmed: true,
      visitorAccessConfirmed: true,
      operatorAuthorized: true,
      expiresAt: approval.reviewDueAt,
    })
  },
)
