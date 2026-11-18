import assert from 'node:assert/strict'
import test from 'node:test'

import {
  authErrorMessage,
  emailProblem,
  passwordProblem,
  passwordRequirements,
  registrationProblems,
} from './validation.ts'
import {
  authRedirectUrl,
  callbackCode,
  canResendSignup,
  normalizeAuthLink,
  readEmailFlow,
} from './links.ts'

test('registration uses the owner-confirmed password policy without changing passwords', () => {
  assert.equal(passwordProblem('Strong!a'), null)
  for (const value of [
    'Short!A',
    'lowercase!',
    'UPPERCASE!',
    'NoSymbol8',
    'Mixed   Case',
  ])
    assert.ok(passwordProblem(value))
  assert.equal(passwordProblem(' LongPass! '), null)
  assert.equal(
    registrationProblems({
      name: ' Test Driver ',
      email: ' driver@example.com ',
      password: 'Strong!a',
      confirmation: 'Strong!a',
    }).name,
    null,
  )
  assert.ok(
    registrationProblems({
      name: '',
      email: 'bad',
      password: 'Strong!a',
      confirmation: 'strong!a',
    }).confirmation,
  )
  assert.ok(emailProblem('x@localhost'))
  assert.ok(emailProblem('bad\n@example.com'))
})

test('server errors are safe, useful, and never echo raw server text or credentials', () => {
  assert.match(
    authErrorMessage({ code: 'email_not_confirmed' }),
    /Confirm your email/,
  )
  assert.match(authErrorMessage({ code: 'invalid_credentials' }), /incorrect/)
  assert.match(authErrorMessage({ code: 'weak_password' }), /8\+ characters/)
  assert.match(authErrorMessage({ code: 'otp_expired' }), /expired/)
  assert.match(authErrorMessage({ code: 'over_email_send_rate_limit' }), /Wait/)
  assert.match(
    authErrorMessage(new TypeError('Network request failed')),
    /connection/,
  )
  assert.doesNotMatch(
    authErrorMessage({ message: 'secret access token' }),
    /secret access token/,
  )
})

test('visible requirements and registration validation use one password policy', () => {
  assert.deepEqual(passwordRequirements(''), [
    { label: 'At least 8 characters', met: false },
    { label: 'One uppercase letter', met: false },
    { label: 'One lowercase letter', met: false },
    { label: 'One special character', met: false },
  ])
  for (const value of [
    'short',
    'longlowercase!',
    'LONGUPPERCASE!',
    'MixedCase8',
    'Strong!a',
    ' Strong!a ',
  ])
    assert.equal(
      passwordRequirements(value).every((item) => item.met),
      passwordProblem(value) === null,
    )
})

test('callbacks accept one authorization code and reject token injection and expired-link errors', () => {
  const code = 'valid-code-1234'
  assert.equal(callbackCode({ code }), code)
  for (const extra of [
    { access_token: 'secret' },
    { refresh_token: 'secret' },
    { token_hash: 'secret' },
    { error: 'expired' },
    { type: 'recovery' },
  ])
    assert.equal(callbackCode({ code, ...extra }), null)
  assert.equal(callbackCode({ code: [code, code] }), null)
  assert.equal(callbackCode({ code: '../path' }), null)
  assert.equal(
    normalizeAuthLink(`${authRedirectUrl}?code=${code}`),
    `/auth/callback?code=${code}`,
  )
  assert.match(
    normalizeAuthLink(`${authRedirectUrl}#access_token=secret`),
    /error=invalid_link/,
  )
  assert.match(
    normalizeAuthLink(`${authRedirectUrl}?code=${code}&code=another-code`),
    /error=invalid_link/,
  )
  assert.equal(normalizeAuthLink('/login'), '/login')
  assert.match(
    normalizeAuthLink(`https://evil.example/auth/callback?code=${code}`),
    /error=invalid_link/,
  )
  assert.match(
    normalizeAuthLink(`parkey://evil/auth/callback?code=${code}`),
    /error=invalid_link/,
  )
})

test('a recovery requires a bounded same-device flow, never URL-supplied claims', () => {
  const value = JSON.stringify({ kind: 'recovery', createdAt: 1000 })
  assert.equal(readEmailFlow(value, 2000)?.kind, 'recovery')
  assert.equal(readEmailFlow(value, 3601001), null)
  assert.equal(readEmailFlow(value, 999), null)
  assert.equal(
    readEmailFlow('{"kind":"administrator","createdAt":1000}', 2000),
    null,
  )
  assert.equal(readEmailFlow('invalid', 2000), null)
})

test('resend is bound to the original email, signup flow and local PKCE proof', () => {
  const request = readEmailFlow(
    JSON.stringify({
      kind: 'signup',
      createdAt: 1000,
      email: 'driver@example.com',
    }),
    2000,
  )
  assert.equal(canResendSignup(request, ' Driver@example.com ', 'proof'), true)
  assert.equal(canResendSignup(request, 'other@example.com', 'proof'), false)
  assert.equal(canResendSignup(request, 'driver@example.com', null), false)
  assert.equal(
    canResendSignup(
      { kind: 'recovery', createdAt: 1000, email: 'driver@example.com' },
      'driver@example.com',
      'proof',
    ),
    false,
  )
  assert.equal(
    canResendSignup(
      readEmailFlow(
        JSON.stringify({
          kind: 'signup',
          createdAt: 1000,
          email: 'driver@example.com',
        }),
        3601001,
      ),
      'driver@example.com',
      'proof',
    ),
    false,
  )
  const legacy = readEmailFlow(
    JSON.stringify({ kind: 'signup', createdAt: 1000 }),
    2000,
  )
  assert.ok(legacy, 'existing Phase 2 confirmation links can still finish')
  assert.equal(canResendSignup(legacy, 'driver@example.com', 'proof'), false)
})
