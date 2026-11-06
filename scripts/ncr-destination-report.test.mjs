import assert from 'node:assert/strict'
import test from 'node:test'

import { buildDestinationReport } from './ncr-destination-report.mjs'
import { buildPermittedEnrichment } from './ncr-permitted-enrichment.mjs'

const candidate = (id, representativePoint, extra = {}) => ({
  id,
  name: 'Unnamed parking facility',
  type: 'lot',
  representativePoint,
  accessClass: 'unknown',
  flags: [],
  ...extra,
})
const destination = (member, sourceId, name, coordinate) => ({
  name,
  placeKind: 'amenity:cafe',
  sourceId,
  sourceRecordUrl: 'https://www.openstreetmap.org/' + sourceId.slice(4),
  sourceLicense: 'ODbL-1.0',
  sourceCoordinate: coordinate,
  anchorCoordinate: member.representativePoint,
  parkingRecordId: member.id,
  geometry: { type: 'Point', coordinates: coordinate },
  sourceTags: {},
  relation: 'nearby_named_property_only',
  sourceRecordEditedAt: '2026-11-03T00:00:00Z',
  sourceVersion: 1,
  sourceSnapshotSha256: 'a'.repeat(64),
})
function fixture(members, clues, extra = {}) {
  return {
    research: { candidates: members },
    enrichment: {
      baseNameTotals: {
        cross_source_name_candidate: 0,
        source_named_requires_cross_reference: 0,
        identity_or_name_conflict: 0,
      },
      records: [
        {
          groupId: 'facility:1',
          candidateIds: members.map((member) => member.id),
          originalStatus: 'unnamed_pending_reference',
          classification: 'nearby_named_property_only',
          proposedName: null,
          contextClues: clues,
          accessPriority: 'access_unknown',
          ...extra,
        },
      ],
    },
  }
}
const build = ({ research, enrichment }) =>
  buildDestinationReport(research, enrichment)

test('grouped observations selecting different same-name branches remain ambiguous', () => {
  const first = candidate('parking:1', [121.03, 14.56])
  const second = candidate('parking:2', [121.0307, 14.56])
  const report = build(
    fixture(
      [first, second],
      [
        destination(
          first,
          'osm:node/101',
          'Coffee Chain',
          first.representativePoint,
        ),
        destination(
          second,
          'osm:node/202',
          'Coffee Chain',
          second.representativePoint,
        ),
      ],
    ),
  )
  assert.equal(report.records[0].destinationReview.outcome, 'ambiguous')
  assert.equal(report.records[0].destinationReview.label, null)
  assert.equal(report.records[0].destinationReview.alternatives.length, 2)
  assert.equal(report.destinationTotals.ambiguousDestinationMatches, 1)
  assert.equal(report.destinationTotals.newlyAssignedDestinationDescriptions, 0)
})

test('unanimous same-identity destinations preserve source-specific distances and original parking data', () => {
  const first = candidate('parking:1', [121.03, 14.56])
  const second = candidate('parking:2', [121.0301, 14.56])
  const input = fixture(
    [first, second],
    [
      destination(first, 'osm:node/101', 'Corner Cafe', [121.0302, 14.56]),
      destination(second, 'osm:node/101', 'Corner Cafe', [121.0302, 14.56]),
    ],
  )
  const original = JSON.stringify(input.research)
  const report = build(input)
  const review = report.records[0].destinationReview
  assert.equal(review.outcome, 'described')
  assert.equal(report.destinationTotals.newlyAssignedDestinationDescriptions, 1)
  assert.equal(review.memberReviews.length, 2)
  assert.notEqual(
    review.memberReviews[0].label.approximateStraightLineMeters,
    review.memberReviews[1].label.approximateStraightLineMeters,
  )
  assert.equal(JSON.stringify(input.research), original)
  assert.equal(review.label.parkingNameConfirmed, false)
  assert.equal(report.destinationTotals.newOfficialNamesVerified, 0)
  assert.equal(report.destinationTotals.publicPublicationApprovals, 0)
})

test('partial geographic support, restricted group members and identity conflicts cannot receive group labels', () => {
  const first = candidate('parking:1', [121.03, 14.56])
  const second = candidate('parking:2', [121.0307, 14.56])
  const clues = [
    destination(
      first,
      'osm:node/101',
      'Corner Cafe',
      first.representativePoint,
    ),
  ]
  assert.equal(
    build(fixture([first, second], clues)).records[0].destinationReview.outcome,
    'ambiguous',
  )
  assert.equal(
    build(fixture([first, { ...second, accessClass: 'private' }], clues))
      .records[0].destinationReview.outcome,
    'restricted_or_unsuitable',
  )
  assert.equal(
    build(fixture([first], clues, { identityConflict: true })).records[0]
      .destinationReview.outcome,
    'ambiguous',
  )
  assert.equal(
    build(fixture([first], [])).records[0].destinationReview.outcome,
    'no_suitable_destination',
  )
})

test('fresh same-ID parking construction or proposed tags override stale permissive source evidence', () => {
  const point = [121.03, 14.56]
  const member = candidate('osm:node/11:Point', point, {
    sourceKind: 'osm',
    sourceTags: { amenity: 'parking', access: 'yes' },
    sourceRecordUrl: 'https://www.openstreetmap.org/node/11',
    sourceLicense: 'ODbL-1.0',
    sourceProviders: [
      { dataset: 'OpenStreetMap', record_id: 'node/11', license: 'ODbL-1.0' },
    ],
    geometry: { type: 'Point', coordinates: point },
    accessClass: 'yes',
  })
  const research = {
    schemaVersion: 1,
    sourceHashes: { osm: 'fixture' },
    sourceAsOf: '2026-11-05T00:00:00Z',
    candidates: [member],
    facilityGroups: [
      {
        id: 'group:11',
        sourceCandidateIds: [member.id],
        maximumLocationSpreadMeters: 0,
        flags: [],
      },
    ],
  }
  const feature = (id, properties) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: point },
    properties: { '@type': 'node', '@id': id, ...properties },
  })
  const contextOsm = {
    type: 'FeatureCollection',
    features: [feature(101, { name: 'Corner Cafe', amenity: 'cafe' })],
  }
  for (const tags of [
    { construction: 'yes' },
    { 'proposed:amenity': 'parking' },
    { opening_hours: 'closed' },
    { access: 'members' },
  ]) {
    const refreshedOsm = {
      type: 'FeatureCollection',
      features: [feature(11, { amenity: 'parking', ...tags })],
    }
    const report = buildDestinationReport(
      research,
      buildPermittedEnrichment(research, {
        refreshedOsm,
        contextOsm,
        destinationEvidence: true,
      }),
    )
    assert.equal(
      report.records[0].destinationReview.outcome,
      'restricted_or_unsuitable',
      JSON.stringify(tags),
    )
    assert.equal(report.records[0].destinationReview.label, null)
  }
})
