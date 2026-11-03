import { createHash } from 'node:crypto'
import { URL } from 'node:url'

import { isParking } from '../apps/mobile/src/discovery/data.ts'

export const PILOT_BOUNDS = {
  west: 121.024,
  south: 14.558,
  east: 121.041,
  north: 14.572,
}

/** Strict ISO timestamp with an explicit real-world UTC offset; no calendar rollover. */
export function strictTimestamp(value, now = Date.now()) {
  if (typeof value !== 'string' || !Number.isFinite(now)) return false
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(
      value,
    )
  if (!match) return false
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number)
  const offsetHours = Number(match[10] ?? 0)
  const offsetMinutes = Number(match[11] ?? 0)
  if (
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHours > 14 ||
    offsetMinutes > 59 ||
    (offsetHours === 14 && offsetMinutes !== 0)
  )
    return false
  const stamp = Date.parse(value)
  if (!Number.isFinite(stamp) || stamp > now) return false
  const offset =
    (offsetHours * 60 + offsetMinutes) * (match[9] === '-' ? -1 : 1)
  const local = new Date(stamp + offset * 60000)
  return (
    local.getUTCFullYear() === year &&
    local.getUTCMonth() + 1 === month &&
    local.getUTCDate() === day &&
    local.getUTCHours() === hour &&
    local.getUTCMinutes() === minute &&
    local.getUTCSeconds() === second
  )
}

// Liang-Barsky segment/rectangle intersection retains complete source geometry.
export function intersectsPilot(geometry) {
  const { west, south, east, north } = PILOT_BOUNDS
  const inside = ([x, y]) => x >= west && x <= east && y >= south && y <= north
  if (geometry.type === 'Point') return inside(geometry.coordinates)
  const points = geometry.coordinates
  if (points.some(inside)) return true
  return points.slice(1).some(([x2, y2], index) => {
    const [x1, y1] = points[index]
    const dx = x2 - x1
    const dy = y2 - y1
    let low = 0
    let high = 1
    const edges = [
      [-dx, x1 - west],
      [dx, east - x1],
      [-dy, y1 - south],
      [dy, north - y1],
    ]
    for (const [p, q] of edges) {
      if (p === 0) {
        if (q < 0) return false
      } else if (p < 0) low = Math.max(low, q / p)
      else high = Math.min(high, q / p)
      if (low > high) return false
    }
    return true
  })
}

