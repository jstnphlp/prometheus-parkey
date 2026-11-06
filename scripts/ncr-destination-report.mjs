/** Reproducible, private destination descriptors; never parking-name approval. */
import { createHash } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'

import {
  destinationDistanceMeters,
  reviewNearbyDestinations,
} from './ncr-destination-labels.mjs'
import {
  buildPermittedEnrichment,
  prioritizedRecords,
} from './ncr-permitted-enrichment.mjs'
import { loadNcrResearch } from './ncr-quality-review.mjs'

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
const source = (filename) => {
  const bytes = readFileSync(filename)
  const raw = filename.endsWith('.gz') ? gunzipSync(bytes) : bytes
  const value = JSON.parse(raw.toString('utf8'))
  return {
    value,
    provenance: {
      filename,
      sha256: digest(bytes),
      uncompressedSha256: digest(raw),
      sourceMetadata: value.sourceMetadata || null,
    },
  }
}
const identity = (value) =>
  String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
const sameDestination = (first, second) =>
  first.sourceId === second.sourceId ||
  (first.duplicateSourceIds || []).some((id) =>
    (second.duplicateSourceIds || []).includes(id),
  ) ||
  (identity(first.destination) === identity(second.destination) &&
    Array.isArray(first.sourceCoordinate) &&
    Array.isArray(second.sourceCoordinate) &&
    destinationDistanceMeters(
      first.sourceCoordinate,
      second.sourceCoordinate,
    ) <= 40)

export function summarizeDestinationGroup(group, memberReviews) {
  const alternatives = [
    ...new Map(
      memberReviews
        .flatMap((review) => review.alternatives)
        .map((item) => [item.sourceId + '|' + item.parkingRecordId, item]),
    ).values(),
  ]
  const labels = memberReviews.map((review) => review.label).filter(Boolean)
  const reasons = [
    ...new Set(memberReviews.flatMap((review) => review.reasons)),
  ]
  let outcome,
    label = null
  if (group.originalStatus !== 'unnamed_pending_reference')
    outcome = 'previously_named'
  else if (
    group.accessPriority === 'restricted_or_unsuitable' ||
    memberReviews.some(
      (review) => review.outcome === 'restricted_or_unsuitable',
    )
  )
    outcome = 'restricted_or_unsuitable'
  else if (
    group.identityConflict ||
    memberReviews.some((review) => review.outcome === 'ambiguous') ||
    labels.some((item) => !sameDestination(labels[0], item))
  )
    outcome = 'ambiguous'
  else if (labels.length === memberReviews.length && labels.length > 0) {
    outcome = 'described'
    label = labels[0]
  } else if (labels.length > 0) {
    outcome = 'ambiguous'
    reasons.push(
      'The grouped source anchors do not support the same destination; retain every original coordinate for review.',
    )
  } else outcome = 'no_suitable_destination'
  if (group.identityConflict)
    reasons.push(
      'Conflicting geographic or identity evidence requires human resolution.',
    )
  return { outcome, label, alternatives, reasons, memberReviews }
}

