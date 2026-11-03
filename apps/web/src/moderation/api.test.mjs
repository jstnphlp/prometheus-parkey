import assert from 'node:assert/strict'
import test from 'node:test'

import { parseQueue } from './api.ts'

const report = {
  id: 'id',
  name: 'Parking',
  kind: 'street',
  intent: 'correction',
  status: 'pending_review',
  target_id: 'target',
  external_target_url: null,
  side: 'left',
  geometry: {
    type: 'LineString',
    coordinates: [
      [121.03, 14.56],
      [121.031, 14.56],
    ],
  },
  fees: null,
  hours: null,
  restrictions: 'Correct the sign',
  observed_at: null,
}
test('queue parsing preserves correction identity and street side for informed review', () => {
  const queue = parseQueue({
    canPublish: false,
    hasMore: true,
    reports: [report],
  })
  assert.equal(queue.reports[0].target_id, 'target')
  assert.equal(queue.reports[0].side, 'left')
  assert.equal(queue.hasMore, true)
})
test('queue rejects malformed and incompatible API responses', () => {
  for (const input of [
    null,
    {},
    { canPublish: false, reports: [] },
    {
      canPublish: false,
      hasMore: false,
      reports: [{ ...report, geometry: null }],
    },
    { canPublish: false, hasMore: false, reports: [{ ...report, fees: 100 }] },
  ])
    assert.throws(() => parseQueue(input))
})
