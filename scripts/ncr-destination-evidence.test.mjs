import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { URL } from 'node:url'
import { gunzipSync } from 'node:zlib'

import {
  buildDestinationReport,
  destinationQueue,
} from './ncr-destination-report.mjs'
import {
  destinationDistanceMeters,
  destinationEvidenceUncertainties,
  parkingDestinationUnsuitable,
} from './ncr-destination-labels.mjs'
import { geometryBounds, pointInNcrGeometry } from './ncr-geography.mjs'
import { buildPermittedEnrichment } from './ncr-permitted-enrichment.mjs'
import { loadNcrResearch } from './ncr-quality-review.mjs'
import { parseCsv } from './parking-open-data.mjs'

const directory = 'data/ncr-destinations/2026-11-05'
const acquisition = join(directory, 'acquisition-42032920734')
const derivatives = join(acquisition, 'derivatives')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const raw = (path) =>
  path.endsWith('.gz') ? gunzipSync(readFileSync(path)) : readFileSync(path)
const json = (path) => JSON.parse(raw(path).toString('utf8'))
const report = () => json(join(directory, 'destination-enrichment.json.gz'))

test('fresh OSM destination derivatives and report outputs retain linked source and boundary hashes', () => {
  const downloaded = json(join(acquisition, 'acquisition.json'))
  assert.equal(downloaded.publisherChecksumMatched, true)
  assert.ok(downloaded.bytes > 0)
  assert.match(
    downloaded.resolvedUrl,
    /^https:\/\/download\.geofabrik\.de\/asia\/philippines-\d{6}\.osm\.pbf$/,
  )
  assert.match(downloaded.sha256, /^[a-f0-9]{64}$/)
  assert.equal(downloaded.md5, downloaded.publisherMd5.split(/\s/)[0])
  assert.ok(
    Date.parse(downloaded.downloadCompletedAt) >=
      Date.parse(downloaded.downloadStartedAt),
  )
  const sourceManifest = json(join(derivatives, 'osm-source-manifest.json'))
  assert.equal(sourceManifest.license, 'ODbL-1.0')
  assert.equal(
    sha(readFileSync(sourceManifest.boundaryFile)),
    sourceManifest.boundarySha256,
  )
  for (const artifact of sourceManifest.artifacts) {
    const path = join(derivatives, artifact.filename)
    assert.equal(sha(readFileSync(path)), artifact.sha256, path)
    assert.equal(sha(raw(path)), artifact.uncompressedSha256, path)
    assert.equal(
      artifact.coarseExtractionManifest.inputSha256,
      downloaded.sha256,
    )
    assert.equal(json(path).sourceMetadata.inputSha256, downloaded.sha256)
    assert.equal(json(path).features.length, artifact.features)
  }
  const manifest = json(join(directory, 'review-manifest.json'))
  for (const [filename, hash] of Object.entries(manifest.outputs))
    assert.equal(sha(readFileSync(join(directory, filename))), hash, filename)
  for (const provenance of Object.values(manifest.inputs)) {
    assert.equal(sha(readFileSync(provenance.filename)), provenance.sha256)
    assert.equal(sha(raw(provenance.filename)), provenance.uncompressedSha256)
  }
  const baseline = json(join(directory, 'baseline-descriptors.json.gz'))
  assert.match(baseline.startingCommit, /^[a-f0-9]{40}$/)
  assert.equal(
    sha(readFileSync(baseline.sourceReport)),
    baseline.sourceReportSha256,
  )
  assert.equal(
    sha(raw(join(directory, baseline.policyFile))),
    baseline.uncompressedPolicySha256,
  )
  assert.equal(baseline.originalUnnamedFacilityGroups, 3112)
  assert.equal(
    baseline.describedGroups,
    baseline.descriptors.filter((row) => row.label).length,
  )
})

