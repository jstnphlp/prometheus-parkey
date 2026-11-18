import assert from 'node:assert/strict'
import test from 'node:test'

import { createOnboardingStore, onboardingStorageKey } from './persistence.ts'

function memoryStorage(initial = []) {
  const values = new Map(initial)
  return {
    values,
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value)
    },
  }
}

test('first launch is incomplete, and completion survives a new store/launch', async () => {
  const storage = memoryStorage()
  assert.equal(await createOnboardingStore(storage).read(), false)
  await createOnboardingStore(storage).complete()
  assert.equal(await createOnboardingStore(storage).read(), true)
})

test('only a recognized completion marker skips onboarding', async () => {
  for (const value of ['', 'false', 'true', '{}', 'completed', 'v2']) {
    const storage = memoryStorage([[onboardingStorageKey, value]])
    assert.equal(await createOnboardingStore(storage).read(), false)
  }
})

test('completing or skipping is idempotent and preserves all discovery data', async () => {
  const parked = JSON.stringify({
    coordinate: [121, 14],
    savedAt: '2026-11-13',
  })
  const favorites = '["public-place"]'
  const storage = memoryStorage([
    ['parkey.discovery.saved-parking.v1', parked],
    ['favorites', favorites],
  ])
  const store = createOnboardingStore(storage)
  await store.complete()
  await store.complete()
  assert.deepEqual(
    [...storage.values],
    [
      ['parkey.discovery.saved-parking.v1', parked],
      ['favorites', favorites],
      [onboardingStorageKey, 'complete'],
    ],
  )
})

test('read failure is surfaced rather than mistaken for a first launch', async () => {
  const storage = memoryStorage()
  const store = createOnboardingStore({
    ...storage,
    getItem: async () => {
      throw new Error('Storage unavailable')
    },
  })
  await assert.rejects(store.read(), /Storage unavailable/)
  assert.equal(storage.values.size, 0)
})

test('failed writes do not report completion and can be retried', async () => {
  const storage = memoryStorage()
  let fail = true
  const store = createOnboardingStore({
    ...storage,
    setItem: async (key, value) => {
      if (fail) throw new Error('Disk full')
      await storage.setItem(key, value)
    },
  })
  await assert.rejects(store.complete(), /Disk full/)
  assert.equal(await store.read(), false)
  fail = false
  await store.complete()
  assert.equal(await store.read(), true)
})

test('completion waits for durable storage before navigation may proceed', async () => {
  const storage = memoryStorage()
  let release
  const ready = new Promise((resolve) => {
    release = resolve
  })
  const store = createOnboardingStore({
    ...storage,
    setItem: async (key, value) => {
      await ready
      await storage.setItem(key, value)
    },
  })
  let completed = false
  const pending = store.complete().then(() => {
    completed = true
  })
  await Promise.resolve()
  assert.equal(completed, false)
  assert.equal(await store.read(), false)
  release()
  await pending
  assert.equal(completed, true)
  assert.equal(await store.read(), true)
})
