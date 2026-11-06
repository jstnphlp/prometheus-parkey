import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import process from 'node:process'
import test from 'node:test'
import { URL } from 'node:url'

import {
  isPublicSupabaseKey,
  pilotCities,
  publicEndpointProblem,
  publicSupabaseProblem,
} from './pilot-config.ts'

const publicKey = 'sb_publishable_synthetic_fixture_public_only'

test('candidate controls require development and are disabled in release builds', () => {
  const moduleUrl = new URL('./pilot-config.ts', import.meta.url).href
  for (const [environment, release, expected] of [
    ['development', '', true],
    ['development', 'true', false],
    ['production', '', false],
    ['production', 'true', false],
    ['test', '', false],
  ]) {
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { candidateResearchEnabled } from ${JSON.stringify(moduleUrl)}; process.stdout.write(String(candidateResearchEnabled))`,
      ],
      {
        env: {
          ...process.env,
          NODE_ENV: environment,
          PARKEY_RELEASE_BUILD: release,
        },
        encoding: 'utf8',
      },
    )
    assert.equal(output, String(expected), `${environment}, release=${release}`)
  }
})
const jwt = (role, alg = 'HS256') =>
  [
    Buffer.from(JSON.stringify({ alg, typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ role, ref: 'synthetic-fixture' })).toString(
      'base64url',
    ),
    'x'.repeat(43),
  ].join('.')

test('pilot city allowlist contains only Manila and Mandaluyong', () => {
  assert.deepEqual(pilotCities, ['Manila', 'Mandaluyong'])
})

test('only publishable keys and legacy anon-role JWTs pass client key screening', () => {
  assert.equal(isPublicSupabaseKey(publicKey), true)
  assert.equal(isPublicSupabaseKey(jwt('anon')), true)
  for (const key of [
    '',
    'sb_secret_synthetic_not_a_real_key',
    'e2e-public-fixture-key',
    jwt('service_role'),
    jwt('authenticated'),
    jwt('anon', 'none'),
    'malformed.jwt.payload',
    `${jwt('anon')}.extra`,
  ])
    assert.equal(isPublicSupabaseKey(key), false)
})

test('local stack addresses are development-only and Supabase must use a base origin', () => {
  for (const host of ['127.0.0.1', 'localhost', '10.0.2.2', '192.168.1.20']) {
    assert.equal(publicEndpointProblem(`http://${host}:55431`, false), null)
    assert.notEqual(publicEndpointProblem(`https://${host}`, true), null)
  }
  assert.equal(
    publicSupabaseProblem(
      'https://synthetic-project.supabase.co',
      publicKey,
      true,
    ),
    null,
  )
  assert.notEqual(
    publicSupabaseProblem(
      'https://synthetic-project.supabase.co/rest/v1',
      publicKey,
      true,
    ),
    null,
  )
})

test('release endpoint checks reject private and alternative IP forms and embedded credentials', () => {
  for (const url of [
    'http://synthetic-project.supabase.co',
    'https://2130706433',
    'https://0x7f000001',
    'https://[::1]',
    'https://[::ffff:127.0.0.1]',
    'https://10.1.2.3',
    'https://172.31.2.3',
    'https://169.254.169.254',
    'https://8.8.8.8',
    'https://service.local',
    'https://localhost.',
    'https://service.local.',
    'https://127.0.0.1.nip.io',
    'https://127.0.0.1.sslip.io',
    'https://e2e.parkey.test',
    'https://user:synthetic@api.parkey.ph',
    'https://api.parkey.ph?key=synthetic',
    'https://api.parkey.ph#synthetic',
    'not a URL',
  ])
    assert.notEqual(publicEndpointProblem(url, true), null, url)
})

test('incomplete and secret-bearing Supabase configuration fails without echoing keys', () => {
  assert.notEqual(publicSupabaseProblem('', '', true), null)
  assert.notEqual(
    publicSupabaseProblem('https://synthetic-project.supabase.co', '', true),
    null,
  )
  const problem = publicSupabaseProblem(
    'https://synthetic-project.supabase.co',
    'sb_secret_synthetic_not_a_real_key',
    true,
  )
  assert.notEqual(problem, null)
  assert.equal(problem.includes('sb_secret_synthetic'), false)
})
