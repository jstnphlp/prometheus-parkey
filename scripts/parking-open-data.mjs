/**
 * Offline, read-only comparison of open POI datasets against Parkey's OSM pilot.
 * Never writes to mobile discovery, the SQL seed, or the original review queue.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import process from 'node:process'

export const PILOT = { west: 121.024, south: 14.558, east: 121.041, north: 14.572 }
const PARKING_CATEGORY = /\b(parking|car\s*park|carpark|parkade)\b/i
const MAX_NEARBY_METERS = 100

const safeString = (x) => typeof x === 'string' ? x.trim() : ''
const keyName = (x) => safeString(x).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const inPilot = (lon, lat) =>
  Number.isFinite(lon) && Number.isFinite(lat) &&
  lon >= PILOT.west && lon <= PILOT.east &&
  lat >= PILOT.south && lat <= PILOT.north
const parkingText = (value) =>
  (Array.isArray(value) ? value.join(' ') : String(value ?? '')).replace(/[_-]/g, ' ')
const isParkingCategory = (value) => PARKING_CATEGORY.test(parkingText(value))
const hash = (value) => createHash('sha256').update(value).digest('hex')

export function distanceMeters(first, second) {
  const rad = Math.PI / 180
  const [lng1, lat1] = first
  const [lng2, lat2] = second
  const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
    Math.sin((lng2 - lng1) * rad / 2) ** 2
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1-a))))
}

function makeCandidate(raw) {
  if (!raw.name || !raw.sourceId || !isParkingCategory(raw.category) ||
      !inPilot(...raw.coordinate)) return null
  return {
    id: raw.sourceKind + ':' + raw.sourceId,
    name: raw.name,
    category: raw.category,
    coordinate: raw.coordinate,
    address: raw.address || null,
    sourceKind: raw.sourceKind,
    sourceId: raw.sourceId,
    sourceUrl: raw.sourceUrl,
    sourceLicense: raw.sourceLicense,
    sourceAttribution: raw.sourceAttribution,
    sourceRecordConfidence: raw.sourceRecordConfidence ?? null,
    sourceRecordRefreshedAt: raw.sourceRecordRefreshedAt ?? null,
    status: 'researched',
    verification: 'unverified',
    verifiedAt: null,
    fees: null,
    hours: null,
    entrance: null,
    access: null,
    possibleBundledMatches: [],
    possibleOtherSourceMatches: [],
    flags: [
      'field_verification_required', 'public_access_unknown',
      'entrance_unknown', 'fees_unknown', 'hours_unknown',
      ...(raw.sourceLicense === 'unknown' ? ['license_review_required'] : []),
    ],
  }
}

/** Accepts Overture CLI GeoJSON FeatureCollection (place type), not scraped web data. */
export function fromOvertureGeojson(collection) {
  if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features))
    throw new Error('Expected Overture GeoJSON FeatureCollection.')
  const results = []
  for (const feature of collection.features) {
    const p = feature?.properties
    if (!p || feature?.geometry?.type !== 'Point') continue
    const name = safeString(p.names?.primary || p.name)
    const category = parkingText([
      p.taxonomy?.primary, p.basic_category, p.categories?.primary,
      ...(Array.isArray(p.categories?.alternate) ? p.categories.alternate : []),
    ].filter(Boolean))
    const id = safeString(feature.id || p.id)
    const sourceLicenses = Array.isArray(p.sources)
      ? [...new Set(p.sources.map((s) => safeString(s.license)).filter(Boolean))].sort()
      : []
    const item = makeCandidate({
      name, category, sourceId: id, sourceKind: 'overture',
      coordinate: feature.geometry.coordinates.slice(0, 2).map(Number),
      address: safeString(p.addresses?.[0]?.freeform),
      sourceUrl: 'https://explore.overturemaps.org/',
      sourceLicense: sourceLicenses.join(', ') || 'unknown',
      sourceAttribution: 'Overture Maps Foundation; review individual record source licenses',
      sourceRecordConfidence: typeof p.confidence === 'number' ? p.confidence : null,
    })
    if (item) results.push(item)
  }
  return results
}

/** Small RFC 4180 CSV reader for exported FSQ Open Source Places subsets. */
export function parseCsv(csv) {
  const lines = []
  let row = [], cell = '', quoted = false
  const text = csv.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      if (quoted && text[i+1] === '"') { cell += '"'; i++ }
      else if (quoted) quoted = false
      else if (cell === '') quoted = true
      else throw new Error('Invalid CSV quoting')
    } else if (!quoted && c === ',') { row.push(cell); cell = '' }
    else if (!quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && text[i+1] === '\n') i++
      row.push(cell)
      if (row.some((x) => x.trim())) lines.push(row)
      row = []; cell = ''
    } else cell += c
  }
  if (quoted) throw new Error('Unterminated CSV quote')
  row.push(cell)
  if (row.some((x) => x.trim())) lines.push(row)
  if (!lines.length) throw new Error('Empty CSV')
  const header = lines.shift()
  if (new Set(header).size !== header.length) throw new Error('Duplicate CSV headers')
  return lines.map((cells) => {
    if (cells.length !== header.length) throw new Error('CSV column count mismatch')
    return Object.fromEntries(header.map((h, i) => [h, cells[i]]))
  })
}

