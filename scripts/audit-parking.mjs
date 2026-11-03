import { readFileSync } from 'node:fs'
import { log } from 'node:console'
import process from 'node:process'
import { pathToFileURL, URL } from 'node:url'

import { isParking } from '../apps/mobile/src/discovery/data.ts'

export function auditParking(records, now = Date.now()) {
  if (!Array.isArray(records) || !records.length || !records.every(isParking))
    throw new Error(
      'Parking snapshot is empty or violates the discovery contract.',
    )
  const ids = new Set()
  const sources = new Set()
  for (const record of records) {
    if (
      ids.has(record.id) ||
      !record.sourceUrl ||
      sources.has(record.sourceUrl)
    )
      throw new Error('Missing source URL or duplicate record/source identity.')
    ids.add(record.id)
    sources.add(record.sourceUrl)
    if (
      record.sourceKind !== 'osm' ||
      record.verification !== 'unverified' ||
      record.verifiedAt !== null
    )
      throw new Error('An OSM import must not claim independent verification.')
    if (!record.sourceUpdatedAt || Date.parse(record.sourceUpdatedAt) > now)
      throw new Error('Snapshot date is missing or in the future.')
  }
  return {
    records: records.length,
    streetSegments: records.filter((record) => record.kind === 'street').length,
    missingFees: records.filter((record) => record.fees === null).length,
    missingHours: records.filter((record) => record.hours === null).length,
    missingEntrances: records.filter(
      (record) => record.kind !== 'street' && !record.entrances?.length,
    ).length,
    snapshotOlderThan30Days: records.filter(
      (record) => now - Date.parse(record.sourceUpdatedAt) > 30 * 86400000,
    ).length,
    independentlyVerified: 0,
    note: 'Import dates measure snapshot age, not field verification. Unknown facts remain unknown.',
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const input =
    process.argv[2] ??
    new URL('../apps/mobile/src/discovery/osm-pilot.json', import.meta.url)
  log(
    JSON.stringify(
      auditParking(JSON.parse(readFileSync(input, 'utf8'))),
      null,
      2,
    ),
  )
}
