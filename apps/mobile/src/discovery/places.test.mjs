import assert from 'node:assert/strict'
import test from 'node:test'

const { Response, AbortController } = globalThis

import { fetchParking } from './data.ts'
import { parkingReference, rankParking } from './model.ts'
import {
  navigationDefaults,
  navigationSearch,
  parseNavigation,
} from './navigation-state.ts'
import {
  parkingNearDestination,
  placeFromFeature,
  placeLayer,
} from './places.ts'
import { fetchDrivingRoute } from './routing.ts'
import { sampleParking } from './sample-data.ts'

const feature = (properties = {}, coordinates = [121.03, 14.56]) => ({
  id: 42,
  type: 'Feature',
  geometry: { type: 'Point', coordinates },
  properties: { name: 'Synthetic mall', class: 'shop', ...properties },
})

test('recognizable tile places retain their actual point and available address', () => {
  const place = placeFromFeature(
    feature({ 'name:en': 'Synthetic landmark', 'addr:street': 'Test Street' }),
  )
  assert.equal(place.name, 'Synthetic landmark')
  assert.equal(place.address, 'Test Street')
  assert.deepEqual(place.coordinate, [121.03, 14.56])
  assert.equal(placeFromFeature(feature()).address, '')
  assert.equal(placeLayer['source-layer'], 'poi')
  assert.equal(placeLayer.source, 'openmaptiles')
})

test('parking, unnamed, malformed and non-point features never become general places', () => {
  for (const invalid of [
    null,
    {},
    feature({ name: '' }),
    feature({ class: 'parking' }),
    feature({}, [NaN, 14]),
    feature({}, [121, 91]),
    {
      ...feature(),
      geometry: {
        type: 'LineString',
        coordinates: [
          [121, 14],
          [121.1, 14],
        ],
      },
    },
  ])
    assert.equal(placeFromFeature(invalid), null)
})

test('destination selection clears parking/route state and centers on the place, not a nearby parking pin', () => {
  const place = placeFromFeature(feature())
  const state = {
    ...navigationDefaults,
    route: true,
    selectedId: 'old',
    ...parkingNearDestination(place),
  }
  assert.equal(state.route, false)
  assert.equal(state.selectedId, null)
  assert.equal(state.searching, false)
  assert.equal(state.position, 'medium')
  assert.deepEqual(state.center, place.coordinate)
  const restored = parseNavigation(navigationSearch(state))
  assert.deepEqual(restored.searchPoint, place.coordinate)
  assert.equal(restored.query, place.name)
  const reference = parkingReference(state.searchPoint, [120, 13], {
    west: 120,
    east: 122,
    south: 13,
    north: 15,
    zoom: 16,
  })
  assert.equal(reference.label, 'destination')
  assert.deepEqual(
    rankParking(sampleParking, reference.coordinate),
    rankParking(sampleParking, place.coordinate),
  )
})

test('nearby discovery uses the existing public RPC and retains unknown/unverified facts', async () => {
  const original = globalThis.fetch
  const record = {
    ...sampleParking[0],
    fees: null,
    hours: null,
    verification: 'unverified',
    verifiedAt: null,
  }
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://backend.example/rest/v1/rpc/discover_parking')
    assert.equal(options.headers.apikey, 'public-test-key')
    assert.deepEqual(JSON.parse(options.body), {
      west: 121.02,
      south: 14.55,
      east: 121.04,
      north: 14.57,
    })
    return Response.json({ records: [record], truncated: false })
  }
  try {
    const result = await fetchParking(
      'https://backend.example',
      'public-test-key',
      { west: 121.02, south: 14.55, east: 121.04, north: 14.57, zoom: 16 },
      new AbortController().signal,
    )
    assert.equal(result.records[0].fees, null)
    assert.equal(result.records[0].verification, 'unverified')
  } finally {
    globalThis.fetch = original
  }
})

test('unconfigured or failed in-app routing cannot fabricate a route or open an external app', async () => {
  const place = placeFromFeature(feature())
  let calls = 0
  const fetcher = async () => {
    calls++
    return new Response('', { status: 503 })
  }
  await assert.rejects(
    fetchDrivingRoute(
      [121.02, 14.55],
      place.coordinate,
      new AbortController().signal,
      { endpoint: '', fetcher },
    ),
    /available/,
  )
  assert.equal(calls, 0)
  await assert.rejects(
    fetchDrivingRoute(
      [121.02, 14.55],
      place.coordinate,
      new AbortController().signal,
      { endpoint: 'https://routing.example', fetcher },
    ),
  )
  assert.equal(calls, 1)
})
