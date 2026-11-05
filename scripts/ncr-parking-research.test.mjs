import assert from 'node:assert/strict'
import test from 'node:test'
import { NCR_LGUS } from './ncr-geography.mjs'
import { buildNcrResearch, classifyGeojson } from './ncr-parking-research.mjs'

const square = (x, y, w = 0.012) => ({
  type: 'Polygon',
  coordinates: [
    [
      [x, y],
      [x + w, y],
      [x + w, y + w],
      [x, y + w],
      [x, y],
    ],
  ],
})
const ncr = {
  type: 'FeatureCollection',
  features: NCR_LGUS.map((name, i) => ({
    type: 'Feature',
    properties: { lgu: name },
    geometry: square(120.9 + i * 0.016, 14.5),
  })),
}
const point = (x, y) => ({ type: 'Point', coordinates: [x, y] })
const osm = (id, p, geometry = point(120.938, 14.506), type = 'node') => ({
  type: 'Feature',
  properties: { '@type': type, '@id': id, ...p },
  geometry,
})
const geo = (...features) => ({ type: 'FeatureCollection', features })
const osmSource = geo(
  osm(
    10,
    { amenity: 'parking', parking: 'multi-storey', name: 'Test Garage' },
    square(120.937, 14.504),
    'way',
  ),
  osm(11, { amenity: 'parking_space', ref: 'B24' }),
  osm(12, { amenity: 'parking_entrance' }),
  osm(
    13,
    {
      highway: 'residential',
      name: 'Example Road',
      'parking:left': 'no',
      'parking:right': 'lane',
    },
    {
      type: 'LineString',
      coordinates: [
        [120.936, 14.506],
        [120.943, 14.506],
      ],
    },
    'way',
  ),
  osm(
    14,
    { highway: 'residential', 'parking:both': 'no' },
    {
      type: 'LineString',
      coordinates: [
        [120.936, 14.507],
        [120.943, 14.507],
      ],
    },
    'way',
  ),
  osm(15, { amenity: 'parking', access: 'private', name: 'Private Lot' }),
  osm(16, { amenity: 'parking', name: 'Outside NCR' }, point(123, 11)),
)
const overture = geo({
  type: 'Feature',
  properties: {
    id: 'over-a',
    name: 'Test Garage',
    basic_category: 'parking',
    confidence: 0.4,
  },
  geometry: point(120.943, 14.51),
})
const asOf = '2026-11-03T13:23:54Z'
const run = (patch = {}) =>
  buildNcrResearch({
    boundaryGeojson: ncr,
    osmGeojson: osmSource,
    overtureGeojson: overture,
    asOf,
    inputHashes: { boundaries: 'test', osm: 'test', overture: 'test' },
    ...patch,
  })

