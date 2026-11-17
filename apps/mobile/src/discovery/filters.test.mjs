import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'

import { hasParkingFeature, partitionParking } from './filters.ts'

const records = JSON.parse(
  readFileSync(new URL('./osm-pilot.json', import.meta.url)),
)

test('feature filters require explicit facts and reject conflicting hours and malformed counts', () => {
  const record = { ...records[0], hours: null, osmTags: {} }
  for (const feature of ['covered', '24h', 'ev', 'accessible'])
    assert.equal(hasParkingFeature(record, feature), false)
  const affirmative = {
    ...record,
    osmTags: {
      covered: 'yes',
      opening_hours: '24/7',
      'capacity:charging': '2',
      wheelchair: 'yes',
    },
  }
  for (const feature of ['covered', '24h', 'ev', 'accessible'])
    assert.equal(hasParkingFeature(affirmative, feature), true)
  assert.equal(
    hasParkingFeature({ ...affirmative, hours: 'Mo-Fr 08:00-17:00' }, '24h'),
    false,
  )
  assert.equal(
    hasParkingFeature(
      {
        ...record,
        hours: '24/7',
        osmTags: { opening_hours: 'Mo-Fr 08:00-17:00' },
      },
      '24h',
    ),
    false,
  )
  for (const count of ['unknown', '-1', '2.5', '0', '99999999999999999999999'])
    assert.equal(
      hasParkingFeature(
        { ...record, osmTags: { 'capacity:charging': count } },
        'ev',
      ),
      false,
    )
  assert.deepEqual(
    partitionParking([record, affirmative], 'all', 'all', ['covered', 'ev'])
      .matched,
    [affirmative],
  )
})

test('type filters reflect the real snapshot and do not conflate lots with garages', () => {
  for (const [kind, count] of [
    ['all', 43],
    ['street', 6],
    ['facilities', 37],
    ['lot', 35],
    ['garage', 2],
  ]) {
    const result = partitionParking(records, kind)
    assert.equal(result.matched.length, count)
    assert.equal(result.nonmatched.length, records.length - count)
    assert.equal(result.unknown.length, 0)
    assert.equal(new Set([...result.matched, ...result.nonmatched]).size, 43)
  }
})

test('actual fee text has two matches and 41 unknowns, with no inferred free or paid values', () => {
  const result = partitionParking(records, 'all', 'applies')
  assert.equal(result.matched.length, 2)
  assert.equal(result.unknown.length, 41)
  assert.equal(result.nonmatched.length, 0)
  assert.ok(
    result.matched.every(
      (record) => record.fees === 'Fee applies; amount unavailable',
    ),
  )
  assert.ok(result.unknown.every((record) => record.fees === null))
})

test('kind mismatch is explicit while unrecognized fee text stays in the unknown partition', () => {
  const record = records[0]
  const inputs = [
    {
      ...record,
      id: 'paid',
      kind: 'lot',
      fees: 'Fee applies; amount unavailable',
    },
    { ...record, id: 'missing', kind: 'lot', fees: null },
    { ...record, id: 'text', kind: 'lot', fees: 'Free after 5pm' },
    { ...record, id: 'zero', kind: 'lot', fees: '0' },
    { ...record, id: 'other', kind: 'garage', fees: null },
  ]
  const result = partitionParking(inputs, 'lot', 'applies')
  assert.deepEqual(
    result.matched.map((item) => item.id),
    ['paid'],
  )
  assert.deepEqual(
    result.unknown.map((item) => item.id),
    ['missing', 'text', 'zero'],
  )
  assert.deepEqual(
    result.nonmatched.map((item) => item.id),
    ['other'],
  )
  assert.equal(inputs.length, 5)
  assert.equal(partitionParking(inputs, 'lot').matched.length, 4)
  assert.deepEqual(partitionParking([], 'all', 'applies'), {
    matched: [],
    nonmatched: [],
    unknown: [],
  })
})

test('free filter requires explicit source evidence and keeps unknown fees separate', () => {
  const record = records[0]
  const inputs = [
    { ...record, id: 'tagged', osmTags: { fee: 'no' }, fees: null },
    {
      ...record,
      id: 'imported',
      osmTags: {},
      fees: 'OSM records no fee; check posted signs',
    },
    { ...record, id: 'unknown', osmTags: {}, fees: null },
    { ...record, id: 'conditional', osmTags: {}, fees: 'Free after 5pm' },
  ]
  const result = partitionParking(inputs, 'all', 'free')
  assert.deepEqual(
    result.matched.map((item) => item.id),
    ['tagged', 'imported'],
  )
  assert.deepEqual(
    result.unknown.map((item) => item.id),
    ['unknown', 'conditional'],
  )
})

test('contradictory fees never match free or paid filters', () => {
  const inputs = [
    {
      ...records[0],
      id: 'free-with-charge',
      osmTags: { fee: 'no', charge: 'PHP 40/hr' },
      fees: null,
    },
    {
      ...records[0],
      id: 'paid-with-free',
      osmTags: { fee: 'yes' },
      fees: 'Free',
    },
    {
      ...records[0],
      id: 'conditional',
      osmTags: { fee: 'no' },
      fees: 'Free for customers',
    },
  ]
  for (const filter of ['free', 'applies']) {
    const result = partitionParking(inputs, 'all', filter)
    assert.deepEqual(result.matched, [])
    assert.deepEqual(result.unknown, inputs)
  }
  assert.deepEqual(partitionParking(inputs, 'all').matched, inputs)
})