test('all 3112 unnamed groups reproduce with a complete outcome partition and unchanged frozen identities', () => {
  const research = loadNcrResearch()
  const original = sha(JSON.stringify(research))
  const stored = report()
  const baseline = json(join(directory, 'baseline-descriptors.json.gz'))
  const rebuilt = buildDestinationReport(
    research,
    buildPermittedEnrichment(research, {
      refreshedOsm: json(join(derivatives, 'ncr-osm-parking.geojson.gz')),
      contextOsm: json(join(derivatives, 'ncr-name-context.geojson.gz')),
      destinationEvidence: true,
    }),
    { baseline },
  )
  assert.deepEqual(stored.records, rebuilt.records)
  assert.deepEqual(stored.destinationTotals, rebuilt.destinationTotals)
  assert.equal(sha(JSON.stringify(research)), original)
  const totals = stored.destinationTotals
  assert.equal(totals.originalUnnamedFacilityGroups, 3112)
  assert.equal(totals.officiallyUnnamedAfter, 3112)
  assert.equal(totals.processedFacilityGroups, research.facilityGroups.length)
  assert.equal(
    totals.destinationDescriptionGroups +
      totals.unnamedWithNoSuitableDestination +
      totals.ambiguousDestinationMatches +
      totals.restrictedOrUnsuitableFacilities,
    3112,
  )
  assert.equal(totals.newOfficialNamesVerified, 0)
  assert.equal(totals.publicPublicationApprovals, 0)
  const prior = new Map(
    baseline.descriptors.map((row) => [row.groupId, row.label]),
  )
  const unnamed = stored.records.filter(
    (group) => group.originalStatus === 'unnamed_pending_reference',
  )
  assert.equal(prior.size, 3112)
  assert.equal(
    totals.previouslyDescribedGroups,
    [...prior.values()].filter(Boolean).length,
  )
  assert.equal(
    totals.newlyAssignedDestinationDescriptions,
    unnamed.filter(
      (group) =>
        group.destinationReview.outcome === 'described' &&
        !prior.get(group.groupId),
    ).length,
  )
  assert.equal(
    totals.destinationDescriptionGroups,
    totals.newlyAssignedDestinationDescriptions +
      totals.retainedOrRefinedDescriptionGroups,
  )
  assert.equal(
    totals.previouslyDescribedGroups,
    totals.retainedOrRefinedDescriptionGroups +
      totals.previousDescriptionsWithheld,
  )
  assert.equal(
    new Set(stored.records.map((group) => group.groupId)).size,
    research.facilityGroups.length,
  )
  for (const group of stored.records) {
    assert.equal(group.publicationApproved, false)
    assert.equal(group.physicalVerified, false)
    assert.equal(group.nameConfirmed, false)
    assert.equal(group.visitorAccessConfirmed, false)
    assert.equal(group.approvedDisplayName, null)
  }
})

