import assert from 'node:assert/strict'
import test from 'node:test'

import {
  boundsChanged,
  createViewportSettler,
  viewportChanged,
} from './viewport-changes.ts'

const viewport = {
  west: 121.024,
  east: 121.041,
  south: 14.558,
  north: 14.568,
  zoom: 14,
}
const shifted = (longitude) => ({
  ...viewport,
  west: viewport.west + longitude,
  east: viewport.east + longitude,
})

test('ignores tiny movements relative to the last committed area', () => {
  assert.equal(boundsChanged(viewport, shifted(0.0001)), false)
  assert.equal(boundsChanged(viewport, shifted(0.0006)), true)
  assert.equal(viewportChanged(viewport, { ...viewport, zoom: 14.02 }), false)
  assert.equal(viewportChanged(viewport, { ...viewport, zoom: 14.2 }), true)
})

test('commits a viewport crossing the legacy query zoom boundary', () => {
  assert.equal(
    viewportChanged({ ...viewport, zoom: 11.99 }, { ...viewport, zoom: 12 }),
    true,
  )
})

test('commits only the latest idle area and cancels on movement or overlay changes', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const committed = []
  const updates = createViewportSettler((area) => committed.push(area))
  updates.settle(viewport)
  t.mock.timers.tick(100)
  updates.cancel()
  t.mock.timers.tick(120)
  assert.deepEqual(committed, [])
  for (let i = 0; i < 10; i++) updates.settle(shifted(i / 1000))
  t.mock.timers.tick(119)
  assert.deepEqual(committed, [])
  t.mock.timers.tick(1)
  assert.deepEqual(committed, [shifted(0.009)])
})
