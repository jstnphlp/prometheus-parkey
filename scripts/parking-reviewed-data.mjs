/**
 * Rebuilds a read-only parking review report from the unchanged Overture export,
 * the bundled OSM baseline, and a separate human decisions ledger.
 *
 * Never writes mobile discovery, the database, the decision ledger or live data.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL, URL } from 'node:url'
import process from 'node:process'
import {
  buildOpenDataReview,
  fromOvertureGeojson,
} from './parking-open-data.mjs'

const statuses = new Set([
  'online_corroborated',
  'needs_site_visit',
  'excluded_pending_reason',
])
const hash = (raw) => createHash('sha256').update(raw).digest('hex')

// The historical comparison hashed this exact snapshot in a Windows CRLF
// checkout. Git stores LF. Preserve its recorded hash; allow only this proven
// byte-equivalent historical pair, never normalize arbitrary future snapshots.
export function matchesSnapshotReviewHash(bytes, expected) {
  const actual = hash(bytes)
  return (
    actual === expected ||
    (actual ===
      '0464b1c51b2fdecad22c9107d77bb452a5bcfc10c878d125b1ba28dda047c2f2' &&
      expected ===
        '4e7d511df06c52dc2a803e244f14f4c78717b450aaf12862d68524acee5b7012')
  )
}
const text = (value) => typeof value === 'string' && value.trim().length > 0
const yyyyMmDd = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value

export function buildReviewedParkingData({
  existing,
  geojson,
  ledger,
  sourceAsOf,
  sourceHashes,
}) {
  if (!ledger || ledger.schemaVersion !== 1 || !Array.isArray(ledger.decisions))
    throw new Error('Expected a versioned human decisions ledger.')
  if (!sourceHashes?.bundledOsm || !sourceHashes?.overture)
    throw new Error('Missing source-file hashes.')
  const overture = fromOvertureGeojson(geojson)
  const baseline = buildOpenDataReview({
    existing,
    overture,
    asOf: sourceAsOf,
    inputHashes: sourceHashes,
  })
  const byId = new Map(
    baseline.candidates.map((candidate) => [candidate.id, candidate]),
  )
  const byDecisionId = new Map()
  for (const decision of ledger.decisions) {
    if (
      !decision ||
      !text(decision.id) ||
      byDecisionId.has(decision.id) ||
      !byId.has(decision.id) ||
      !statuses.has(decision.reviewStatus) ||
      !yyyyMmDd(decision.reviewedOn) ||
      decision.reviewedOn > new Date().toISOString().slice(0, 10) ||
      decision.sourceName !== byId.get(decision.id).name ||
      !text(decision.evidenceNote) ||
      decision.siteVisitAt !== null ||
      decision.publicationApproved !== false ||
      decision.evidenceReference !== null
    )
      throw new Error(
        'Invalid or mismatched review decision: ' + (decision?.id ?? 'unknown'),
      )
    if (
      (decision.reviewStatus === 'online_corroborated' &&
        decision.method !== 'google_maps_name_search') ||
      (decision.reviewStatus !== 'online_corroborated' &&
        decision.method !== null)
    )
      throw new Error(
        'Review method does not match review status for ' + decision.id,
      )
    byDecisionId.set(decision.id, decision)
  }
  if (byDecisionId.size !== baseline.candidates.length)
    throw new Error(
      'Decisions must account for every Overture source candidate.',
    )
  const candidates = baseline.candidates.map((candidate) => {
    const decision = byDecisionId.get(candidate.id)
    return {
      ...candidate,
      // A name listing found online is not a verified facility or permission to park.
      status: 'researched',
      verification: 'unverified',
      verifiedAt: null,
      reviewDecision: {
        status: decision.reviewStatus,
        reviewedOn: decision.reviewedOn,
        method: decision.method,
        evidenceReference: decision.evidenceReference,
        evidenceNote: decision.evidenceNote,
        siteVisitAt: null,
        publicationApproved: false,
      },
    }
  })
  const eligibleForFurtherReview = candidates.filter(
    (c) => c.reviewDecision.status !== 'excluded_pending_reason',
  )
  const possibleUnamedMatches = new Set(
    eligibleForFurtherReview.flatMap((c) =>
      c.possibleBundledMatches.filter((m) => m.isUnnamed).map((m) => m.id),
    ),
  )
  const countStatus = (status) =>
    candidates.filter((c) => c.reviewDecision.status === status).length
  return {
    schemaVersion: 2,
    sourceAsOf,
    pilotBounds: baseline.pilotBounds,
    sourceHashes,
    policy:
      'Human decisions remain separate from source data. Google Maps name searches are user-reported online corroboration only, not evidence that a driver may park at a coordinate. Site visits and provider license review remain pending; no candidates are field-verified or publication-approved. Potential matches are not confirmed duplicates. Source file dates are not field-observation dates.',
    counts: {
      existing: existing.length,
      existingUnnamed: baseline.counts.existingUnnamed,
      sourceCandidates: candidates.length,
      retainedForReview: eligibleForFurtherReview.length,
      onlineCorroborated: countStatus('online_corroborated'),
      needsSiteVisit: countStatus('needs_site_visit'),
      excludedPendingReason: countStatus('excluded_pending_reason'),
      potentialNewFacilities: eligibleForFurtherReview.filter(
        (c) => !c.possibleBundledMatches.length,
      ).length,
      potentiallyMatchingUnnamed: possibleUnamedMatches.size,
      unknownLicense: candidates.filter((c) => c.sourceLicense === 'unknown')
        .length,
      physicallyVerified: 0,
      publicationApproved: 0,
    },
    candidates,
  }
}

function main() {
  const args = process.argv.slice(2)
  if (args.length !== 1 || !['--write', '--check'].includes(args[0]))
    throw new Error(
      'Usage: node scripts/parking-reviewed-data.mjs --write|--check',
    )
  const read = (relative) => readFileSync(new URL(relative, import.meta.url))
  const existingBytes = read('../apps/mobile/src/discovery/osm-pilot.json')
  const geoBytes = read('../poblacion-places.geojson')
  const source = JSON.parse(
    read('../data/parking-open-data-review.json').toString('utf8'),
  )
  const ledger = JSON.parse(
    read('../data/parking-open-data-decisions.json').toString('utf8'),
  )
  const hashes = source.sourceHashes
  if (
    !matchesSnapshotReviewHash(existingBytes, hashes?.bundledOsm) ||
    hash(geoBytes) !== hashes?.overture
  )
    throw new Error(
      'Source inputs changed since original comparison. Review source changes before regenerating.',
    )
  const reviewed = buildReviewedParkingData({
    existing: JSON.parse(existingBytes.toString('utf8')),
    geojson: JSON.parse(geoBytes.toString('utf8')),
    ledger,
    sourceAsOf: source.asOf,
    sourceHashes: hashes,
  })
  const output = new URL(
    '../data/parking-open-data-reviewed.json',
    import.meta.url,
  )
  const expected = JSON.stringify(reviewed, null, 2) + '\n'
  if (args[0] === '--check') {
    if (readFileSync(output, 'utf8') !== expected)
      throw new Error(
        'Reviewed file is stale; run --write after examining decisions.',
      )
  } else writeFileSync(output, expected)
  process.stdout.write(JSON.stringify(reviewed.counts, null, 2) + '\n')
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
