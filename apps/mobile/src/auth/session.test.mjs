import assert from 'node:assert/strict'
import test from 'node:test'

import { createSessionVerifier } from './session.ts'
import { boundedAuthFetch } from './network.ts'

const user = { id: 'test-user', email_confirmed_at: '2026-11-13T00:00:00Z' }
function setup({
  session = { expires_at: Date.now() / 1000 + 3600 },
  verified = user,
  failure = false,
  recovery = false,
} = {}) {
  const states = []
  let verifiedRequests = 0
  const checker = createSessionVerifier(
    {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => {
        verifiedRequests++
        return {
          data: { user: verified },
          error: failure ? new Error('offline') : null,
        }
      },
    },
    (state) => states.push(state),
    () => recovery,
  )
  return { checker, states, calls: () => verifiedRequests }
}

test('restoration trusts a fresh server user, never the stored session user', async () => {
  const { checker, calls } = setup({
    session: { user: { id: 'forged' }, expires_at: Date.now() / 1000 + 3600 },
  })
  assert.equal((await checker.verify()).user.id, user.id)
  assert.equal(calls(), 1)
})
test('guests do not require a network auth request', async () => {
  const { checker, calls } = setup({ session: null })
  assert.equal((await checker.verify()).status, 'signed-out')
  assert.equal(calls(), 0)
})
test('offline, invalid and unconfirmed sessions never appear signed in', async () => {
  assert.equal(
    (await setup({ failure: true }).checker.verify()).status,
    'error',
  )
  assert.equal(
    (await setup({ verified: { id: 'unconfirmed' } }).checker.verify()).status,
    'signed-out',
  )
  assert.equal(
    (await setup({ verified: null }).checker.verify()).status,
    'signed-out',
  )
})
test('only verified recovery sessions expose the password-reset state', async () => {
  assert.equal(
    (await setup({ recovery: true }).checker.verify()).status,
    'recovery',
  )
  assert.equal(
    (await setup({ recovery: true, failure: true }).checker.verify()).status,
    'error',
  )
})
test('late session responses cannot reverse sign-out or provider disposal', async () => {
  let finish
  const pending = new Promise((resolve) => {
    finish = resolve
  })
  const states = []
  const checker = createSessionVerifier(
    {
      getSession: async () => ({ data: { session: {} }, error: null }),
      getUser: () => pending,
    },
    (state) => states.push(state),
    () => false,
  )
  const verification = checker.verify()
  await Promise.resolve()
  checker.clear()
  checker.cancel()
  finish({ data: { user }, error: null })
  await verification
  assert.equal(states.at(-1).status, 'signed-out')
})
test('auth events and submit handlers share a pending verification instead of invalidating each other', async () => {
  const { checker, calls } = setup()
  const results = await Promise.all([
    checker.verify(),
    checker.verify(),
    checker.verify(),
  ])
  assert.ok(results.every((state) => state.status === 'signed-in'))
  assert.equal(calls(), 1)
})
test('auth fetch times out and propagates caller cancellation', async () => {
  const stalled = async (_input, init) =>
    new Promise((_resolve, reject) => {
      if (init.signal.aborted) reject(new Error('aborted'))
      else
        init.signal.addEventListener(
          'abort',
          () => reject(new Error('aborted')),
          { once: true },
        )
    })
  await assert.rejects(
    boundedAuthFetch('https://example.invalid', undefined, stalled, 10),
    /aborted/,
  )
  const controller = new globalThis.AbortController()
  controller.abort()
  await assert.rejects(
    boundedAuthFetch(
      'https://example.invalid',
      { signal: controller.signal },
      stalled,
    ),
    /aborted/,
  )
})

test('verified user data cannot keep an expired session signed in', async () => {
  const { checker } = setup({ session: { expires_at: Date.now() / 1000 - 1 } })
  assert.equal((await checker.verify()).status, 'signed-out')
})
