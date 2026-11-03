import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'

import { renderOsmSeed } from './osm-snapshot-sql.mjs'
import {
  intersectsPilot,
  validateOsmSnapshot,
  validateImportManifest,
  validateSnapshotProvenance,
  strictTimestamp,
} from './parking-import.mjs'

const { structuredClone } = globalThis

const snapshot = JSON.parse(
  readFileSync(
    new URL('../apps/mobile/src/discovery/osm-pilot.json', import.meta.url),
    'utf8',
  ),
)
const now = Date.parse('2026-11-03T00:00:00Z')
const record = () => structuredClone(snapshot[0])
const validate = (records) => validateOsmSnapshot(records, { now })

test('complete bundled snapshot retains all 43 identities and complete crossing lines', () => {
  const records = validate(snapshot)
  assert.equal(records.length, 43)
  assert.equal(records.filter((item) => item.kind === 'street').length, 6)
  assert.deepEqual(
    records.map((item) => item.id),
    [...snapshot].map((item) => item.id).sort(),
  )
  assert.deepEqual(validate([...snapshot].reverse()), records)
  assert.deepEqual(
    snapshot.find((item) => item.id === 'osm:way/97081380').geometry,
    records.find((item) => item.id === 'osm:way/97081380').geometry,
  )
})

test('geographic check uses true line intersection rather than a bounding box', () => {
  assert.equal(
    intersectsPilot({
      type: 'LineString',
      coordinates: [
        [121.02, 14.565],
        [121.05, 14.565],
      ],
    }),
    true,
  )
  assert.equal(
    intersectsPilot({
      type: 'LineString',
      coordinates: [
        [121.023, 14.573],
        [121.0245, 14.573],
        [121.023, 14.5715],
      ],
    }),
    false,
  )
  const outside = record()
  outside.geometry.coordinates = [120, 14]
  assert.throws(() => validate([outside]), /pilot coverage/)
  outside.geometry.coordinates = [14.56, 121.03]
  assert.throws(() => validate([outside]), /contract/)
  outside.geometry.coordinates = [NaN, 14.56]
  assert.throws(() => validate([outside]), /contract/)
})

test('empty data, duplicate identity and mismatched source URL fail closed', () => {
  assert.throws(() => validate([]), /nonempty/)
  assert.throws(() => validate([record(), record()]), /Duplicate/)
  for (const patch of [
    { id: 'osm:node/001' },
    { sourceUrl: 'https://www.openstreetmap.org/node/1' },
    { sourceKind: 'community' },
    { license: 'Proprietary' },
    { sourceLabel: ' ' },
  ])
    assert.throws(() => validate([{ ...record(), ...patch }]))
})

test('snapshot, edit and regulation dates cannot fabricate freshness', () => {
  for (const value of [
    null,
    '',
    'not-a-date',
    '2026-11-04T00:00:00Z',
    '2026-11-02',
    '2026-02-30T00:00:00Z',
  ])
    assert.throws(() => validate([{ ...record(), sourceUpdatedAt: value }]))
  assert.throws(
    () => validate([{ ...record(), osmEditedAt: '2026-11-02T23:00:00Z' }]),
    /edit date/,
  )
  const changed = record()
  changed.regulations[0].observedAt = '2026-11-03T00:00:00Z'
  assert.throws(() => validate([changed]), /observation date/)
  changed.regulations[0].observedAt = changed.sourceUpdatedAt
  changed.regulations[0].sourceUrl = 'https://example.org/unrelated'
  assert.throws(() => validate([changed]), /source URL/)
})

test('verification claims, duplicate rules and malformed text cannot enter imports', () => {
  for (const patch of [
    { verification: 'verified', verifiedAt: '2026-11-02T00:00:00Z' },
    { verifiedAt: '2026-11-02T00:00:00Z' },
    { name: ' ' },
    { hours: '' },
    { fees: 'f'.repeat(501) },
    { side: 'both' },
  ])
    assert.throws(() => validate([{ ...record(), ...patch }]))
  const changed = record()
  changed.regulations.push(structuredClone(changed.regulations[0]))
  assert.throws(() => validate([changed]), /Duplicate source regulation/)
})