/** Every original unnamed group receives exactly one mutually exclusive outcome. */
export function buildDestinationReport(
  research,
  enrichment,
  { baseline = null } = {},
) {
  const candidates = new Map(
    research.candidates.map((candidate) => [candidate.id, candidate]),
  )
  for (const group of enrichment.records) {
    const memberReviews = group.candidateIds.map((id) => ({
      recordId: id,
      ...reviewNearbyDestinations(candidates.get(id), group, {
        privatePreview: true,
      }),
    }))
    group.destinationReview = summarizeDestinationGroup(group, memberReviews)
  }
  const unnamed = enrichment.records.filter(
    (group) => group.originalStatus === 'unnamed_pending_reference',
  )
  const count = (outcome) =>
    unnamed.filter((group) => group.destinationReview.outcome === outcome)
      .length
  const priorLabels = new Map(
    (baseline?.descriptors || []).map((row) => [row.groupId, row.label]),
  )
  if (
    baseline &&
    (digest(JSON.stringify(baseline.sourceHashes)) !==
      digest(JSON.stringify(research.sourceHashes)) ||
      priorLabels.size !== unnamed.length ||
      unnamed.some((group) => !priorLabels.has(group.groupId)))
  )
    throw new Error(
      'Baseline descriptions belong to another or incomplete facility snapshot',
    )
  const newDescriptions = unnamed.filter(
    (group) =>
      group.destinationReview.outcome === 'described' &&
      !priorLabels.get(group.groupId),
  ).length
  const totals = {
    originalUnnamedFacilityGroups: unnamed.length,
    destinationDescriptionGroups: count('described'),
    newlyAssignedDestinationDescriptions: newDescriptions,
    previouslyDescribedGroups: [...priorLabels.values()].filter(Boolean).length,
    retainedOrRefinedDescriptionGroups: count('described') - newDescriptions,
    previousDescriptionsWithheld: unnamed.filter(
      (group) =>
        priorLabels.get(group.groupId) &&
        group.destinationReview.outcome !== 'described',
    ).length,
    previouslyNamedFacilities:
      enrichment.baseNameTotals.cross_source_name_candidate +
      enrichment.baseNameTotals.source_named_requires_cross_reference,
    previousIdentityOrNameConflicts:
      enrichment.baseNameTotals.identity_or_name_conflict,
    unnamedWithNoSuitableDestination: count('no_suitable_destination'),
    ambiguousDestinationMatches: count('ambiguous'),
    restrictedOrUnsuitableFacilities: count('restricted_or_unsuitable'),
    newOfficialNamesVerified: 0,
    publicPublicationApprovals: 0,
    officiallyUnnamedAfter: unnamed.length,
    processedFacilityGroups: enrichment.records.length,
  }
  if (
    totals.originalUnnamedFacilityGroups !==
    totals.destinationDescriptionGroups +
      totals.unnamedWithNoSuitableDestination +
      totals.ambiguousDestinationMatches +
      totals.restrictedOrUnsuitableFacilities
  )
    throw new Error('Incomplete unnamed-group outcome partition')
  enrichment.destinationTotals = totals
  enrichment.destinationPolicy =
    'Private descriptive context only. Source anchors are not verified vehicle entrances. Straight-line distance is not a walkable route, ownership, visitor eligibility, current operation or availability. Original names and publication approvals are unchanged.'
  return enrichment
}

