import assert from 'node:assert/strict'
import test from 'node:test'

import { createHandler } from './handler.ts'
import {
  DISCLOSURE_VERSION,
  MAX_BODY_BYTES,
  readReportBody,
  reportRequest,
} from './validation.ts'

const actor = '11111111-1111-4111-8111-111111111111'
const receiptId = '22222222-2222-4222-8222-222222222222'
const now = Date.parse('2026-11-10T08:00:00Z')
const env = {
  SUPABASE_URL: 'https://db.example.org',
  SUPABASE_SERVICE_ROLE_KEY: 'test-only-server-credential',
  MOBILE_REPORTS_ENABLED: 'true',
  MOBILE_REPORTS_PRIVACY_APPROVED: 'true',
  MOBILE_REPORTS_WEB_ORIGIN: 'https://mobile.example.org',
}
const report = () => ({
  intent: 'add',
  target: null,
  name: 'Synthetic parking report',
  kind: 'lot',
  geometry: { type: 'Point', coordinates: [121.03, 14.56] },
  side: 'unknown',
  restrictions: null,
  hours: null,
  fees: null,
  observed_at: '2026-11-09T00:00:00Z',
})
const body = () => ({
  schema_version: 1,
  action: 'submit',
  client_key: 'local-test-1',
  disclosure_version: DISCLOSURE_VERSION,
  report: report(),
})
const request = (value = body(), headers = {}) =>
  new Request('https://edge.example.org', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer test-user-token-with-valid-format',
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(value),
  })
