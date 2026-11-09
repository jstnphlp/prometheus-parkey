import type { PilotParking } from '@parkey/shared-types'

/** Identity alone is insufficient: a new approval/fact object must be observed. */
export function samePilotRecords(
  a: readonly PilotParking[],
  b: readonly PilotParking[],
) {
  return (
    a.length === b.length && a.every((record, index) => record === b[index])
  )
}

function sourceIdentity(record: PilotParking) {
  if (record.source.kind === 'osm' && record.source.url) {
    try {
      const url = new URL(record.source.url)
      if (
        !url.username &&
        !url.password &&
        ['openstreetmap.org', 'www.openstreetmap.org'].includes(url.hostname)
      ) {
        const match = /^\/(node|way|relation)\/(\d+)\/?$/.exec(url.pathname)
        if (match) return `osm:${match[1]}/${match[2]}`
      }
    } catch {
      /* Preserve observation identity when a citation is not canonical. */
    }
  }
  return JSON.stringify([
    record.source.kind,
    record.sourceObservationId || record.id,
  ])
}

/** Deduplicate repeated source observations, never nearby geometry or names. */
export function uniquePilotRecords(records: readonly PilotParking[]) {
  const unique = new Map<string, PilotParking>()
  for (const record of records) unique.set(sourceIdentity(record), record)
  return [...unique.values()]
}
