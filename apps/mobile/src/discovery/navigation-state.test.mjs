import assert from 'node:assert/strict'
import test from 'node:test'

import {
  navigationDefaults,
  navigationLayers,
  navigationSearch,
  parseNavigation,
  parsePreferences,
} from './navigation-state.ts'
import { stepSheet } from './sheet-state.ts'
import { draftParking } from './draft-parking.ts'
import { validateContribution } from './model.ts'

test('dedicated list, details, feature filters and Appearance have stable URL and Back layers', () => {
  const state = {
    ...navigationDefaults,
    view: 'list',
    details: true,
    selectedId: 'osm:test',
    features: ['covered', 'ev'],
    panel: 'appearance',
  }
  assert.deepEqual(parseNavigation(navigationSearch(state)), state)
  const layers = navigationLayers(state)
  assert.equal(layers[0].view, 'map')
  assert.equal(layers[1].view, 'list')
  assert.equal(layers[2].selectedId, 'osm:test')
  assert.equal(layers[3].details, true)
  assert.equal(layers[4].panel, 'appearance')
  assert.deepEqual(
    parseNavigation('?features=vacancy,covered,covered').features,
    ['covered'],
  )
})

test('URL round trip preserves a selected spot, query, filter, sheet, layer and map center', () => {
  const state = {
    ...navigationDefaults,
    selectedId: 'osm:way/4083253',
    filter: 'street',
    position: 'medium',
    query: 'Makati & cafés',
    center: [121.03, 14.56],
    searching: true,
    panel: 'saved',
  }
  assert.deepEqual(parseNavigation(navigationSearch(state)), state)
})
test('invalid links and preferences cannot create unsupported filters, layers or coordinates', () => {
  assert.deepEqual(
    parseNavigation('?details=1&directions=1&tab=Entrance'),
    navigationDefaults,
  )
  const state = parseNavigation(
    '?filter=invalid&sheet=invalid&panel=other&lng=999&lat=999',
    parsePreferences('{bad JSON'),
  )
  assert.deepEqual(state, navigationDefaults)
  assert.deepEqual(
    parsePreferences('{"filter":"garage","position":"expanded"}'),
    { filter: 'garage', position: 'expanded' },
  )
  assert.equal(
    parseNavigation('?filter=all', { filter: 'garage' }).filter,
    'all',
  )
})
test('sheet gestures advance exactly one level and stop at the endpoints', () => {
  assert.equal(stepSheet('compact', 1), 'medium')
  assert.equal(stepSheet('medium', 1), 'expanded')
  assert.equal(stepSheet('expanded', -1), 'medium')
  assert.equal(stepSheet('medium', -1), 'compact')
  assert.equal(stepSheet('compact', -1), 'compact')
  assert.equal(stepSheet('expanded', 1), 'expanded')
})
test('an optional-name draft is valid and its preview preserves actual geometry and provenance', () => {
  const draft = {
    id: 'local-test',
    intent: 'add',
    targetId: null,
    kind: 'lot',
    geometry: { type: 'Point', coordinates: [121.03, 14.56] },
    side: 'unknown',
    name: '',
    restrictions: '',
    hours: '',
    fees: '',
    photoUri: null,
    createdAt: '2026-10-31T12:00:00Z',
    status: 'local_pending_review',
  }
  assert.equal(
    validateContribution(draft, [], Date.parse(draft.createdAt)),
    null,
  )
  const preview = draftParking(draft)
  assert.deepEqual(preview.geometry, draft.geometry)
  assert.equal(preview.name, 'Parking lot')
  assert.equal(preview.verification, 'unverified')
  assert.equal(preview.sourceLabel, 'Private draft on this device')
  assert.equal(preview.fees, null)
  assert.deepEqual(preview.regulations, [])
  assert.match(
    validateContribution(
      { ...draft, kind: 'street' },
      [],
      Date.parse(draft.createdAt),
    ),
    /location|points/,
  )
})

test('a shared full-height selected link has one-level Back entries', () => {
  const state = {
    ...navigationDefaults,
    position: 'expanded',
    selectedId: 'osm:way/4083253',
    searching: true,
    query: 'Makati',
  }
  const layers = navigationLayers(state)
  assert.deepEqual(
    layers.map((layer) => [
      layer.position,
      layer.selectedId !== null,
      layer.searching,
    ]),
    [
      ['compact', false, false],
      ['medium', false, false],
      ['expanded', false, false],
      ['expanded', true, false],
      ['expanded', true, true],
    ],
  )
  assert.ok(layers.every((layer) => layer.query === 'Makati'))
})

test('refresh keeps the chosen search location distinct from the map focus on nearby parking', () => {
  const state = {
    ...navigationDefaults,
    query: 'Makati',
    searchPoint: [121.0211226, 14.5567949],
    center: [121.0253195, 14.5591531],
  }
  const restored = parseNavigation(navigationSearch(state))
  assert.deepEqual(restored.searchPoint, state.searchPoint)
  assert.deepEqual(restored.center, state.center)
  assert.equal(restored.query, state.query)
  assert.equal(
    parseNavigation('?q=Makati&searchLng=999&searchLat=999').searchPoint,
    null,
  )
})

test('Your parking restores through links and Back returns to the map', () => {
  const state = { ...navigationDefaults, panel: 'you' }
  assert.deepEqual(parseNavigation(navigationSearch(state)), state)
  const layers = navigationLayers(state)
  assert.equal(layers.at(-1).panel, 'you')
  assert.equal(layers.at(-2).panel, null)
})

test('free parking filter survives URL and saved preference round trips', () => {
  const state = parseNavigation('?fees=free')
  assert.equal(state.fees, 'free')
  assert.equal(parseNavigation(navigationSearch(state)).fees, 'free')
  assert.equal(parsePreferences(JSON.stringify({ fees: 'free' })).fees, 'free')
})
