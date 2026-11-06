import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createPilotRequestGate,
  fetchPilotPage,
  fetchPilotParkingRecord,
  isPilotParking,
  mergePilotPage,
  PilotAccessError,
  pilotAreas,
  pilotNavigationEntrance,
  pilotRecordCanDisplay,
  pilotSelectedRecord,
  pilotSelectionKey,
} from './pilot-client.ts'

const { Response, AbortController } = globalThis

const future = () => new Date(Date.now() + 3600000).toISOString()
const record = () => ({
  id: 'original:1',
  sourceObservationId: 'osm:node/1:Point',
  name: 'Source parking',
  officialName: null,
  descriptiveLabel: 'Parking beside test street',
  featureType: 'lot',
  geometry: { type: 'Point', coordinates: [120.984, 14.599] },
  representativePoint: [120.984, 14.599],
  accessClass: 'unknown',
  restrictedAccess: false,
  source: {
    kind: 'osm',
    url: 'https://www.openstreetmap.org/node/1',
    license: 'ODbL-1.0',
    attribution: 'OpenStreetMap contributors',
    updatedAt: null,
  },
  evidence: {
    researchStatus: 'researched',
    onlineCorroborated: false,
    operatorConfirmed: false,
    physicallyVerified: false,
    publicationApproved: true,
  },
  navigationApproval: null,
  reviewDueAt: future(),
  fees: null,
  hours: null,
  destinationContext: [],
  warnings: [],
})
const request = (mode = 'public') => ({
  city: 'Manila',
  mode,
  bounds: pilotAreas.Manila.bounds,
  token: mode === 'public' ? null : 'synthetic.session.token',
})
const connection = {
  supabaseUrl: 'https://fixture.invalid',
  publicKey: 'sb_publishable_fixture_only',
}
const page = (records = [record()], extra = {}) => ({
  schemaVersion: 1,
  kind: 'pilot_discovery',
  scopeVersion: 'manila-mandaluyong-v1',
  city: 'Manila',
  mode: 'public',
  records,
  nextCursor: null,
  notice: 'Synthetic test fixtures only',
  ...extra,
})

test('focusing a selected map record retains its detail while city, mode, session and expiry invalidate it', () => {
  const original = request()
  const selection = { key: pilotSelectionKey(original), record: record() }
  const focused = {
    ...original,
    bounds: { west: 120.98, south: 14.59, east: 121, north: 14.61 },
  }
  assert.equal(pilotSelectedRecord(selection, focused), selection.record)
  assert.equal(
    pilotSelectedRecord(selection, { ...focused, city: 'Mandaluyong' }),
    null,
  )
  assert.equal(
    pilotSelectedRecord(selection, {
      ...focused,
      mode: 'candidate_research',
      token: 'different',
    }),
    null,
  )
  assert.equal(
    pilotSelectedRecord(
      selection,
      focused,
      Date.parse(selection.record.reviewDueAt),
    ),
    null,
  )
})

test('public display rejects research context, restricted access, missing approvals and expired cache entries', () => {
  const source = record()
  assert.equal(isPilotParking(source), true)
  assert.equal(pilotRecordCanDisplay(source, 'public'), true)
  for (const changed of [
    { ...source, evidence: { ...source.evidence, publicationApproved: false } },
    { ...source, restrictedAccess: true },
    { ...source, officialName: null, descriptiveLabel: null },
    { ...source, reviewDueAt: new Date(Date.now() - 1).toISOString() },
    { ...source, destinationContext: [{ label: 'Unverified nearby context' }] },
  ])
    assert.equal(pilotRecordCanDisplay(changed, 'public'), false)
  const candidate = {
    ...source,
    evidence: { ...source.evidence, publicationApproved: false },
  }
  assert.equal(pilotRecordCanDisplay(candidate, 'candidate_research'), true)
  assert.equal(pilotRecordCanDisplay(source, 'candidate_research'), false)
})

test('only an explicit current reviewed entrance authorizes public navigation, never source geometry or candidate mode', () => {
  const source = record()
  assert.equal(pilotNavigationEntrance(source, 'public'), null)
  const approved = {
    ...source,
    navigationApproval: {
      entrance: [120.985, 14.5991],
      entranceConfirmed: true,
      visitorAccessConfirmed: true,
      operatorAuthorized: true,
      expiresAt: source.reviewDueAt,
    },
  }
  assert.deepEqual(
    pilotNavigationEntrance(approved, 'public'),
    approved.navigationApproval.entrance,
  )
  assert.notDeepEqual(
    pilotNavigationEntrance(approved, 'public'),
    source.representativePoint,
  )
  assert.equal(pilotNavigationEntrance(approved, 'candidate_research'), null)
  for (const changed of [
    { ...approved, accessClass: 'private' },
    {
      ...approved,
      navigationApproval: {
        ...approved.navigationApproval,
        operatorAuthorized: false,
      },
    },
    {
      ...approved,
      navigationApproval: {
        ...approved.navigationApproval,
        expiresAt: new Date(Date.now() - 1).toISOString(),
      },
    },
    {
      ...approved,
      navigationApproval: {
        ...approved.navigationApproval,
        expiresAt: new Date(Date.now() + 7200000).toISOString(),
      },
    },
  ])
    assert.equal(pilotNavigationEntrance(changed, 'public'), null)
})

