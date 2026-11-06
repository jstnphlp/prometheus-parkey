import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import process from 'node:process'
import { gzipSync, gunzipSync } from 'node:zlib'

const args = process.argv.slice(2)
if (args.length !== 5)
  throw new Error(
    'Usage: node scripts/package-ncr-research.mjs RESEARCH_JSON BOUNDARIES_GEOJSON OSM_GEOJSON OVERTURE_GEOJSON OUTPUT_DIRECTORY',
  )
const [researchPath, boundariesPath, osmPath, overturePath, outputDirectory] =
  args
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const research = JSON.parse(readFileSync(researchPath, 'utf8'))
if (
  research.candidates.some(
    (c) => c.publicationApproved !== false || c.verification !== 'unverified',
  )
)
  throw new Error(
    'Packaging requires research-only, unverified source observations.',
  )
mkdirSync(outputDirectory, { recursive: true })
const artifacts = []
for (const [role, path] of [
  ['research', researchPath],
  ['boundaries', boundariesPath],
  ['osm', osmPath],
  ['overture', overturePath],
]) {
  const bytes = readFileSync(path)
  if (role !== 'research' && hash(bytes) !== research.sourceHashes[role])
    throw new Error('Source hash mismatch: ' + role)
  const compressed = gzipSync(bytes, { level: 9 })
  if (hash(gunzipSync(compressed)) !== hash(bytes))
    throw new Error('Archive integrity failure.')
  const filename = basename(path) + '.gz'
  writeFileSync(join(outputDirectory, filename), compressed, { flag: 'wx' })
  artifacts.push({
    role,
    filename,
    bytes: compressed.length,
    sha256: hash(compressed),
    uncompressedBytes: bytes.length,
    uncompressedSha256: hash(bytes),
  })
}
const manifest = {
  schemaVersion: 1,
  asOf: research.sourceAsOf,
  policy:
    'Offline research database; source licenses and notices in licenses/ apply. No app display approval, public-access guarantee, physical verification, or vacancy claim. Existing owner decisions remain separate from source observations.',
  sourceHashes: research.sourceHashes,
  sourceMetadata: research.sourceMetadata,
  counts: research.counts,
  priorReviewSummary: research.priorReviewSummary,
  artifacts,
}
writeFileSync(
  join(outputDirectory, 'manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
  { flag: 'wx' },
)
process.stdout.write(
  JSON.stringify({ artifacts, counts: research.counts }, null, 2) + '\n',
)