/** FSQ OS Places CSV must be obtained from the official Places Portal. */
export function fromFoursquareCsv(csv) {
  const rows = parseCsv(csv)
  const results = []
  for (const p of rows) {
    const id = safeString(p.fsq_place_id)
    if (safeString(p.date_closed)) continue
    const item = makeCandidate({
      name: safeString(p.name),
      sourceId: id,
      sourceKind: 'foursquare_os',
      category: parkingText(p.fsq_category_labels),
      coordinate: [Number(p.longitude), Number(p.latitude)],
      address: safeString(p.address),
      sourceUrl: 'https://foursquare.com/placemakers/review-place/' + encodeURIComponent(id),
      sourceLicense: 'Apache-2.0',
      sourceAttribution: 'Foursquare Open Source Places (Apache-2.0)',
      sourceRecordRefreshedAt: safeString(p.date_refreshed) || null,
    })
    if (item) results.push(item)
  }
  return results
}

/** Never declares a match verified or rewrites any existing OSM name. */
export function buildOpenDataReview({ existing, overture = [], foursquare = [], asOf, inputHashes = {} }) {
  if (!Array.isArray(existing) || !Array.isArray(overture) || !Array.isArray(foursquare))
    throw new Error('Invalid inputs')
  if (typeof asOf !== 'string' || !Number.isFinite(Date.parse(asOf)) ||
      !/Z$/.test(asOf) || Date.parse(asOf) > Date.now())
    throw new Error('Specify --as-of as a nonfuture UTC ISO timestamp.')
  const candidates = [...overture, ...foursquare].sort((a,b) => a.id.localeCompare(b.id))
  const ids = new Set()
  for (const c of candidates) {
    if (ids.has(c.id)) throw new Error('Duplicate external source ID: ' + c.id)
    ids.add(c.id)
    const neighbours = []
    for (const old of existing) {
      if (!['lot', 'garage'].includes(old.kind) || old.geometry?.type !== 'Point') continue
      const m = distanceMeters(c.coordinate, old.geometry.coordinates)
      if (m <= MAX_NEARBY_METERS)
        neighbours.push({ id: old.id, name: old.name, distanceMeters: m,
          isUnnamed: keyName(old.name).startsWith('unnamed parking') })
    }
    c.possibleBundledMatches = neighbours.sort((a,b) => a.distanceMeters - b.distanceMeters).slice(0, 8)
    if (neighbours.length) c.flags.push('existing_facility_match_requires_review')
    for (const other of candidates) {
      if (other.id === c.id || other.sourceKind === c.sourceKind) continue
      const d = distanceMeters(c.coordinate, other.coordinate)
      if (d <= 60 && keyName(c.name) === keyName(other.name))
        c.possibleOtherSourceMatches.push({ id: other.id, distanceMeters: d })
    }
    if (c.possibleOtherSourceMatches.length) c.flags.push('cross_source_possible_duplicate')
  }
  const unmatched = candidates.filter((c) => !c.possibleBundledMatches.length)
  const namedOsm = existing.filter((x) => !keyName(x.name).startsWith('unnamed parking'))
  return {
    schemaVersion: 1,
    asOf,
    pilotBounds: PILOT,
    sourceHashes: inputHashes,
    counts: {
      existing: existing.length,
      existingUnnamed: existing.length - namedOsm.length,
      overtureCandidates: overture.length,
      foursquareCandidates: foursquare.length,
      stagedCandidates: candidates.length,
      potentialNewFacilities: unmatched.length,
      potentiallyMatchingUnnamed: new Set(candidates.flatMap(
        (c) => c.possibleBundledMatches.filter((x) => x.isUnnamed).map((x) => x.id),
      )).size,
      verified: 0,
      published: 0,
    },
    policy: 'Offline research only. Nearby points are not proven to be the same parking facility. Overture may already contain Foursquare data, so cross-provider matches are not independent corroboration. All candidate names, access, operating status and entrances require human verification. This script never publishes parking records.',
    candidates,
  }
}

function cli() {
  const args = process.argv.slice(2)
  const option = (flag) => { const n = args.indexOf(flag); return n < 0 ? null : args[n+1] }
  const asOf = option('--as-of')
  const overtureFile = option('--overture')
  const foursquareFile = option('--foursquare')
  if ((!overtureFile && !foursquareFile) || !asOf ||
      args.some((a, i) => a.startsWith('--') &&
        (!['--as-of', '--overture', '--foursquare'].includes(a) || !args[i+1] || args[i+1].startsWith('--'))))
    throw new Error('Usage: node scripts/parking-open-data.mjs --as-of 2026-11-03T00:00:00Z [--overture FILE.geojson] [--foursquare FILE.csv]')
  const existingFile = new URL('../apps/mobile/src/discovery/osm-pilot.json', import.meta.url)
  const output = new URL('../data/parking-open-data-review.json', import.meta.url)
  if (existsSync(output)) throw new Error('Review output exists. Archive or review it before running again: data/parking-open-data-review.json')
  const existingBytes = readFileSync(existingFile)
  const hashes = { bundledOsm: hash(existingBytes) }
  let overture = [], foursquare = []
  if (overtureFile) {
    const bytes = readFileSync(overtureFile)
    hashes.overture = hash(bytes)
    overture = fromOvertureGeojson(JSON.parse(bytes.toString('utf8')))
  }
  if (foursquareFile) {
    const bytes = readFileSync(foursquareFile)
    hashes.foursquare = hash(bytes)
    foursquare = fromFoursquareCsv(bytes.toString('utf8'))
  }
  const review = buildOpenDataReview({
    existing: JSON.parse(existingBytes.toString('utf8')),
    overture, foursquare, asOf, inputHashes: hashes,
  })
  writeFileSync(output, JSON.stringify(review, null, 2) + '\n', { flag: 'wx' })
  process.stdout.write(JSON.stringify(review.counts, null, 2) + '\n')
  process.stdout.write('Staged for human review only: data/parking-open-data-review.json\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { cli() } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1 }
}
