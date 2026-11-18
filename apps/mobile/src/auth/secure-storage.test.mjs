import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import test from 'node:test'

import {
  chunkedSecretStorage,
  createSessionStorage,
  sessionStorageKey,
} from './secure-storage.ts'

function fixture() {
  const values = new Map()
  let fail = false
  const secrets = chunkedSecretStorage({
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      assert.ok(Buffer.byteLength(value) <= 2000)
      if (fail && key.endsWith('.1')) throw new Error('keychain write failed')
      values.set(key, value)
    },
    removeItem: async (key) => {
      values.delete(key)
    },
  })
  return {
    values,
    secrets,
    failWrites: () => {
      fail = true
    },
  }
}

test('large Unicode session data round-trips in small secure chunks', async () => {
  const { secrets } = fixture()
  const value = JSON.stringify({
    token: 'x'.repeat(9000),
    name: '🚙'.repeat(700),
  })
  await secrets.setItem('session', value)
  assert.equal(await secrets.getItem('session'), value)
  await secrets.removeItem('session')
  assert.equal(await secrets.getItem('session'), null)
})

test('a failed partial write preserves the previous complete session', async () => {
  const { secrets, failWrites } = fixture()
  await secrets.setItem('session', 'old session')
  failWrites()
  await assert.rejects(secrets.setItem('session', 'new'.repeat(1000)), /failed/)
  assert.equal(await secrets.getItem('session'), 'old session')
})

test('missing chunks fail closed rather than returning partial credentials', async () => {
  const { values, secrets } = fixture()
  await secrets.setItem('session', 'x'.repeat(1000))
  values.delete([...values.keys()].find((key) => key.endsWith('.1')))
  await assert.rejects(secrets.getItem('session'), /incomplete/)
})

test('unchecked Remember me holds tokens only in memory; PKCE proofs survive relaunch', async () => {
  const { secrets } = fixture()
  const storage = createSessionStorage(secrets)
  await storage.setRemember(false)
  await storage.setItem(sessionStorageKey, 'session token')
  await storage.setItem(`${sessionStorageKey}-code-verifier`, 'proof')
  assert.equal(await storage.getItem(sessionStorageKey), 'session token')
  const relaunched = createSessionStorage(secrets)
  assert.equal(await relaunched.getItem(sessionStorageKey), null)
  assert.equal(
    await relaunched.getItem(`${sessionStorageKey}-code-verifier`),
    'proof',
  )
})

test('Remember me restores securely; signing out erases sessions and indexed PKCE flows', async () => {
  const { secrets, values } = fixture()
  const storage = createSessionStorage(secrets)
  const flowId = 'a'.repeat(32)
  await storage.setRemember(true)
  await storage.setItem(sessionStorageKey, 'session token')
  await storage.setItem(
    `${sessionStorageKey}-flows-code-verifier`,
    JSON.stringify([flowId]),
  )
  await storage.setItem(
    `${sessionStorageKey}-flow-${flowId}-code-verifier`,
    'proof',
  )
  assert.equal(
    await createSessionStorage(secrets).getItem(sessionStorageKey),
    'session token',
  )
  await storage.forget()
  await storage.setItem(
    sessionStorageKey,
    'late refresh must not resurrect session',
  )
  assert.equal(
    await createSessionStorage(secrets).getItem(sessionStorageKey),
    null,
  )
  assert.equal(values.size, 0)
})

test('ordered writes cannot leave a remembered session after a concurrent sign-out', async () => {
  const { secrets } = fixture()
  const storage = createSessionStorage(secrets)
  await storage.setRemember(true)
  const saving = storage.setItem(sessionStorageKey, 'token'.repeat(1000))
  const clearing = storage.forget()
  await Promise.all([saving, clearing])
  assert.equal(
    await createSessionStorage(secrets).getItem(sessionStorageKey),
    null,
  )
})

test('sign-out erases a corrupt session manifest using its separate inventory', async () => {
  const { secrets, values } = fixture()
  const storage = createSessionStorage(secrets)
  await storage.setRemember(true)
  await storage.setItem(sessionStorageKey, 'credential'.repeat(1000))
  values.set(`parkey.auth.v1.${sessionStorageKey}`, '{broken')
  await secrets.getItem(sessionStorageKey).then(
    () => assert.fail('corrupt manifest was accepted'),
    () => undefined,
  )
  await storage.forget()
  assert.equal(values.size, 0)
})

test('a corrupt PKCE index cannot block deletion of remembered credentials', async () => {
  const { secrets, values } = fixture()
  const storage = createSessionStorage(secrets)
  await storage.setRemember(true)
  await storage.setItem(sessionStorageKey, '{invalid-session-json')
  await storage.setItem(
    `${sessionStorageKey}-flows-code-verifier`,
    '{invalid-index-json',
  )
  await storage.forget()
  assert.equal(values.size, 0)
})
