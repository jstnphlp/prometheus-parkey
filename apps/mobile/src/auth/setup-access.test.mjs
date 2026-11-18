import assert from 'node:assert/strict'
import test from 'node:test'

import { setupAccess } from './setup-access.ts'
import { createSessionVerifier } from './session.ts'

const now = 1000
const user = {
  id: 'fixture-only-user',
  email_confirmed_at: '2026-11-17T00:00:00Z',
  user_metadata: {},
}

test('account setup only follows a confirmed, verified, unexpired sign-in', () => {
  assert.equal(
    setupAccess({ status: 'signed-in', user, expiresAt: 2000 }, now),
    'allowed',
  )
  for (const status of ['signed-out', 'unavailable', 'error'])
    assert.equal(setupAccess({ status, user: null }, now), 'login')
  assert.equal(setupAccess({ status: 'checking', user: null }, now), 'checking')
})

test('an unconfirmed, expired or malformed session cannot enter setup', () => {
  for (const expiresAt of [999, now, NaN, Infinity])
    assert.equal(
      setupAccess({ status: 'signed-in', user, expiresAt }, now),
      'login',
    )
  assert.equal(
    setupAccess(
      {
        status: 'signed-in',
        user: { ...user, email_confirmed_at: null },
        expiresAt: 2000,
      },
      now,
    ),
    'login',
  )
})

test('password recovery stays separate from account onboarding', () => {
  assert.equal(
    setupAccess({ status: 'recovery', user, expiresAt: 2000 }, now),
    'recovery',
  )
})

test('only a successfully verified server session advances the post-login flow', async () => {
  let verifiedRequests = 0
  const verifier = createSessionVerifier(
    {
      getSession: async () => ({
        data: { session: { expires_at: Math.floor(Date.now() / 1000) + 3600 } },
        error: null,
      }),
      getUser: async () => {
        verifiedRequests++
        return { data: { user }, error: null }
      },
    },
    () => {},
    () => false,
  )
  const state = await verifier.verify()
  assert.equal(verifiedRequests, 1)
  assert.equal(setupAccess(state), 'allowed')
  verifier.clear()
  const refused = createSessionVerifier(
    {
      getSession: async () => ({
        data: { session: { expires_at: Math.floor(Date.now() / 1000) + 3600 } },
        error: null,
      }),
      getUser: async () => ({
        data: { user: null },
        error: new Error('session refused'),
      }),
    },
    () => {},
    () => false,
  )
  assert.equal(setupAccess(await refused.verify()), 'login')
})
