import assert from 'node:assert/strict'
import test from 'node:test'

import { confirmSignupSession, verifySignupCode } from './email-code.ts'

const user = {
  email: 'driver@example.invalid',
  email_confirmed_at: '2026-11-18T00:00:00Z',
}

test('a failed session check retries the matching session without replaying a consumed code', async () => {
  let session = null
  let otpCalls = 0
  let networkAvailable = false
  const auth = {
    getSession: async () => ({ data: { session }, error: null }),
    verifyOtp: async () => {
      otpCalls++
      session = { user }
      return { data: { user, session }, error: null }
    },
  }
  const verify = async () =>
    networkAvailable
      ? { status: 'signed-in', user, expiresAt: Date.now() + 60000 }
      : { status: 'error', user: null }
  await assert.rejects(
    confirmSignupSession(auth, user.email, '123456', verify, async () => {}),
    { code: 'verification_session_pending' },
  )
  networkAvailable = true
  await confirmSignupSession(auth, user.email, '123456', verify, async () => {})
  assert.equal(otpCalls, 1)
})

test('cleanup failure does not undo real server verification', async () => {
  await confirmSignupSession(
    {
      getSession: async () => ({ data: { session: { user } }, error: null }),
      verifyOtp: async () => assert.fail('must not replay OTP'),
    },
    user.email,
    '123456',
    async () => ({ status: 'signed-in', user, expiresAt: Date.now() + 60000 }),
    async () => {
      throw new Error('secure storage unavailable')
    },
  )
})

test('a cached user never substitutes for a matching server-verified identity', async () => {
  await assert.rejects(
    confirmSignupSession(
      {
        getSession: async () => ({ data: { session: { user } }, error: null }),
        verifyOtp: async () =>
          assert.fail('not needed for an existing session'),
      },
      user.email,
      '123456',
      async () => ({
        status: 'signed-in',
        user: { ...user, email: 'other@example.invalid' },
        expiresAt: Date.now() + 60000,
      }),
      async () => {},
    ),
  )
})
test('signup verification sends the real numeric code and never exchanges a link', async () => {
  let input
  await verifySignupCode(
    {
      verifyOtp: async (value) => {
        input = value
        return { data: { user, session: {} }, error: null }
      },
    },
    ' DRIVER@example.invalid ',
    '123456',
  )
  assert.deepEqual(input, {
    email: 'driver@example.invalid',
    token: '123456',
    type: 'signup',
  })
})
test('malformed codes never reach the provider', async () => {
  for (const token of ['', '1234', '12345x', '1234567'])
    await assert.rejects(
      verifySignupCode(
        { verifyOtp: async () => assert.fail('must not submit') },
        user.email,
        token,
      ),
      { code: 'invalid_otp' },
    )
})
test('invalid, expired, failed, and unconfirmed responses cannot advance', async () => {
  for (const result of [
    { data: { user, session: null }, error: null },
    {
      data: { user: { ...user, email_confirmed_at: null }, session: {} },
      error: null,
    },
    {
      data: { user: { ...user, email: 'other@example.invalid' }, session: {} },
      error: null,
    },
    {
      data: { user: null, session: null },
      error: Object.assign(new Error('Expired'), { code: 'otp_expired' }),
    },
  ])
    await assert.rejects(
      verifySignupCode({ verifyOtp: async () => result }, user.email, '123456'),
    )
})
