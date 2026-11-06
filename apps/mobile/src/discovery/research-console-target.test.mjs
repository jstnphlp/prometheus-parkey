import assert from 'node:assert/strict'
import test from 'node:test'

import { researchConsoleTarget } from './research-console-target.ts'

test('external console handoff requires an explicit safe target', () => {
  for (const value of [
    '',
    'not a URL',
    'javascript:alert(1)',
    'https://user:pass@research.parkey.ph',
    'https://research.parkey.ph?session=private',
    'https://research.parkey.ph#token',
  ]) {
    assert.equal(researchConsoleTarget(value, false), null)
    assert.equal(researchConsoleTarget(value, true), null)
  }
  assert.equal(
    researchConsoleTarget('https://research.parkey.ph/console', false),
    'https://research.parkey.ph/console',
  )
})

test('local HTTP console is development-only and cannot become a release target', () => {
  assert.equal(
    researchConsoleTarget('http://localhost:8090', true),
    'http://localhost:8090/',
  )
  assert.equal(researchConsoleTarget('http://localhost:8090', false), null)
  for (const value of [
    'http://localhost',
    'http://localhost:8090/private',
    'http://10.0.2.2:8090',
    'https://127.0.0.1',
    'https://research.parkey.test',
  ])
    assert.equal(researchConsoleTarget(value, false), null)
})
