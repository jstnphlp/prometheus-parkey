import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'

const { AbortController, Response } = globalThis

import {
  fetchParking,
  isParking,
  parseDestinations,
  searchDestinations,
} from './data.ts'
import {
  anchor,
  directionsUrl,
  distanceLabel,
  distanceMeters,
  filterParking,
  inViewport,
  inPilotCoverage,
  isCoordinate,
  isGeometry,
  queryableViewport,
  parkingReference,
  rankParking,
  validateContribution,
} from './model.ts'
import { draftGeoJSON, parkingGeoJSON } from './map-data.ts'
import { sampleParking } from './sample-data.ts'

const view = {
  west: 121.024,
  south: 14.558,
  east: 121.041,
  north: 14.572,
  zoom: 15.5,
}
const now = Date.parse('2026-10-28T08:00:00Z')
const draft = {
  id: 'local-test',
  intent: 'add',
  targetId: null,
  kind: 'street',
  geometry: {
    type: 'LineString',
    coordinates: [
      [121.03, 14.56],
      [121.031, 14.561],
    ],
  },
  side: 'unknown',
  name: 'Observed street',
  restrictions: '',
  hours: '',
  fees: '',
  photoUri: null,
  createdAt: new Date(now).toISOString(),
  status: 'local_pending_review',
}

test('geographic validation rejects malformed, non-finite, and degenerate geometry', () => {
  for (const point of [
    [14, 121],
    [181, 14],
    [121, NaN],
    [121, Infinity],
    ['121', 14],
    [121, 14, 3],
  ])
    assert.equal(isCoordinate(point), false)
  assert.equal(isCoordinate([121, 14]), true)
  assert.equal(
    isGeometry({ type: 'LineString', coordinates: [[121, 14]] }),
    false,
  )
  assert.equal(
    isGeometry({
      type: 'LineString',
      coordinates: [
        [121, 14],
        [121, 14],
      ],
    }),
    false,
  )
  assert.equal(isGeometry(draft.geometry), true)
})

test('viewport queries are bounded; crossing street lines are retained', () => {
  assert.equal(queryableViewport(view), true)
  for (const patch of [
    { zoom: 10 },
    { north: Infinity },
    { west: 121.5 },
    { east: 125 },
    { north: NaN },
  ])
    assert.equal(queryableViewport({ ...view, ...patch }), false)
  assert.equal(
    inViewport(
      {
        type: 'LineString',
        coordinates: [
          [121.02, 14.56],
          [121.05, 14.56],
        ],
      },
      view,
    ),
    true,
  )
  assert.equal(
    inViewport({ type: 'Point', coordinates: [122, 14.56] }, view),
    false,
  )
})

test('map filters and rendering preserve street line geometry and selection', () => {
  const street = filterParking(sampleParking, 'street')
  assert.equal(street.length, 1)
  assert.equal(filterParking(sampleParking, 'facilities').length, 2)
  const feature = parkingGeoJSON(street, street[0].id).features[0]
  assert.equal(feature.geometry.type, 'LineString')
  assert.equal(feature.properties.selected, true)
  assert.equal(feature.properties.muted, false)
  const selectedMap = parkingGeoJSON(sampleParking, sampleParking[0].id)
  assert.equal(selectedMap.features[1].properties.muted, true)
  for (const item of selectedMap.features) {
    assert.equal(item.properties.label, 'Fee ?')
    assert.equal(item.properties.knownFee, false)
    assert.equal(item.properties.free, false)
  }
  assert.equal(
    parkingGeoJSON(sampleParking, null).features.some(
      (item) => item.properties.muted,
    ),
    false,
  )
  assert.equal(feature.properties.sample, true)
  const draft = draftGeoJSON([
    [121.03, 14.56],
    [121.031, 14.561],
  ])
  assert.equal(draft.features.length, 3)
  assert.deepEqual(draft.features[0].geometry, {
    type: 'LineString',
    coordinates: [
      [121.03, 14.56],
      [121.031, 14.561],
    ],
  })
})

