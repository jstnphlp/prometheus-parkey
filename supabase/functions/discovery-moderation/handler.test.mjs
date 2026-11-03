import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import test from 'node:test'

import { createHandler } from './handler.ts'

const env = {
  MODERATION_ORIGIN: 'https://review.example.org',
  SUPABASE_URL: 'https://db.example.org',
  SUPABASE_SERVICE_ROLE_KEY: 'test-only-not-a-credential',
}
const token = (aal) =>
  `header.${Buffer.from(JSON.stringify({ aal })).toString('base64url')}.signature`
const request = (
  aal = 'aal2',
  origin = env.MODERATION_ORIGIN,
  body = { operation: 'list' },
) =>
  new Request('https://edge.example.org', {
    method: 'POST',
    headers: {
      origin,
      Authorization: `Bearer ${token(aal)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
test('missing configuration and wrong origins fail before authentication or RPC calls', async () => {
  const never = () => {
    throw new Error('Must not call a provider')
  }
  assert.equal((await createHandler({}, never)(request())).status, 503)
  assert.equal(
    (
      await createHandler(
        env,
        never,
      )(request('aal2', 'https://other.example.org'))
    ).status,
    403,
  )
})
test('invalid Auth tokens and AAL1 sessions cannot reach the private RPC', async () => {
  assert.equal(
    (
      await createHandler(
        env,
        async () => new Response('{}', { status: 401 }),
      )(request())
    ).status,
    401,
  )
  let calls = 0
  const handler = createHandler(env, async () => {
    calls++
    return Response.json({ id: 'reviewer' })
  })
  assert.equal((await handler(request('aal1'))).status, 403)
  assert.equal(calls, 1)
})
test('verified sessions pass only server-validated identity and bounded fields to RPC', async () => {
  const handler = createHandler(env, async (url, options) => {
    if (url.endsWith('/auth/v1/user'))
      return Response.json({ id: 'verified-user' })
    assert.ok(url.endsWith('/rest/v1/rpc/moderate_discovery'))
    const body = JSON.parse(options.body)
    assert.equal(body.reviewer, 'verified-user')
    assert.equal(body.operation, 'list')
    assert.equal(body.queue_status, 'pending_review')
    return Response.json({ reports: [], canPublish: false, hasMore: false })
  })
  assert.equal((await handler(request())).status, 200)
  assert.equal(
    (
      await handler(
        request('aal2', env.MODERATION_ORIGIN, {
          operation: 'list',
          reviewer: 'forged',
        }),
      )
    ).status,
    422,
  )
})
test('reviewer denial and RPC errors never expose database error text', async () => {
  for (const status of [403, 400, 500]) {
    const handler = createHandler(env, async (url) =>
      url.endsWith('/auth/v1/user')
        ? Response.json({ id: 'user' })
        : new Response('private SQL details', { status }),
    )
    const response = await handler(request())
    assert.equal(
      response.status,
      status === 403 ? 403 : status >= 500 ? 503 : 409,
    )
    assert.ok(!(await response.text()).includes('private SQL'))
  }
})

test('provider network failures are unavailable rather than invalid client requests', async () => {
  const handler = createHandler(env, async () => {
    throw new TypeError('Private network error')
  })
  const response = await handler(request())
  assert.equal(response.status, 503)
  assert.ok(!(await response.text()).includes('Private network'))
})
