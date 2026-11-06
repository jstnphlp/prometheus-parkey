import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'

import {
  createPilotSavedStore,
  MAX_PILOT_SAVED,
  parsePilotSaved,
  pilotSavedKey,
  publicPilotSavedPlace,
} from './pilot-saved.ts'

const now = Date.parse('2026-11-06T00:00:00Z')
const record = (id = 1) => ({
  id: `fixture:${id}`,
  sourceObservationId: `osm:node/${id}:Point`,
  name: `Original source ${id}`,
  officialName: `Approved fixture ${id}`,
  descriptiveLabel: null,
  featureType: 'facility_unspecified',
  geometry: { type: 'Point', coordinates: [120.984, 14.599] },
  representativePoint: [120.984, 14.599],
  accessClass: 'unknown',
  restrictedAccess: false,
  source: {
    kind: 'osm',
    url: `https://www.openstreetmap.org/node/${id}`,
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
  reviewDueAt: new Date(now + 3600000).toISOString(),
  fees: null,
  hours: null,
  destinationContext: [],
  warnings: [],
})

function memoryStorage(initial = null) {
  let raw = initial
  let failRead = false
  let failWrite = false
  let failClear = false
  return {
    get raw() {
      return raw
    },
    failRead() {
      failRead = true
    },
    failWrite() {
      failWrite = true
    },
    failClear() {
      failClear = true
    },
    storage: {
      async getItem() {
        if (failRead) {
          failRead = false
          throw new Error('Synthetic read failure')
        }
        return raw
      },
      async setItem(_key, value) {
        if (failWrite) {
          failWrite = false
          throw new Error('Synthetic write failure')
        }
        raw = value
      },
      async removeItem() {
        if (failClear) {
          failClear = false
          throw new Error('Synthetic clear failure')
        }
        raw = null
      },
    },
  }
}

test('public pilot saving preserves exact metadata and drops record bodies and permissions', async () => {
  const entry = record()
  const metadata = publicPilotSavedPlace(entry, 'Manila', 'public', now)
  assert.deepEqual(Object.keys(metadata).sort(), [
    'city',
    'coordinate',
    'featureType',
    'id',
    'key',
    'name',
    'sourceUrl',
  ])
  assert.equal(metadata.featureType, 'facility_unspecified')
  assert.deepEqual(metadata.coordinate, entry.representativePoint)
  assert.notEqual(metadata.coordinate, entry.representativePoint)
  assert.equal(metadata.name, entry.officialName)
  const disk = memoryStorage()
  const store = createPilotSavedStore(disk.storage)
  const saved = await store.toggle(entry, 'Manila', 'public', now)
  saved[0].coordinate[0] = 0
  const hydrated = await store.load()
  assert.equal(hydrated[0].coordinate[0], 120.984)
  for (const key of [
    'evidence',
    'geometry',
    'sourceObservationId',
    'navigationApproval',
    'fees',
    'hours',
    'destinationContext',
  ])
    assert.equal(Object.hasOwn(JSON.parse(disk.raw).items[0], key), false)
})

test('source identity survives server IDs, remains city-scoped and never guesses classification', async () => {
  const entry = record()
  assert.equal(
    pilotSavedKey(entry, 'Manila'),
    pilotSavedKey({ ...entry, id: 'new-server-id' }, 'Manila'),
  )
  assert.notEqual(
    pilotSavedKey(entry, 'Manila'),
    pilotSavedKey(entry, 'Mandaluyong'),
  )
  for (const featureType of [
    'lot',
    'garage',
    'facility_unspecified',
    'street_segment',
    'entrance',
    'space',
  ]) {
    const saved = publicPilotSavedPlace(
      { ...entry, featureType },
      'Manila',
      'public',
      now,
    )
    assert.equal(
      parsePilotSaved({ version: 1, items: [saved] })[0].featureType,
      featureType,
    )
  }
  const disk = memoryStorage()
  const store = createPilotSavedStore(disk.storage)
  await store.toggle(entry, 'Manila', 'public', now)
  assert.deepEqual(
    await store.toggle(
      { ...entry, id: 'new-server-id' },
      'Manila',
      'public',
      now,
    ),
    [],
  )
})

test('explicit public visitor access still requires current publication approval', () => {
  const visitors = { ...record(), accessClass: 'public_visitors' }
  assert.equal(
    publicPilotSavedPlace(visitors, 'Manila', 'public', now).id,
    visitors.id,
  )
  for (const change of [
    { restrictedAccess: true },
    { evidence: { ...visitors.evidence, publicationApproved: false } },
    { reviewDueAt: new Date(now).toISOString() },
  ])
    assert.throws(() =>
      publicPilotSavedPlace(
        { ...visitors, ...change },
        'Manila',
        'public',
        now,
      ),
    )
})

test('candidate, expired, restricted, contradictory and malformed inputs never reach storage', async () => {
  const entry = record()
  const disk = memoryStorage()
  const store = createPilotSavedStore(disk.storage)
  await assert.rejects(store.toggle(entry, 'Manila', 'candidate_research', now))
  for (const change of [
    { evidence: { ...entry.evidence, publicationApproved: false } },
    { restrictedAccess: true },
    { accessClass: 'private', restrictedAccess: false },
    { accessClass: 'members', restrictedAccess: false },
    { accessClass: 'unexpected-access', restrictedAccess: false },
    { reviewDueAt: new Date(now).toISOString() },
    { reviewDueAt: null },
    { featureType: 'invented-type' },
    { representativePoint: [181, 14] },
    { officialName: null, descriptiveLabel: null },
    { officialName: '', descriptiveLabel: '' },
    {
      source: {
        ...entry.source,
        url: 'https://user:secret@source.example/parking',
      },
    },
    {
      destinationContext: [
        {
          label: 'Unverified research context',
          destination: 'Museum fixture',
          sourceId: 'osm:node/2',
          sourceRecordUrl: 'https://www.openstreetmap.org/node/2',
          sourceLicense: 'ODbL-1.0',
          status: 'research_context_only',
          parkingNameConfirmed: false,
          visitorAccessConfirmed: false,
          navigationEntranceConfirmed: false,
          publicationApproved: false,
        },
      ],
    },
  ])
    await assert.rejects(
      store.toggle({ ...entry, ...change }, 'Manila', 'public', now),
    )
  await assert.rejects(store.toggle(entry, 'Outside pilot', 'public', now))
  await assert.rejects(store.toggle(entry, 'Manila', 'public', Number.NaN))
  assert.equal(disk.raw, null)
})

test('corrupt or oversized hydration requires explicit recovery and never silently resets storage', async () => {
  const saved = publicPilotSavedPlace(record(), 'Manila', 'public', now)
  for (const value of [
    { version: 2, items: [saved] },
    { version: 1, items: [saved], privateRecords: [] },
    { version: 1, items: [{ ...saved, navigationApproval: null }] },
    { version: 1, items: [{ ...saved, featureType: 'invented-type' }] },
    { version: 1, items: [{ ...saved, key: 'different-key' }] },
    { version: 1, items: [saved, saved] },
    {
      version: 1,
      items: Array.from({ length: MAX_PILOT_SAVED + 1 }, () => saved),
    },
  ])
    assert.throws(() => parsePilotSaved(value))
  const disk = memoryStorage('{broken json')
  const store = createPilotSavedStore(disk.storage)
  await assert.rejects(store.load())
  await assert.rejects(store.toggle(record(), 'Manila', 'public', now))
  assert.equal(disk.raw, '{broken json')
  assert.deepEqual(await store.clear(), [])
  assert.equal(
    (await store.toggle(record(), 'Manila', 'public', now)).length,
    1,
  )
  const huge = createPilotSavedStore(memoryStorage('x'.repeat(327681)).storage)
  await assert.rejects(huge.load(), /too large/)
})

test('concurrent saves serialize, retain newest-first ordering and bound storage to fifty', async () => {
  const disk = memoryStorage()
  const store = createPilotSavedStore(disk.storage)
  await Promise.all(
    Array.from({ length: 55 }, (_, id) =>
      store.toggle(record(id), 'Manila', 'public', now),
    ),
  )
  const items = await store.load()
  assert.equal(items.length, MAX_PILOT_SAVED)
  assert.equal(items[0].id, 'fixture:54')
  assert.equal(items.at(-1).id, 'fixture:5')
  assert.equal(JSON.parse(disk.raw).items.length, 50)
  const next = await store.remove(items[10].key)
  assert.equal(next.length, 49)
  assert.ok(!next.some((item) => item.key === items[10].key))
})

test('failed writes do not advance local truth or poison subsequent operations', async () => {
  const disk = memoryStorage()
  const store = createPilotSavedStore(disk.storage)
  await store.load()
  disk.failWrite()
  await assert.rejects(store.toggle(record(1), 'Manila', 'public', now))
  const items = await store.toggle(record(2), 'Manila', 'public', now)
  assert.deepEqual(
    items.map((item) => item.id),
    ['fixture:2'],
  )
  disk.failClear()
  await assert.rejects(store.clear())
  assert.equal((await store.load()).length, 1)
  disk.failRead()
  await assert.rejects(store.load())
  assert.equal((await store.load()).length, 1)
  assert.deepEqual(await store.clear(), [])
})

test('storage reads, writes and clearing never overlap', async () => {
  let active = 0
  let maximum = 0
  const calls = []
  async function operation(name) {
    active++
    maximum = Math.max(active, maximum)
    calls.push(name)
    await setImmediate()
    active--
    return null
  }
  const store = createPilotSavedStore({
    getItem: () => operation('read'),
    setItem: () => operation('write'),
    removeItem: () => operation('clear'),
  })
  await Promise.all([
    store.load(),
    store.toggle(record(1), 'Manila', 'public', now),
    store.toggle(record(2), 'Manila', 'public', now),
    store.clear(),
  ])
  assert.equal(maximum, 1)
  assert.deepEqual(calls, ['read', 'write', 'write', 'clear'])
})
