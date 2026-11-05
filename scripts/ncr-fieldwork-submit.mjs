import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  openSync,
  closeSync,
  fsyncSync,
  renameSync,
  unlinkSync,
} from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import {
  appendReviewEvent,
  digest,
  validateReviewLedger,
} from './ncr-quality-review.mjs'

export function validateFieldSubmission(
  submission,
  checklist,
  now = Date.now(),
) {
  if (
    !submission ||
    submission.schemaVersion !== 1 ||
    submission.status !== 'submitted_unreviewed'
  )
    throw new Error('Expected unreviewed field submission')
  const allowed = new Set([
    'schemaVersion',
    'status',
    'candidateId',
    'sourceHashes',
    'observerReference',
    'observedAt',
    'attestedOnSite',
    'privacyReviewed',
    'facts',
    'notes',
    'photos',
  ])
  if (Object.keys(submission).some((k) => !allowed.has(k)))
    throw new Error(
      'Unknown submission field; verification/publication claims are forbidden',
    )
  assert.deepEqual(
    submission.sourceHashes,
    checklist.sourceHashes,
    'Submission source version does not match current checklist',
  )
  const task = checklist.tasks.find((t) => t.id === submission.candidateId)
  if (!task) throw new Error('Unknown candidate ID')
  if (
    typeof submission.observerReference !== 'string' ||
    !submission.observerReference.trim() ||
    submission.observerReference.length > 80
  )
    throw new Error('Use a non-personal observer/evidence reference')
  const observed = Date.parse(submission.observedAt)
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(
      submission.observedAt,
    ) ||
    !Number.isFinite(observed) ||
    observed > now ||
    observed < Date.parse(checklist.sourceAsOf)
  )
    throw new Error(
      'Use an actual nonfuture UTC visit time after the research snapshot',
    )
  if (submission.attestedOnSite !== true || submission.privacyReviewed !== true)
    throw new Error(
      'Actual on-site observation and evidence/privacy attestation are required',
    )
  if (
    typeof submission.notes !== 'string' ||
    submission.notes.trim().length < 20 ||
    submission.notes.length > 4000
  )
    throw new Error(
      'Describe the actual observation and remaining uncertainty (20–4000 characters)',
    )
  const facts = submission.facts
  if (
    !facts ||
    !['unknown', 'exists', 'not_found'].includes(facts.existence) ||
    ![
      'unknown',
      'public_visitors',
      'customers',
      'private',
      'prohibited',
      'permit_only',
      'residents',
      'staff_only',
    ].includes(facts.access) ||
    !['unknown', 'open_observed', 'closed_observed', 'construction'].includes(
      facts.operation,
    )
  )
    throw new Error('Invalid observation vocabulary')
  const factKeys = new Set([
    'existence',
    'access',
    'operation',
    'entranceCoordinates',
    'ratesText',
    'hoursText',
    'operatorEvidence',
    'signageText',
  ])
  if (Object.keys(facts).some((k) => !factKeys.has(k)))
    throw new Error(
      'Unsupported fact; no verification/publication or live-availability claims allowed',
    )
  for (const key of [
    'ratesText',
    'hoursText',
    'operatorEvidence',
    'signageText',
  ])
    if (
      facts[key] !== null &&
      (typeof facts[key] !== 'string' || facts[key].length > 1000)
    )
      throw new Error('Invalid observation text')
  const point = facts.entranceCoordinates
  if (
    point !== null &&
    (!Array.isArray(point) ||
      point.length !== 2 ||
      !point.every(Number.isFinite) ||
      Math.abs(point[0]) > 180 ||
      Math.abs(point[1]) > 90)
  )
    throw new Error('Invalid separately observed entrance coordinate')
  if (!Array.isArray(submission.photos) || submission.photos.length > 3)
    throw new Error('At most three optional, privacy-reviewed photos')
  for (const photo of submission.photos) {
    if (
      !photo ||
      Object.keys(photo).some(
        (k) => !['id', 'caption', 'dataUrl'].includes(k),
      ) ||
      typeof photo.id !== 'string' ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(photo.id) ||
      typeof photo.caption !== 'string' ||
      photo.caption.length > 500 ||
      typeof photo.dataUrl !== 'string' ||
      !/^data:image\/png;base64,[a-zA-Z0-9+/]+={0,2}$/.test(photo.dataUrl) ||
      photo.dataUrl.length > 2_800_000
    )
      throw new Error(
        'Photos must be bounded locally sanitized PNG evidence, not external URLs',
      )
    const bytes = Buffer.from(photo.dataUrl.split(',')[1], 'base64')
    if (
      bytes.length > 2 * 1024 * 1024 ||
      bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
    )
      throw new Error('Invalid PNG evidence')
  }
  return task
}