test('parking ranking follows destination, location, then the actual map center', () => {
  const destination = anchor(sampleParking[0].geometry)
  const location = anchor(sampleParking[1].geometry)
  const reference = parkingReference(destination, location, view)
  assert.deepEqual(reference, { coordinate: destination, label: 'destination' })
  assert.equal(
    rankParking(sampleParking, reference.coordinate)[0].id,
    sampleParking[0].id,
  )
  const nearMe = parkingReference(null, location, view)
  assert.equal(nearMe.label, 'your location')
  assert.equal(
    rankParking(sampleParking, nearMe.coordinate)[0].id,
    sampleParking[1].id,
  )
  assert.deepEqual(parkingReference(null, null, view), {
    coordinate: [(view.west + view.east) / 2, (view.south + view.north) / 2],
    label: 'map center',
  })
  const moved = { ...view, west: 120, east: 120.1 }
  assert.equal(parkingReference(null, null, moved).coordinate[0], 120.05)
  assert.match(
    distanceLabel(destination, location, reference.label),
    /from destination · straight line/,
  )
  assert.equal(distanceLabel(null, location), 'Distance unavailable')
})

test('equal-distance ordering is deterministic and preserves records and geometry', () => {
  const first = { ...sampleParking[0], id: 'a', fees: null, hours: null }
  const second = { ...first, id: 'b' }
  const records = [second, first]
  const ranked = rankParking(records, anchor(first.geometry))
  assert.deepEqual(
    ranked.map((record) => record.id),
    ['a', 'b'],
  )
  assert.deepEqual(
    records.map((record) => record.id),
    ['b', 'a'],
  )
  assert.equal(ranked[0], first)
  assert.equal(ranked[0].fees, null)
  assert.equal(ranked[0].hours, null)
  const streets = filterParking(sampleParking, 'street')
  assert.deepEqual(rankParking(streets, anchor(streets[0].geometry)), streets)
  assert.equal(rankParking([], [121, 14]).length, 0)
})

test('pilot recovery is based on coverage intersection rather than GPS or destination', () => {
  assert.equal(inPilotCoverage(view), true)
  assert.equal(inPilotCoverage({ ...view, west: 120, east: 120.1 }), false)
  assert.equal(inPilotCoverage({ ...view, south: 15, north: 15.01 }), false)
  assert.equal(
    inPilotCoverage({ ...view, west: 120, south: 14, east: 122, north: 15 }),
    true,
  )
})

test('bundled OSM records have valid provenance and no fabricated verification', () => {
  const records = JSON.parse(
    readFileSync(new URL('./osm-pilot.json', import.meta.url)),
  )
  assert.ok(records.length > 0)
  assert.ok(records.some((r) => r.kind === 'street'))
  for (const record of records) {
    assert.equal(isParking(record), true, record.id)
    assert.equal(record.sourceKind, 'osm')
    assert.equal(record.verification, 'unverified')
    assert.equal(record.verifiedAt, null)
    assert.match(
      record.sourceUrl,
      /^https:\/\/www.openstreetmap.org\/(node|way)\/\d+$/,
    )
    assert.ok(record.sourceUpdatedAt)
    assert.ok(record.license.includes('ODbL'))
    assert.equal('availability' in record, false)
  }
})

test('distance and navigation links use the proper coordinate order', () => {
  assert.ok(Math.abs(distanceMeters([121, 14], [121, 14.001]) - 111.2) < 1)
  const middle = anchor(draft.geometry)
  assert.ok(Math.abs(middle[0] - 121.0305) < 0.000001)
  for (const provider of ['apple', 'google', 'waze'])
    assert.ok(directionsUrl([121.03, 14.56], provider).includes('14.56,121.03'))
  const url = new URL(directionsUrl([121.03, 14.56], 'google'))
  assert.equal(url.origin, 'https://www.google.com')
  assert.equal(url.pathname, '/maps/dir/')
  assert.equal(url.searchParams.get('api'), '1')
  assert.equal(url.searchParams.get('destination'), '14.56,121.03')
  assert.equal(url.searchParams.get('travelmode'), 'driving')
})

