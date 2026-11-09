import assert from 'node:assert/strict'
import test from 'node:test'

import { refreshReviewedParking } from './parking-navigation-refresh.ts'
import { sampleParking } from './sample-data.ts'

const { fetch: originalFetch, Response, AbortController } = globalThis
const connection = {
  url: 'https://fixture.invalid',
  publicKey: 'synthetic-public-key',
}
const record = () => ({
  ...sampleParking[0],
  id: 'old',
  sourceKind: 'osm',
  sourceUrl: 'https://www.openstreetmap.org/node/42',
  entrances: [[121, 14]],
  navigationApproval: {
    entrance: [121, 14],
    entranceConfirmed: true,
    visitorAccessConfirmed: true,
    operatorAuthorized: true,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  },
})

test('fresh lookup uses current authorized facts even when the backend identity changes', async () => {
  const stale = record(),
    fresh = {
      ...stale,
      id: 'new-server-id',
      entrances: [[121.001, 14]],
      navigationApproval: {
        ...stale.navigationApproval,
        entrance: [121.001, 14],
      },
    }
  let requests = 0
  globalThis.fetch = async (url, options) => {
    requests++
    assert.match(url, /discover_parking$/)
    assert.equal(options.method, 'POST')
    return new Response(JSON.stringify({ records: [fresh], truncated: false }))
  }
  try {
    assert.deepEqual(
      await refreshReviewedParking(
        stale,
        connection,
        new AbortController().signal,
      ),
      fresh,
    )
    assert.equal(requests, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('missing, revoked, restricted, expired or ambiguous current facts never authorize a route', async () => {
  const stale = record()
  const cases = [
    [],
    [{ ...stale, navigationApproval: null }],
    [{ ...stale, osmTags: { 'parking:access': 'private' } }],
    [
      {
        ...stale,
        navigationApproval: {
          ...stale.navigationApproval,
          expiresAt: new Date(Date.now() - 1).toISOString(),
        },
      },
    ],
    [stale, stale],
  ]
  try {
    for (const records of cases) {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ records, truncated: false }))
      await assert.rejects(
        refreshReviewedParking(stale, connection, new AbortController().signal),
      )
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('network errors, absent backend and cancellation cannot fall back to cached authorization', async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    throw new Error('offline')
  }
  try {
    await assert.rejects(
      refreshReviewedParking(
        record(),
        connection,
        new AbortController().signal,
      ),
      /offline/,
    )
    await assert.rejects(
      refreshReviewedParking(
        record(),
        { url: '', publicKey: '' },
        new AbortController().signal,
      ),
    )
    const canceled = new AbortController()
    canceled.abort()
    await assert.rejects(
      refreshReviewedParking(record(), connection, canceled.signal),
    )
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('generic shared website citations cannot link a different record to an old approval', async () => {
  const stale = { ...record(), sourceUrl: 'https://operator.example/' }
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        records: [{ ...stale, id: 'another-facility' }],
        truncated: false,
      }),
    )
  try {
    await assert.rejects(
      refreshReviewedParking(stale, connection, new AbortController().signal),
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
