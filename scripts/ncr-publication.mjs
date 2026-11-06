import { createHash } from 'node:crypto'

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
export const contentHash = (value) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex')
const utc = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d\d-\d\dT.*Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0
const actions = new Set([
  'record_evidence',
  'approve_publication',
  'reject',
  'revoke_publication',
])
const evidenceKinds = new Set([
  'online_corroborated',
  'operator_confirmed',
  'physically_verified',
])
const blockedAccess = new Set([
  'private',
  'no',
  'permit',
  'residents',
  'military',
  'emergency',
  'delivery',
  'destination',
  'psv',
  'designated',
])
const blockedFlags = new Set([
  'mapped_restricted_access',
  'mapped_closed_or_disused',
  'prior_human_exclusion_requires_resolution',
  'invalid_geometry_requires_review',
  'unsafe',
  'prohibited',
])
const allowedLicenses = new Set([
  'ODbL-1.0',
  'CDLA-Permissive-2.0',
  'Apache-2.0',
])

/** Ledger bytes are internal review evidence, never a client-supplied authority. */
export function validatePublicationLedger(ledger, now = Date.now()) {
  if (ledger?.schemaVersion !== 1 || !Array.isArray(ledger.events))
    throw new Error('Expected publication ledger v1.')
  let previousHash = null,
    previousTime = -Infinity
  const ids = new Set()
  for (let index = 0; index < ledger.events.length; index++) {
    const event = ledger.events[index]
    if (
      !event ||
      event.sequence !== index + 1 ||
      !nonempty(event.eventId) ||
      ids.has(event.eventId) ||
      !nonempty(event.recordId) ||
      !actions.has(event.action) ||
      event.actorKind !== 'human_reviewer' ||
      !nonempty(event.actorId) ||
      !utc(event.recordedAt) ||
      Date.parse(event.recordedAt) > now ||
      Date.parse(event.recordedAt) < previousTime ||
      !nonempty(event.reason) ||
      event.previousHash !== previousHash ||
      !Array.isArray(event.evidenceReferences) ||
      !event.evidenceReferences.length ||
      !event.evidenceReferences.every(nonempty)
    )
      throw new Error('Invalid publication audit event.')
    const { eventHash, ...payload } = event
    if (eventHash !== contentHash(payload))
      throw new Error('Publication audit chain changed.')
    if (
      event.action !== 'record_evidence' &&
      ['evidenceKind', 'observedAt', 'facts'].some((key) =>
        Object.hasOwn(event, key),
      )
    )
      throw new Error(
        'Evidence observation fields require a record_evidence event.',
      )
    if (
      event.action === 'record_evidence' &&
      (!evidenceKinds.has(event.evidenceKind) ||
        !utc(event.observedAt) ||
        Date.parse(event.observedAt) > Date.parse(event.recordedAt) ||
        !Array.isArray(event.facts) ||
        !event.facts.length ||
        !event.facts.every(nonempty))
    )
      throw new Error('Unsupported evidence observation.')
    if (
      event.action === 'approve_publication' &&
      (!/^[a-f0-9]{64}$/.test(event.recordHash || '') ||
        !utc(event.reviewDueAt) ||
        Date.parse(event.reviewDueAt) <= Date.parse(event.recordedAt) ||
        Date.parse(event.reviewDueAt) - Date.parse(event.recordedAt) >
          90 * 86400000 ||
        event.scope !== 'unverified_discovery' ||
        event.licenseApproved !== true ||
        event.accessApproved !== true ||
        event.safetyApproved !== true ||
        event.accessDecision !== 'public_visitor_access' ||
        !Array.isArray(event.approvedFields) ||
        !['name', 'geometry', 'source', 'evidence', 'access'].every((field) =>
          event.approvedFields.includes(field),
        ))
    )
      throw new Error(
        'Publication approval requires field, license, access, safety and expiry decisions.',
      )
    ids.add(event.eventId)
    previousHash = eventHash
    previousTime = Date.parse(event.recordedAt)
  }
  return ledger
}