function provider({
  user,
  quotaStatus = 200,
  rpcStatus = 200,
  rpcBody,
  delay,
} = {}) {
  const calls = []
  const run = async (url, init) => {
    calls.push({ url, init })
    if (url.endsWith('/auth/v1/user'))
      return Response.json(
        user ?? {
          id: actor,
          email: 'synthetic@example.org',
          email_confirmed_at: '2026-11-01T00:00:00Z',
          is_anonymous: false,
        },
      )
    if (url.endsWith('/consume_mobile_report_attempt'))
      return new Response(null, { status: quotaStatus })
    if (delay) throw new Error('Test-only network failure')
    return Response.json(
      rpcBody ?? {
        state: 'received',
        receiptId,
        receivedAt: '2026-11-10T08:00:00Z',
      },
      { status: rpcStatus },
    )
  }
  return { run, calls }
}
test('disabled service and unknown origins cannot authenticate or write', async () => {
  const p = provider()
  assert.equal((await createHandler({}, p.run)(request())).status, 503)
  assert.equal(
    (
      await createHandler(
        { ...env, MOBILE_REPORTS_PRIVACY_APPROVED: 'false' },
        p.run,
      )(request())
    ).status,
    503,
  )
  assert.equal(
    (
      await createHandler(
        env,
        p.run,
      )(request(body(), { origin: 'https://attacker.example.org' }))
    ).status,
    403,
  )
  assert.equal(p.calls.length, 0)
})
test('missing bearer, unverified, anonymous and malformed identities never reach a quota or write RPC', async () => {
  const missing = provider()
  assert.equal(
    (
      await createHandler(
        env,
        missing.run,
      )(request(body(), { Authorization: '' }))
    ).status,
    401,
  )
  assert.equal(missing.calls.length, 0)
  for (const user of [
    { id: actor, email: 'test@example.org', email_confirmed_at: null },
    {
      id: actor,
      email: 'test@example.org',
      email_confirmed_at: '2026-11-01Z',
      is_anonymous: true,
    },
    {
      id: 'wrong',
      email: 'test@example.org',
      email_confirmed_at: '2026-11-01Z',
    },
  ]) {
    const p = provider({ user })
    assert.equal(
      (await createHandler(env, p.run, () => now)(request())).status,
      403,
    )
    assert.equal(p.calls.length, 1)
  }
})
test('verified email is checked remotely and private submission has a minimal receipt', async () => {
  const p = provider({
    rpcBody: {
      state: 'received',
      receiptId,
      receivedAt: '2026-11-10T08:00:00Z',
      private_note: 'must not escape',
      email: 'must not escape',
    },
  })
  const response = await createHandler(env, p.run, () => now)(request())
  assert.equal(response.status, 202)
  assert.deepEqual(await response.json(), {
    state: 'received',
    receiptId,
    receivedAt: '2026-11-10T08:00:00Z',
  })
  assert.equal(p.calls.length, 3)
  const payload = JSON.parse(p.calls[2].init.body)
  assert.equal(payload.actor, actor)
  assert.equal(payload.operation, 'submit')
  assert.equal(payload.payload.photoUri, undefined)
  assert.equal(payload.payload.status, undefined)
  assert.equal(payload.payload.observed_at, '2026-11-09T00:00:00.000Z')
  assert.equal(response.headers.get('cache-control'), 'no-store')
})
test('attempt quota is charged before validating a malformed report and failures cannot write', async () => {
  const p = provider()
  const malformed = { ...body(), report: { ...report(), published: true } }
  assert.equal(
    (await createHandler(env, p.run, () => now)(request(malformed))).status,
    422,
  )
  assert.equal(p.calls.length, 2)
  const limited = provider({ quotaStatus: 429 })
  const response = await createHandler(env, limited.run, () => now)(request())
  assert.equal(response.status, 429)
  assert.equal(response.headers.get('retry-after'), '60')
  assert.equal(limited.calls.length, 2)
})
test('write limits, idempotency conflicts and unknown delivery preserve generic errors', async () => {
  for (const status of [429, 409, 503]) {
    const p = provider({
      rpcStatus: status,
      rpcBody: { secret: 'never forward' },
    })
    const response = await createHandler(env, p.run, () => now)(request())
    assert.equal(response.status, status)
    assert.doesNotMatch(JSON.stringify(await response.json()), /never forward/)
  }
  const p = provider({ delay: true })
  assert.equal(
    (await createHandler(env, p.run, () => now)(request())).status,
    503,
  )
})
test('status recovery and withdrawal remain scoped to authenticated actor and client key', async () => {
  for (const action of ['status', 'withdraw']) {
    const p = provider({
      rpcBody:
        action === 'status'
          ? { state: 'not_sent' }
          : {
              state: 'withdrawn',
              receiptId,
              receivedAt: '2026-11-10T08:00:00Z',
            },
    })
    const response = await createHandler(
      env,
      p.run,
      () => now,
    )(request({ schema_version: 1, action, client_key: 'local-test-1' }))
    assert.equal(response.status, 200)
    assert.deepEqual(JSON.parse(p.calls[2].init.body), {
      actor,
      operation: action,
      client_key: 'local-test-1',
      payload: null,
    })
  }
})
test('validation rejects authority, media, malformed geometry, future/stale dates and conflicting targets', () => {
  const cases = [
    { ...report(), photoUri: 'file:///private.jpg' },
    { ...report(), target: actor },
    { ...report(), kind: 'invented' },
    { ...report(), geometry: { type: 'Point', coordinates: [181, 14] } },
    { ...report(), geometry: { type: 'Point', coordinates: [121, 14, 5] } },
    {
      ...report(),
      intent: 'correction',
      target: 'https://attacker.example.org',
      restrictions: 'Wrong access',
    },
    {
      ...report(),
      intent: 'correction',
      target: 'osm:node/123',
      restrictions: null,
    },
    { ...report(), observed_at: '2026-11-11T00:00:00Z' },
    { ...report(), observed_at: '2026-01-01T00:00:00Z' },
  ]
  for (const value of cases)
    assert.throws(() => reportRequest({ ...body(), report: value }, now))
  assert.throws(() => reportRequest({ ...body(), actor }, now))
  assert.throws(() =>
    reportRequest({ ...body(), disclosure_version: 'old' }, now),
  )
  assert.equal(
    reportRequest(
      {
        ...body(),
        report: {
          ...report(),
          intent: 'correction',
          target: 'osm:node/123',
          restrictions: 'Synthetic correction',
        },
      },
      now,
    ).payload.target,
    'osm:node/123',
  )
})
test('both declared and streamed oversized bodies are rejected', async () => {
  const tooLarge = 'x'.repeat(MAX_BODY_BYTES + 1)
  await assert.rejects(
    readReportBody(
      new Request('https://edge.example.org', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(tooLarge.length),
        },
        body: tooLarge,
      }),
    ),
    RangeError,
  )
  await assert.rejects(
    readReportBody(
      new Request('https://edge.example.org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: tooLarge,
      }),
    ),
    RangeError,
  )
})
test('source street corrections retain valid geometry beyond the editor addition limit', () => {
  const coordinates = Array.from({ length: 13 }, (_, i) => [
    121.03 + i * 0.00001,
    14.56,
  ])
  const street = {
    ...report(),
    kind: 'street',
    intent: 'correction',
    target: 'osm:way/123',
    restrictions: 'Synthetic correction',
    geometry: { type: 'LineString', coordinates },
  }
  assert.equal(
    reportRequest({ ...body(), report: street }, now).payload.geometry
      .coordinates.length,
    13,
  )
  assert.throws(() =>
    reportRequest(
      { ...body(), report: { ...street, intent: 'add', target: null } },
      now,
    ),
  )
})
