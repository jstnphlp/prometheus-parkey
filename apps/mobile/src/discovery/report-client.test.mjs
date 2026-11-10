import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isReportReceipt,
  reportForSending,
  reportObservationDate,
  requestReportCode,
  sendReportRequest,
  verifyReportCode,
} from './report-client.ts'

const { AbortController, Response } = globalThis

const connection = {
  url: 'https://db.parkey.dev',
  key: 'sb_publishable_testonly0123456789',
}
const signal = () => new AbortController().signal
const session = () => ({
  token: 'test-only-session-token',
  userId: '11111111-1111-4111-8111-111111111111',
  expiresAt: Date.now() + 60000,
})
const draft = {
  id: 'local-test-1',
  intent: 'add',
  targetId: null,
  name: 'Synthetic report',
  kind: 'lot',
  geometry: { type: 'Point', coordinates: [121, 14] },
  side: 'unknown',
  restrictions: '',
  hours: '',
  fees: '',
  photoUri: 'file:///private-image.jpg',
  createdAt: new Date().toISOString(),
  status: 'local_pending_review',
}
const today = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
test('verification uses only public configuration and normalizes email without persisting credentials', async () => {
  let calls = 0
  await requestReportCode(
    connection,
    ' User@Example.org ',
    signal(),
    async (url, init) => {
      calls++
      assert.equal(url, 'https://db.parkey.dev/auth/v1/otp')
      assert.deepEqual(JSON.parse(init.body), {
        email: 'user@example.org',
        create_user: true,
      })
      assert.equal(init.credentials, 'omit')
      assert.equal(init.redirect, 'error')
      assert.equal(init.headers.Authorization, undefined)
      return Response.json({})
    },
  )
  assert.equal(calls, 1)
  await assert.rejects(
    requestReportCode(
      { ...connection, key: 'sb_secret_not_public' },
      'user@example.org',
      signal(),
      () => {
        throw new Error('Must not fetch')
      },
    ),
  )
})
test('unverified and anonymous Auth responses cannot create a sending session', async () => {
  const auth = {
    access_token: 'test-only-user-token-format',
    expires_in: 3600,
    user: {
      id: session().userId,
      email_confirmed_at: new Date().toISOString(),
      is_anonymous: false,
    },
  }
  for (const user of [
    { ...auth.user, email_confirmed_at: null },
    { ...auth.user, is_anonymous: true },
    { ...auth.user, id: 'invalid' },
  ])
    await assert.rejects(
      verifyReportCode(
        connection,
        'test@example.org',
        '123456',
        signal(),
        async () => Response.json({ ...auth, user }),
      ),
    )
  const verified = await verifyReportCode(
    connection,
    'test@example.org',
    '123456',
    signal(),
    async () =>
      Response.json({ ...auth, refresh_token: 'must-not-be-returned' }),
  )
  assert.equal(verified.token, auth.access_token)
  assert.equal(verified.refresh_token, undefined)
  assert.ok(verified.expiresAt <= Date.now() + 600000)
})
test('photos, local status and creation timestamps never enter a report payload', () => {
  const value = reportForSending(draft, draft.name, today())
  assert.equal(value.photoUri, undefined)
  assert.equal(value.status, undefined)
  assert.equal(value.createdAt, undefined)
  assert.equal(value.fees, null)
  assert.equal(value.target, null)
  assert.throws(() => reportObservationDate('2026-02-30'))
  assert.throws(() => reportObservationDate('2999-01-01'))
})
test('sending requires explicit consent and a nonexpired verified session before any request', async () => {
  const never = () => {
    throw new Error('Must not fetch')
  }
  await assert.rejects(
    sendReportRequest(
      connection,
      session(),
      draft,
      'submit',
      signal(),
      { name: draft.name, observationDate: today(), consent: false },
      never,
    ),
    /Confirm/,
  )
  await assert.rejects(
    sendReportRequest(
      connection,
      { ...session(), expiresAt: 0 },
      draft,
      'status',
      signal(),
      undefined,
      never,
    ),
    /expired/,
  )
})
test('submission uses a stable draft key and returns a receipt without granting approval', async () => {
  const received = {
    state: 'received',
    receiptId: '22222222-2222-4222-8222-222222222222',
    receivedAt: new Date().toISOString(),
  }
  const result = await sendReportRequest(
    connection,
    session(),
    draft,
    'submit',
    signal(),
    { name: draft.name, observationDate: today(), consent: true },
    async (url, init) => {
      assert.equal(url, 'https://db.parkey.dev/functions/v1/mobile-reports')
      const body = JSON.parse(init.body)
      assert.equal(body.client_key, draft.id)
      assert.equal(body.report.photoUri, undefined)
      assert.match(init.headers.Authorization, /^Bearer /)
      return Response.json(received, { status: 202 })
    },
  )
  assert.deepEqual(result, received)
  assert.equal(isReportReceipt({ ...received, state: 'published' }), false)
})
test('a lost receipt can be recovered without uploading again and withdrawal sends no report contents', async () => {
  for (const action of ['status', 'withdraw']) {
    const value = await sendReportRequest(
      connection,
      session(),
      draft,
      action,
      signal(),
      undefined,
      async (_url, init) => {
        assert.deepEqual(JSON.parse(init.body), {
          schema_version: 1,
          action,
          client_key: draft.id,
        })
        return Response.json(
          action === 'status'
            ? { state: 'not_sent' }
            : {
                state: 'withdrawn',
                receiptId: '22222222-2222-4222-8222-222222222222',
                receivedAt: new Date().toISOString(),
              },
        )
      },
    )
    assert.equal(value.state, action === 'status' ? 'not_sent' : 'withdrawn')
  }
})
test('private server errors and malformed responses are never shown verbatim', async () => {
  await assert.rejects(
    sendReportRequest(
      connection,
      session(),
      draft,
      'status',
      signal(),
      undefined,
      async () => Response.json({ secret: 'PRIVATE SQL' }, { status: 500 }),
    ),
    (error) => !error.message.includes('PRIVATE SQL'),
  )
  await assert.rejects(
    sendReportRequest(
      connection,
      session(),
      draft,
      'status',
      signal(),
      undefined,
      async () => new Response('PRIVATE broken JSON'),
    ),
    /unsupported response/,
  )
})
