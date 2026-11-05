import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'

import { geometryBounds, pointInNcrGeometry } from './ncr-geography.mjs'
import { distanceMeters } from './parking-open-data.mjs'

export const canonical = (value) => JSON.stringify(value)
export const digest = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : canonical(value))
    .digest('hex')
export const FACILITY_TYPES = new Set(['lot', 'garage', 'facility_unspecified'])
const polygon = (c) => ['Polygon', 'MultiPolygon'].includes(c.geometry.type)
const pointValid = (p) =>
  Array.isArray(p) &&
  p.length === 2 &&
  p.every(Number.isFinite) &&
  Math.abs(p[0]) <= 180 &&
  Math.abs(p[1]) <= 90
const meaningfulName = (c) => !/^(Unnamed|Mapped)\b/.test(c.name)

export function loadNcrResearch(directory = 'data/ncr-research') {
  const manifest = JSON.parse(
    readFileSync(join(directory, 'manifest.json'), 'utf8'),
  )
  const artifact = manifest.artifacts.find((a) => a.role === 'research')
  const bytes = readFileSync(join(directory, artifact.filename))
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    artifact.sha256,
    'Research archive hash mismatch',
  )
  const raw = gunzipSync(bytes)
  assert.equal(
    createHash('sha256').update(raw).digest('hex'),
    artifact.uncompressedSha256,
    'Research input hash mismatch',
  )
  return JSON.parse(raw.toString('utf8'))
}

function providers(c) {
  return (c.sourceProviders || [])
    .filter((s) => s.dataset && s.record_id)
    .map((s) => `${String(s.dataset).toLowerCase()}:${s.record_id}`)
    .sort()
}
export function commonProviderIdentities(records) {
  if (!records.length) return []
  return providers(records[0]).filter((key) =>
    records.every((c) => providers(c).includes(key)),
  )
}
const sourceEvidence = (c) => ({
  id: c.id,
  name: c.name,
  type: c.type,
  point: c.representativePoint,
  sourceRecordUrl: c.sourceRecordUrl,
  sourceLicense: c.sourceLicense,
  sourceEditedAt: c.sourceRecordEditedAt,
  providers: providers(c),
})

export function reviewRelationships(candidates) {
  const facilities = candidates.filter((c) => FACILITY_TYPES.has(c.type))
  const footprints = facilities.filter(polygon)
  return candidates
    .filter((c) => ['entrance', 'space', 'street_segment'].includes(c.type))
    .map((c) => {
      if (c.type === 'street_segment')
        return {
          candidateId: c.id,
          role: c.type,
          parentCandidateIds: [],
          basis: 'independent_mapped_street_extent',
          status: 'human_legal_review_required',
          changesFacilityCount: false,
        }
      const containing = footprints.filter((f) => {
        const [west, south, east, north] = geometryBounds(f.geometry)
        const [x, y] = c.representativePoint
        return (
          x >= west &&
          x <= east &&
          y >= south &&
          y <= north &&
          pointInNcrGeometry(c.representativePoint, f.geometry)
        )
      })
      const nearby = containing.length
        ? []
        : facilities
            .map((f) => ({
              id: f.id,
              meters: distanceMeters(
                c.representativePoint,
                f.representativePoint,
              ),
            }))
            .filter((f) => f.meters <= 35)
            .sort((a, b) => a.meters - b.meters || a.id.localeCompare(b.id))
            .slice(0, 3)
      return {
        candidateId: c.id,
        role: c.type,
        parentCandidateIds: containing.length
          ? containing.map((f) => f.id).sort()
          : nearby.map((f) => f.id),
        basis: containing.length
          ? 'representative_point_inside_mapped_parking_footprint'
          : nearby.length
            ? 'nearby_facility_within_35m'
            : 'no_supported_parent_match',
        status:
          containing.length === 1
            ? 'parent_match_proposed_not_confirmed'
            : 'human_identity_review_required',
        changesFacilityCount: false,
      }
    })
}

