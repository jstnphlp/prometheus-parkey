import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCoverage } from './ncr-coverage.mjs'
import { groupFacilityIdentities } from './ncr-facilities.mjs'
import { NCR_LGUS } from './ncr-geography.mjs'

test('facility identities merge explicit provider matches, preserving nearby distinct lots', () => {
  const records = [
    {
      id: 'osm:way/10:Polygon',
      type: 'lot',
      lgus: ['Makati'],
      sourceProviders: [],
    },
    {
      id: 'osm:way/10:LineString',
      type: 'lot',
      lgus: ['Makati'],
      sourceProviders: [],
    },
    {
      id: 'overture:a',
      type: 'lot',
      lgus: ['Makati'],
      sourceProviders: [{ dataset: 'OpenStreetMap', record_id: 'way/10' }],
    },
    { id: 'overture:b', type: 'lot', lgus: ['Makati'], sourceProviders: [] },
    {
      id: 'osm:node/11:Point',
      type: 'entrance',
      lgus: ['Makati'],
      sourceProviders: [],
    },
  ]
  const groups = groupFacilityIdentities(records)
  assert.equal(groups.length, 2)
  assert.equal(
    groups.find((g) => g.sourceCandidateIds.includes('overture:a'))
      .sourceCandidateIds.length,
    3,
  )
  assert.deepEqual(groups, groupFacilityIdentities([...records].reverse()))
  assert.ok(groups.every((g) => g.publicationApproved === false))
})

test('coverage retains zero cells, overlapping city counts and nonfacility types', () => {
  const boundaryGeojson = {
    type: 'FeatureCollection',
    features: NCR_LGUS.map((lgu) => ({
      type: 'Feature',
      properties: { lgu },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [121.03, 14.56],
            [121.031, 14.56],
            [121.031, 14.561],
            [121.03, 14.561],
            [121.03, 14.56],
          ],
        ],
      },
    })),
  }
  const candidate = {
    id: 'test',
    type: 'entrance',
    lgus: NCR_LGUS,
    name: 'Mapped vehicle entrance',
    accessClass: 'unknown',
    restrictedAccess: false,
    flags: [],
    sourceLicense: 'ODbL-1.0',
    sourceKind: 'osm',
    researchCell: '121.0300,14.5600',
    representativePoint: [121.0305, 14.5605],
  }
  const research = {
    candidates: [
      candidate,
      {
        ...candidate,
        id: 'crossing-street',
        type: 'street_segment',
        researchCell: '121.0500,14.5600',
        representativePoint: [121.0505, 14.5605],
      },
    ],
    facilityGroups: [],
    counts: { insideNcr: 2 },
    duplicateReviewPairs: [],
  }
  const coverage = buildCoverage(research, boundaryGeojson)
  assert.equal(coverage.summary.mappedEntities, 2)
  assert.equal(coverage.perLgu.Makati.mappedEntities, 2)
  assert.equal(coverage.perLgu.Makati.deduplicatedFacilityCandidates, 0)
  assert.ok(coverage.grid.zeroMappedCells > 0)
  assert.equal(
    coverage.grid.cells.reduce((sum, c) => sum + c.mappedEntities, 0),
    2,
  )
  assert.equal(
    coverage.grid.cells.find((c) => c.researchCell === '121.0500,14.5600')
      .representativeOutsideAdminGrid,
    true,
  )
  assert.ok(
    coverage.hotspots.every(
      (h) => h.opportunityRank === null && h.demand === null,
    ),
  )
})

test('shared provider identity retains conflicting locations for explicit review', () => {
  const records = [121.01, 121.09].map((x, i) => ({
    id: `overture:${i}`,
    type: 'facility_unspecified',
    lgus: ['Makati'],
    representativePoint: [x, 14.56],
    sourceProviders: [{ dataset: 'meta', record_id: 'same-original-page' }],
  }))
  const groups = groupFacilityIdentities(records)
  assert.equal(groups.length, 1)
  assert.equal(groups[0].sourceCandidateIds.length, 2)
  assert.equal(groups[0].identityReviewRequired, true)
  assert.ok(groups[0].flags.includes('shared_identity_location_conflict'))
  assert.ok(groups[0].maximumLocationSpreadMeters > 8000)
})
