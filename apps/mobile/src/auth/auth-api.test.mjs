import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import test from 'node:test'

import { createAuthClient } from './auth-api.ts'
import { authRedirectUrl } from './links.ts'
import { createSessionStorage, sessionStorageKey } from './secure-storage.ts'

const fixtureUser = {
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'driver@example.invalid',
  email_confirmed_at: '2026-11-13T00:00:00Z',
  created_at: '2026-11-13T00:00:00Z',
  updated_at: '2026-11-13T00:00:00Z',
  app_metadata: {},
  user_metadata: {},
}
function sessionPayload(expiresIn = 3600) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
      sub: fixtureUser.id,
      exp: Math.floor(Date.now() / 1000) + expiresIn,
    })}.c2lnbmF0dXJl`,
    refresh_token: 'unit-test-refresh-token',
    token_type: 'bearer',
    expires_in: expiresIn,
    user: fixtureUser,
  }
}
function setup(respond) {
  const values = new Map()
  const secrets = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value)
    },
    removeItem: async (key) => {
      values.delete(key)
    },
  }
  const calls = []
  const request = async (input, init) => {
    const body = init?.body ? JSON.parse(init.body) : null
    calls.push({ url: String(input), body })
    const { status = 200, json } = respond(String(input), body)
    return new globalThis.Response(JSON.stringify(json), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'X-Supabase-Api-Version': '2024-01-01',
      },
    })
  }
  const storage = createSessionStorage(secrets)
  const client = createAuthClient(
    'https://auth-test.supabase.co',
    'unit-test-public-key',
    storage,
    request,
  )
  return { values, secrets, storage, client, calls, request }
}

test('SDK signup sends name metadata and S256 PKCE, and does not invent an authenticated session', async () => {
  const { client, calls, storage } = setup(() => ({
    json: { ...fixtureUser, email_confirmed_at: null },
  }))
  await storage.setRemember(false)
  const result = await client.auth.signUp({
    email: fixtureUser.email,
    password: 'Example!Aa',
    options: {
      data: { full_name: 'Test Driver' },
      emailRedirectTo: authRedirectUrl,
    },
  })
  assert.equal(result.error, null)
  assert.equal(result.data.session, null)
  const signup = calls.find((call) => call.url.includes('/signup'))
  assert.equal(signup.body.code_challenge_method, 's256')
  assert.match(signup.body.code_challenge, /^[A-Za-z0-9_-]{43}$/)
  assert.deepEqual(signup.body.data, { full_name: 'Test Driver' })
  assert.equal(await storage.getItem(sessionStorageKey), null)
})

test('SDK recovery link exchange identifies recovery from the stored proof, not callback claims', async () => {
  const { client, calls } = setup((url) => ({
    json: url.includes('/recover') ? {} : sessionPayload(),
  }))
  const request = await client.auth.resetPasswordForEmail(fixtureUser.email, {
    redirectTo: authRedirectUrl,
  })
  assert.equal(request.error, null)
  assert.equal(
    calls.find((call) => call.url.includes('/recover')).body
      .code_challenge_method,
    's256',
  )
  const result = await client.auth.exchangeCodeForSession(
    'test-authorization-code',
  )
  assert.equal(result.error, null)
  assert.equal(result.data.redirectType, 'recovery')
  assert.ok(result.data.session)
  assert.equal(
    (await client.auth.exchangeCodeForSession('replay-authorization-code'))
      .error.code,
    'pkce_code_verifier_not_found',
  )
})

test('SDK login preserves secure sessions across relaunch and obtains a fresh server user', async () => {
  const { client, storage, secrets, request } = setup((url) => ({
    json: url.endsWith('/user') ? fixtureUser : sessionPayload(),
  }))
  await storage.setRemember(true)
  assert.equal(
    (
      await client.auth.signInWithPassword({
        email: fixtureUser.email,
        password: 'Example!Aa',
      })
    ).error,
    null,
  )
  const restored = createAuthClient(
    'https://auth-test.supabase.co',
    'unit-test-public-key',
    createSessionStorage(secrets),
    request,
  )
  assert.ok((await restored.auth.getSession()).data.session)
  assert.equal((await restored.auth.getUser()).data.user.id, fixtureUser.id)
})

test('invalid credentials and rejected confirmation/reset links remain errors', async () => {
  const { client } = setup((url) => ({
    status: 400,
    json: {
      code: url.includes('/token') ? 'invalid_credentials' : 'otp_expired',
      msg: 'Rejected',
    },
  }))
  assert.ok(
    (
      await client.auth.signInWithPassword({
        email: fixtureUser.email,
        password: 'Wrong!Aa',
      })
    ).error,
  )
  assert.ok(
    (await client.auth.exchangeCodeForSession('expired-authorization-code'))
      .error,
  )
  assert.ok(
    (
      await client.auth.resetPasswordForEmail(fixtureUser.email, {
        redirectTo: authRedirectUrl,
      })
    ).error,
  )
  assert.equal((await client.auth.getSession()).data.session, null)
})

test('an expired remembered session refreshes through Supabase before it is reused', async () => {
  const { storage, secrets, request, calls } = setup(() => ({
    json: sessionPayload(),
  }))
  await storage.setRemember(true)
  await storage.setItem(
    sessionStorageKey,
    JSON.stringify({
      ...sessionPayload(-60),
      expires_at: Math.floor(Date.now() / 1000) - 60,
    }),
  )
  const restored = createAuthClient(
    'https://auth-test.supabase.co',
    'unit-test-public-key',
    createSessionStorage(secrets),
    request,
  )
  const result = await restored.auth.getSession()
  assert.equal(result.error, null)
  assert.ok(result.data.session.expires_at > Date.now() / 1000)
  assert.ok(calls.some((call) => call.url.includes('grant_type=refresh_token')))
})

test('a server-rejected password change remains an error with the existing session intact', async () => {
  const { client } = setup((url, body) =>
    url.endsWith('/user') && body?.password
      ? {
          status: 422,
          json: { code: 'weak_password', msg: 'Password rejected' },
        }
      : { json: url.endsWith('/user') ? fixtureUser : sessionPayload() },
  )
  await client.auth.signInWithPassword({
    email: fixtureUser.email,
    password: 'Example!Aa',
  })
  const result = await client.auth.updateUser({ password: 'NewExample!Aa' })
  assert.equal(result.error.code, 'weak_password')
  assert.ok((await client.auth.getSession()).data.session)
})
