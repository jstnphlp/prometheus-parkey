import assert from 'node:assert/strict'
import test from 'node:test'

import { resendConfirmation } from './resend-confirmation.ts'
import { readEmailFlow } from './links.ts'
import { pendingFlowKey, sessionStorageKey } from './secure-storage.ts'

function fixture() {
  const original = JSON.stringify({
    kind: 'signup',
    email: 'driver@example.com',
    createdAt: 1000,
  })
  const values = new Map([
    [pendingFlowKey, original],
    [`${sessionStorageKey}-code-verifier`, 'local-proof'],
  ])
  const store = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value)
    },
    removeItem: async (key) => {
      values.delete(key)
    },
  }
  return { values, store, original }
}
test('failed resend retains the original callback and PKCE proof', async () => {
  const { values, store, original } = fixture()
  await assert.rejects(
    resendConfirmation(
      store,
      store,
      'driver@example.com',
      async () => ({ error: new Error('rate limit') }),
      () => 3600000,
    ),
    /rate limit/,
  )
  assert.equal(values.get(pendingFlowKey), original)
  assert.equal(values.get(`${sessionStorageKey}-code-verifier`), 'local-proof')
})
test('accepted resend near expiry renews the same-device callback window', async () => {
  const { values, store } = fixture()
  await resendConfirmation(
    store,
    store,
    'Driver@example.com',
    async () => ({ error: null }),
    () => 3600000,
  )
  assert.equal(
    readEmailFlow(values.get(pendingFlowKey), 3602000)?.createdAt,
    3600000,
  )
})
test('wrong-address or expired requests fail before contacting the server', async () => {
  const { store } = fixture()
  let calls = 0
  const send = async () => {
    calls++
    return { error: null }
  }
  await assert.rejects(
    resendConfirmation(store, store, 'other@example.com', send, () => 2000),
    { code: 'verification_request_missing' },
  )
  await assert.rejects(
    resendConfirmation(store, store, 'driver@example.com', send, () => 3601001),
    { code: 'verification_request_missing' },
  )
  assert.equal(calls, 0)
})