export function buildQualityFindings(research) {
  const byId = new Map(research.candidates.map((c) => [c.id, c]))
  const groupsByCandidate = new Map(
    research.facilityGroups.flatMap((g) =>
      g.sourceCandidateIds.map((id) => [id, g]),
    ),
  )
  const snapshotHash = digest(research.sourceHashes)
  const issues = []
  const add = (kind, candidateIds, reasons, evidence, options = {}) => {
    candidateIds = [...new Set(candidateIds)].sort()
    const issueKey = `${kind}:${digest(candidateIds).slice(0, 20)}`
    const definition = {
      issueKey,
      kind,
      candidateIds,
      reasons,
      evidence,
      sourceSnapshot: snapshotHash,
      status: 'human_review_required',
      assignedTo: 'human_site_observer',
      severity: 'review',
      blockingPublicDisplay: true,
      ...options,
    }
    issues.push({
      id: `${issueKey}:${digest(definition).slice(0, 16)}`,
      ...definition,
    })
  }
  for (const pair of research.duplicateReviewPairs) {
    const members = [byId.get(pair.firstId), byId.get(pair.secondId)]
    if (members.some((c) => !c))
      throw new Error('Duplicate pair references missing source observation')
    const common = commonProviderIdentities(members)
    const group = groupsByCandidate.get(pair.firstId)
    const shared = group && group.sourceCandidateIds.includes(pair.secondId)
    const conflict = group?.flags.includes('shared_identity_location_conflict')
    const resolved = common.length > 0 && shared && !conflict
    add(
      'duplicate_pair',
      members.map((c) => c.id),
      [
        resolved
          ? 'explicit_shared_provider_identity'
          : conflict
            ? 'shared_provider_identity_has_location_conflict'
            : 'proximity_or_containment_does_not_prove_identity',
      ],
      {
        originalPair: pair,
        observations: members.map(sourceEvidence),
        sharedProviderIdentities: common,
        facilityGroupId: shared ? group.id : null,
        physicalIdentityConfirmed: false,
      },
      {
        status: resolved ? 'resolved_source_identity' : 'human_review_required',
        assignedTo: resolved
          ? 'automated_source_identity_audit'
          : 'human_data_reviewer',
        blockingPublicDisplay: !resolved,
        severity: conflict ? 'high' : 'review',
      },
    )
  }
  for (const group of research.facilityGroups.filter((g) =>
    g.flags.includes('shared_identity_location_conflict'),
  )) {
    const members = group.sourceCandidateIds.map((id) => byId.get(id))
    add(
      'provider_identity_location_conflict',
      group.sourceCandidateIds,
      [
        'shared_source_identity_is_not_a_confirmed_physical_facility',
        'conflicting_locations_must_not_be_averaged_or_silently_chosen',
      ],
      {
        facilityGroupId: group.id,
        maximumLocationSpreadMeters: group.maximumLocationSpreadMeters,
        observations: members.map(sourceEvidence),
        sharedProviderIdentities: commonProviderIdentities(members),
      },
      { severity: 'high', assignedTo: 'human_data_reviewer' },
    )
  }
  const relationships = reviewRelationships(research.candidates)
  const related = new Map(relationships.map((r) => [r.candidateId, r]))
  const cutoff = `${research.sourceAsOf.slice(0, 4) - 2}${research.sourceAsOf.slice(4, 10)}`
  for (const c of research.candidates) {
    const reasons = [
      'no_physical_verification',
      'current_operation_and_visitor_rights_unconfirmed',
    ]
    if (!pointValid(c.representativePoint))
      reasons.push('invalid_representative_coordinates')
    if (polygon(c) && !pointInNcrGeometry(c.representativePoint, c.geometry))
      reasons.push('representative_point_outside_source_footprint')
    if (
      c.restrictedAccess ||
      [
        'private',
        'no',
        'permit',
        'residents',
        'emergency',
        'delivery',
        'destination',
        'psv',
      ].includes(c.accessClass)
    )
      reasons.push('mapped_restricted_or_purpose_limited_access')
    if (c.accessClass === 'unknown') reasons.push('public_access_unknown')
    if (c.accessClass === 'customers')
      reasons.push('customer_access_conditions_need_confirmation')
    if (c.type === 'street_segment')
      reasons.push('street_legality_side_extent_and_schedule_unconfirmed')
    if (c.conditionalRulesPresent)
      reasons.push('conditional_access_or_parking_rules_need_review')
    if (c.requiresLicenseReview) reasons.push('provider_license_unresolved')
    if (c.sourceRecordEditedAt && c.sourceRecordEditedAt.slice(0, 10) < cutoff)
      reasons.push(
        'old_source_edit_requires_freshness_check_not_proof_of_closure',
      )
    if (c.type === 'facility_unspecified')
      reasons.push('structural_facility_subtype_not_established')
    if (
      meaningfulName(c) &&
      /smoking|mechanical|car.?wash|repair|door.?service|chemin neuf/i.test(
        c.name,
      )
    )
      reasons.push(
        'name_suggests_possible_nonparking_or_business_category_mismatch',
      )
    if (c.priorHumanReview?.reviewStatus === 'excluded_pending_reason')
      reasons.push('prior_owner_exclusion_preserved')
    if (
      c.priorHumanReview?.siteVisitRequired ||
      c.priorHumanReview?.reviewStatus === 'needs_site_visit'
    )
      reasons.push('prior_owner_site_visit_required')
    if (c.flags.includes('mapped_closed_or_disused'))
      reasons.push('mapped_closed_or_disused')
    if (c.type === 'entrance' || c.type === 'space')
      reasons.push('child_feature_not_an_independent_facility')
    add(
      'candidate_evidence_gap',
      [c.id],
      reasons,
      {
        sourceObservationId: c.id,
        sourceAccess: c.accessClass,
        sourceTagsSupportingCategory: Object.fromEntries(
          [
            'amenity',
            'parking',
            'building',
            'access',
            'operator',
            'parking:condition',
          ]
            .filter((key) => c.sourceTags[key] !== undefined)
            .map((key) => [key, c.sourceTags[key]]),
        ),
        relationshipReviewCandidateId: related.has(c.id) ? c.id : null,
        priorDecisionRecordId: c.priorHumanReview ? c.id : null,
        mallAssociation: null,
        commercialUseConfirmed: false,
        operatingStatus: c.operatingStatus,
      },
      {
        severity: reasons.some((r) =>
          /invalid_|restricted|exclusion|closed|license/.test(r),
        )
          ? 'high'
          : 'review',
        requiredRoles:
          c.type === 'street_segment'
            ? ['human_site_observer', 'human_legal_reviewer']
            : ['human_site_observer', 'human_data_reviewer'],
      },
    )
  }
  const positions = new Map()
  for (const c of research.candidates.filter((c) =>
    pointValid(c.representativePoint),
  )) {
    const key = c.representativePoint.map((x) => x.toFixed(6)).join(',')
    if (!positions.has(key)) positions.set(key, [])
    positions.get(key).push(c)
  }
  for (const [coordinate, members] of positions)
    if (members.length >= 5)
      add(
        'coincident_source_positions',
        members.map((c) => c.id),
        [
          'coincident_coordinates_can_mean_floors_bays_or_geocoding_error_not_automatic_duplicates',
        ],
        {
          coordinate,
          count: members.length,
          observations: members.map(sourceEvidence),
        },
        { assignedTo: 'human_data_reviewer' },
      )
  return {
    issues: issues.sort((a, b) => a.id.localeCompare(b.id)),
    relationships,
    summary: {
      sourceObservations: research.candidates.length,
      duplicatePairsInvestigated: research.duplicateReviewPairs.length,
      conflictingProviderGroupsInvestigated: research.facilityGroups.filter(
        (g) => g.flags.includes('shared_identity_location_conflict'),
      ).length,
      duplicatePairsResolvedBySourceIdentity: issues.filter(
        (i) =>
          i.kind === 'duplicate_pair' &&
          i.status === 'resolved_source_identity',
      ).length,
      duplicatePairsRequiringHumanReview: issues.filter(
        (i) =>
          i.kind === 'duplicate_pair' && i.status === 'human_review_required',
      ).length,
      relationshipProposals: relationships.length,
      confirmedPhysicalRelationships: 0,
      physicallyVerified: 0,
      publicationApproved: 0,
    },
  }
}