test('keeps facilities, individual spaces, entrances, and legal-unknown curb segments separate', () => {
  const r = run()
  assert.equal(r.counts.rawParkingCandidates, 7)
  assert.equal(r.counts.insideNcr, 6)
  assert.deepEqual(r.counts.byType, {
    lot: 0,
    garage: 1,
    facility_unspecified: 2,
    space: 1,
    street_segment: 1,
    entrance: 1,
  })
  assert.equal(r.counts.streetRequiresLegalReview, 1)
  assert.equal(r.counts.restricted, 1)
  assert.equal(r.counts.unknownLicense, 1)
  assert.equal(r.counts.physicallyVerified, 0)
  assert.equal(r.counts.publicationApproved, 0)
  assert.equal(r.counts.possibleDuplicatePairs, 1)
  const street = r.candidates.find((c) => c.type === 'street_segment')
  assert.deepEqual(street.streetSides, ['right'])
  assert.ok(street.flags.includes('street_legality_unconfirmed'))
  const garage = r.candidates.find((c) => c.id === 'osm:way/10:Polygon')
  assert.deepEqual(garage.lgus, ['Makati', 'Malabon'])
  assert.ok(garage.flags.includes('representative_point_not_entrance'))
  assert.equal(garage.accessConfirmed, false)
  assert.equal(garage.pointIsVehicleEntrance, false)
  assert.equal(r.perLgu.Makati.mappedEntities, 6)
  assert.equal(
    r.candidates.some((c) => c.id.includes('14:')),
    false,
  )
  assert.equal(
    r.candidates.some((c) => c.name === 'Outside NCR'),
    false,
  )
})
test('does not publish private or Overture-unknown-license records', () => {
  const r = run()
  const privateLot = r.candidates.find((c) => c.name === 'Private Lot')
  assert.ok(privateLot.flags.includes('mapped_restricted_access'))
  const fromOverture = r.candidates.find((c) => c.sourceKind === 'overture')
  assert.ok(fromOverture.flags.includes('license_review_required'))
  assert.ok(
    r.candidates.every(
      (c) =>
        c.verification === 'unverified' &&
        c.publicationApproved === false &&
        c.displayEligibility === 'pending_human_and_license_review',
    ),
  )
})
test('input geometry, identity and snapshot failures are explicit', () => {
  assert.throws(() => run({ asOf: '2099-01-01T00:00:00Z' }), /nonfuture/)
  assert.throws(
    () => run({ osmGeojson: geo(osm(null, { amenity: 'parking' })) }),
    /source identity/,
  )
  assert.throws(
    () =>
      run({
        osmGeojson: geo(
          osm(10, { amenity: 'parking' }),
          osm(10, { amenity: 'parking' }),
        ),
      }),
    /Duplicate source ID/,
  )
  assert.throws(
    () => run({ boundaryGeojson: { type: 'FeatureCollection', features: [] } }),
    /Expected 17/,
  )
  assert.throws(
    () => run({ osmGeojson: null, overtureGeojson: null }),
    /At least one source/,
  )
})
test('identical inputs give identical reports without mutating sources', () => {
  const before = JSON.stringify({ ncr, osmSource, overture })
  assert.deepEqual(run(), run())
  assert.equal(JSON.stringify({ ncr, osmSource, overture }), before)
  assert.equal(Object.keys(run().perLgu).length, 17)
})
test('explicit no-parking tags and unrelated shops are not parking supply', () => {
  assert.equal(
    classifyGeojson(
      geo(
        osm(
          22,
          { highway: 'residential', 'parking:both': 'no' },
          {
            type: 'LineString',
            coordinates: [
              [120.936, 14.506],
              [120.938, 14.506],
            ],
          },
          'way',
        ),
        osm(23, { amenity: 'restaurant' }),
      ),
      'osm',
    ).length,
    0,
  )
})

test('preserves Overture provider evidence, unnamed parking and closed status', () => {
  const properties = {
    id: 'unnamed',
    categories: { primary: 'parking_garage' },
    sources: [
      { dataset: 'OpenStreetMap', record_id: 'way/10', license: 'ODbL-1.0' },
    ],
    operating_status: 'permanently_closed',
  }
  const r = run({
    overtureGeojson: geo({
      type: 'Feature',
      properties,
      geometry: point(120.943, 14.51),
    }),
  })
  const c = r.candidates.find((c) => c.id === 'overture:unnamed')
  assert.equal(c.name, 'Unnamed parking facility')
  assert.equal(c.type, 'garage')
  assert.deepEqual(c.sourceTags, properties)
  assert.deepEqual(c.sourceProviders, properties.sources)
  assert.equal(c.operatingStatus, 'permanently_closed')
  assert.ok(c.flags.includes('mapped_closed_or_disused'))
  assert.equal(r.counts.identityDuplicatesCollapsed, 1)
  assert.equal(
    r.facilityGroups.find((g) => g.sourceCandidateIds.includes(c.id))
      .sourceCandidateIds.length,
    2,
  )
})

test('street-side areas are not lots and conditional customer access is retained', () => {
  const r = run({
    overtureGeojson: null,
    osmGeojson: geo(
      osm(200, {
        amenity: 'parking',
        parking: 'street_side',
        access: 'customers',
        'access:conditional': 'no @ (22:00-06:00)',
      }),
    ),
  })
  assert.equal(r.counts.byType.street_segment, 1)
  assert.equal(r.candidates[0].accessClass, 'customers')
  assert.ok(r.candidates[0].flags.includes('conditional_rules_need_review'))
  assert.ok(
    r.candidates[0].flags.includes('customer_access_conditions_unconfirmed'),
  )
})

test('invalid source coordinates fail before geographic exclusion', () => {
  assert.throws(
    () =>
      run({
        osmGeojson: geo(osm(201, { amenity: 'parking' }, point(121, 95))),
      }),
    /Invalid geometry/,
  )
})

