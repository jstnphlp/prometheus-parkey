import assert from 'node:assert/strict'
import test from 'node:test'

import { createHandler } from './handler.ts'
import { parseLocationIQ, parseQuery } from './provider.ts'

const { Request, Response, AbortController } = globalThis
const env = {
  LOCATIONIQ_API_TOKEN: 'synthetic-secret',
  SUPABASE_URL: 'https://backend.example',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service',
  PLACE_SEARCH_PUBLIC_KEY: 'public-test',
  PLACE_SEARCH_WEB_ORIGINS: 'https://app.example',
}
const row = {
  place_id: '42',
  display_place: 'Synthetic Mall',
  display_address: 'Manila, Philippines',
  display_name: 'Synthetic Mall, Manila, Philippines',
  lat: '14.6',
  lon: '121',
  address: { country_code: 'ph' },
}
const request = (body = { query: 'mall' }, extras = {}) =>
  new Request('https://edge.example', {
    method: 'POST',
    headers: {
      apikey: 'public-test',
      'content-type': 'application/json',
      ...extras,
    },
    body: JSON.stringify(body),
  })

test('proxy requests Philippines-only autocomplete and returns only normalized public fields and attribution', async () => {
  const urls = []
  const handler = createHandler(env, async (input, options) => {
    const url = new URL(input)
    urls.push(url)
    if (url.hostname === 'backend.example') {
      assert.equal(url.pathname, '/rest/v1/rpc/consume_place_search')
      assert.equal(options.headers.Authorization, 'Bearer synthetic-service')
      return Response.json(0)
    }
    assert.equal(url.hostname, 'api.locationiq.com')
    assert.equal(url.searchParams.get('countrycodes'), 'ph')
    assert.equal(url.searchParams.get('key'), 'synthetic-secret')
    assert.equal(url.searchParams.get('q'), 'mall')
    assert.equal(options.redirect, 'error')
    return Response.json([
      { ...row, privateResearch: 'must not return', token: 'must not return' },
    ])
  })
  const response = await handler(request())
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.equal(data.attribution.label, 'Search by LocationIQ.com')
  assert.deepEqual(Object.keys(data.results[0]).sort(), [
    'address',
    'coordinate',
    'id',
    'name',
  ])
  assert.equal(JSON.stringify(data).includes('synthetic-secret'), false)
  assert.equal(urls.length, 2)
})

test('unconfigured, unauthorized, forbidden origins and invalid queries never call upstream', async () => {
  const fetcher = async () => {
    assert.fail('unexpected network request')
  }
  assert.equal((await createHandler({}, fetcher)(request())).status, 503)
  const handler = createHandler(env, fetcher)
  assert.equal((await handler(request({}, { apikey: 'wrong' }))).status, 401)
  assert.equal(
    (
      await handler(
        request({ query: 'mall' }, { origin: 'https://evil.example' }),
      )
    ).status,
    403,
  )
  for (const input of [
    { query: 'ab' },
    { query: 'x'.repeat(181) },
    { query: 'mall', mode: 'candidate_research' },
    { query: 'bad\ninput' },
  ])
    assert.equal((await handler(request(input))).status, 400)
  assert.equal(
    (await handler(request({ query: 'x'.repeat(3000) }))).status,
    400,
  )
})

test('CORS preflight exposes retry header only for approved web origins', async () => {
  const handler = createHandler(env)
  const response = await handler(
    new Request('https://edge.example', {
      method: 'OPTIONS',
      headers: { origin: 'https://app.example' },
    }),
  )
  assert.equal(response.status, 204)
  assert.equal(
    response.headers.get('Access-Control-Allow-Origin'),
    'https://app.example',
  )
  assert.equal(
    response.headers.get('Access-Control-Expose-Headers'),
    'Retry-After',
  )
})

test('shared quotas fail closed and prevent provider calls', async () => {
  for (const [quota, expected] of [
    [Response.json(60), 429],
    [Response.json('bad'), 503],
    [new Response('', { status: 500 }), 503],
  ]) {
    let calls = 0
    const handler = createHandler(env, async () => {
      calls++
      return quota
    })
    const response = await handler(request())
    assert.equal(response.status, expected)
    assert.equal(calls, 1)
  }
})

test('provider rate limits, empty results and failed calls use sanitized states', async () => {
  for (const [status, expected] of [
    [429, 429],
    [404, 200],
    [500, 503],
    [401, 503],
  ]) {
    const handler = createHandler(env, async (url) =>
      String(url).includes('/rpc/')
        ? Response.json(0)
        : new Response('sensitive upstream response', { status }),
    )
    const response = await handler(request())
    assert.equal(response.status, expected)
    if (status === 429) assert.equal(response.headers.get('Retry-After'), '60')
    assert.equal((await response.text()).includes('sensitive'), false)
  }
})

test('invalid coordinates, non-Philippine records, duplicates and malformed provider payloads are rejected', () => {
  assert.equal(
    parseLocationIQ([
      row,
      row,
      { ...row, address: { country_code: 'us' } },
      { ...row, lat: 'NaN' },
      { ...row, lat: '' },
      { ...row, lon: '999' },
    ]).length,
    1,
  )
  assert.throws(() => parseLocationIQ({}))
  assert.throws(() => parseQuery({ query: 'mall', token: 'injected' }))
})

test('aborted clients propagate cancellation to the provider', async () => {
  const controller = new AbortController()
  controller.abort()
  const handler = createHandler(env, async (url, options) => {
    if (String(url).includes('/rpc/')) return Response.json(0)
    assert.equal(options.signal.aborted, true)
    throw new Error('secret-bearing provider error')
  })
  const response = await handler(
    new Request(request(), { signal: controller.signal }),
  )
  assert.equal(response.status, 503)
  assert.equal((await response.text()).includes('secret-bearing'), false)
})
