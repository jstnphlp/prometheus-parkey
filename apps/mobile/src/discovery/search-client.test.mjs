import assert from 'node:assert/strict'
import test from 'node:test'

import { searchDestinations } from './data.ts'

test('absent search configuration never transmits queries or coordinates', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    throw new Error('Unexpected network request')
  }
  try {
    for (const endpoint of ['', '   '])
      await assert.rejects(
        searchDestinations(
          endpoint,
          'Synthetic query',
          [121, 14],
          new globalThis.AbortController().signal,
        ),
        /Destination search is unavailable/,
      )
    assert.equal(calls, 0)
  } finally {
    globalThis.fetch = original
  }
})
