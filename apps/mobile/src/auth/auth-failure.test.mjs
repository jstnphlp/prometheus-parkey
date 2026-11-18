import assert from 'node:assert/strict'
import test from 'node:test'

import { authFailure } from './auth-failure.ts'
import { authErrorMessage } from './validation.ts'

test('SMTP rejection is a delivery failure rather than an offline failure', () => {
  const error = {
    name: 'AuthApiError',
    status: 500,
    code: 'unexpected_failure',
    message: 'Error sending confirmation email',
  }
  assert.deepEqual(authFailure(error), {
    category: 'email_delivery',
    status: 500,
    code: 'unexpected_failure',
  })
  assert.match(authErrorMessage(error), /confirmation email/)
  assert.doesNotMatch(authErrorMessage(error), /connection/)
})

test('transport, service, rate-limit and local failures stay distinct', () => {
  assert.equal(
    authFailure(new TypeError('Network request failed')).category,
    'network',
  )
  assert.equal(authFailure({ name: 'AbortError' }).category, 'network')
  assert.equal(
    authFailure({ name: 'AuthRetryableFetchError', status: 0 }).category,
    'network',
  )
  assert.equal(
    authFailure({ name: 'AuthRetryableFetchError', status: 503 }).category,
    'service',
  )
  assert.equal(
    authFailure(new TypeError('TextEncoder unavailable')).category,
    'local',
  )
  assert.equal(
    authFailure({ status: 500, message: 'Database error saving new user' })
      .category,
    'account_service',
  )
  assert.equal(authFailure({ status: 429 }).category, 'rate_limit')
  assert.doesNotMatch(
    authErrorMessage({ status: 500, message: 'private provider failure' }),
    /connection|private provider/,
  )
})

test('local signup diagnostics contain no input, token, raw message or untrusted code', () => {
  const result = authFailure({
    status: 500,
    code: 'secret_from_provider',
    message: 'secret',
    email: 'secret@example.invalid',
    password: 'secret',
    access_token: 'secret',
    headers: { Authorization: 'secret' },
  })
  assert.deepEqual(result, {
    category: 'service',
    status: 500,
    code: 'unclassified',
  })
  assert.doesNotMatch(
    JSON.stringify(result),
    /secret|email|password|token|Authorization/,
  )
})
