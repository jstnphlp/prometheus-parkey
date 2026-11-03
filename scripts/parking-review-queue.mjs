import { readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'
import { pathToFileURL, URL } from 'node:url'

import { strictTimestamp, PILOT_BOUNDS } from './parking-import.mjs'

import { isCoordinate } from '../apps/mobile/src/discovery/model.ts'
import {
  AUDIT_AS_OF,
  auditParking,
  contentHash,
  readAuditAsOf,
} from './audit-parking.mjs'

const https = (value) => {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      Boolean(url.hostname)
    )
  } catch {
    return false
  }
}
const text = (value) => typeof value === 'string' && value.trim().length > 0

export function validateResearch(dataset) {
  if (
    !dataset ||
    dataset.schemaVersion !== 1 ||
    !Array.isArray(dataset.candidates)
  )
    throw new Error('Unsupported research dataset.')
  const identities = new Set()
  const urls = new Set()
  for (const candidate of dataset.candidates) {
    if (
      !candidate ||
      !text(candidate.id) ||
      identities.has(candidate.id) ||
      !text(candidate.name) ||
      !(
        candidate.kind === null ||
        ['lot', 'garage', 'street'].includes(candidate.kind)
      ) ||
      !['researched', 'rejected'].includes(candidate.status) ||
      !['low', 'medium', 'high'].includes(candidate.confidence) ||
      !text(candidate.confidenceReason) ||
      !https(candidate.sourceUrl) ||
      urls.has(candidate.sourceUrl) ||
      !text(candidate.sourceKind) ||
      !text(candidate.license) ||
      !text(candidate.evidence) ||
      !strictTimestamp(candidate.observedAt, Date.now()) ||
      candidate.fieldVerifiedAt !== null ||
      candidate.fees !== null ||
      candidate.hours !== null ||
      candidate.entrance !== null ||
      (candidate.coordinate !== null && !isCoordinate(candidate.coordinate)) ||
      (candidate.status === 'rejected' && !text(candidate.rejectionReason))
    )
      throw new Error(
        `Invalid or unsupported research claim: ${candidate?.id ?? 'unknown'}`,
      )
    if (candidate.sourceKind === 'osm') {
      const identity =
        /^https:\/\/www\.openstreetmap\.org\/(node|way)\/([1-9]\d*)$/.exec(
          candidate.sourceUrl,
        )
      if (
        !identity ||
        candidate.license !== 'ODbL-1.0' ||
        !Number.isSafeInteger(candidate.sourceVersion) ||
        candidate.sourceVersion < 1 ||
        !strictTimestamp(
          candidate.osmEditedAt,
          Date.parse(candidate.observedAt),
        ) ||
        candidate.evidenceDetails?.versionUrl !==
          `https://api.openstreetmap.org/api/0.6/${identity[1]}/${identity[2]}/${candidate.sourceVersion}`
      )
        throw new Error(`Invalid OSM research provenance: ${candidate.id}`)
    }
    if (candidate.coordinate !== null && candidate.status !== 'rejected') {
      const [lng, lat] = candidate.coordinate
      if (
        lng < PILOT_BOUNDS.west ||
        lng > PILOT_BOUNDS.east ||
        lat < PILOT_BOUNDS.south ||
        lat > PILOT_BOUNDS.north
      )
        throw new Error(`Research coordinate outside pilot: ${candidate.id}`)
    }
    identities.add(candidate.id)
    urls.add(candidate.sourceUrl)
  }
  return dataset.candidates
}

