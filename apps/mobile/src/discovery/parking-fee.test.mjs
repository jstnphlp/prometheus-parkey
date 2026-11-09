import assert from 'node:assert/strict'
import test from 'node:test'

import { parkingFee, parkingFeeFacts } from './parking-fee.ts'

const record = (tags = {}, fees = null) => ({ osmTags: tags, fees })

test('only explicit consistent fee facts establish a fee assertion', () => {
  for (const input of [
    record({ fee: 'no' }),
    record({}, 'Free'),
    record({}, 'OSM records no fee; check posted signs'),
  ]) {
    assert.equal(parkingFee(input), 'Free')
    assert.equal(parkingFeeFacts(input).status, 'free')
  }
  for (const [input, expected] of [
    [record({ fee: ' YES ' }), 'Paid'],
    [record({}, 'Fee applies; amount unavailable'), 'Paid'],
    [record({ fee: 'yes', charge: '₱40/hr' }), '₱40/hr'],
    [record({}, 'PHP 50 per hour'), 'PHP 50 per hour'],
  ]) {
    assert.equal(parkingFee(input), expected)
    assert.equal(parkingFeeFacts(input).status, 'paid')
  }
  for (const raw of [
    null,
    '',
    'Unknown',
    'No free parking',
    'Free for customers',
    'Free after 5pm',
    'PHP 0',
    '0',
    'PHP -40',
    'PHP Infinity',
    'PHP 1e3',
  ]) {
    assert.equal(parkingFee(record({}, raw)), undefined, raw)
    assert.equal(parkingFeeFacts(record({}, raw)).status, 'unknown')
  }
})

test('contradictory free and charge facts stay unknown while retaining each source fact', () => {
  for (const input of [
    record({ fee: 'no', charge: 'PHP 40/hr' }),
    record({ fee: 'no' }, 'Paid'),
    record({ fee: 'yes' }, 'Free'),
    record({ charge: '₱50/hr' }, 'No fee'),
    record({ fee: 'no' }, 'Free after 5pm'),
    record({ fee: 'customers' }, 'Free'),
    record({ charge: 'PHP 50/hr' }, 'PHP 40/hr'),
  ]) {
    const before = JSON.stringify(input)
    const facts = parkingFeeFacts(input)
    assert.equal(facts.conflict, true, before)
    assert.equal(facts.status, 'unknown', before)
    assert.equal(parkingFee(input), undefined, before)
    assert.ok(facts.sources.length >= 2)
    assert.equal(JSON.stringify(input), before)
  }
  assert.deepEqual(
    parkingFeeFacts(record({ fee: 'no', charge: 'PHP 40/hr' }, 'Paid')).sources,
    [
      { label: 'OSM fee', value: 'no' },
      { label: 'OSM charge', value: 'PHP 40/hr' },
      { label: 'Recorded fee', value: 'Paid' },
    ],
  )
})

test('equivalent currency and hourly-unit spelling does not manufacture a source conflict', () => {
  const facts = parkingFeeFacts(
    record({ fee: 'yes', charge: '₱40/hr' }, 'PHP 40.00 per hour'),
  )
  assert.equal(facts.conflict, false)
  assert.equal(facts.status, 'paid')
  assert.equal(facts.value, '₱40/hr')
  assert.equal(
    parkingFeeFacts(record({ charge: '₱40/day' }, 'PHP 40 per hour')).conflict,
    true,
  )
})
