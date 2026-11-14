import assert from 'node:assert/strict'
import test from 'node:test'

import { createPopupGate } from '../components/popup-policy.ts'
import { authErrorMessage } from './validation.ts'

test('popups deduplicate pending failures and automatic session warnings', () => {
  const gate = createPopupGate()
  const failure = {
    title: 'Could not sign in',
    message: 'Try again.',
    tone: 'error',
    group: 'auth-system',
  }
  const automatic = {
    title: 'Session unavailable',
    message: 'Reconnect.',
    tone: 'warning',
    group: 'auth-system',
    onceKey: 'login:error',
  }
  assert.equal(gate.accept(failure), true)
  assert.equal(gate.accept(failure), false)
  assert.equal(gate.accept(automatic), false)
  gate.finish(failure)
  assert.equal(
    gate.accept(automatic),
    false,
    'do not repeat the same failure after dismissal',
  )
  assert.equal(
    gate.accept(failure),
    true,
    'an explicit retry can report a new failed attempt',
  )
  gate.finish(failure)
  gate.allowAgain('login:error')
  assert.equal(gate.accept(automatic), true)
  gate.finish(automatic)
})

test('independent popups can queue without repeated copies', () => {
  const gate = createPopupGate()
  const info = {
    title: 'Remember me',
    message: 'Secure session storage.',
    tone: 'info',
  }
  const warning = {
    title: 'Could not save progress',
    message: 'Retry.',
    tone: 'warning',
  }
  assert.equal(gate.accept(info), true)
  assert.equal(gate.accept(warning), true)
  assert.equal(gate.accept(info), false)
  gate.finish(info)
  assert.equal(gate.accept(info), true)
})

test('delivery, resend and callback failures remain safe and actionable', () => {
  assert.match(
    authErrorMessage({ code: 'email_address_not_authorized' }),
    /delivery.*not configured/,
  )
  assert.match(
    authErrorMessage({ code: 'verification_request_missing' }),
    /Start registration on this device/,
  )
  assert.match(authErrorMessage({ code: 'over_email_send_rate_limit' }), /Wait/)
  assert.match(
    authErrorMessage({ code: 'bad_code_verifier' }),
    /another device/,
  )
  for (const code of [
    'unexpected_failure',
    'smtp_vendor_error',
    'invalid_credentials',
  ])
    assert.doesNotMatch(
      authErrorMessage({ code, message: 'secret SMTP recipient/token' }),
      /secret SMTP/,
    )
})