export function validateReviewLedger(ledger) {
  if (
    ledger?.schemaVersion !== 1 ||
    !Array.isArray(ledger.issues) ||
    !Array.isArray(ledger.events)
  )
    throw new Error('Invalid review ledger')
  if (digest(ledger.issues) !== ledger.catalogHash)
    throw new Error('Review issue catalog integrity mismatch')
  const ids = new Set()
  for (const issue of ledger.issues) {
    const { id, ...definition } = issue
    if (
      ids.has(issue.id) ||
      !issue.candidateIds?.length ||
      issue.blockingPublicDisplay !==
        (issue.status !== 'resolved_source_identity')
    )
      throw new Error('Invalid or duplicated issue definition')
    if (
      id !== `${issue.issueKey}:${digest(definition).slice(0, 16)}` ||
      !ledger.sourceSnapshots?.includes(issue.sourceSnapshot)
    )
      throw new Error('Issue evidence identity mismatch')
    ids.add(issue.id)
  }
  let previousHash = null
  for (const [index, event] of ledger.events.entries()) {
    const { eventHash, ...payload } = event
    if (
      event.sequence !== index + 1 ||
      event.previousHash !== previousHash ||
      digest(payload) !== eventHash ||
      !ids.has(event.issueId)
    )
      throw new Error('Review audit-chain integrity mismatch')
    const keys = new Set([
      'sequence',
      'previousHash',
      'eventHash',
      'issueId',
      'action',
      'actor',
      'observedAt',
      'evidenceReference',
      'payloadHash',
      'outcome',
      'note',
    ])
    if (
      Object.keys(event).some((key) => !keys.has(key)) ||
      ![
        'record_field_submission',
        'request_review',
        'human_rejection',
        'human_identity_resolution',
        'reopen',
      ].includes(event.action) ||
      typeof event.evidenceReference !== 'string' ||
      !event.evidenceReference.trim() ||
      typeof event.actor !== 'string' ||
      !event.actor.trim() ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(event.observedAt) ||
      !Number.isFinite(Date.parse(event.observedAt)) ||
      Date.parse(event.observedAt) > Date.now()
    )
      throw new Error('Unsupported review event')
    previousHash = eventHash
  }
  return true
}

