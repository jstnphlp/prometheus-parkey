import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import test from 'node:test'

import { confirmationToken, confirmEmail } from './email-confirmation.ts'

const token = 'a'.repeat(64)
const config = {
  url: 'https://auth-test.supabase.co',
  key: 'sb_publishable_test_public_key',
}
const verified = {
  user: { id: 'confirmed-user', email_confirmed_at: '2026-11-14T00:00:00Z' },
  access_token: 'must-not-be-returned',
  refresh_token: 'must-not-be-returned',
}
const response = (value, status = 200) =>
  new globalThis.Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

test('confirmation accepts one token in the fragment and rejects injected parameters', () => {
  assert.equal(confirmationToken(`#token_hash=${token}`), token)
  for (const value of [
    '',
    '?token_hash=' + token,
    '#token_hash=short',
    '#token_hash=' + token + '&token_hash=' + token,
    '#token_hash=' + token + '&type=recovery',
    '#token_hash=' + token + '&next=https://evil.invalid',
    '#access_token=' + token,
    '#token_hash=' + 'a'.repeat(600),
  ])
    assert.equal(confirmationToken(value), null)
})

test('cross-device confirmation uses the email token without a local PKCE verifier or session', async () => {
  const calls = []
  const request = async (url, init) => {
    calls.push({ url, init })
    return response(verified)
  }
  assert.equal(await confirmEmail(token, config, request), 'confirmed')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, config.url + '/auth/v1/verify')
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    token_hash: token,
    type: 'email',
  })
  assert.equal(calls[0].init.credentials, 'omit')
  assert.equal(calls[0].init.cache, 'no-store')
  assert.equal(calls[0].init.referrerPolicy, 'no-referrer')
  assert.equal(calls[0].init.headers.Authorization, undefined)
  assert.doesNotMatch(calls[0].url, new RegExp(token))
})

test('success is never inferred from a link, HTTP status or unverified user alone', async () => {
  for (const value of [
    {},
    { user: null },
    { user: { id: 'user' } },
    { user: { id: 'user', email_confirmed_at: null } },
    { user: { id: 'user', email_confirmed_at: 'invalid' } },
    { access_token: 'token' },
  ])
    assert.equal(
      await confirmEmail(token, config, async () => response(value)),
      'unavailable',
    )
})

test('expired and rejected links, rate limits, network and server errors remain failures', async () => {
  assert.equal(
    await confirmEmail(
      token,
      config,
      async () =>
        new globalThis.Response('upstream unavailable', { status: 503 }),
    ),
    'unavailable',
  )
  assert.equal(
    await confirmEmail(token, config, async () =>
      response({ code: 'otp_expired' }, 403),
    ),
    'expired',
  )
  assert.equal(
    await confirmEmail(token, config, async () =>
      response({ message: 'secret provider text' }, 400),
    ),
    'invalid',
  )
  for (const status of [429, 500, 503])
    assert.equal(
      await confirmEmail(token, config, async () =>
        response({ message: 'secret' }, status),
      ),
      'unavailable',
    )
  assert.equal(
    await confirmEmail(token, config, async () => {
      throw new TypeError('private network detail')
    }),
    'network',
  )
})

test('invalid input or privileged/public-endpoint misconfiguration prevents requests', async () => {
  let calls = 0
  const request = async () => {
    calls++
    return response(verified)
  }
  assert.equal(await confirmEmail('invalid', config, request), 'invalid')
  for (const item of [
    { ...config, url: 'http://auth-test.supabase.co' },
    { ...config, url: 'https://user:pass@auth-test.supabase.co' },
    { ...config, url: config.url + '?token=secret' },
    { ...config, key: 'sb_secret_privileged' },
    { ...config, key: '' },
  ])
    assert.equal(await confirmEmail(token, item, request), 'unavailable')
  const serviceKey =
    'header.' +
    Buffer.from(JSON.stringify({ role: 'service_role' })).toString(
      'base64url',
    ) +
    '.signature'
  assert.equal(
    await confirmEmail(token, { ...config, key: serviceKey }, request),
    'unavailable',
  )
  assert.equal(calls, 0)
})

test('legacy public anonymous key is accepted without exposing session results', async () => {
  const key =
    'header.' +
    Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url') +
    '.signature'
  assert.equal(
    await confirmEmail(token, { ...config, key }, async () =>
      response(verified),
    ),
    'confirmed',
  )
})