export function buildReviewQueue(records, research, asOf = AUDIT_AS_OF) {
  const audit = auditParking(records, asOf)
  const candidates = validateResearch(research)
  const ids = new Set(records.map((record) => record.id))
  const urls = new Set(records.map((record) => record.sourceUrl))
  const researched = records.map((record) => {
    const flags = ['field_verification_required', 'legal_permission_unknown']
    if (record.kind !== 'street' && !record.entrances?.length)
      flags.push('entrance_unknown')
    if (
      record.osmTags?.ownership === 'private' ||
      record.regulations.some((rule) =>
        /Road ownership recorded by OpenStreetMap: private/.test(
          rule.description,
        ),
      )
    )
      flags.push('private_road_ownership_requires_review')
    if (!record.fees) flags.push('fees_unknown')
    if (!record.hours) flags.push('hours_unknown')
    if (['private', 'customers', 'no'].includes(record.osmTags?.access))
      flags.push('restricted_access_requires_review')
    if (
      record.osmEditedAt &&
      Date.parse(asOf) - Date.parse(record.osmEditedAt) > 365 * 86400000
    )
      flags.push('osm_edit_older_than_one_year')
    if (audit.recordsWithVerticesOutsidePilot.includes(record.id))
      flags.push('street_crosses_pilot_boundary')
    const possibleDuplicates = audit.nearbyFacilitiesWithin50m
      .filter((pair) => pair.ids.includes(record.id))
      .map((pair) => pair.ids.find((id) => id !== record.id))
    if (possibleDuplicates.length) flags.push('nearby_facility_review')
    return {
      id: record.id,
      name: record.name,
      origin: 'bundled_osm',
      status: 'researched',
      sourceUrl: record.sourceUrl,
      observedAt: record.sourceUpdatedAt,
      osmEditedAt: record.osmEditedAt ?? null,
      license: record.license,
      confidence: 'low',
      confidenceReason:
        'OSM mapping evidence only; no independent field observation.',
      fieldVerifiedAt: null,
      possibleDuplicates,
      flags,
    }
  })
  const rejected = []
  for (const candidate of candidates) {
    if (ids.has(candidate.id) || urls.has(candidate.sourceUrl))
      throw new Error(
        `Candidate duplicates bundled or researched identity: ${candidate.id}`,
      )
    ids.add(candidate.id)
    urls.add(candidate.sourceUrl)
    const item = {
      ...candidate,
      origin: 'public_source_research',
      flags: [
        'field_verification_required',
        'legal_permission_unknown',
        ...(candidate.coordinate === null ? ['coordinates_unknown'] : []),
        ...(candidate.kind === null ? ['parking_type_unknown'] : []),
      ],
    }
    if (candidate.status === 'rejected') rejected.push(item)
    else researched.push(item)
  }
  const byId = (a, b) => a.id.localeCompare(b.id)
  return {
    schemaVersion: 1,
    snapshotAsOf: asOf,
    snapshotSha256: contentHash(records),
    researchSha256: contentHash(research),
    counts: {
      researched: researched.length,
      verified: 0,
      rejected: rejected.length,
      bundled: records.length,
      additionalCandidates: candidates.length,
    },
    policy:
      'Offline human review only. Research confidence is evidence strength, not field verification, public access, permission to park, or publication approval. No queue entries are imported or published by this command. Verified is empty until a separate reviewed human evidence process exists.',
    researched: researched.sort(byId),
    verified: [],
    rejected: rejected.sort(byId),
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const read = (path) =>
    JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
  const queue = buildReviewQueue(
    read('../apps/mobile/src/discovery/osm-pilot.json'),
    read('../data/parking-research.json'),
    readAuditAsOf(),
  )
  const target = new URL('../data/parking-review-queue.json', import.meta.url)
  if (process.argv.includes('--check')) {
    if (
      JSON.stringify(JSON.parse(readFileSync(target, 'utf8'))) !==
      JSON.stringify(queue)
    )
      throw new Error('Parking review queue is stale. Run pnpm data:refresh.')
  } else writeFileSync(target, JSON.stringify(queue, null, 2) + '\n')
  process.stdout.write(
    `Review queue: ${queue.counts.researched} researched, 0 verified, ${queue.counts.rejected} rejected; no publication.\n`,
  )
}