export function validateOsmSnapshot(records, { now = Date.now() } = {}) {
  if (!Number.isFinite(now)) throw new Error('Expected a finite audit time.')
  if (!Array.isArray(records) || records.length === 0)
    throw new Error('OSM snapshot must be a nonempty array.')
  const ids = new Set()
  const urls = new Set()
  for (const record of records) {
    const fail = (reason) => {
      throw new Error(`${record?.id ?? 'Unknown record'}: ${reason}`)
    }
    if (!isParking(record)) fail('Invalid discovery record contract.')
    if (!/^osm:(node|way)\/[1-9]\d*$/.test(record.id))
      fail('Expected canonical OSM node/way identity.')
    const expectedUrl = `https://www.openstreetmap.org/${record.id.slice(4)}`
    if (record.kind === 'street' && !record.id.startsWith('osm:way/'))
      fail('Street geometry requires an OSM way identity.')
    if (record.sourceUrl !== expectedUrl)
      fail('Source URL does not match OSM identity.')
    if (ids.has(record.id) || urls.has(record.sourceUrl))
      fail('Duplicate OSM identity or source URL.')
    ids.add(record.id)
    urls.add(record.sourceUrl)
    if (record.sourceKind !== 'osm' || !record.sourceLabel.trim())
      fail('Missing OSM attribution.')
    if (
      !['Open Database License (ODbL) 1.0', 'ODbL-1.0'].includes(record.license)
    )
      fail('OSM data requires ODbL-1.0.')
    if (record.verification !== 'unverified' || record.verifiedAt !== null)
      fail('OSM imports cannot claim field verification.')
    if (!strictTimestamp(record.sourceUpdatedAt, now))
      fail('Missing, invalid or future snapshot date.')
    if (
      record.osmEditedAt != null &&
      (!strictTimestamp(record.osmEditedAt, now) ||
        Date.parse(record.osmEditedAt) > Date.parse(record.sourceUpdatedAt))
    )
      fail('OSM edit date must not follow the snapshot date.')
    if (!intersectsPilot(record.geometry))
      fail('Geometry does not intersect pilot coverage.')
    if (record.kind !== 'street' && record.side !== 'unknown')
      fail('Facility side must be unknown.')
    for (const [field, limit] of [
      ['name', 200],
      ['address', 500],
      ['fees', 500],
      ['hours', 500],
    ]) {
      const value = record[field]
      if (value !== null && (!value.trim() || value.length > limit))
        fail(`Invalid ${field} text length.`)
    }
    const ruleIds = new Set()
    for (const rule of record.regulations) {
      if (
        !rule.description.trim() ||
        rule.description.length > 1000 ||
        !rule.sourceLabel.trim()
      )
        fail('Invalid regulation text/attribution.')
      if (
        rule.sourceUrl !== expectedUrl ||
        !strictTimestamp(rule.observedAt, now) ||
        Date.parse(rule.observedAt) > Date.parse(record.sourceUpdatedAt)
      )
        fail(
          'Regulation requires matching source URL and valid observation date.',
        )
      const identity = JSON.stringify([
        rule.description,
        rule.sourceUrl,
        Date.parse(rule.observedAt),
      ])
      if (ruleIds.has(identity)) fail('Duplicate source regulation.')
      ruleIds.add(identity)
    }
  }
  return [...records].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Validates a new extractor sidecar; historical snapshots may predate manifests. */
export function validateImportManifest(
  snapshotBytes,
  records,
  manifest,
  inputBytes,
) {
  const fail = () => {
    throw new Error(
      'OSM import manifest does not match the snapshot or provenance contract.',
    )
  }
  if (
    !manifest ||
    manifest.schemaVersion !== 1 ||
    manifest.license !== 'ODbL-1.0' ||
    manifest.attribution !== '\u00a9 OpenStreetMap contributors' ||
    manifest.verification !== 'unverified' ||
    manifest.recordCount !== records.length ||
    manifest.streetSegments !==
      records.filter((record) => record.kind === 'street').length ||
    JSON.stringify(manifest.bounds) !==
      JSON.stringify([
        PILOT_BOUNDS.west,
        PILOT_BOUNDS.south,
        PILOT_BOUNDS.east,
        PILOT_BOUNDS.north,
      ]) ||
    records.some((record) => record.sourceUpdatedAt !== manifest.observedAt) ||
    !/^[a-f0-9]{64}$/.test(manifest.inputSha256) ||
    manifest.outputSha256 !==
      createHash('sha256').update(snapshotBytes).digest('hex')
  )
    fail()
  let source
  try {
    source = new URL(manifest.sourceUrl)
  } catch {
    fail()
  }
  if (
    source.protocol !== 'https:' ||
    !source.hostname ||
    source.username ||
    source.password
  )
    fail()
  if (
    inputBytes !== undefined &&
    manifest.inputSha256 !==
      createHash('sha256').update(inputBytes).digest('hex')
  )
    fail()
  return manifest
}

// Original bundled snapshot only: its source XML predates provenance manifests.
const LEGACY_SNAPSHOT_SHA256 =
  'c84d0d5c05d1caab533372788de5ff99ac6e2962d002eda396f34f85c9c981df'

export function validateSnapshotProvenance(snapshotBytes, records, manifest) {
  const decoded = JSON.parse(snapshotBytes.toString('utf8'))
  if (JSON.stringify(decoded) !== JSON.stringify(records))
    throw new Error('OSM records do not match the decoded snapshot bytes.')
  if (manifest !== undefined)
    return validateImportManifest(snapshotBytes, records, manifest)
  const contentHash = createHash('sha256')
    .update(JSON.stringify(decoded))
    .digest('hex')
  if (contentHash !== LEGACY_SNAPSHOT_SHA256)
    throw new Error(
      'A provenance manifest is required for every changed or new OSM snapshot. Re-extract the licensed source with explicit observation metadata.',
    )
  return null
}
