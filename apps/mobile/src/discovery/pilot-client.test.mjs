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

test('identical concurrent public viewport reads share one fetch and one parsed body', async (t) => {
  let complete,
    calls = 0
  const response = new Response(JSON.stringify(page()))
  const readBody = t.mock.method(response, 'text')
  t.mock.method(globalThis, 'fetch', () => {
    calls++
    return new Promise((resolve) => {
      complete = () => resolve(response)
    })
  })
  const first = fetchPilotPage(
    connection,
    request(),
    'pilot_discovery',
    new AbortController().signal,
  )
  const second = fetchPilotPage(
    connection,
    request(),
    'pilot_discovery',
    new AbortController().signal,
  )
  assert.equal(calls, 1)
  complete()
  const [a, b] = await Promise.all([first, second])
  assert.equal(a, b)
  assert.equal(a.records[0].id, 'original:1')
  assert.equal(readBody.mock.callCount(), 1)
})

test('viewport pooling isolates origins, public keys, cities and exact bounds', async (t) => {
  let release,
    calls = 0
  const gate = new Promise((resolve) => {
    release = resolve
  })
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    calls++
    const body = JSON.parse(options.body)
    await gate
    return new Response(JSON.stringify(page([], { city: body.p_city })))
  })
  const changed = {
    ...request(),
    bounds: { ...request().bounds, west: 120.941 },
  }
  const reads = [
    fetchPilotPage(
      connection,
      request(),
      'pilot_discovery',
      new AbortController().signal,
    ),
    fetchPilotPage(
      { ...connection, supabaseUrl: 'https://other-fixture.invalid' },
      request(),
      'pilot_discovery',
      new AbortController().signal,
    ),
    fetchPilotPage(
      { ...connection, publicKey: 'sb_publishable_other_fixture' },
      request(),
      'pilot_discovery',
      new AbortController().signal,
    ),
    fetchPilotPage(
      connection,
      { ...request(), city: 'Mandaluyong' },
      'pilot_discovery',
      new AbortController().signal,
    ),
    fetchPilotPage(
      connection,
      changed,
      'pilot_discovery',
      new AbortController().signal,
    ),
  ]
  assert.equal(calls, 5)
  release()
  await Promise.all(reads)
})

test('a canceled public caller cannot cancel another subscriber', async (t) => {
  let complete, transport
  t.mock.method(globalThis, 'fetch', (_url, options) => {
    transport = options.signal
    return new Promise((resolve) => {
      complete = () => resolve(new Response(JSON.stringify(page())))
    })
  })
  const a = new AbortController(),
    b = new AbortController()
  const first = fetchPilotPage(
    connection,
    request(),
    'pilot_discovery',
    a.signal,
  )
  const second = fetchPilotPage(
    connection,
    request(),
    'pilot_discovery',
    b.signal,
  )
  const canceled = assert.rejects(first, { name: 'AbortError' })
  a.abort()
  await canceled
  assert.equal(transport.aborted, false)
  complete()
  assert.equal((await second).records.length, 1)
})

test('all public subscribers cancel transport and later callers start fresh work', async (t) => {
  let calls = 0,
    transport
  t.mock.method(globalThis, 'fetch', (_url, options) => {
    calls++
    if (calls > 1) return Promise.resolve(new Response(JSON.stringify(page())))
    transport = options.signal
    return new Promise((_resolve, reject) =>
      options.signal.addEventListener(
        'abort',
        () => reject(options.signal.reason),
        { once: true },
      ),
    )
  })
  const a = new AbortController(),
    b = new AbortController()
  const first = fetchPilotPage(
    connection,
    request(),
    'pilot_discovery',
    a.signal,
  )
  const second = fetchPilotPage(
    connection,
    request(),
    'pilot_discovery',
    b.signal,
  )
  const canceled = Promise.all([
    assert.rejects(first, { name: 'AbortError' }),
    assert.rejects(second, { name: 'AbortError' }),
  ])
  a.abort()
  b.abort()
  await canceled
  assert.equal(transport.aborted, true)
  await fetchPilotPage(
    connection,
    request(),
    'pilot_discovery',
    new AbortController().signal,
  )
  assert.equal(calls, 2)
})

test('failed public requests are removed from the pool before retry', async (t) => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    return calls === 1
      ? new Response('{}', { status: 503 })
      : new Response(JSON.stringify(page()))
  })
  const first = fetchPilotPage(
    connection,
    request(),
    'pilot_discovery',
    new AbortController().signal,
  )
  const second = fetchPilotPage(
    connection,
    request(),
    'pilot_discovery',
    new AbortController().signal,
  )
  await Promise.all([
    assert.rejects(first, /unavailable/),
    assert.rejects(second, /unavailable/),
  ])
  assert.equal(calls, 1)
  await fetchPilotPage(
    connection,
    request(),
    'pilot_discovery',
    new AbortController().signal,
  )
  assert.equal(calls, 2)
})

test('candidate, session-bearing, paginated, search and fresh navigation reads never coalesce', async (t) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url)
    const body = JSON.parse(options.body)
    return new Response(
      JSON.stringify(
        page([], {
          mode: body.p_mode,
          kind: url.endsWith('discover_pilot_destinations')
            ? 'pilot_destinations'
            : 'pilot_discovery',
        }),
      ),
    )
  })
  const reads = []
  for (let i = 0; i < 2; i++) {
    reads.push(
      fetchPilotPage(
        connection,
        request('candidate_research'),
        'pilot_discovery',
        new AbortController().signal,
      ),
    )
    reads.push(
      fetchPilotPage(
        connection,
        { ...request(), token: 'synthetic-unused-session' },
        'pilot_discovery',
        new AbortController().signal,
      ),
    )
    reads.push(
      fetchPilotPage(
        connection,
        request(),
        'pilot_discovery',
        new AbortController().signal,
        'next-fixture-cursor',
      ),
    )
    reads.push(
      fetchPilotPage(
        connection,
        request(),
        'pilot_destinations',
        new AbortController().signal,
        null,
        'Museum',
      ),
    )
    reads.push(
      fetchPilotParkingRecord(
        connection,
        request(),
        'original:1',
        new AbortController().signal,
      ),
    )
    reads.push(
      fetchPilotPage(
        connection,
        request(),
        'pilot_discovery',
        new AbortController().signal,
        null,
        ' ',
      ),
    )
  }
  assert.equal(calls.length, 12)
  await Promise.all(reads)
  assert.equal(
    calls.filter((url) => url.endsWith('get_pilot_parking')).length,
    2,
  )
})

test('pooled public reads retain the leaf fifteen-second timeout', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let transport
  t.mock.method(globalThis, 'fetch', (_url, options) => {
    transport = options.signal
    return new Promise((_resolve, reject) =>
      options.signal.addEventListener(
        'abort',
        () => reject(new Error('Synthetic transport abort')),
        { once: true },
      ),
    )
  })
  const a = new AbortController(),
    b = new AbortController()
  const first = fetchPilotPage(
    connection,
    request(),
    'pilot_discovery',
    a.signal,
  )
  const second = fetchPilotPage(
    connection,
    request(),
    'pilot_discovery',
    b.signal,
  )
  const failed = Promise.all([
    assert.rejects(first, /timed out/),
    assert.rejects(second, /timed out/),
  ])
  t.mock.timers.tick(15000)
  await failed
  assert.equal(transport.aborted, true)
  assert.equal(a.signal.aborted, false)
  assert.equal(b.signal.aborted, false)
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
