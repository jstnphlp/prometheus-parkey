import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'
import { pathToFileURL, URL } from 'node:url'
import { parseArgs } from 'node:util'

import {
  anchor,
  distanceMeters,
  PILOT_VIEWPORT,
} from '../apps/mobile/src/discovery/model.ts'
import { strictTimestamp, validateOsmSnapshot } from './parking-import.mjs'

export const AUDIT_AS_OF = '2026-11-03T00:00:00Z'
export function readAuditAsOf() {
  const config = JSON.parse(
    readFileSync(
      new URL('../data/parking-audit-config.json', import.meta.url),
      'utf8',
    ),
  )
  if (config.schemaVersion !== 1 || !strictTimestamp(config.asOf, Date.now()))
    throw new Error(
      'Set a valid, nonfuture audit asOf in data/parking-audit-config.json.',
    )
  return config.asOf
}

export const contentHash = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex')
const points = (record) =>
  record.geometry.type === 'Point'
    ? [record.geometry.coordinates]
    : record.geometry.coordinates
const outside = ([longitude, latitude]) =>
  longitude < PILOT_VIEWPORT.west ||
  longitude > PILOT_VIEWPORT.east ||
  latitude < PILOT_VIEWPORT.south ||
  latitude > PILOT_VIEWPORT.north
const count = (records, predicate) => records.filter(predicate).length

export function auditParking(records, asOf = AUDIT_AS_OF) {
  const now = Date.parse(asOf)
  if (!Number.isFinite(now) || !strictTimestamp(asOf, now))
    throw new Error('Audit date must be a finite timestamp.')
  validateOsmSnapshot(records, { now })
  const coordinates = records.flatMap(points)
  const facilities = records.filter((record) => record.kind !== 'street')
  const nearbyFacilities = []
  for (let i = 0; i < facilities.length; i++) {
    for (let j = i + 1; j < facilities.length; j++) {
      const distance = distanceMeters(
        anchor(facilities[i].geometry),
        anchor(facilities[j].geometry),
      )
      if (distance < 50)
        nearbyFacilities.push({
          ids: [facilities[i].id, facilities[j].id].sort(),
          distanceMeters: Math.round(distance * 10) / 10,
        })
    }
  }
  const ageCount = (field, days) =>
    count(
      records,
      (record) =>
        record[field] && now - Date.parse(record[field]) > days * 86400000,
    )
  const dates = records
    .map((record) => record.osmEditedAt)
    .filter(Boolean)
    .sort()
  return {
    schemaVersion: 1,
    asOf,
    snapshotSha256: contentHash(records),
    records: records.length,
    kinds: Object.fromEntries(
      ['lot', 'garage', 'street'].map((kind) => [
        kind,
        count(records, (record) => record.kind === kind),
      ]),
    ),
    missing: {
      address: count(records, (record) => record.address === null),
      fees: count(records, (record) => record.fees === null),
      hours: count(records, (record) => record.hours === null),
      facilityEntrances: count(
        facilities,
        (record) => !record.entrances?.length,
      ),
      osmEditedAt: count(records, (record) => !record.osmEditedAt),
      checkDate: count(records, (record) => !record.osmTags?.check_date),
    },
    unnamed: count(records, (record) => /^Unnamed/.test(record.name)),
    access: Object.fromEntries(
      ['private', 'customers', 'no', 'unknown', 'other'].map((access) => [
        access,
        count(records, (record) => {
          const value = record.osmTags?.access || 'unknown'
          return access === 'other'
            ? !['private', 'customers', 'no', 'unknown'].includes(value)
            : value === access
        }),
      ]),
    ),
    independentlyVerified: count(
      records,
      (record) => record.verification === 'verified',
    ),
    sourceUrls: new Set(records.map((record) => record.sourceUrl)).size,
    duplicateIds:
      records.length - new Set(records.map((record) => record.id)).size,
    snapshotDates: [
      ...new Set(records.map((record) => record.sourceUpdatedAt)),
    ].sort(),
    snapshotOlderThan30Days: ageCount('sourceUpdatedAt', 30),
    osmEditOlderThan365Days: ageCount('osmEditedAt', 365),
    osmEditOlderThan730Days: ageCount('osmEditedAt', 730),
    oldestOsmEdit: dates[0] ?? null,
    newestOsmEdit: dates.at(-1) ?? null,
    pilotBounds: {
      west: PILOT_VIEWPORT.west,
      south: PILOT_VIEWPORT.south,
      east: PILOT_VIEWPORT.east,
      north: PILOT_VIEWPORT.north,
    },
    geometryEnvelope: {
      west: Math.min(...coordinates.map((p) => p[0])),
      south: Math.min(...coordinates.map((p) => p[1])),
      east: Math.max(...coordinates.map((p) => p[0])),
      north: Math.max(...coordinates.map((p) => p[1])),
    },
    recordsWithVerticesOutsidePilot: records
      .filter((record) => points(record).some(outside))
      .map((record) => record.id)
      .sort(),
    verticesOutsidePilot: coordinates.filter(outside).length,
    nearbyFacilitiesWithin50m: nearbyFacilities.sort((a, b) =>
      a.ids.join().localeCompare(b.ids.join()),
    ),
    nearbyFacilitiesWithin30m: nearbyFacilities.filter(
      (pair) => pair.distanceMeters < 30,
    ).length,
    notes: [
      'Snapshot age and OSM edit age are not field-verification age or proof of current conditions.',
      'The pilot rectangle covers Poblacion and nearby streets; it is not an official barangay boundary or a completeness claim.',
      'Nearby facilities are review hints, not automatic duplicates. OSM node/way duplicates and multi-level facilities require human review.',
      'Recorded access and parking tags do not establish legal permission, public access, or vacancy.',
    ],
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { values, positionals } = parseArgs({
    options: {
      write: { type: 'boolean' },
      check: { type: 'boolean' },
      'as-of': { type: 'string' },
    },
    allowPositionals: true,
  })
  if (
    positionals.length > 1 ||
    (values.write && values.check) ||
    ((values.write || values.check) && (positionals.length || values['as-of']))
  )
    throw new Error(
      'Use --write/--check only with the bundled snapshot and saved audit configuration.',
    )
  const asOf = values['as-of'] ?? readAuditAsOf()
  if (!strictTimestamp(asOf, Date.now()))
    throw new Error('Expected a valid nonfuture --as-of timestamp.')
  const snapshot = JSON.parse(
    readFileSync(
      positionals[0] ??
        new URL('../apps/mobile/src/discovery/osm-pilot.json', import.meta.url),
      'utf8',
    ),
  )
  const report = auditParking(snapshot, asOf)
  const target = new URL('../data/parking-audit.json', import.meta.url)
  if (values.write)
    writeFileSync(target, JSON.stringify(report, null, 2) + '\n')
  else if (values.check) {
    if (
      JSON.stringify(JSON.parse(readFileSync(target, 'utf8'))) !==
      JSON.stringify(report)
    )
      throw new Error('Parking audit is stale. Run pnpm data:refresh.')
  } else process.stdout.write(JSON.stringify(report, null, 2) + '\n')
}
