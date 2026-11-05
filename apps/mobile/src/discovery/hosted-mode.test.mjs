import assert from 'node:assert/strict'
import test from 'node:test'
import { discoveryMode, validHostedConfig } from './hosted-mode.ts'
import { fetchApprovedParking } from './data.ts'
import { sampleParking } from './sample-data.ts'

const { AbortController, Response } = globalThis

const bounds = {
  west: 121.02,
  south: 14.55,
  east: 121.04,
  north: 14.57,
  zoom: 15,
}
const url = 'https://project.supabase.co'
const key = 'sb_publishable_synthetic'

test('explicit modes preserve legacy and fail closed on typos and secret keys', () => {
  assert.equal(discoveryMode(undefined), 'legacy')
  assert.equal(discoveryMode('hosted'), 'hosted')
  assert.equal(discoveryMode('synthetic'), 'synthetic')
  assert.equal(discoveryMode('production'), 'disabled')
  assert.equal(validHostedConfig(url, key), true)
  for (const endpoint of [
    'http://project.supabase.co',
    'https://user:pass@project.supabase.co',
    url + '/?token=x',
  ])
    assert.equal(validHostedConfig(endpoint, key), false)
  for (const credential of [
    'sb_secret_test',
    'service_role',
    'eyJhbGciOiJIUzI1NiJ9.test.test',
  ])
    assert.equal(validHostedConfig(url, credential), false)
})

test('hosted reads validate version, reject unverified fixtures and propagate abort/errors', async (t) => {
  const signal = new AbortController().signal
  let payload = { contractVersion: 1, records: [], truncated: false }
  t.mock.method(globalThis, 'fetch', async (endpoint, request) => {
    assert.equal(endpoint, url + '/rest/v1/rpc/discover_approved_parking')
    assert.equal(request.signal, signal)
    assert.deepEqual(JSON.parse(request.body), {
      west: 121.02,
      south: 14.55,
      east: 121.04,
      north: 14.57,
    })
    return Response.json(payload)
  })
  assert.deepEqual(
    await fetchApprovedParking(url, key, bounds, signal),
    payload,
  )
  payload = { ...payload, records: sampleParking }
  await assert.rejects(
    fetchApprovedParking(url, key, bounds, signal),
    /unsupported response/,
  )
  payload = { contractVersion: 2, records: [], truncated: false }
  await assert.rejects(
    fetchApprovedParking(url, key, bounds, signal),
    /unsupported response/,
  )
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('', { status: 503 }),
  )
  await assert.rejects(
    fetchApprovedParking(url, key, bounds, signal),
    /could not be loaded/,
  )
})
