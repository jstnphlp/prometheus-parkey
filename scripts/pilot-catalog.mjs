import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'

import { intersectingLgus, validateNcrBoundaries } from './ncr-geography.mjs'
import { contentHash } from './ncr-publication.mjs'
import { loadNcrResearch } from './ncr-quality-review.mjs'

export const PILOT_SCOPE_VERSION = 'manila-mandaluyong-v1'
export const PILOT_CITIES = ['Manila', 'Mandaluyong']
const hash = (value) => createHash('sha256').update(value).digest('hex')
const quote = (value) => "'" + value.replaceAll("'", "''") + "'"
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    )
  return value
}
const text = (value) => JSON.stringify(canonical(value))
const defaults = {
  researchDirectory: 'data/ncr-research',
  destinationDirectory: 'data/ncr-destinations/2026-11-05',
}

function verifiedArchive(filename, expectedCompressed, expectedRaw) {
  const bytes = readFileSync(filename)
  assert.equal(hash(bytes), expectedCompressed, 'Frozen archive hash mismatch')
  const raw = filename.endsWith('.gz') ? gunzipSync(bytes) : bytes
  assert.equal(hash(raw), expectedRaw, 'Frozen source content hash mismatch')
  return JSON.parse(raw.toString('utf8'))
}

export function loadPilotGeography(
  researchDirectory = defaults.researchDirectory,
) {
  const manifest = JSON.parse(
    readFileSync(join(researchDirectory, 'manifest.json'), 'utf8'),
  )
  const artifact = manifest.artifacts.find((item) => item.role === 'boundaries')
  const collection = verifiedArchive(
    join(researchDirectory, artifact.filename),
    artifact.sha256,
    artifact.uncompressedSha256,
  )
  return {
    collection,
    boundaries: validateNcrBoundaries(collection),
    sourceHash: artifact.uncompressedSha256,
    metadata: manifest.sourceMetadata.boundaries,
  }
}

export function isPilotGeometry(geometry, city, boundaries) {
  if (!PILOT_CITIES.includes(city)) return false
  const owners = intersectingLgus(geometry, boundaries)
  return owners.length === 1 && owners[0] === city
}

/** Explicit IDs only; this never imports, enables access, or publishes records. */
export function preparePilotCatalog({
  kind,
  city,
  ids,
  researchDirectory = defaults.researchDirectory,
  destinationDirectory = defaults.destinationDirectory,
}) {
  if (
    !PILOT_CITIES.includes(city) ||
    !['candidates', 'destinations'].includes(kind)
  )
    throw new Error(
      'Choose a pilot city and candidates or destinations catalog',
    )
  if (
    !Array.isArray(ids) ||
    ids.length < 1 ||
    ids.length > 50 ||
    ids.some((id) => typeof id !== 'string' || !id.trim()) ||
    new Set(ids).size !== ids.length
  )
    throw new Error(
      'Supply 1–50 unique explicit original source IDs; bulk/archive imports are forbidden',
    )
  const geography = loadPilotGeography(researchDirectory)
  const research = loadNcrResearch(researchDirectory)
  const manifest = JSON.parse(
    readFileSync(join(destinationDirectory, 'review-manifest.json'), 'utf8'),
  )
  assert.deepEqual(
    research.sourceHashes,
    manifest.sourceHashes,
    'Destination context belongs to another research snapshot',
  )
  const reportPath = join(
    destinationDirectory,
    'destination-enrichment.json.gz',
  )
  const reportBytes = readFileSync(reportPath)
  assert.equal(
    hash(reportBytes),
    manifest.outputs['destination-enrichment.json.gz'],
    'Frozen destination report hash mismatch',
  )
  const report = JSON.parse(gunzipSync(reportBytes).toString('utf8'))
  let sourceRecords
  if (kind === 'candidates') sourceRecords = research.candidates
  else {
    const source = manifest.inputs['context-osm']
    const context = verifiedArchive(
      source.filename,
      source.sha256,
      source.uncompressedSha256,
    )
    sourceRecords = context.features.map((feature) => {
      const tags = feature.properties
      const category = [
        'shop',
        'amenity',
        'tourism',
        'leisure',
        'historic',
        'building',
      ].find((key) => tags[key])
      return {
        id: `osm:${tags['@type']}/${tags['@id']}`,
        name: tags.name,
        category: category
          ? `${category}:${tags[category]}`
          : 'named_destination',
        geometry: feature.geometry,
        sourceKind: 'osm',
        sourceRecordUrl: `https://www.openstreetmap.org/${tags['@type']}/${tags['@id']}`,
        sourceLicense: 'ODbL-1.0',
        sourceAttribution: source.sourceMetadata.attribution,
        sourceRecordEditedAt: tags['@timestamp'] || null,
        sourceTags: tags,
      }
    })
  }
  const byId = new Map(sourceRecords.map((record) => [record.id, record]))
  const records = ids.map((id) => {
    const record = byId.get(id)
    if (!record) throw new Error('Original source record not found: ' + id)
    if (!isPilotGeometry(record.geometry, city, geography.boundaries))
      throw new Error(
        'Record is outside or crosses the selected pilot city: ' + id,
      )
    const context =
      kind === 'candidates'
        ? report.records
            .filter((group) => group.candidateIds.includes(id))
            .map((group) => ({
              groupId: group.groupId || group.id,
              destinationReview: group.destinationReview || null,
            }))
        : []
    const recordText = text(record),
      contextText = text(context)
    return {
      id,
      recordText,
      recordHash: contentHash(record),
      contextText,
      contextHash: hash(contextText),
    }
  })
  const packageText = JSON.stringify({
    schemaVersion: 1,
    scopeVersion: PILOT_SCOPE_VERSION,
    kind,
    city,
    sourceHashes: research.sourceHashes,
    boundaryHash: geography.sourceHash,
    destinationReportHash: hash(reportBytes),
    destinationSourceHash: manifest.inputs['context-osm'].uncompressedSha256,
    records,
  })
  return { packageText, packageHash: hash(packageText) }
}

export function pilotCatalogSql(prepared, reviewerId) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(reviewerId || ''))
    throw new Error('Existing reviewer UUID required')
  if (hash(prepared.packageText) !== prepared.packageHash)
    throw new Error('Catalog package bytes changed')
  return `-- PRIVATE LOCAL IMPORT. No access enablement, publication or approval.\nselect public.import_pilot_catalog(${quote(reviewerId)}::uuid,${quote(prepared.packageText)},${quote(prepared.packageHash)});\n`
}

function main() {
  const [kind, city, idsPath, reviewerId, output] = process.argv.slice(2)
  if (!output)
    throw new Error(
      'Usage: node scripts/pilot-catalog.mjs candidates|destinations CITY EXPLICIT_IDS_JSON REVIEWER_UUID PRIVATE_OUTPUT_PREFIX',
    )
  const prepared = preparePilotCatalog({
    kind,
    city,
    ids: JSON.parse(readFileSync(idsPath, 'utf8')),
  })
  writeFileSync(output + '.json', JSON.stringify(prepared, null, 2) + '\n', {
    flag: 'wx',
  })
  writeFileSync(output + '.sql', pilotCatalogSql(prepared, reviewerId), {
    flag: 'wx',
  })
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main()
  } catch (error) {
    process.stderr.write(error.message + '\n')
    process.exitCode = 1
  }
}
