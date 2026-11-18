import assert from 'node:assert/strict'
import test from 'node:test'

import {
  discoveryDestination,
  postAuthDestination,
  setupAccess,
} from './setup-access.ts'
import { saveAccountProfile } from './profile-save.ts'
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

test('confirmed account enters required setup and can reach discovery only after save', async () => {
  let serverUser = {
    ...user,
    user_metadata: { full_name: 'Registered Driver' },
  }
  let failSave = true
  const session = { expires_at: Math.floor(Date.now() / 1000) + 3600 }
  const auth = {
    getSession: async () => ({ data: { session }, error: null }),
    getUser: async () => ({ data: { user: serverUser }, error: null }),
    updateUser: async ({ data }) => {
      if (failSave) return { data: { user: null }, error: new Error('offline') }
      serverUser = {
        ...serverUser,
        user_metadata: { ...serverUser.user_metadata, ...data },
      }
      return { data: { user: serverUser }, error: null }
    },
  }
  const verifier = createSessionVerifier(
    auth,
    () => {},
    () => false,
  )
  const draft = {
    fullName: 'Registered Driver',
    vehicleTypes: ['Motorcycle'],
    work: 'Office employee',
    workOther: '',
    city: 'Taguig City',
    cityOther: '',
    drivingPurpose: 'Work / Commuting',
    drivingPurposeOther: '',
    drivingFrequency: 'Daily',
    parkingDuration: 'Under 1 hour',
    parkingPreferences: ['Covered parking'],
  }
  assert.equal(postAuthDestination(serverUser), '/account-setup')
  assert.equal(
    discoveryDestination(await verifier.verify(), true),
    '/account-setup',
  )
  await assert.rejects(
    saveAccountProfile(auth, serverUser.id, draft),
    /offline/,
  )
  assert.equal(
    discoveryDestination(await verifier.verify(), true),
    '/account-setup',
  )
  failSave = false
  await saveAccountProfile(auth, serverUser.id, draft)
  assert.equal(postAuthDestination(serverUser), '/')
  assert.equal(discoveryDestination(await verifier.verify(), false), '/')
})

test('guest discovery stays available, while checking and recovery do not enter setup', () => {
  assert.equal(
    discoveryDestination({ status: 'signed-out', user: null }, false),
    '/welcome',
  )
  assert.equal(
    discoveryDestination({ status: 'signed-out', user: null }, true),
    '/',
  )
  assert.equal(
    discoveryDestination({ status: 'unavailable', user: null }, true),
    '/',
  )
  assert.equal(
    discoveryDestination({ status: 'checking', user: null }, true),
    null,
  )
  assert.equal(
    discoveryDestination(
      { status: 'recovery', user, expiresAt: 2000 },
      true,
      now,
    ),
    '/reset-password',
  )
})
