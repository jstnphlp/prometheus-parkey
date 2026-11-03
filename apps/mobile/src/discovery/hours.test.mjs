import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'

import { hoursLabel, hoursStatus } from './hours.ts'

// All bundled real records currently have null hours. Schedule examples below
// are deliberately synthetic, not claims about any of these parking records.
const records = JSON.parse(
  readFileSync(new URL('./osm-pilot.json', import.meta.url)),
)
const at = (iso) => new Date(iso)

test('real snapshot hours remain unknown without altering the source', () => {
  assert.ok(records.length > 0, 'The bundled dataset must not be empty')
  assert.ok(records.every((record) => record.hours === null))
  for (const record of records)
    assert.equal(hoursStatus(record.hours), 'unknown', record.id)
  assert.equal(hoursLabel('open'), 'Open now')
  assert.equal(hoursLabel('closed'), 'Closed')
  assert.equal(hoursLabel('unknown'), 'Hours unknown')
})

test('synthetic daily hours use Manila time with inclusive opening and exclusive closing', () => {
  const source = '08:00-17:00'
  assert.equal(hoursStatus(source, at('2026-10-30T23:59:59Z')), 'closed')
  assert.equal(hoursStatus(source, at('2026-10-31T00:00:00Z')), 'open')
  assert.equal(hoursStatus(source, at('2026-10-31T08:59:59Z')), 'open')
  assert.equal(hoursStatus(source, at('2026-10-31T09:00:00Z')), 'closed')
  assert.equal(hoursStatus('00:00-24:00', at('2026-10-30T16:00:00Z')), 'open')
})

test('synthetic weekly schedules, split ranges and explicit closures stay bounded', () => {
  const source = 'Mo-Fr 08:00-12:00,13:00-17:00; Sa 09:00-12:00; Su off'
  assert.equal(hoursStatus(source, at('2026-10-30T00:00:00Z')), 'open')
  assert.equal(hoursStatus(source, at('2026-10-30T04:00:00Z')), 'closed')
  assert.equal(hoursStatus(source, at('2026-10-30T05:00:00Z')), 'open')
  assert.equal(hoursStatus(source, at('2026-10-31T01:00:00Z')), 'open')
  assert.equal(hoursStatus(source, at('2026-10-31T04:00:00Z')), 'closed')
  // UTC Saturday evening is already Sunday in Manila.
  assert.equal(hoursStatus(source, at('2026-10-31T17:00:00Z')), 'closed')
  assert.equal(
    hoursStatus('Mo,We-Fr 08:00-17:00', at('2026-10-27T01:00:00Z')),
    'closed',
  )
  assert.equal(
    hoursStatus('Fr-Mo 08:00-17:00', at('2026-10-31T01:00:00Z')),
    'open',
  )
  assert.equal(hoursStatus('closed', at('2026-10-31T01:00:00Z')), 'closed')
})

test('synthetic overnight ranges carry into the following day and week only until closing', () => {
  const source = 'Fr 22:00-02:00'
  assert.equal(hoursStatus(source, at('2026-10-30T13:59:00Z')), 'closed')
  assert.equal(hoursStatus(source, at('2026-10-30T14:00:00Z')), 'open')
  assert.equal(hoursStatus(source, at('2026-10-30T17:59:00Z')), 'open')
  assert.equal(hoursStatus(source, at('2026-10-30T18:00:00Z')), 'closed')
  assert.equal(hoursStatus(source, at('2026-10-31T15:00:00Z')), 'closed')
  assert.equal(
    hoursStatus('Su 22:00-02:00', at('2026-11-01T17:00:00Z')),
    'open',
  )
  assert.equal(hoursStatus('22:00-02:00', at('2026-10-30T17:00:00Z')), 'open')
})

test('synthetic 24/7 is explicit and does not bless unsupported exceptions', () => {
  assert.equal(hoursStatus('24/7', at('2026-10-30T16:00:00Z')), 'open')
  assert.equal(hoursStatus(' 24/7 ', at('2026-11-01T15:59:00Z')), 'open')
  assert.equal(hoursStatus('24/7; PH off'), 'unknown')
  assert.equal(hoursStatus('24/7', new Date(NaN)), 'unknown')
})

test('synthetic malformed and richer OSM expressions are wholly unknown, never guessed', () => {
  for (const source of [
    null,
    '',
    ' ',
    'open daily',
    '9am-5pm',
    '08:00+',
    'sunrise-sunset',
    'Mo-Fr 08:00-17:00; PH off',
    'Mo-Fr 08:00-17:00; Sa',
    'Mo-Fr 08:00-17:00; Fr 10:00-18:00',
    'Fr 22:00-02:00; Sa off',
    'Mo,Mo 08:00-17:00',
    'Mo-Fr-Su 08:00-17:00',
    'XX 08:00-17:00',
    'Jan-Dec 08:00-17:00',
    '08:60-17:00',
    '25:00-17:00',
    '24:00-02:00',
    '08:00-24:01',
    '00:00-00:00',
    '08:00-17:00;',
    '08:00-17:00 || "by appointment"',
    '08:00-17:00 open',
  ])
    assert.equal(
      hoursStatus(source, at('2026-10-30T01:00:00Z')),
      'unknown',
      source,
    )
})