test('every accepted descriptor has original parking anchors, fresh OSM provenance and recomputable geographic evidence', () => {
  const candidates = new Map(
    loadNcrResearch().candidates.map((candidate) => [candidate.id, candidate]),
  )
  const features = new Map(
    json(join(derivatives, 'ncr-name-context.geojson.gz')).features.map(
      (feature) => [
        'osm:' + feature.properties['@type'] + '/' + feature.properties['@id'],
        feature,
      ],
    ),
  )
  const downloaded = json(join(acquisition, 'acquisition.json'))
  let checked = 0
  for (const group of report().records) {
    if (group.destinationReview.outcome !== 'described') {
      assert.equal(group.destinationReview.label, null)
      continue
    }
    assert.equal(group.originalStatus, 'unnamed_pending_reference')
    assert.notEqual(group.accessPriority, 'restricted_or_unsuitable')
    assert.equal(group.identityConflict, false)
    assert.deepEqual(group.unsuitableSourceIds, [])
    for (const review of group.destinationReview.memberReviews) {
      assert.equal(review.outcome, 'described')
      const label = review.label
      const member = candidates.get(review.recordId)
      const source = features.get(label.sourceId)
      assert.ok(source)
      assert.deepEqual(destinationEvidenceUncertainties(source.properties), [])
      assert.equal(
        parkingDestinationUnsuitable({ sourceTags: source.properties }),
        false,
      )
      assert.equal(parkingDestinationUnsuitable(member), false)
      assert.equal(
        label.label,
        'Parking near ' + source.properties.name.trim().replace(/\s+/g, ' '),
      )
      assert.equal(
        label.sourceRecordUrl,
        'https://www.openstreetmap.org/' + label.sourceId.slice(4),
      )
      assert.equal(label.sourceLicense, 'ODbL-1.0')
      assert.equal(label.sourceSnapshotSha256, downloaded.sha256)
      assert.equal(label.sourceRecordEditedAt, source.properties['@timestamp'])
      assert.ok(Number.isFinite(Date.parse(label.sourceRecordEditedAt)))
      assert.equal(label.sourceVersion, source.properties['@version'])
      assert.ok(
        Number.isInteger(label.sourceVersion) && label.sourceVersion > 0,
      )
      assert.equal(label.parkingRecordId, member.id)
      assert.deepEqual(label.anchorCoordinate, member.representativePoint)
      assert.equal(member.restrictedAccess, false)
      assert.ok(
        ![
          'private',
          'no',
          'permit',
          'residents',
          'military',
          'emergency',
          'members',
          'delivery',
          'destination',
          'designated',
          'psv',
        ].includes(member.accessClass),
      )
      const bounds = geometryBounds(source.geometry)
      const coordinate =
        source.geometry.type === 'Point'
          ? source.geometry.coordinates
          : [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2]
      assert.deepEqual(label.sourceCoordinate, coordinate)
      assert.equal(label.distanceBasis, 'source_geometry_anchor_haversine')
      assert.ok(
        Math.abs(
          label.approximateStraightLineMeters -
            destinationDistanceMeters(member.representativePoint, coordinate),
        ) <= 0.051,
      )
      const contains =
        ['Polygon', 'MultiPolygon'].includes(source.geometry.type) &&
        pointInNcrGeometry(member.representativePoint, source.geometry)
      assert.equal(label.insideSourcePropertyFootprint, contains)
      assert.equal(label.parkingNameConfirmed, false)
      assert.equal(label.visitorAccessConfirmed, false)
      assert.equal(label.navigationEntranceConfirmed, false)
      assert.equal(label.publicationApproved, false)
      assert.ok(
        label.uncertainties.some((text) =>
          text.includes('not a walkable route'),
        ),
      )
      checked++
    }
  }
  assert.ok(
    checked > 0,
    'fresh source must produce evidence-backed descriptors',
  )
})

test('human review queue retains every original unnamed group and every source-coordinate inspection link', () => {
  const stored = report()
  const queue = json(join(directory, 'destination-review-queue.json.gz'))
  assert.deepEqual(queue, destinationQueue(stored))
  assert.equal(queue.length, 3112)
  assert.equal(new Set(queue.map((row) => row.groupId)).size, 3112)
  assert.equal(
    parseCsv(
      raw(join(directory, 'destination-review-queue.csv.gz')).toString('utf8'),
    ).length,
    3112,
  )
  const candidates = new Map(
    loadNcrResearch().candidates.map((candidate) => [candidate.id, candidate]),
  )
  for (const row of queue) {
    assert.equal(row.physicalVerificationComplete, false)
    assert.equal(row.publicationApproved, false)
    assert.ok(row.uncertainties.length > 0)
    assert.ok(
      row.physicalChecks.some((text) => text.includes('vehicle entrance')),
    )
    assert.ok(
      row.physicalChecks.some((text) =>
        text.includes('legally use this parking'),
      ),
    )
    assert.equal(
      row.sourceCoordinatesAndInspectionLinks.length,
      row.parkeyRecordIds.length,
    )
    for (const link of row.sourceCoordinatesAndInspectionLinks) {
      const member = candidates.get(link.recordId)
      assert.ok(row.parkeyRecordIds.includes(link.recordId))
      assert.deepEqual(link.coordinate, member.representativePoint)
      const query =
        member.representativePoint[1] + ',' + member.representativePoint[0]
      const google = new URL(link.googleMaps)
      const waze = new URL(link.waze)
      assert.equal(
        google.origin + google.pathname,
        'https://www.google.com/maps/search/',
      )
      assert.equal(google.searchParams.get('query'), query)
      assert.equal(waze.origin + waze.pathname, 'https://www.waze.com/ul')
      assert.equal(waze.searchParams.get('ll'), query)
    }
  }
  const top = json(join(directory, 'destination-top-ten.json'))
  assert.equal(top.length, 10)
  assert.deepEqual(
    top,
    queue.filter((row) => row.outcome === 'described').slice(0, 10),
  )
})
