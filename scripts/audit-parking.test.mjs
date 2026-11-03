import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'

import { auditParking } from './audit-parking.mjs'

const records = JSON.parse(
  readFileSync(
    new URL('../apps/mobile/src/discovery/osm-pilot.json', import.meta.url),
  ),
)
const now = '2030-01-01T00:00:00Z'
test('audits actual records without treating import age as independent verification', () => {
  const report = auditParking(records, now)
  assert.equal(report.records, records.length)
  assert.equal(report.independentlyVerified, 0)
  assert.equal(
    report.missing.hours,
    records.filter((r) => r.hours === null).length,
  )
  assert.equal(report.snapshotOlderThan30Days, records.length)
})
test('rejects empty, duplicated, malformed, future-dated and falsely verified imports', () => {
  for (const input of [
    [],
    [{}],
    [records[0], records[0]],
    [{ ...records[0], sourceUrl: null }],
    [
      {
        ...records[0],
        verification: 'verified',
        verifiedAt: '2026-01-01T00:00:00Z',
      },
    ],
    [{ ...records[0], sourceUpdatedAt: '2100-01-01T00:00:00Z' }],
  ])
    assert.throws(() => auditParking(input, now))
})
