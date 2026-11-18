import assert from 'node:assert/strict'
import test from 'node:test'

import { softenDarkMapStyle } from './dark-map-style.ts'

test('dark map recolors land, roads and labels while retaining provider data and layout', () => {
  const style = {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#0c0c0c' },
      },
      {
        id: 'highway_minor',
        type: 'line',
        source: 'openmaptiles',
        paint: { 'line-color': '#181818', 'line-width': 4 },
      },
      {
        id: 'place_town',
        type: 'symbol',
        source: 'openmaptiles',
        layout: { 'text-field': ['get', 'name'] },
        paint: { 'text-color': '#242424' },
      },
    ],
  }
  const softened = softenDarkMapStyle(style)
  assert.strictEqual(softened.sources, style.sources)
  assert.equal(softened.glyphs, style.glyphs)
  assert.notEqual(
    softened.layers[0].paint['background-color'],
    style.layers[0].paint['background-color'],
  )
  assert.notEqual(
    softened.layers[1].paint['line-color'],
    style.layers[1].paint['line-color'],
  )
  assert.equal(softened.layers[1].paint['line-width'], 4)
  assert.strictEqual(softened.layers[2].layout, style.layers[2].layout)
  assert.equal(softened.layers[0].paint['background-color'], '#292331')
  assert.equal(softened.layers[2].paint['text-color'], '#EEE8F3')
})
