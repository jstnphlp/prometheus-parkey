import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import { validateFieldSubmission } from './ncr-fieldwork-submit.mjs'
import {
  appendPublicationEvent,
  contentHash,
  publicationState,
  validatePublicationLedger,
} from './ncr-publication.mjs'
import {
  digest,
  loadNcrResearch,
  validateReviewLedger,
} from './ncr-quality-review.mjs'

const sha256 = (text) => createHash('sha256').update(text).digest('hex')
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    )
  return value
}
const json = (value) => JSON.stringify(canonical(value))
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0
const references = (value) =>
  Array.isArray(value) && value.length > 0 && value.every(nonempty)
const sqlLiteral = (value) => "'" + value.replaceAll("'", "''") + "'"
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

/** Import one original observation, never a deduplicated destination or archive. */
export function prepareReviewerImport(
  research,
  reviewLedger,
  checklist,
  submission,
  now = Date.now(),
) {
  validateReviewLedger(reviewLedger)
  validateFieldSubmission(submission, checklist, now)
  assert.deepEqual(research.sourceHashes, reviewLedger.sourceHashes)
  assert.deepEqual(research.sourceHashes, checklist.sourceHashes)
  const candidate = research.candidates.find(
    (c) => c.id === submission.candidateId,
  )
  if (!candidate) throw new Error('Original source observation is missing')
  const submissionHash = digest(submission)
  const event = reviewLedger.events.find(
    (e) =>
      e.action === 'record_field_submission' &&
      e.payloadHash === submissionHash,
  )
  if (!event)
    throw new Error('Archive must first be reconciled into review ledger')
  const issues = reviewLedger.issues.filter((i) =>
    i.candidateIds.includes(candidate.id),
  )
  if (!issues.some((i) => i.id === event.issueId))
    throw new Error(
      'Submission event does not belong to this source observation',
    )
  const evidence = {
    schemaVersion: 1,
    candidateText: json(candidate),
    recordHash: contentHash(candidate),
    sourceHashes: research.sourceHashes,
    sourceAsOf: research.sourceAsOf,
    reviewCatalogHash: reviewLedger.catalogHash,
    reviewIssues: issues,
    reviewSubmissionEvent: event,
    // Preserve original property ordering: existing field submission hashes use it.
    submissionText: JSON.stringify(submission),
    submissionHash,
  }
  const packageText = JSON.stringify(evidence)
  return { packageText, packageHash: sha256(packageText) }
}

export function validateReviewerPackage(prepared) {
  if (sha256(prepared.packageText) !== prepared.packageHash)
    throw new Error('Private evidence package bytes changed')
  const evidence = JSON.parse(prepared.packageText)
  const candidate = JSON.parse(evidence.candidateText)
  const submission = JSON.parse(evidence.submissionText)
  if (
    evidence.schemaVersion !== 1 ||
    contentHash(candidate) !== evidence.recordHash ||
    sha256(evidence.submissionText) !== evidence.submissionHash ||
    submission.candidateId !== candidate.id ||
    evidence.reviewSubmissionEvent.payloadHash !== evidence.submissionHash ||
    !evidence.reviewIssues.some(
      (issue) => issue.id === evidence.reviewSubmissionEvent.issueId,
    )
  )
    throw new Error('Evidence source identity or reconciliation changed')
  assert.deepEqual(submission.sourceHashes, evidence.sourceHashes)
  return { evidence, candidate, submission }
}

/** Build a request only. The database reviewer registry authorizes every action. */
export function prepareReviewerDecision(
  prepared,
  publicationLedger,
  payload,
  now = Date.now(),
) {
  const { evidence, candidate, submission } = validateReviewerPackage(prepared)
  validatePublicationLedger(publicationLedger, now)
  if (
    !uuid.test(payload.actorId || '') ||
    payload.recordId !== candidate.id ||
    !['approve_publication', 'reject', 'revoke_publication'].includes(
      payload.action,
    )
  )
    throw new Error('Use the registered reviewer UUID and original record ID')
  if (
    !payload.evidenceReferences?.includes(
      `internal:field-submission/${evidence.submissionHash}`,
    )
  )
    throw new Error('Decision must cite the immutable imported submission')
  if (payload.action === 'approve_publication') {
    const decisions = payload.reviewDecisions
    if (
      payload.recordHash !== evidence.recordHash ||
      decisions?.identity?.decision !== 'confirmed_original_source' ||
      decisions?.access?.decision !== 'public_visitors' ||
      decisions?.entrance?.decision !== 'safe_visitor_entrance_confirmed' ||
      decisions?.operatorPermission?.decision !== 'confirmed' ||
      decisions?.operatorPermission?.scope !== 'unverified_discovery_only' ||
      decisions?.license?.decision !== 'approved' ||
      decisions?.license?.scope !== 'public_discovery_display' ||
      !nonempty(decisions?.license?.publicAttribution) ||
      decisions.license.publicAttribution.length > 500 ||
      !['official_name', 'descriptive_label'].includes(
        decisions?.label?.kind,
      ) ||
      !nonempty(decisions?.label?.text) ||
      Object.values(decisions).some((d) => !references(d.evidenceReferences)) ||
      submission.facts.existence !== 'exists' ||
      submission.facts.access !== 'public_visitors' ||
      submission.facts.operation !== 'open_observed' ||
      !submission.facts.entranceCoordinates ||
      !nonempty(submission.facts.operatorEvidence)
    )
      throw new Error(
        'Explicit identity, access, safe entrance, operator permission, license and label decisions are required',
      )
    if (
      decisions.label.text.length > 200 ||
      !Array.isArray(decisions.entrance.coordinates) ||
      json(decisions.entrance.coordinates) !==
        json(submission.facts.entranceCoordinates)
    )
      throw new Error(
        'Entrance must bind the observed coordinates; label is bounded',
      )
    if (
      Object.hasOwn(
        decisions.operatorPermission,
        'visitorNavigationAuthorized',
      ) &&
      typeof decisions.operatorPermission.visitorNavigationAuthorized !==
        'boolean'
    )
      throw new Error(
        'Visitor navigation needs a separate explicit boolean operator decision',
      )
    const resolutions = payload.issueResolutions
    if (
      !Array.isArray(resolutions) ||
      evidence.reviewIssues.some(
        (issue) =>
          issue.blockingPublicDisplay &&
          !resolutions.some(
            (resolution) =>
              resolution.issueId === issue.id &&
              resolution.outcome === 'human_resolved' &&
              nonempty(resolution.reason) &&
              references(resolution.evidenceReferences),
          ),
      )
    )
      throw new Error(
        'Every blocking source issue needs an explicit human resolution',
      )
    // Existing exclusions and license policy remain authoritative; a label or
    // a submitted observation cannot silently rewrite restricted source facts.
    const prospective = appendPublicationEvent(publicationLedger, payload, {
      authorizedHuman: true,
      now,
    })
    if (!publicationState(candidate, prospective, { now }).eligible)
      throw new Error(
        'Source safety/access/license exclusions still block publication',
      )
  } else if (
    payload.action === 'reject' &&
    !['rejected', 'correction_requested'].includes(payload.outcome)
  )
    throw new Error(
      'Reject explicitly or request a correction; never alter source bytes',
    )
  const next = appendPublicationEvent(publicationLedger, payload, {
    // This validates request structure. It grants no database access and does
    // not persist a local approval. Only the controlled RPC can approve it.
    authorizedHuman: true,
    now,
  })
  const { eventHash, ...event } = next.events.at(-1)
  return {
    packageHash: prepared.packageHash,
    eventText: json(event),
    eventHash,
  }
}