test('local seed generation rejects invalid inputs before SQL exists and escapes quoted source facts', () => {
  assert.throws(() => renderOsmSeed([], { now }), /nonempty/)
  const changed = record()
  changed.name = "Operator's parking"
  const sql = renderOsmSeed([changed], { now })
  assert.match(sql, /Operator''s parking/)
  assert.match(sql, /Existing OSM record differs or was reviewed/)
  assert.match(sql, /Existing OSM regulations differ/)
  assert.match(sql, /OSM source attribution differs/)
  assert.match(sql, /begin;[\s\S]*commit;/)
  assert.doesNotMatch(sql, /^\s*(update|delete|truncate|drop)\s/im)
  assert.equal(renderOsmSeed([changed], { now }), sql)
})

test('manifest detects snapshot tampering, source mismatch and wrong raw artifact hash', () => {
  const records = validate(snapshot)
  const bytes = JSON.stringify(records)
  const manifest = {
    schemaVersion: 1,
    license: 'ODbL-1.0',
    attribution: '\u00a9 OpenStreetMap contributors',
    verification: 'unverified',
    recordCount: records.length,
    streetSegments: 6,
    bounds: [121.024, 14.558, 121.041, 14.572],
    observedAt: records[0].sourceUpdatedAt,
    sourceUrl: 'https://www.openstreetmap.org/api/0.6/map',
    inputSha256: createHash('sha256')
      .update('raw OSM XML test artifact')
      .digest('hex'),
    outputSha256: createHash('sha256').update(bytes).digest('hex'),
  }
  assert.equal(
    validateImportManifest(
      bytes,
      records,
      manifest,
      'raw OSM XML test artifact',
    ),
    manifest,
  )
  assert.throws(
    () => validateImportManifest(bytes + ' ', records, manifest),
    /manifest/,
  )
  assert.throws(
    () =>
      validateImportManifest(bytes, records, {
        ...manifest,
        observedAt: '2026-10-28T00:00:00Z',
      }),
    /manifest/,
  )
  assert.throws(
    () =>
      validateImportManifest(bytes, records, {
        ...manifest,
        sourceUrl: 'http://example.org',
      }),
    /manifest/,
  )
  assert.throws(
    () =>
      validateImportManifest(
        bytes,
        records,
        manifest,
        'different raw artifact',
      ),
    /manifest/,
  )
})

test('strict timestamps reject rollover and malformed offsets while accepting real UTC offsets', () => {
  for (const value of [
    '2026-02-30T00:00:00Z',
    '2025-02-29T00:00:00Z',
    '2026-04-31T00:00:00Z',
    '2026-11-02T24:00:00Z',
    '2026-11-02T00:60:00Z',
    '2026-11-02T00:00:60Z',
    '2026-11-02T00:00:00',
    '2026-11-02T00:00:00+08',
    '2026-11-02T00:00:00+14:01',
    '2026-11-02T00:00:00-15:00',
    '2026-11-02T00:00:00+08:60',
    '2026-11-04T00:00:00+08:00',
  ])
    assert.equal(strictTimestamp(value, now), false, value)
  for (const value of [
    '2024-02-29T00:00:00Z',
    '2026-11-02T00:00:00+14:00',
    '2026-11-02T00:00:00-14:00',
    '2026-11-02T00:00:00.123456+08:00',
    '2026-11-02T00:00:00-03:30',
  ])
    assert.equal(strictTimestamp(value, now), true, value)
})

test('only original historical snapshot can omit an import manifest', () => {
  const bytes = JSON.stringify(snapshot)
  assert.equal(validateSnapshotProvenance(bytes, snapshot), null)
  assert.equal(
    validateSnapshotProvenance(JSON.stringify(snapshot, null, 4), snapshot),
    null,
  )
  const changed = structuredClone(snapshot)
  changed[0].name = 'Changed source name'
  assert.throws(
    () => validateSnapshotProvenance(JSON.stringify(changed), changed),
    /manifest is required/,
  )
  assert.throws(
    () => validateSnapshotProvenance(JSON.stringify([record()]), [record()]),
    /manifest is required/,
  )
  assert.throws(
    () => validateSnapshotProvenance(bytes, changed),
    /decoded snapshot/,
  )
  assert.throws(
    () => validateSnapshotProvenance(bytes, snapshot, null),
    /manifest/,
  )
})
