import assert from 'node:assert/strict'
import test from 'node:test'

import { createAuthClient } from './auth-api.ts'
import { normalizeAuthLink, readEmailFlow } from './links.ts'
import { completeOAuth, openOAuth } from './oauth-flow.ts'
import {
  enabledSocialProviders,
  oauthCallbackCode,
  oauthRedirectUrl,
  readOAuthFlow,
  trustedOAuthUrl,
} from './oauth-policy.ts'
import {
  createSessionStorage,
  pendingFlowKey,
  sessionStorageKey,
} from './secure-storage.ts'

const projectUrl = 'https://auth-test.supabase.co'
const proofKey = `${sessionStorageKey}-code-verifier`
const flowId = '0123456789abcdef0123456789abcdef'
const code = 'test-authorization-code'
const callback = `${oauthRedirectUrl}?code=${code}`
function setup({ reject = false, verified = true } = {}) {
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
  const storage = createSessionStorage(secrets)
  const calls = []
  const request = async (input, init) => {
    calls.push({
      url: String(input),
      body: init?.body ? JSON.parse(init.body) : null,
    })
    return new globalThis.Response(
      JSON.stringify(
        reject
          ? { code: 'bad_code_verifier', msg: 'Rejected' }
          : {
              access_token: 'test-access-token',
              refresh_token: 'test-refresh-token',
              expires_in: 3600,
              token_type: 'bearer',
              user: {
                id: 'test-user',
                aud: 'authenticated',
                email: 'driver@example.invalid',
                email_confirmed_at: '2026-11-14T00:00:00Z',
                app_metadata: {},
                user_metadata: {},
                created_at: '2026-11-14T00:00:00Z',
              },
            },
      ),
      {
        status: reject ? 400 : 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Supabase-Api-Version': '2024-01-01',
        },
      },
    )
  }
  let checks = 0
  const client = createAuthClient(
    projectUrl,
    'unit-public-key',
    storage,
    request,
  )
  const context = {
    client,
    storage,
    secrets,
    projectUrl,
    provider: 'google',
    verify: async () => {
      checks++
      return verified
    },
  }
  return { values, calls, context, checks: () => checks }
}

test('OAuth pending state is short-lived, provider-specific and cannot authorize recovery', () => {
  const now = Date.now()
  const flow = { kind: 'oauth', provider: 'google', createdAt: now, flowId }
  assert.deepEqual(readOAuthFlow(JSON.stringify(flow), now), flow)
  assert.equal(readEmailFlow(JSON.stringify(flow)), null)
  for (const value of [
    null,
    '{',
    JSON.stringify({ ...flow, kind: 'recovery' }),
    JSON.stringify({ ...flow, provider: 'unknown' }),
    JSON.stringify({ ...flow, createdAt: now + 1 }),
    JSON.stringify({ ...flow, createdAt: now - 900001 }),
  ])
    assert.equal(readOAuthFlow(value, now), null)
})

test('OAuth callbacks reject foreign origins, fragments, duplicates and token injection', () => {
  assert.equal(oauthCallbackCode(callback), code)
  assert.equal(normalizeAuthLink(callback), `/auth/oauth?code=${code}`)
  assert.equal(
    normalizeAuthLink(`/auth/oauth?code=${code}`),
    `/auth/oauth?code=${code}`,
  )
  for (const url of [
    callback.replace('parkey:', 'https:'),
    callback.replace('//auth', '//foreign'),
    `${callback}#access_token=secret`,
    `${callback}&code=second-code`,
    `${callback}&access_token=secret`,
    `${callback}&type=recovery`,
    `${callback}&error=access_denied`,
  ]) {
    assert.equal(oauthCallbackCode(url), null)
    assert.doesNotMatch(normalizeAuthLink(url), /\?code=/)
  }
})

test('provider settings require explicit true and default to unavailable', () => {
  for (const value of [
    null,
    {},
    { external: 'invalid' },
    { external: { google: 'true', facebook: 1 } },
  ])
    assert.deepEqual(enabledSocialProviders(value), {
      google: false,
      facebook: false,
    })
  assert.deepEqual(
    enabledSocialProviders({ external: { google: true, facebook: false } }),
    { google: true, facebook: false },
  )
})

for (const provider of ['google', 'facebook']) {
  test(`${provider} uses SDK S256 PKCE and a real code exchange before verified success`, async () => {
    const { context, calls, values, checks } = setup()
    await context.storage.setRemember(false)
    let authorized
    const success = await openOAuth({
      ...context,
      provider,
      browser: async (url, redirect) => {
        authorized = url
        assert.equal(redirect, oauthRedirectUrl)
        assert.ok(trustedOAuthUrl(url, projectUrl, provider))
        assert.equal(
          new globalThis.URL(url).searchParams.get('scopes'),
          provider === 'facebook' ? 'email' : null,
        )
        assert.ok(await context.storage.getItem(proofKey))
        return { type: 'success', url: callback }
      },
    })
    assert.equal(success, true)
    assert.equal(checks(), 1)
    assert.equal(calls.length, 1)
    assert.match(calls[0].url, /grant_type=pkce/)
    assert.equal(calls[0].body.auth_code, code)
    assert.ok(calls[0].body.code_verifier)
    assert.equal(await context.secrets.getItem(pendingFlowKey), null)
    assert.equal(await context.storage.getItem(proofKey), null)
    assert.ok(
      [...values.values()].every((v) => !v.includes('test-refresh-token')),
    )
    for (const modified of [
      authorized.replace(projectUrl, 'https://foreign.invalid'),
      authorized.replace('s256', 'plain'),
      `${authorized}&provider=facebook`,
      authorized.replace(
        encodeURIComponent(oauthRedirectUrl),
        encodeURIComponent('parkey://auth/callback'),
      ),
    ])
      assert.equal(trustedOAuthUrl(modified, projectUrl, provider), false)
  })
}

