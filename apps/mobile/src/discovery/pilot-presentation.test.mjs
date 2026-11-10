import assert from 'node:assert/strict'
import test from 'node:test'

import {
  partitionPilotParking,
  pilotFeeStatus,
  pilotTypeLabel,
  rankPilotParking,
} from './pilot-presentation.ts'

const reference = [120.984, 14.599]
// These are unit fixtures, not public parking or evidence of visitor access.
const record = (
  id,
  featureType = 'lot',
  fees = null,
  coordinate = reference,
) => ({
  id,
  featureType,
  fees,
  representativePoint: coordinate,
})

test('only explicit unconditional source fees establish free or paid parking', () => {
  for (const text of [
    'Free',
    ' free parking ',
    'No fee',
    'No charge',
    'OSM records no fee; check posted signs',
  ])
    assert.equal(pilotFeeStatus(text), 'free', text)
  for (const text of [
    'Paid',
    'paid parking',
    'Fee applies',
    'Fee applies; amount unavailable',
    'PHP 40',
    '₱40/hr',
    'PHP 50.50 per hour',
    '₱150/day',
  ])
    assert.equal(pilotFeeStatus(text), 'paid', text)
  for (const text of [
    null,
    undefined,
    0,
    {},
    [],
    '',
    'Unknown',
    'Unavailable',
    'Not recorded',
    'none',
    '0',
    'PHP 0',
    '₱0/hr',
    'Free after 5pm',
    'Free for customers',
    'PHP 40/hr; free on Sundays',
    'No free parking',
    'Paid nearby',
    'PHP Infinity',
    `PHP ${'9'.repeat(400)}`,
    'PHP -40',
    'PHP 1e3',
    'Estimated ₱40',
  ])
    assert.equal(pilotFeeStatus(text), 'unknown', JSON.stringify(text))
})

test('type labels retain unknown facilities, spaces and entrances without inventing lots', () => {
  const labels = {
    lot: 'Parking lot',
    garage: 'Parking garage',
    facility_unspecified: 'Unclassified parking',
    street_segment: 'Street parking',
    space: 'Mapped parking space',
    entrance: 'Mapped entrance',
  }
  for (const [type, expected] of Object.entries(labels))
    assert.equal(pilotTypeLabel(type), expected)
  assert.equal(
    pilotTypeLabel('street_segment', 'candidate_research'),
    'Street research',
  )
  for (const value of [null, undefined, {}, 'unsupported'])
    assert.equal(pilotTypeLabel(value), 'Parking type unknown')
})

test('price filters separate unknowns and known opposite prices without changing records', () => {
  const records = [
    record('paid', 'lot', 'Fee applies; amount unavailable'),
    record('free', 'lot', 'No fee'),
    record('unknown', 'lot'),
    record('conditional', 'lot', 'Free after 5pm'),
    record('unclassified', 'facility_unspecified', 'No fee'),
    record('entrance', 'entrance', 'No fee'),
  ]
  const result = partitionPilotParking(records, 'lot', 'free')
  assert.deepEqual(
    result.matched.map((item) => item.id),
    ['free'],
  )
  assert.deepEqual(
    result.unknown.map((item) => item.id),
    ['unknown', 'conditional'],
  )
  assert.deepEqual(
    result.nonmatched.map((item) => item.id),
    ['paid', 'unclassified', 'entrance'],
  )
  assert.equal(result.matched[0], records[1])
  assert.deepEqual(partitionPilotParking(records).matched, records)
  assert.deepEqual(
    partitionPilotParking(records, 'facility_unspecified').matched,
    [records[4]],
  )
  assert.deepEqual(partitionPilotParking(records, 'entrance').matched, [
    records[5],
  ])
  assert.deepEqual(
    partitionPilotParking(records, 'all', 'paid').matched.map(
      (item) => item.id,
    ),
    ['paid'],
  )
  assert.deepEqual(partitionPilotParking([], 'all', 'free'), {
    matched: [],
    nonmatched: [],
    unknown: [],
  })
})

test('nearby ranking uses the supplied destination/location/map reference and stable id ties', () => {
  const records = [
    record('far', 'lot', null, [121.01, 14.62]),
    record('z', 'facility_unspecified'),
    record('a', 'entrance'),
  ]
  const ranked = rankPilotParking(records, reference)
  assert.deepEqual(
    ranked.map((item) => item.record.id),
    ['a', 'z', 'far'],
  )
  assert.equal(ranked[0].straightLineMeters, 0)
  assert.equal(ranked[1].straightLineMeters, 0)
  assert.ok(ranked[2].straightLineMeters > 1000)
  assert.deepEqual(
    records.map((item) => item.id),
    ['far', 'z', 'a'],
  )
  assert.equal(ranked[0].record, records[2])
  assert.equal(ranked[0].record.featureType, 'entrance')
  assert.equal(rankPilotParking(records, [121.01, 14.62])[0].record.id, 'far')
})

test('invalid coordinates never produce a fictional finite distance', () => {
  const valid = record('valid')
  for (const coordinate of [[NaN, 14], [181, 14], [120, 90], [], null]) {
    const invalid = record('invalid', 'lot', null, coordinate)
    const ranked = rankPilotParking([invalid, valid], reference)
    assert.equal(ranked[0].record, valid)
    assert.equal(ranked[1].straightLineMeters, null)
  }
  for (const point of [null, undefined, [Infinity, 0], [0, 90]]) {
    const ranked = rankPilotParking([record('z'), record('a')], point)
    assert.deepEqual(
      ranked.map((item) => item.record.id),
      ['a', 'z'],
    )
    assert.ok(ranked.every((item) => item.straightLineMeters === null))
  }
})