/** Pure append helper, for an accountable human workflow; there is no HTTP write endpoint. */
export function appendPublicationEvent(
  ledger,
  payload,
  { authorizedHuman = false, now = Date.now() } = {},
) {
  if (!authorizedHuman)
    throw new Error('An authorized accountable human reviewer is required.')
  validatePublicationLedger(ledger, now)
  const previousHash = ledger.events.at(-1)?.eventHash || null
  const event = { ...payload, sequence: ledger.events.length + 1, previousHash }
  const next = {
    ...ledger,
    events: [...ledger.events, { ...event, eventHash: contentHash(event) }],
  }
  return validatePublicationLedger(next, now)
}

export function publicationState(
  candidate,
  ledger,
  { now = Date.now(), issues = [] } = {},
) {
  validatePublicationLedger(ledger, now)
  const events = ledger.events.filter(
    (event) => event.recordId === candidate.id,
  )
  const decision = events
    .filter((event) => event.action !== 'record_evidence')
    .at(-1)
  const evidence = {
    researchStatus: candidate.researchStatus || 'researched',
    onlineCorroborated:
      candidate.onlineCorroborated === true ||
      events.some(
        (event) =>
          event.action === 'record_evidence' &&
          event.evidenceKind === 'online_corroborated',
      ),
    operatorConfirmed: events.some(
      (event) =>
        event.action === 'record_evidence' &&
        event.evidenceKind === 'operator_confirmed',
    ),
    physicallyVerified: events.some(
      (event) =>
        event.action === 'record_evidence' &&
        event.evidenceKind === 'physically_verified',
    ),
    publicationApproved: false,
  }
  const reasons = []
  if (!decision || decision.action !== 'approve_publication')
    reasons.push(decision?.action || 'not_approved')
  if (decision?.action === 'approve_publication') {
    if (Date.parse(decision.reviewDueAt) <= now) reasons.push('review_expired')
    if (decision.recordHash !== contentHash(candidate))
      reasons.push('source_revision_needs_review')
  }
  if (
    candidate.restrictedAccess ||
    blockedAccess.has(String(candidate.accessClass || '').toLowerCase())
  )
    reasons.push('restricted_access')
  if (candidate.accessClass === 'customers')
    reasons.push('customer_only_access')
  if (
    [
      'closed',
      'permanently_closed',
      'temporarily_closed',
      'disused',
      'construction',
    ].includes(candidate.operatingStatus)
  )
    reasons.push('closed_or_unavailable')
  if (candidate.flags?.some((flag) => blockedFlags.has(flag)))
    reasons.push('source_safety_exclusion')
  if (candidate.type === 'street_segment')
    reasons.push('street_legal_review_required')
  if (['space', 'entrance'].includes(candidate.type))
    reasons.push('child_feature_not_independent_public_parking')
  const licenses = String(candidate.sourceLicense || '')
    .split(',')
    .map((value) => value.trim())
  if (
    !licenses.length ||
    licenses.some((license) => !allowedLicenses.has(license)) ||
    candidate.requiresLicenseReview
  )
    reasons.push('license_review_required')
  if (
    !Array.isArray(candidate.sourceProviders) ||
    !candidate.sourceProviders.length ||
    candidate.sourceProviders.some(
      (provider) => !allowedLicenses.has(provider.license),
    )
  )
    reasons.push('provider_license_review_required')
  const blockingIssues = issues.filter(
    (issue) =>
      issue.candidateIds?.includes(candidate.id) &&
      issue.status !== 'resolved_source_identity' &&
      issue.status !== 'resolved' &&
      issue.blockingPublicDisplay !== false,
  )
  if (blockingIssues.length) reasons.push('unresolved_research_issue')
  evidence.publicationApproved = reasons.length === 0
  return {
    eligible: reasons.length === 0,
    reasons: [...new Set(reasons)],
    evidence,
    reviewIssueIds: blockingIssues.map((issue) => issue.id),
    lastReviewedAt: decision?.recordedAt || null,
    approvedAt:
      decision?.action === 'approve_publication' ? decision.recordedAt : null,
    reviewDueAt: decision?.reviewDueAt || null,
  }
}