test('prior owner decisions and navigation references survive exact-ID reconciliation', () => {
  const decision = {
    id: 'overture:over-a',
    reviewStatus: 'online_corroborated',
    siteVisitAt: null,
    publicationApproved: false,
    siteVisitRequired: true,
    siteVisitReferenceUrl: 'owner-supplied-reference',
  }
  const r = run({ priorReviews: { schemaVersion: 1, decisions: [decision] } })
  const c = r.candidates.find((c) => c.id === decision.id)
  assert.deepEqual(c.priorHumanReview, decision)
  assert.equal(c.onlineCorroborated, true)
  assert.equal(c.verification, 'unverified')
  assert.equal(c.publicationApproved, false)
  assert.ok(c.flags.includes('prior_site_visit_required'))
  assert.equal(r.priorReviewSummary.matched, 1)
  assert.throws(
    () =>
      run({
        priorReviews: {
          schemaVersion: 1,
          decisions: [{ ...decision, publicationApproved: true }],
        },
      }),
    /Unsupported/,
  )
})

test('GDAL native source arrays retain licenses and automotive businesses are excluded', () => {
  const props = {
    id: 'gdal',
    name: 'Garage',
    basic_category: 'parking',
    sources_json: [
      { dataset: 'meta', record_id: '123', license: 'CDLA-Permissive-2.0' },
    ],
  }
  const records = classifyGeojson(
    geo(
      { type: 'Feature', properties: props, geometry: point(121, 14.5) },
      {
        type: 'Feature',
        properties: {
          ...props,
          id: 'repair',
          basic_category: 'garage_door_service',
        },
        geometry: point(121, 14.5),
      },
    ),
    'overture',
  )
  assert.equal(records.length, 1)
  assert.equal(records[0].sourceLicense, 'CDLA-Permissive-2.0')
  assert.deepEqual(records[0].sourceProviders, props.sources_json)
})

test('unnamed OSM footprints produce review matches without guessing shared identity', () => {
  const r = run({
    osmGeojson: geo(
      osm(301, { amenity: 'parking' }, square(120.937, 14.504), 'way'),
    ),
  })
  assert.equal(r.duplicateReviewPairs.length, 1)
  assert.equal(
    r.duplicateReviewPairs[0].basis,
    'overture_point_inside_osm_parking_footprint',
  )
  assert.equal(r.counts.identityDuplicatesCollapsed, 0)
  assert.equal(r.counts.deduplicatedFacilityCandidates, 2)
})

test('one licensed provider cannot hide another provider missing a license', () => {
  const r = run({
    overtureGeojson: geo({
      type: 'Feature',
      geometry: point(120.943, 14.51),
      properties: {
        id: 'mixed',
        basic_category: 'parking',
        sources: [
          { dataset: 'meta', license: 'CDLA-Permissive-2.0' },
          { dataset: 'unknown-provider' },
        ],
      },
    }),
  })
  assert.equal(r.counts.unknownLicense, 1)
  assert.ok(
    r.candidates
      .find((c) => c.id === 'overture:mixed')
      .flags.includes('license_review_required'),
  )
})

test('explicit parking buildings remain garages without inventing public access', () => {
  const r = run({
    overtureGeojson: null,
    osmGeojson: geo(osm(400, { building: 'parking' })),
  })
  assert.equal(r.counts.byType.garage, 1)
  assert.equal(r.candidates[0].accessClass, 'unknown')
  assert.equal(r.candidates[0].accessConfirmed, false)
  assert.equal(r.candidates[0].publicationApproved, false)
})

test('legacy marked parking lanes remain unverified street evidence', () => {
  const r = run({
    overtureGeojson: null,
    osmGeojson: geo(
      osm(
        401,
        {
          highway: 'residential',
          'parking:lane:left': 'marked',
          'parking:lane:right': 'no',
        },
        {
          type: 'LineString',
          coordinates: [
            [120.936, 14.506],
            [120.943, 14.506],
          ],
        },
        'way',
      ),
    ),
  })
  assert.equal(r.counts.byType.street_segment, 1)
  assert.deepEqual(r.candidates[0].streetSides, ['left'])
  assert.ok(r.candidates[0].flags.includes('street_legality_unconfirmed'))
  assert.equal(r.candidates[0].publicationApproved, false)
})