export function destinationQueue(report) {
  return prioritizedRecords(report)
    .filter((group) => group.originalStatus === 'unnamed_pending_reference')
    .map((group, index) => ({
      priority: index + 1,
      groupId: group.groupId,
      parkeyRecordIds: group.candidateIds,
      area: group.area,
      outcome: group.destinationReview.outcome,
      proposedDescriptiveLabel: group.destinationReview.label?.label || null,
      proposedAlternativesForReview: group.destinationReview.alternatives.map(
        (item) => item.label,
      ),
      alternatives: group.destinationReview.alternatives,
      sourceCoordinatesAndInspectionLinks: group.reviewLinks,
      access: group.accessPriority,
      restrictions: group.unsuitableSourceIds,
      uncertainties: [
        ...group.uncertainties,
        ...group.destinationReview.reasons,
      ],
      physicalChecks: [
        ...group.onSiteChecks,
        'Check whether motorists visiting the proposed destination may legally use this parking; proximity alone does not establish permission or ownership.',
        'Identify the actual vehicle entrance and any barriers, one-way restrictions, pedestrian connections or separate properties between the source anchor and destination.',
        'If several destinations are plausible, record signage and visitor conditions without choosing an official parking name from proximity.',
      ],
      physicalVerificationComplete: false,
      publicationApproved: false,
    }))
}
const csv = (rows) => {
  const columns = Object.keys(rows[0] || {})
  const cell = (value) =>
    '"' +
    String(
      typeof value === 'object' ? JSON.stringify(value) : (value ?? ''),
    ).replace(/"/g, '""') +
    '"'
  return (
    columns.join(',') +
    '\n' +
    rows
      .map((row) => columns.map((column) => cell(row[column])).join(','))
      .join('\n') +
    '\n'
  )
}

function main() {
  const args = process.argv.slice(2)
  const allowed = new Set([
    '--context',
    '--parking',
    '--out-dir',
    '--acquisition',
    '--baseline',
  ])
  const values = new Map()
  if (![8, 10].includes(args.length))
    throw new Error(
      'Usage: node scripts/ncr-destination-report.mjs --context context.geojson.gz --parking parking.geojson.gz --acquisition acquisition.json --out-dir NEW_DIRECTORY',
    )
  for (let i = 0; i < args.length; i += 2) {
    if (!allowed.has(args[i]) || values.has(args[i]) || !args[i + 1])
      throw new Error('Invalid or duplicate report option')
    values.set(args[i], args[i + 1])
  }
  const context = source(values.get('--context')),
    parking = source(values.get('--parking')),
    acquisition = source(values.get('--acquisition'))
  const baseline = values.has('--baseline')
    ? source(values.get('--baseline'))
    : null
  if (
    acquisition.value.publisherChecksumMatched !== true ||
    !/^[a-f0-9]{64}$/.test(acquisition.value.sha256 || '') ||
    [context.value, parking.value].some(
      (collection) =>
        collection.sourceMetadata?.inputSha256 !== acquisition.value.sha256 ||
        collection.sourceMetadata?.license !== 'ODbL-1.0',
    )
  )
    throw new Error(
      'Source derivatives do not match the checksum-verified acquired snapshot',
    )
  const research = loadNcrResearch()
  const report = buildDestinationReport(
    research,
    buildPermittedEnrichment(research, {
      contextOsm: context.value,
      refreshedOsm: parking.value,
      destinationEvidence: true,
    }),
    { baseline: baseline?.value || null },
  )
  report.additionalSourceProvenance = {
    'context-osm': context.provenance,
    'refreshed-osm': parking.provenance,
    acquisition: acquisition.provenance,
    ...(baseline ? { baseline: baseline.provenance } : {}),
  }
  const queue = destinationQueue(report)
  const out = values.get('--out-dir')
  const outputs = [
    ['destination-enrichment.json.gz', JSON.stringify(report) + '\n'],
    ['destination-review-queue.json.gz', JSON.stringify(queue) + '\n'],
    ['destination-review-queue.csv.gz', csv(queue)],
    [
      'destination-summary.json',
      JSON.stringify(report.destinationTotals, null, 2) + '\n',
    ],
    [
      'destination-top-ten.json',
      JSON.stringify(
        queue.filter((row) => row.outcome === 'described').slice(0, 10),
        null,
        2,
      ) + '\n',
    ],
    [
      'destination-ambiguity-shortlist.json',
      JSON.stringify(
        queue.filter((row) => row.outcome === 'ambiguous').slice(0, 30),
        null,
        2,
      ) + '\n',
    ],
  ]
  const manifestPath = join(out, 'review-manifest.json')
  if (
    existsSync(manifestPath) ||
    outputs.some(([filename]) => existsSync(join(out, filename)))
  )
    throw new Error('Refusing to overwrite destination artifacts')
  const hashes = {}
  for (const [filename, contents] of outputs) {
    const path = join(out, filename)
    mkdirSync(dirname(path), { recursive: true })
    const bytes = filename.endsWith('.gz')
      ? gzipSync(contents, { mtime: 0 })
      : Buffer.from(contents)
    writeFileSync(path, bytes, { flag: 'wx' })
    hashes[filename] = digest(bytes)
  }
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        sourceHashes: research.sourceHashes,
        command: ['node', 'scripts/ncr-destination-report.mjs', ...args],
        inputs: report.additionalSourceProvenance,
        outputs: hashes,
        totals: report.destinationTotals,
        policy: report.destinationPolicy,
      },
      null,
      2,
    ) + '\n',
    { flag: 'wx' },
  )
  process.stdout.write(JSON.stringify(report.destinationTotals, null, 2) + '\n')
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
