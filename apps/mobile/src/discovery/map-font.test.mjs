import assert from 'node:assert/strict'
import test from 'node:test'
import { createExpression } from '@maplibre/maplibre-gl-style-spec'

import { mapTextFont } from './map-font.ts'
import { parkingLabelLayout, parkingMarkerLayout } from './map-marker-style.ts'

const key = 'layers[0].layout.text-font'

test('the font stack is a valid native expression that evaluates to actual font names', () => {
  const parsed = createExpression(mapTextFont, key)
  assert.equal(parsed.result, 'success')
  assert.deepEqual(parsed.value.evaluate({ zoom: 16 }), ['Noto Sans Bold'])
  // This is how Native interprets the old plain array, not GL JS font syntax.
  const previous = createExpression(['Noto Sans Bold'], key)
  assert.equal(previous.result, 'error')
  assert.ok(
    previous.value.some((error) => /unknown expression/i.test(error.message)),
  )
})

test('normal and selected parking labels use the supported explicit font expression', () => {
  for (const layout of [parkingMarkerLayout(1 / 3), parkingLabelLayout()]) {
    const parsed = createExpression(layout['text-font'], key)
    assert.equal(parsed.result, 'success')
    assert.deepEqual(parsed.value.evaluate({ zoom: 16 }), ['Noto Sans Bold'])
  }
})