for (const type of ['cancel', 'dismiss']) {
  test(`browser ${type} leaves no session or pending proof`, async () => {
    const { context, calls, checks, values } = setup()
    assert.equal(
      await openOAuth({ ...context, browser: async () => ({ type }) }),
      false,
    )
    assert.equal(calls.length, 0)
    assert.equal(checks(), 0)
    assert.ok([...values.keys()].every((key) => !key.includes('code-verifier')))
    assert.equal(await context.secrets.getItem(pendingFlowKey), null)
    assert.equal(await context.storage.getItem(proofKey), null)
    assert.equal((await context.client.auth.getSession()).data.session, null)
  })
}

test('cold callback needs a local OAuth request and a non-recovery verifier', async () => {
  const { context, calls } = setup()
  await assert.rejects(completeOAuth(context, code), {
    code: 'oauth_not_verified',
  })
  await context.secrets.setItem(
    pendingFlowKey,
    JSON.stringify({
      kind: 'oauth',
      provider: 'google',
      createdAt: Date.now(),
      flowId,
    }),
  )
  await context.storage.setItem(
    `${sessionStorageKey}-flow-${flowId}-code-verifier`,
    'test-proof/recovery',
  )
  await assert.rejects(completeOAuth(context, code), {
    code: 'oauth_not_verified',
  })
  assert.equal(calls.length, 0)
})

test('rejected exchanges, offline browser and failed server verification never report success', async () => {
  for (const configuration of [{ reject: true }, { verified: false }]) {
    const { context } = setup(configuration)
    await assert.rejects(
      openOAuth({
        ...context,
        browser: async () => ({ type: 'success', url: callback }),
      }),
    )
    assert.equal(await context.secrets.getItem(pendingFlowKey), null)
  }
  const { context } = setup()
  await assert.rejects(
    openOAuth({
      ...context,
      browser: async () => {
        throw new TypeError('Network request failed')
      },
    }),
  )
  assert.equal(await context.storage.getItem(proofKey), null)
})

test('callback completion restores a secure pending OAuth request after process restart', async () => {
  const { context } = setup()
  await context.storage.setRemember(true)
  const started = await context.client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: oauthRedirectUrl, skipBrowserRedirect: true },
  })
  await context.secrets.setItem(
    pendingFlowKey,
    JSON.stringify({
      kind: 'oauth',
      provider: 'google',
      createdAt: Date.now(),
      flowId: started.data.flowId,
    }),
  )
  const storage = createSessionStorage(context.secrets)
  await completeOAuth({ ...context, storage }, code)
  assert.ok(await storage.getItem(sessionStorageKey))
  assert.equal(await context.secrets.getItem(pendingFlowKey), null)
})

test('active OAuth always selects its own indexed proof, ignoring an old recovery compatibility key', async () => {
  const { context, calls } = setup()
  await context.client.auth.resetPasswordForEmail('driver@example.invalid')
  const oldRecovery = await context.storage.getItem(proofKey)
  await openOAuth({
    ...context,
    browser: async () => {
      const pending = readOAuthFlow(
        await context.secrets.getItem(pendingFlowKey),
      )
      const selected = await context.storage.getItem(
        `${sessionStorageKey}-flow-${pending.flowId}-code-verifier`,
      )
      await context.storage.setItem(proofKey, oldRecovery)
      assert.notEqual(selected, oldRecovery)
      return { type: 'success', url: callback }
    },
  })
  const exchange = calls.find((call) => call.url.includes('grant_type=pkce'))
  assert.notEqual(
    exchange.body.code_verifier,
    JSON.parse(oldRecovery).split('/')[0],
  )
  assert.equal(await context.storage.getItem(proofKey), oldRecovery)
})

test('a callback after cancellation is rejected before exchange; a new provider gets a new proof', async () => {
  const { context, calls } = setup()
  let cancelledId
  await openOAuth({
    ...context,
    browser: async () => {
      cancelledId = readOAuthFlow(
        await context.secrets.getItem(pendingFlowKey),
      ).flowId
      return { type: 'cancel' }
    },
  })
  await assert.rejects(completeOAuth(context, code), {
    code: 'oauth_not_verified',
  })
  assert.equal(calls.length, 0)
  await openOAuth({
    ...context,
    provider: 'facebook',
    browser: async () => {
      const pending = readOAuthFlow(
        await context.secrets.getItem(pendingFlowKey),
      )
      assert.equal(pending.provider, 'facebook')
      assert.notEqual(pending.flowId, cancelledId)
      assert.equal(
        await context.storage.getItem(
          `${sessionStorageKey}-flow-${cancelledId}-code-verifier`,
        ),
        null,
      )
      return { type: 'cancel' }
    },
  })
})