export function reviewerImportSql(prepared, reviewerId) {
  validateReviewerPackage(prepared)
  if (!uuid.test(reviewerId))
    throw new Error('Registered reviewer UUID required')
  return `-- LOCAL ONLY. Run with an authorized operator connection; no hosted execution.\nselect public.import_discovery_evidence(${sqlLiteral(reviewerId)}::uuid, ${sqlLiteral(prepared.packageText)}, ${sqlLiteral(prepared.packageHash)});\n`
}

export function reviewerDecisionSql(request, reviewerId) {
  if (!uuid.test(reviewerId))
    throw new Error('Registered reviewer UUID required')
  const event = JSON.parse(request.eventText)
  if (
    sha256(request.eventText) !== request.eventHash ||
    event.actorId !== reviewerId
  )
    throw new Error('Decision hash or reviewer identity changed')
  return `-- LOCAL ONLY. Contains private review evidence; do not publish.\nselect public.decide_discovery_evidence(${sqlLiteral(reviewerId)}::uuid, ${sqlLiteral(request.packageHash)}, ${sqlLiteral(request.eventText)}, ${sqlLiteral(request.eventHash)});\n`
}

export function reviewerLedgerSql(reviewerId) {
  if (!uuid.test(reviewerId))
    throw new Error('Registered reviewer UUID required')
  return `-- LOCAL ONLY. Export to a new private file; preserve historical ledgers.\nselect public.export_discovery_publication_ledger(${sqlLiteral(reviewerId)}::uuid);\n`
}

function main() {
  const [operation, ...args] = process.argv.slice(2)
  if (operation === 'prepare') {
    const [directory, submissionPath, reviewerId, output] = args
    if (!output)
      throw new Error(
        'prepare RESEARCH_DIR ARCHIVED_SUBMISSION REVIEWER_UUID PRIVATE_OUTPUT_PREFIX',
      )
    const read = (path) => JSON.parse(readFileSync(path, 'utf8'))
    const prepared = prepareReviewerImport(
      loadNcrResearch(directory),
      read(join(directory, 'review-ledger.json')),
      read(join(directory, 'fieldwork-checklist.json')),
      read(submissionPath),
    )
    writeFileSync(output + '.json', JSON.stringify(prepared, null, 2) + '\n', {
      flag: 'wx',
    })
    writeFileSync(output + '.sql', reviewerImportSql(prepared, reviewerId), {
      flag: 'wx',
    })
  } else if (operation === 'decision') {
    const [packagePath, ledgerPath, decisionPath, output] = args
    if (!output)
      throw new Error(
        'decision PRIVATE_PACKAGE PUBLICATION_LEDGER HUMAN_DECISION PRIVATE_OUTPUT_SQL',
      )
    const read = (path) => JSON.parse(readFileSync(path, 'utf8'))
    const payload = read(decisionPath)
    const request = prepareReviewerDecision(
      read(packagePath),
      read(ledgerPath),
      payload,
    )
    writeFileSync(output, reviewerDecisionSql(request, payload.actorId), {
      flag: 'wx',
    })
  } else if (operation === 'export') {
    const [reviewerId, output] = args
    if (!output) throw new Error('export REVIEWER_UUID PRIVATE_OUTPUT_SQL')
    writeFileSync(output, reviewerLedgerSql(reviewerId), { flag: 'wx' })
  } else
    throw new Error(
      'Use prepare, decision or export. Requests never grant reviewer access or automatically publish.',
    )
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