export function reconcileFieldSubmission(
  ledger,
  checklist,
  submission,
  now = Date.now(),
) {
  validateReviewLedger(ledger)
  const task = validateFieldSubmission(submission, checklist, now)
  assert.deepEqual(
    ledger.sourceHashes,
    checklist.sourceHashes,
    'Ledger/checklist version mismatch',
  )
  const payloadHash = digest(submission)
  if (
    ledger.events.some(
      (e) =>
        e.action === 'record_field_submission' && e.payloadHash === payloadHash,
    )
  )
    throw new Error(
      'Submission already reconciled; duplicate audit event refused',
    )
  const issue = ledger.issues.find(
    (i) =>
      i.kind === 'candidate_evidence_gap' &&
      i.candidateIds.includes(task.id) &&
      task.unresolvedIssueIds.includes(i.id),
  )
  if (!issue) throw new Error('Candidate has no matching current review issue')
  const updated = appendReviewEvent(ledger, {
    issueId: issue.id,
    action: 'record_field_submission',
    actor: 'unreviewed-field-submission-import',
    observedAt: submission.observedAt,
    evidenceReference: `internal:field-submission/${payloadHash}`,
    payloadHash,
    note: 'Actual observer submission received; evidence remains unreviewed. No physical-verification, legal, access or publication decision was made.',
  })
  return {
    ledger: updated,
    receipt: {
      schemaVersion: 1,
      candidateId: task.id,
      submissionHash: payloadHash,
      status: 'received_pending_human_reconciliation',
      verificationStatus: 'unverified',
      publicationApproved: false,
      reviewIssueId: issue.id,
    },
  }
}

function atomicJson(path, value) {
  const temporary = path + '.pending-' + randomUUID()
  let descriptor
  try {
    descriptor = openSync(temporary, 'wx')
    writeFileSync(descriptor, JSON.stringify(value, null, 2) + '\n')
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = undefined
    renameSync(temporary, path)
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
    if (existsSync(temporary)) unlinkSync(temporary)
  }
}

/** Serialized and retryable local ingestion; source evidence never grants approval. */
export function persistFieldSubmission(
  directory,
  outDirectory,
  submission,
  now = Date.now(),
) {
  const ledgerPath = join(directory, 'review-ledger.json'),
    lockPath = ledgerPath + '.lock'
  let lock
  try {
    lock = openSync(lockPath, 'wx')
  } catch (error) {
    if (error.code === 'EEXIST')
      throw new Error(
        'Review ledger is locked by another import. Retry after it finishes; inspect a stale lock before removing it.',
        { cause: error },
      )
    throw error
  }
  try {
    writeFileSync(
      lock,
      JSON.stringify({
        processId: process.pid,
        startedAt: new Date().toISOString(),
      }),
    )
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'))
    const checklist = JSON.parse(
      readFileSync(join(directory, 'fieldwork-checklist.json'), 'utf8'),
    )
    validateReviewLedger(ledger)
    const task = validateFieldSubmission(submission, checklist, now)
    assert.deepEqual(
      ledger.sourceHashes,
      checklist.sourceHashes,
      'Ledger/checklist version mismatch',
    )
    const payloadHash = digest(submission)
    const existing = ledger.events.find(
      (event) =>
        event.action === 'record_field_submission' &&
        event.payloadHash === payloadHash,
    )
    const result = existing
      ? {
          ledger,
          receipt: {
            schemaVersion: 1,
            candidateId: task.id,
            submissionHash: payloadHash,
            status: 'received_pending_human_reconciliation',
            verificationStatus: 'unverified',
            publicationApproved: false,
            reviewIssueId: existing.issueId,
          },
        }
      : reconcileFieldSubmission(ledger, checklist, submission, now)
    mkdirSync(outDirectory, { recursive: true })
    const archive = join(outDirectory, payloadHash + '.json')
    if (existsSync(archive)) {
      let saved,
        parsed = false
      try {
        saved = JSON.parse(readFileSync(archive, 'utf8'))
        parsed = true
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error
        // Preserve interrupted archive bytes for inspection, then recover from
        // the still-present validated submission supplied by the operator.
        renameSync(archive, archive + '.incomplete-' + randomUUID())
      }
      if (parsed)
        assert.equal(
          digest(saved),
          payloadHash,
          'Archived source content differs; refusing overwrite',
        )
    }
    if (!existsSync(archive)) atomicJson(archive, submission)
    if (!existing) atomicJson(ledgerPath, result.ledger)
    const receiptPath = join(outDirectory, payloadHash + '.receipt.json')
    if (existsSync(receiptPath))
      assert.deepEqual(
        JSON.parse(readFileSync(receiptPath, 'utf8')),
        result.receipt,
        'Existing receipt differs',
      )
    else atomicJson(receiptPath, result.receipt)
    return result
  } finally {
    closeSync(lock)
    unlinkSync(lockPath)
  }
}

function main() {
  const [
    submissionPath,
    directory = 'data/ncr-research',
    outDirectory = 'output/ncr/field-submissions',
  ] = process.argv.slice(2)
  if (!submissionPath)
    throw new Error(
      'Usage: node scripts/ncr-fieldwork-submit.mjs SUBMISSION_JSON [RESEARCH_DIRECTORY] [PRIVATE_OUTPUT_DIRECTORY]',
    )
  const input = readFileSync(submissionPath)
  if (input.length > 10 * 1024 * 1024)
    throw new Error('Submission exceeds 10 MiB')
  const submission = JSON.parse(input.toString('utf8'))
  const result = persistFieldSubmission(directory, outDirectory, submission)
  process.stdout.write(JSON.stringify(result.receipt) + '\n')
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
