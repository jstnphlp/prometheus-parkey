import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'

import {
  createPublicPilotCache,
  PUBLIC_PILOT_CACHE_TTL_MS,
} from './pilot-cache.ts'

const now = Date.parse('2026-11-06T00:00:00Z')
const origin = 'https://cache-fixture.supabase.co'
const area = (offset = 0, city = 'Manila') => ({
  city,
  mode: 'public',
  token: null,
  bounds: {
    west: 120.98 + offset * 0.001,
    south: 14.59,
    east: 120.99 + offset * 0.001,
    north: 14.6,
  },
})
const record = (id = '1') => ({
  id: `fixture:${id}`,
  sourceObservationId: `osm:node/${id}:Point`,
  name: `Original fixture ${id}`,
  officialName: null,
  descriptiveLabel: `Approved fixture ${id}`,
  featureType: 'facility_unspecified',
  geometry: { type: 'Point', coordinates: [120.984, 14.599] },
  representativePoint: [120.984, 14.599],
  accessClass: 'public_visitors',
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

function memoryStorage() {
  const data = new Map()
  const calls = []
  let failRead = false,
    failWrite = false,
    failRemove = false
  return {
    data,
    calls,
    failRead: () => {
      failRead = true
    },
    failWrite: () => {
      failWrite = true
    },
    failRemove: () => {
      failRemove = true
    },
    storage: {
      async getItem(key) {
        calls.push(['get', key])
        if (failRead) {
          failRead = false
          throw new Error('Synthetic read failure')
        }
        return data.get(key) ?? null
      },
      async setItem(key, value) {
        calls.push(['set', key])
        if (failWrite) {
          failWrite = false
          throw new Error('Synthetic write failure')
        }
        data.set(key, value)
      },
      async removeItem(key) {
        calls.push(['remove', key])
        if (failRemove) {
          failRemove = false
          throw new Error('Synthetic remove failure')
        }
        data.delete(key)
      },
    },
  }
}

test('cache persists a deep public whitelist and never retains navigation capability', async () => {
  const disk = memoryStorage(),
    cache = createPublicPilotCache(disk.storage, origin)
  const input = {
    ...record(),
    reviewerToken: 'synthetic-private-token',
    geometry: { ...record().geometry, privateNote: 'synthetic-private-note' },
    source: { ...record().source, adminKey: 'synthetic-admin-value' },
    evidence: {
      ...record().evidence,
      researcherEmail: 'synthetic-private-email',
    },
    navigationApproval: {
      entrance: [120.984, 14.599],
      entranceConfirmed: true,
      visitorAccessConfirmed: true,
      operatorAuthorized: true,
      expiresAt: new Date(now + 60000).toISOString(),
    },
  }
  assert.equal(await cache.put(area(), [input], now), true)
  const serialized = [...disk.data.values()][0]
  for (const forbidden of [
    'reviewerToken',
    'adminKey',
    'researcherEmail',
    'privateNote',
    'synthetic-private',
    'entranceConfirmed',
    'operatorAuthorized',
  ])
    assert.ok(!serialized.includes(forbidden), forbidden)
  const hit = await createPublicPilotCache(disk.storage, origin).get(
    area(),
    now,
  )
  assert.equal(hit.records[0].navigationApproval, null)
  assert.equal(input.navigationApproval.entranceConfirmed, true)
  assert.equal(input.source.adminKey, 'synthetic-admin-value')
  hit.records[0].representativePoint[0] = 0
  hit.records[0].geometry.coordinates[0] = 0
  assert.equal(
    (await cache.get(area(), now)).records[0].representativePoint[0],
    120.984,
  )
  assert.equal(
    (await cache.get(area(), now)).records[0].geometry.coordinates[0],
    120.984,
  )
})

test('exact geometry, classification and normalized viewport identity survive hydration', async () => {
  const disk = memoryStorage(),
    cache = createPublicPilotCache(disk.storage, origin)
  const ring = [
    [120.98, 14.59],
    [120.99, 14.59],
    [120.99, 14.6],
    [120.98, 14.59],
  ]
  const records = [
    { ...record('lot'), featureType: 'lot' },
    { ...record('garage'), featureType: 'garage' },
    {
      ...record('unknown'),
      geometry: { type: 'Polygon', coordinates: [ring] },
    },
    {
      ...record('street'),
      featureType: 'street_segment',
      geometry: { type: 'MultiLineString', coordinates: [ring.slice(0, 2)] },
    },
    { ...record('space'), featureType: 'space' },
    {
      ...record('entrance'),
      featureType: 'entrance',
      geometry: { type: 'MultiPolygon', coordinates: [[ring]] },
    },
  ]
  assert.equal(await cache.put(area(), records, now), true)
  const request = area()
  request.bounds.west += 0.0000001
  const hit = await createPublicPilotCache(disk.storage, origin).get(
    request,
    now,
  )
  assert.deepEqual(hit.records, records)
  assert.equal(hit.fetchedAt, now)
  assert.equal(await cache.get(area(1), now), null)
  assert.equal(await cache.get(area(0, 'Mandaluyong'), now), null)
})

test('TTL and review expiry are strict and are never extended by reads', async () => {
  const disk = memoryStorage(),
    cache = createPublicPilotCache(disk.storage, origin)
  await cache.put(area(), [record()], now)
  assert.ok(await cache.get(area(), now + PUBLIC_PILOT_CACHE_TTL_MS - 1))
  assert.equal(await cache.get(area(), now + PUBLIC_PILOT_CACHE_TTL_MS), null)
  const expiring = {
    ...record(),
    reviewDueAt: new Date(now + 1000).toISOString(),
  }
  await cache.put(area(), [expiring], now)
  assert.ok(await cache.get(area(), now + 999))
  assert.equal(await cache.get(area(), now + 1000), null)
  await cache.put(area(), [record()], now)
  assert.equal(await cache.get(area(), now - 1), null)
  assert.equal(await cache.get(area(), Number.NaN), null)
})

test('candidate, context-bearing, unapproved, restricted and unsupported facts never enter cache', async () => {
  const disk = memoryStorage(),
    cache = createPublicPilotCache(disk.storage, origin)
  for (const request of [
    { ...area(), mode: 'candidate_research', token: 'synthetic-session' },
    { ...area(), token: 'synthetic-session' },
    { ...area(), city: 'Outside pilot' },
    { ...area(), bounds: { west: 0, east: 5, south: 0, north: 5 } },
  ]) {
    assert.equal(await cache.put(request, [record()], now), false)
    assert.equal(await cache.get(request, now), null)
    await cache.invalidate(request)
  }
  const original = record()
  for (const changed of [
    {
      ...original,
      evidence: { ...original.evidence, publicationApproved: false },
    },
    { ...original, restrictedAccess: true },
    { ...original, accessClass: 'private' },
    { ...original, accessClass: 'members' },
    { ...original, accessClass: 'unrecognized-explicit-value' },
    { ...original, featureType: 'guessed-lot' },
    { ...original, reviewDueAt: new Date(now).toISOString() },
    {
      ...original,
      source: {
        ...original.source,
        url: 'https://user:secret@source.example/record',
      },
    },
    {
      ...original,
      source: {
        ...original.source,
        url: 'https://source.example/record?access_token=synthetic',
      },
    },
    {
      ...original,
      source: {
        ...original.source,
        url: 'https://source.example/record#session=synthetic',
      },
    },
    {
      ...original,
      destinationContext: [
        {
          label: 'Context',
          destination: 'Fixture',
          sourceId: 'fixture',
          sourceRecordUrl: 'https://source.example/record',
          sourceLicense: 'fixture',
          status: 'research_context_only',
          parkingNameConfirmed: false,
          visitorAccessConfirmed: false,
          navigationEntranceConfirmed: false,
          publicationApproved: false,
        },
      ],
    },
  ])
    assert.equal(await cache.put(area(), [changed], now), false)
  assert.equal(disk.calls.length, 0)
})

test('backend origins isolate storage and unsafe namespaces cannot perform I/O', async () => {
  const disk = memoryStorage()
  const first = createPublicPilotCache(disk.storage, origin)
  const second = createPublicPilotCache(
    disk.storage,
    'https://other-fixture.supabase.co',
  )
  await first.put(area(), [record('first-backend')], now)
  assert.equal(await second.get(area(), now), null)
  await second.put(area(), [record('second-backend')], now)
  assert.equal(
    (await first.get(area(), now)).records[0].id,
    'fixture:first-backend',
  )
  assert.equal(
    (await second.get(area(), now)).records[0].id,
    'fixture:second-backend',
  )
  assert.equal(disk.data.size, 2)
  const local = createPublicPilotCache(disk.storage, 'http://127.0.0.1:55431')
  assert.equal(await local.put(area(), [], now), true)
  const before = disk.calls.length
  for (const namespace of [
    '',
    undefined,
    'javascript:alert(1)',
    'https://user:secret@cache.example',
    'https://cache.example/path',
    'https://cache.example?token=private',
    'https://cache.example#private',
    'http://unsafe.example',
  ]) {
    const cache = createPublicPilotCache(disk.storage, namespace)
    assert.equal(await cache.get(area(), now), null)
    assert.equal(await cache.put(area(), [record()], now), false)
    await cache.invalidate(area())
  }
  assert.equal(disk.calls.length, before)
})

test('six-entry LRU honors reads and survives a new cache instance', async () => {
  const disk = memoryStorage(),
    cache = createPublicPilotCache(disk.storage, origin)
  for (let index = 0; index < 6; index++)
    assert.equal(
      await cache.put(area(index), [record(String(index))], now),
      true,
    )
  await cache.get(area(0), now)
  await cache.put(area(6), [record('6')], now)
  const hydrated = createPublicPilotCache(disk.storage, origin)
  assert.equal(await hydrated.get(area(1), now), null)
  assert.ok(await hydrated.get(area(0), now))
  assert.ok(await hydrated.get(area(6), now))
  assert.equal(JSON.parse([...disk.data.values()][0]).entries.length, 6)
})

test('aggregate record count is bounded without silently truncating an authoritative entry', async () => {
  const disk = memoryStorage(),
    cache = createPublicPilotCache(disk.storage, origin)
  for (let index = 0; index < 3; index++) {
    const records = Array.from({ length: 400 }, (_, id) =>
      record(`${index}-${id}`),
    )
    assert.equal(await cache.put(area(index), records, now), true)
  }
  assert.equal(await cache.get(area(0), now), null)
  assert.equal((await cache.get(area(2), now)).records.length, 400)
  const envelope = JSON.parse([...disk.data.values()][0])
  assert.ok(
    envelope.entries.reduce((sum, entry) => sum + entry.records.length, 0) <=
      1000,
  )
  assert.equal(
    await cache.put(
      area(3),
      Array.from({ length: 1001 }, (_, id) => record(`too-many-${id}`)),
      now,
    ),
    false,
  )
})

test('serialized UTF-8 storage never exceeds one MiB, including multibyte source text', async () => {
  const disk = memoryStorage(),
    cache = createPublicPilotCache(disk.storage, origin)
  for (let index = 0; index < 4; index++)
    assert.equal(
      await cache.put(
        area(index),
        [
          {
            ...record(String(index)),
            warnings: Array.from({ length: 20 }, () => '₱'.repeat(5000)),
          },
        ],
        now,
      ),
      true,
    )
  const serialized = [...disk.data.values()][0]
  assert.ok(Buffer.byteLength(serialized, 'utf8') <= 1024 * 1024)
  assert.ok(Buffer.byteLength(serialized, 'utf8') > serialized.length)
  assert.equal(await cache.get(area(0), now), null)
  assert.equal(
    await cache.put(
      area(5),
      [
        {
          ...record('huge'),
          warnings: Array.from({ length: 100 }, () => '₱'.repeat(5000)),
        },
      ],
      now,
    ),
    false,
  )
  assert.ok(
    [...disk.data.values()].every(
      (value) => Buffer.byteLength(value, 'utf8') <= 1024 * 1024,
    ),
  )
})

test('authoritative empty results overwrite older records and reject late older writes', async () => {
  const disk = memoryStorage(),
    cache = createPublicPilotCache(disk.storage, origin)
  assert.equal(await cache.put(area(), [record()], now), true)
  assert.equal(await cache.put(area(), [], now + 10), true)
  assert.equal(await cache.put(area(), [record('late')], now + 5), false)
  assert.deepEqual(await cache.get(area(), now + 11), {
    records: [],
    fetchedAt: now + 10,
  })
})

test('corrupt, capability-bearing and oversized storage hydrate as misses', async () => {
  const disk = memoryStorage(),
    cache = createPublicPilotCache(disk.storage, origin)
  await cache.put(area(), [record()], now)
  const key = [...disk.data.keys()][0]
  const valid = JSON.parse(disk.data.get(key))
  for (const corrupt of [
    '{bad JSON',
    JSON.stringify({ ...valid, version: 99 }),
    JSON.stringify({ ...valid, namespace: 'https://other-backend.example' }),
    JSON.stringify({ ...valid, privateToken: 'synthetic' }),
    JSON.stringify({
      ...valid,
      entries: [
        {
          ...valid.entries[0],
          records: [{ ...record(), privateNotes: 'synthetic' }],
        },
      ],
    }),
    JSON.stringify({
      ...valid,
      entries: [
        {
          ...valid.entries[0],
          records: [
            {
              ...record(),
              navigationApproval: {
                entrance: [120.984, 14.599],
                entranceConfirmed: true,
                visitorAccessConfirmed: true,
                operatorAuthorized: true,
                expiresAt: new Date(now + 1000).toISOString(),
              },
            },
          ],
        },
      ],
    }),
    'x'.repeat(1024 * 1024 + 1),
  ]) {
    disk.data.set(key, corrupt)
    assert.equal(
      await createPublicPilotCache(disk.storage, origin).get(area(), now),
      null,
    )
  }
  disk.data.set(key, '{bad JSON')
  const recovering = createPublicPilotCache(disk.storage, origin)
  assert.equal(await recovering.put(area(), [record('new')], now), true)
  assert.equal((await recovering.get(area(), now)).records[0].id, 'fixture:new')
})

test('storage failures are misses and failed invalidation cannot resurrect stale cache', async () => {
  const disk = memoryStorage(),
    cache = createPublicPilotCache(disk.storage, origin)
  disk.failRead()
  assert.equal(await cache.get(area(), now), null)
  disk.failWrite()
  assert.equal(await cache.put(area(), [record()], now), false)
  assert.equal(await cache.get(area(), now), null)
  assert.equal(await cache.put(area(), [record()], now), true)
  disk.failRemove()
  await cache.invalidate(area())
  assert.equal(await cache.get(area(), now), null)
  assert.equal(await cache.put(area(1), [record('fresh')], now + 1), true)
  assert.equal(await cache.get(area(), now + 1), null)
  assert.ok(await cache.get(area(1), now + 1))
})

test('concurrent operations serialize and invalidation fences pending writes and reads', async () => {
  const disk = memoryStorage()
  let release
  let writing = false
  let active = 0,
    maximum = 0
  const barrier = new Promise((resolve) => {
    release = resolve
  })
  const cache = createPublicPilotCache(
    {
      ...disk.storage,
      async setItem(key, value) {
        active++
        maximum = Math.max(maximum, active)
        writing = true
        await barrier
        await disk.storage.setItem(key, value)
        active--
      },
    },
    origin,
  )
  const pendingWrite = cache.put(area(), [record()], now)
  while (!writing) await setImmediate()
  const pendingRead = cache.get(area(), now)
  const invalidation = cache.invalidate(area())
  release()
  assert.equal(await pendingWrite, false)
  assert.equal(await pendingRead, null)
  await invalidation
  assert.equal(await cache.get(area(), now), null)
  assert.equal(maximum, 1)
  await Promise.all(
    Array.from({ length: 4 }, (_, id) =>
      cache.put(area(id), [record(String(id))], now + id),
    ),
  )
  assert.ok(await cache.get(area(3), now + 4))
  assert.equal(maximum, 1)
})