test('scope replacement aborts prior work and refuses completion even when transport ignores cancellation', () => {
  const gate = createPilotRequestGate()
  const manila = gate.begin()
  const mandaluyong = gate.begin()
  assert.equal(manila.signal.aborted, true)
  assert.equal(manila.current(), false)
  assert.equal(mandaluyong.current(), true)
  gate.cancel()
  assert.equal(mandaluyong.signal.aborted, true)
  assert.equal(mandaluyong.current(), false)
})

test('bounded page requests bind city/mode/viewport and never send reviewer credentials on public calls', async (t) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options })
    return new Response(JSON.stringify(page()))
  })
  const result = await fetchPilotPage(
    connection,
    { ...request(), token: 'must-never-be-sent' },
    'pilot_discovery',
    new AbortController().signal,
  )
  assert.equal(result.records[0].fees, null)
  assert.equal(result.records[0].officialName, null)
  assert.equal(calls[0].options.headers.Authorization, undefined)
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    p_city: 'Manila',
    p_mode: 'public',
    p_bbox: pilotAreas.Manila.bounds,
    p_limit: 50,
    p_after: null,
  })
  await assert.rejects(
    fetchPilotPage(
      connection,
      { ...request(), bounds: { west: 120, east: 121, south: 14, north: 15 } },
      'pilot_discovery',
      new AbortController().signal,
    ),
    /Zoom in/,
  )
  assert.equal(calls.length, 1)
})

test('server scope mismatches, unsupported responses and private leakage fail closed', async (t) => {
  const responses = [
    page([], { city: 'Mandaluyong' }),
    page([], { mode: 'candidate_research' }),
    page([], { scopeVersion: 'wrong' }),
    page([{ ...record(), restrictedAccess: true }]),
    page([record(), record()]),
    page([], { nextCursor: 'stalled' }),
  ]
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(JSON.stringify(responses.shift())),
  )
  for (let i = 0; i < 6; i++)
    await assert.rejects(
      fetchPilotPage(
        connection,
        request(),
        'pilot_discovery',
        new AbortController().signal,
      ),
      /incompatible|pagination/,
    )
})

test('candidate access requires a memory token and server authorization, public pages never upgrade the session', async (t) => {
  let received
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    received = options.headers.Authorization
    return new Response('{}', { status: 403 })
  })
  await assert.rejects(
    fetchPilotPage(
      connection,
      { ...request('candidate_research'), token: null },
      'pilot_discovery',
      new AbortController().signal,
    ),
    PilotAccessError,
  )
  assert.equal(received, undefined)
  await assert.rejects(
    fetchPilotPage(
      connection,
      request('candidate_research'),
      'pilot_discovery',
      new AbortController().signal,
    ),
    PilotAccessError,
  )
  assert.equal(received, 'Bearer synthetic.session.token')
})

test('pagination rejects duplicate identities and repeated cursors instead of accumulating a misleading map', () => {
  const cursors = new Set()
  assert.deepEqual(
    mergePilotPage([{ id: 'one' }], [{ id: 'two' }], 'next', cursors),
    [{ id: 'one' }, { id: 'two' }],
  )
  assert.throws(
    () => mergePilotPage([], [{ id: 'three' }], 'next', cursors),
    /repeated a page cursor/,
  )
  assert.throws(
    () => mergePilotPage([{ id: 'one' }], [{ id: 'one' }], 'another', cursors),
    /repeated record IDs/,
  )
})

test('navigation revalidation uses the targeted server lookup and handles revoked records without a fallback', async (t) => {
  const calls = []
  let response = page([])
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) })
    return new Response(JSON.stringify(response))
  })
  assert.equal(
    await fetchPilotParkingRecord(
      connection,
      request(),
      'original:1',
      new AbortController().signal,
    ),
    null,
  )
  assert.match(calls[0].url, /get_pilot_parking$/)
  assert.deepEqual(calls[0].body, {
    p_city: 'Manila',
    p_mode: 'public',
    p_id: 'original:1',
  })
  response = page([record()])
  assert.equal(
    (
      await fetchPilotParkingRecord(
        connection,
        request(),
        'original:1',
        new AbortController().signal,
      )
    ).id,
    'original:1',
  )
  await assert.rejects(
    fetchPilotParkingRecord(
      connection,
      request(),
      'different:1',
      new AbortController().signal,
    ),
    /different parking identity/,
  )
})

test('destination search remains separate from parking identity and sends a bounded city query', async (t) => {
  const destination = {
    id: 'destination:1',
    name: 'Synthetic destination',
    category: 'museum',
    coordinate: [120.99, 14.6],
    source: record().source,
    publicationApproved: true,
    reviewDueAt: future(),
    parkingIdentity: false,
    parkingAccessConfirmed: false,
  }
  let body
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    body = JSON.parse(options.body)
    return new Response(
      JSON.stringify(page([destination], { kind: 'pilot_destinations' })),
    )
  })
  const result = await fetchPilotPage(
    connection,
    request(),
    'pilot_destinations',
    new AbortController().signal,
    null,
    '  Museum  ',
  )
  assert.equal(body.p_query, 'Museum')
  assert.equal(result.records[0].parkingIdentity, false)
  destination.parkingAccessConfirmed = true
  await assert.rejects(
    fetchPilotPage(
      connection,
      request(),
      'pilot_destinations',
      new AbortController().signal,
    ),
    /incompatible/,
  )
})
