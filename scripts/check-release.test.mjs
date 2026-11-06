import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import test from 'node:test'
import { fileURLToPath, URL } from 'node:url'

import { config } from '../apps/mobile/src/discovery/config.ts'
import { releaseConfigurationProblems } from '../apps/mobile/release-policy.ts'

const publicKey = 'sb_publishable_synthetic_fixture_public_only'
const safe = {
  ...config,
  supabaseUrl: '',
  supabaseKey: '',
  routingUrl: '',
  geocoder: '',
  analyticsEndpoint: '',
  sentryDsn: '',
  ncrResearchUrl: '',
}

test('disabled rollout and unconfigured optional providers are safe release defaults', () => {
  assert.deepEqual(
    releaseConfigurationProblems(safe, { pilotFlag: 'false' }),
    [],
  )
  assert.deepEqual(
    releaseConfigurationProblems(
      {
        ...safe,
        supabaseUrl: 'https://synthetic-project.supabase.co',
        supabaseKey: publicKey,
      },
      { pilotFlag: 'true' },
    ),
    [],
  )
})

test('enabled rollout, partial keys, invalid flags and development research endpoints fail closed', () => {
  assert.ok(releaseConfigurationProblems(safe, { pilotFlag: 'true' }).length)
  assert.ok(releaseConfigurationProblems(safe, { pilotFlag: 'yes' }).length)
  assert.ok(
    releaseConfigurationProblems(safe, {
      privateResearchUrl: 'http://127.0.0.1:8090',
    }).length,
  )
  assert.ok(
    releaseConfigurationProblems({ ...safe, supabaseKey: publicKey }, {})
      .length,
  )
  assert.ok(
    releaseConfigurationProblems(
      {
        ...safe,
        supabaseUrl: 'https://synthetic-project.supabase.co',
        supabaseKey: 'sb_secret_synthetic_not_real',
      },
      { pilotFlag: 'false' },
    ).length,
  )
})

test('development demos are rejected even with a provider-review assertion', () => {
  assert.ok(
    releaseConfigurationProblems(
      { ...safe, geocoder: 'https://photon.komoot.io/api/' },
      { searchProviderReviewed: 'true' },
    ).some((problem) => problem.includes('Photon')),
  )
  assert.ok(
    releaseConfigurationProblems(
      { ...safe, routingUrl: 'https://router.project-osrm.org' },
      { routingProviderReviewed: 'true' },
    ).some((problem) => problem.includes('OSRM')),
  )
})

test('custom public providers need an explicit build review and private providers remain prohibited', () => {
  const values = {
    ...safe,
    mapStyle: 'https://maps.provider.ph/styles/pilot',
    geocoder: 'https://search.provider.ph/api/',
    routingUrl: 'https://routing.provider.ph',
  }
  assert.equal(releaseConfigurationProblems(values, {}).length, 3)
  assert.deepEqual(
    releaseConfigurationProblems(values, {
      mapProviderReviewed: 'true',
      searchProviderReviewed: 'true',
      routingProviderReviewed: 'true',
    }),
    [],
  )
  assert.ok(
    releaseConfigurationProblems(
      { ...safe, mapStyle: 'https://192.168.1.20/style.json' },
      {
        mapProviderReviewed: 'true',
      },
    ).length,
  )
})

test('optional telemetry URLs cannot retain a private release endpoint', () => {
  const publicDsnKey = '0123456789abcdef0123456789abcdef'
  assert.deepEqual(
    releaseConfigurationProblems(
      { ...safe, sentryDsn: `https://${publicDsnKey}@o0.ingest.sentry.io/1` },
      {},
    ),
    [],
  )
  assert.ok(
    releaseConfigurationProblems(
      { ...safe, sentryDsn: `https://${publicDsnKey}@127.0.0.1/1` },
      {},
    ).length,
  )
  assert.ok(
    releaseConfigurationProblems(
      { ...safe, analyticsEndpoint: 'https://localhost./api/event' },
      {},
    ).length,
  )
})

test('production runtime removes the private research URL and all demo fallbacks', () => {
  const env = { ...process.env, NODE_ENV: 'production' }
  for (const name of Object.keys(env))
    if (name.startsWith('EXPO_PUBLIC_')) delete env[name]
  env.EXPO_PUBLIC_NCR_RESEARCH_URL = 'http://127.0.0.1:8090'
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import {config} from './apps/mobile/src/discovery/config.ts'; console.log(JSON.stringify({research:config.ncrResearchUrl,search:config.geocoder,routing:config.routingUrl}))",
    ],
    { env, encoding: 'utf8' },
  )
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout), {
    research: '',
    search: '',
    routing: '',
  })
})

test('actual Expo config hook rejects an unsafe explicit release build', () => {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PARKEY_RELEASE_BUILD: 'true',
  }
  for (const name of Object.keys(env))
    if (name.startsWith('EXPO_PUBLIC_')) delete env[name]
  env.EXPO_PUBLIC_PILOT_DISCOVERY_ENABLED = 'true'
  env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:55431'
  env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publicKey
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL('../node_modules/expo/bin/cli', import.meta.url)),
      'config',
      '--type',
      'public',
      '--json',
    ],
    {
      cwd: fileURLToPath(new URL('../apps/mobile/', import.meta.url)),
      env,
      encoding: 'utf8',
    },
  )
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Release endpoints require a public HTTPS/)
  assert.equal(result.stderr.includes(publicKey), false)
})
