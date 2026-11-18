import assert from 'node:assert/strict'
import test from 'node:test'

import {
  parsePlaceSearch,
  placeSearchEndpoint,
  searchPlaces,
  SearchRateLimit,
  SEARCH_DEBOUNCE_MS,
} from './place-search.ts'

const { Response, AbortController } = globalThis
const credit = {
  label: 'Search by LocationIQ.com',
  url: 'https://locationiq.com/',
}
const payload = {
  results: [
    {
      id: 'public:1',
      name: 'Synthetic landmark',
      address: 'Philippines',
      coordinate: [121, 14.6],
    },
  ],
  attribution: credit,
}

test('provider-neutral results carry required attribution and validated geographic points', () => {
  assert.deepEqual(parsePlaceSearch(payload).results[0].attribution, credit)
  for (const invalid of [
    { ...payload, attribution: { ...credit, url: 'javascript:bad' } },
    { ...payload, results: [{ ...payload.results[0], coordinate: [NaN, 14] }] },
    { ...payload, attribution: null },
  ])
    assert.throws(() => parsePlaceSearch(invalid))
  assert.deepEqual(parsePlaceSearch({ ...payload, results: [] }).results, [])
  assert.equal(SEARCH_DEBOUNCE_MS, 600)
})

test('search sends only query to own backend and never a LocationIQ token or research mode', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://backend.example/functions/v1/place-search')
    assert.equal(options.headers.apikey, 'public-test')
    assert.deepEqual(JSON.parse(options.body), { query: 'mall' })
    return Response.json(payload)
  }
  try {
    const result = await searchPlaces(
      {
        enabled: true,
        backend: 'https://backend.example',
        publicKey: 'public-test',
        legacyEndpoint: '',
      },
      ' mall ',
      [121, 14],
      new AbortController().signal,
    )
    assert.equal(result.results[0].name, 'Synthetic landmark')
  } finally {
    globalThis.fetch = original
  }
})

test('proxy rate limits preserve retry delay and upstream errors never leak raw bodies', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = async () =>
      new Response('private', { status: 429, headers: { 'Retry-After': '30' } })
    const args = [
      {
        enabled: true,
        backend: 'https://backend.example',
        publicKey: 'public-test',
        legacyEndpoint: '',
      },
      'mall',
      [121, 14],
      new AbortController().signal,
    ]
    await assert.rejects(
      searchPlaces(...args),
      (error) => error instanceof SearchRateLimit && error.retryAfter === 30,
    )
    globalThis.fetch = async () => new Response('private', { status: 503 })
    await assert.rejects(searchPlaces(...args), /Search unavailable/)
  } finally {
    globalThis.fetch = original
  }
  assert.throws(() =>
    placeSearchEndpoint('https://user:password@backend.example'),
  )
})
