import assert from 'node:assert/strict'
import test from 'node:test'

import { createLocalDraftId } from './local-draft-id.ts'

test('separate drafts cannot collide within the same minute, millisecond or random value', (t) => {
  t.mock.method(Date, 'now', () => 123456789)
  t.mock.method(Math, 'random', () => 0.5)
  const keys = Array.from({ length: 20 }, () => createLocalDraftId())
  assert.equal(new Set(keys).size, 20)
  assert.ok(keys.every((key) => /^[A-Za-z0-9:_-]{1,100}$/.test(key)))
})
