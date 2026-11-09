import assert from 'node:assert/strict'
import test from 'node:test'

import { samePilotRecords, uniquePilotRecords } from './pilot-performance.ts'

const record = (id, observation = id, url = null, kind = 'osm') => ({
  id,
  sourceObservationId: observation,
  source: { kind, url },
  name: 'Shared label',
  representativePoint: [121, 14],
})

test('clock-only filtering reuses exact record references without hiding changed facts', () => {
  const a = record('a'),
    b = record('b')
  const previous = [a, b]
  assert.equal(samePilotRecords(previous, [a, b]), true)
  assert.equal(
    samePilotRecords(previous, [{ ...a, name: 'New reviewed fact' }, b]),
    false,
  )
  assert.equal(samePilotRecords(previous, [b, a]), false)
  assert.equal(samePilotRecords(previous, [a]), false)
})

test('repeated canonical observations prefer the newest complete record', () => {
  const old = record('old', 'one', 'https://www.openstreetmap.org/way/42')
  const fresh = record(
    'new',
    'one-updated',
    'https://openstreetmap.org/way/42#map=15/14/121',
  )
  assert.deepEqual(uniquePilotRecords([old, fresh]), [fresh])
  assert.deepEqual(
    uniquePilotRecords([record('old', 'same'), record('new', 'same')]).map(
      (x) => x.id,
    ),
    ['new'],
  )
})

test('nearby records, generic citation URLs and different source kinds never merge', () => {
  const records = [
    record('a', 'one', 'https://operator.example/'),
    record('b', 'two', 'https://operator.example/'),
    record('c', 'one', null, 'overture'),
    record('d', 'different', 'https://www.openstreetmap.org/node/42'),
  ]
  assert.equal(uniquePilotRecords(records).length, records.length)
  assert.equal(
    uniquePilotRecords([
      record('a', 'one', 'https://user:secret@openstreetmap.org/way/42'),
      record('b', 'two', 'https://www.openstreetmap.org/way/42'),
    ]).length,
    2,
  )
})