export function updateReviewLedger(research, previous = null) {
  if (previous) validateReviewLedger(previous)
  const findings = buildQualityFindings(research)
  const byId = new Map((previous?.issues || []).map((i) => [i.id, i]))
  for (const issue of findings.issues) {
    if (
      byId.has(issue.id) &&
      canonical(byId.get(issue.id)) !== canonical(issue)
    )
      throw new Error(
        'Existing source issue changed without a new evidence version',
      )
    byId.set(issue.id, issue)
  }
  const issues = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
  const ledger = {
    schemaVersion: 1,
    policy:
      'Research-only immutable issue definitions and append-only audit events. Source identity resolution is not physical identity, access, legal, verification or publication approval.',
    evidenceSources: {
      sourceObservationIds: 'metro-parking-research.json.gz#candidates[id]',
      relationshipReviewCandidateIds:
        'relationship-review.json#relationships[candidateId]',
      priorDecisionRecordIds: 'poblacion-preservation.json#decisions[id]',
      licensing: 'licenses/README.md',
      note: 'References preserve original source IDs and point to the immutable hash-verified source archive; they do not discard geometry, source licenses or decisions.',
    },
    sourceHashes: research.sourceHashes,
    sourceAsOf: research.sourceAsOf,
    sourceSnapshots: [
      ...new Set([
        ...(previous?.sourceSnapshots || []),
        digest(research.sourceHashes),
      ]),
    ].sort(),
    catalogHash: digest(issues),
    issues,
    events: previous?.events || [],
    summary: findings.summary,
  }
  validateReviewLedger(ledger)
  return { ledger, relationships: findings.relationships }
}

export function appendReviewEvent(ledger, input) {
  validateReviewLedger(ledger)
  const payload = {
    sequence: ledger.events.length + 1,
    previousHash: ledger.events.at(-1)?.eventHash || null,
    ...input,
  }
  const result = {
    ...ledger,
    events: [...ledger.events, { ...payload, eventHash: digest(payload) }],
  }
  validateReviewLedger(result)
  return result
}

function main() {
  const directory = process.argv[2] || 'data/ncr-research'
  const path = join(directory, 'review-ledger.json')
  // All ledger writers share the field-submission lock; never overwrite a
  // concurrent human evidence event during catalog regeneration.
  const lockPath = path + '.lock'
  const lock = openSync(lockPath, 'wx')
  try {
    const previous = existsSync(path)
      ? JSON.parse(readFileSync(path, 'utf8'))
      : null
    const research = loadNcrResearch(directory)
    const { ledger, relationships } = updateReviewLedger(research, previous)
    if (process.argv.includes('--check')) {
      if (!previous || canonical(previous) !== canonical(ledger))
        throw new Error('Review ledger requires regeneration')
      const saved = JSON.parse(
        readFileSync(join(directory, 'relationship-review.json'), 'utf8'),
      )
      assert.deepEqual(saved, {
        schemaVersion: 1,
        sourceHashes: research.sourceHashes,
        policy:
          'Geometric review proposals only; never independent corroboration, physical identity, access or permission.',
        relationships,
      })
    } else {
      mkdirSync(dirname(path), { recursive: true })
      const temporary = path + '.pending'
      try {
        writeFileSync(temporary, JSON.stringify(ledger, null, 2) + '\n', {
          flag: 'wx',
        })
        renameSync(temporary, path)
      } finally {
        if (existsSync(temporary)) unlinkSync(temporary)
      }
      writeFileSync(
        join(directory, 'relationship-review.json'),
        JSON.stringify(
          {
            schemaVersion: 1,
            sourceHashes: research.sourceHashes,
            policy:
              'Geometric review proposals only; never independent corroboration, physical identity, access or permission.',
            relationships,
          },
          null,
          2,
        ) + '\n',
      )
    }
    process.stdout.write(
      JSON.stringify({
        ...ledger.summary,
        issueCount: ledger.issues.length,
        eventCount: ledger.events.length,
      }) + '\n',
    )
  } finally {
    closeSync(lock)
    unlinkSync(lockPath)
  }
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
