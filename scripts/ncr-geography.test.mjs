import assert from 'node:assert/strict'
import test from 'node:test'
import {
  NCR_LGUS,
  validateNcrBoundaries,
  pointInNcrGeometry,
  intersectingLgus,
  researchCell,
} from './ncr-geography.mjs'

const square = (west, south, width = 0.012) => ({
  type: 'Polygon',
  coordinates: [
    [
      [west, south],
      [west + width, south],
      [west + width, south + width],
      [west, south + width],
      [west, south],
    ],
  ],
})
const sample = () => ({
  type: 'FeatureCollection',
  features: NCR_LGUS.map((lgu, i) => ({
    type: 'Feature',
    properties: { lgu },
    geometry: square(120.9 + i * 0.016, 14.5),
  })),
})
test('requires all 17 named NCR LGUs and valid closed polygons', () => {
  const b = validateNcrBoundaries(sample())
  assert.equal(b.size, 17)
  const missing = sample()
  missing.features.pop()
  assert.throws(() => validateNcrBoundaries(missing), /Expected 17/)
  const duplicate = sample()
  duplicate.features[0].properties.lgu = 'Makati'
  assert.throws(() => validateNcrBoundaries(duplicate), /repeated LGU/)
  const notClosed = sample()
  notClosed.features[0].geometry.coordinates[0].pop()
  assert.throws(() => validateNcrBoundaries(notClosed), /unclosed/)
})
test('rejects wrong-region polygons with familiar NCR names', () => {
  const foreign = sample()
  foreign.features[0].geometry = square(123, 11)
  assert.throws(() => validateNcrBoundaries(foreign), /outside the NCR/)
})
test('handles polygon holes, coordinate ordering and crossing street segments', () => {
  const b = validateNcrBoundaries(sample())
  const makati = b.get('Makati')
  assert.equal(
    pointInNcrGeometry([120.9 + 2 * 0.016 + 0.006, 14.506], makati),
    true,
  )
  assert.equal(pointInNcrGeometry([14.506, 120.938], makati), false)
  const x = 120.9 + 2 * 0.016
  const road = {
    type: 'LineString',
    coordinates: [
      [x - 0.005, 14.506],
      [x + 0.011, 14.506],
    ],
  }
  assert.deepEqual(intersectingLgus(road, b), ['Las Piñas', 'Makati'])
  assert.deepEqual(
    intersectingLgus({ type: 'Point', coordinates: [120.5, 14.5] }, b),
    [],
  )
  const outer = [
    [121, 14.5],
    [121.04, 14.5],
    [121.04, 14.54],
    [121, 14.54],
    [121, 14.5],
  ]
  const hole = [
    [121.01, 14.51],
    [121.03, 14.51],
    [121.03, 14.53],
    [121.01, 14.53],
    [121.01, 14.51],
  ]
  const p = { type: 'Polygon', coordinates: [outer, hole] }
  assert.equal(pointInNcrGeometry([121.02, 14.52], p), false)
  assert.equal(pointInNcrGeometry([121.005, 14.505], p), true)
})
test('research cells are deterministic, not administrative boundaries', () => {
  assert.equal(researchCell([121.0301, 14.567]), '121.0300,14.5600')
  assert.throws(() => researchCell([121, 190]))
})