test('contributions reject invalid descriptions, geometry, corrections, and oversized fields', () => {
  assert.equal(validateContribution(draft, [], now), null)
  assert.equal(validateContribution({ ...draft, name: ' ' }, [], now), null)
  for (const patch of [
    { name: 'a'.repeat(101) },
    { fees: 'x'.repeat(501) },
    { intent: 'correction', targetId: null },
    { intent: 'correction', targetId: 'osm:way/1', restrictions: '' },
    { kind: 'garage' },
    {
      geometry: {
        type: 'LineString',
        coordinates: [
          [121.03, 14.56],
          [121.030001, 14.56],
        ],
      },
    },
    {
      geometry: {
        type: 'LineString',
        coordinates: [
          [121.03, 14.56],
          [121.1, 14.56],
        ],
      },
    },
  ])
    assert.ok(validateContribution({ ...draft, ...patch }, [], now))
})

test('local preview throttling, deduplication, and storage cap protect the local flow', () => {
  assert.match(
    validateContribution(draft, [{ ...draft, name: 'Different' }], now),
    /30 seconds/,
  )
  assert.match(
    validateContribution(
      draft,
      [{ ...draft, createdAt: new Date(now - 60000).toISOString() }],
      now,
    ),
    /similar preview/,
  )
  assert.match(
    validateContribution(
      draft,
      Array.from({ length: 20 }, () => draft),
      now,
    ),
    /20 local previews/,
  )
})

test('geocoder parsing tolerates incomplete features but rejects invalid envelopes', () => {
  const payload = {
    features: [
      null,
      {
        geometry: { type: 'Point', coordinates: [121.03, 14.56] },
        properties: { name: 'Poblacion', city: 'Makati', osm_id: 1 },
      },
      { geometry: { type: 'Point', coordinates: [999, 14] }, properties: {} },
    ],
  }
  assert.deepEqual(
    parseDestinations(payload).map((r) => r.name),
    ['Poblacion'],
  )
  assert.throws(() => parseDestinations({ error: 'unavailable' }))
  assert.deepEqual(parseDestinations({ features: [] }), [])
})

test('parking API validates real responses and surfaces service errors', async (t) => {
  let request
  const mock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    request = { url, options }
    return new Response(
      JSON.stringify({ records: sampleParking, truncated: false }),
    )
  })
  const result = await fetchParking(
    'https://example.test/',
    'public-test-key',
    view,
    new AbortController().signal,
  )
  assert.equal(result.records.length, 3)
  assert.equal(request.url, 'https://example.test/rest/v1/rpc/discover_parking')
  assert.deepEqual(JSON.parse(request.options.body), {
    west: view.west,
    south: view.south,
    east: view.east,
    north: view.north,
  })
  mock.mock.mockImplementation(
    async () => new Response('{"records":[{"id":"broken"}],"truncated":false}'),
  )
  await assert.rejects(
    fetchParking(
      'https://example.test',
      'public-test-key',
      view,
      new AbortController().signal,
    ),
    /unsupported response/,
  )
  mock.mock.mockImplementation(async () => new Response('', { status: 503 }))
  await assert.rejects(
    fetchParking(
      'https://example.test',
      'public-test-key',
      view,
      new AbortController().signal,
    ),
    /could not be loaded/,
  )
})

test('destination search encodes the query, geographic bias, and abort signal', async (t) => {
  const controller = new AbortController()
  let called
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    called = { url: new URL(url), options }
    return new Response('{"features":[]}')
  })
  await searchDestinations(
    'https://example.test/api/',
    ' Poblacion & Makati ',
    [121.03, 14.56],
    controller.signal,
  )
  assert.equal(called.url.searchParams.get('q'), 'Poblacion & Makati')
  assert.equal(called.url.searchParams.get('limit'), '6')
  assert.equal(called.url.searchParams.get('lon'), '121.03')
  assert.equal(called.url.searchParams.get('lat'), '14.56')
  assert.equal(called.options.signal, controller.signal)
})
