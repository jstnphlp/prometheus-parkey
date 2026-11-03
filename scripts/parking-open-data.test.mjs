import assert from 'node:assert/strict'
import test from 'node:test'
import {
  fromOvertureGeojson, fromFoursquareCsv, parseCsv,
  distanceMeters, buildOpenDataReview,
} from './parking-open-data.mjs'

const OSM = [
  { id: 'osm:node/1', name: 'Unnamed parking · OpenStreetMap', kind: 'lot',
    geometry: { type: 'Point', coordinates: [121.0300, 14.5600] } },
  { id: 'osm:node/2', name: 'Existing Named Garage', kind: 'garage',
    geometry: { type: 'Point', coordinates: [121.0360, 14.5660] } },
  { id: 'osm:way/3', name: 'Street', kind: 'street',
    geometry: { type: 'LineString', coordinates: [[121.03,14.56],[121.031,14.561]] } },
]

const venue = (id, lon, lat, category = 'parking_lot', name = 'Test Named Parking') => ({
  type: 'Feature', id,
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: {
    names: { primary: name },
    taxonomy: { primary: category },
    sources: [{ license: 'CDLA-Permissive-2.0' }],
    confidence: 0.91,
    addresses: [{ freeform: 'Sample address' }],
  },
})
const FC = (...features) => ({ type: 'FeatureCollection', features })
const AS_OF = '2026-11-03T00:00:00Z'

test('filters Overture places by relevant parking category, map region and name', () => {
  const results = fromOvertureGeojson(FC(
    venue('near', 121.03001, 14.56001),
    venue('shopping', 121.03, 14.56, 'shopping_mall', 'Big Mall'),
    venue('far', 120.95, 14.52),
    venue('no-name', 121.03, 14.56, 'parking_garage', ''),
    venue('parking-garage', 121.035, 14.5601, 'parking_garage', 'Indoor Garage'),
  ))
  assert.deepEqual(results.map((x) => x.id), ['overture:near', 'overture:parking-garage'])
  assert.equal(results[0].sourceLicense, 'CDLA-Permissive-2.0')
  assert.equal(results[0].verification, 'unverified')
  assert.equal(results[0].sourceRecordConfidence, 0.91)
  assert.equal(results[0].fees, null)
})

test('unknown source license remains flagged, never silently assumed', () => {
  const feature = venue('licenseless', 121.03, 14.56)
  delete feature.properties.sources
  const [item] = fromOvertureGeojson(FC(feature))
  assert.equal(item.sourceLicense, 'unknown')
  assert.ok(item.flags.includes('license_review_required'))
})

test('parses quoted FSQ CSV with escaped quotes, skips closed POIs and unrelated businesses', () => {
  const csv = [
    'fsq_place_id,name,latitude,longitude,fsq_category_labels,date_closed',
    'fsq-a,"ABC ""Premium"" Parking",14.56001,121.03001,"Parking Garage",',
    'fsq-b,Foo Cafe,14.5600,121.0300,Coffee Shop,',
    'fsq-c,Closed Garage,14.5600,121.0300,Parking Garage,2026-01-01',
  ].join('\r\n')
  const parsed = parseCsv(csv)
  assert.equal(parsed[0].name, 'ABC "Premium" Parking')
  const rows = fromFoursquareCsv(csv)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, 'foursquare_os:fsq-a')
  assert.equal(rows[0].name, 'ABC "Premium" Parking')
  assert.equal(rows[0].sourceLicense, 'Apache-2.0')
})

test('malformed inputs fail rather than fabricating discoveries', () => {
  assert.throws(() => fromOvertureGeojson({ features: [] }))
  assert.throws(() => parseCsv('a,b\n"broken'))
  assert.throws(() => parseCsv('a,b\na'))
  assert.throws(() => buildOpenDataReview({ existing: OSM, asOf: '2099-01-01T00:00:00Z' }))
})

test('stages possible matches with no automatic renaming, verification or publication', () => {
  const candidates = fromOvertureGeojson(FC(
    venue('matched', 121.03003, 14.56001, 'parking_lot', 'Named Building Parking'),
    venue('new', 121.0405, 14.570, 'parking', 'Other Parking'),
  ))
  const before = JSON.stringify(OSM)
  const result = buildOpenDataReview({ existing: OSM, overture: candidates, asOf: AS_OF })
  assert.equal(result.counts.existing, 3)
  assert.equal(result.counts.existingUnnamed, 1)
  assert.equal(result.counts.stagedCandidates, 2)
  assert.equal(result.counts.potentiallyMatchingUnnamed, 1)
  assert.equal(result.counts.potentialNewFacilities, 1)
  assert.equal(result.counts.verified, 0)
  assert.equal(result.counts.published, 0)
  assert.equal(result.candidates[0].possibleBundledMatches[0].id, 'osm:node/1')
  assert.equal(result.candidates[0].possibleBundledMatches[0].isUnnamed, true)
  assert.equal(result.candidates[1].possibleBundledMatches.length, 0)
  assert.equal(JSON.stringify(OSM), before)
})

test('cross-source overlap is flagged, never treated as independent verification', () => {
  const a = fromOvertureGeojson(FC(venue('gers-a', 121.031, 14.561)))
  const b = fromFoursquareCsv(
    'fsq_place_id,name,latitude,longitude,fsq_category_labels\n' +
    'fsq-a,Test Named Parking,14.56101,121.03101,Parking Lot\n')
  const result = buildOpenDataReview({ existing: OSM, overture: a, foursquare: b, asOf: AS_OF })
  assert.equal(result.counts.stagedCandidates, 2)
  for (const c of result.candidates) {
    assert.ok(c.flags.includes('cross_source_possible_duplicate'))
    assert.equal(c.possibleOtherSourceMatches.length, 1)
    assert.equal(c.verification, 'unverified')
  }
})

test('duplicates are errors, and distances are geographic not raw degree differences', () => {
  const same = fromOvertureGeojson(FC(venue('repeat', 121.0301, 14.5601)))
  assert.throws(() =>
    buildOpenDataReview({ existing: OSM, overture: [...same, ...same], asOf: AS_OF }),
    /Duplicate external source ID/,
  )
  assert.equal(distanceMeters([121.03, 14.56],[121.03,14.56]), 0)
  assert.ok(distanceMeters([121.03,14.56],[121.04,14.56]) > 1000)
})
