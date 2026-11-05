import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import process from 'node:process'
import { gunzipSync } from 'node:zlib'
import { buildNcrResearch } from './ncr-parking-research.mjs'
import { buildCoverage } from './ncr-coverage.mjs'

const directory = process.argv[2] || 'data/ncr-research'
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const manifest = JSON.parse(
  readFileSync(join(directory, 'manifest.json'), 'utf8'),
)
const inputs = new Map()
for (const artifact of manifest.artifacts) {
  assert.equal(
    artifact.filename,
    basename(artifact.filename),
    'Archive filenames must remain inside the package',
  )
  const bytes = readFileSync(join(directory, artifact.filename))
  assert.equal(bytes.length, artifact.bytes)
  assert.equal(hash(bytes), artifact.sha256, artifact.filename)
  const raw = gunzipSync(bytes)
  assert.equal(raw.length, artifact.uncompressedBytes)
  assert.equal(hash(raw), artifact.uncompressedSha256, artifact.filename)
  if (artifact.role !== 'research')
    assert.equal(hash(raw), manifest.sourceHashes[artifact.role])
  inputs.set(artifact.role, JSON.parse(raw.toString('utf8')))
}
for (const role of ['research', 'boundaries', 'osm', 'overture'])
  assert.ok(inputs.has(role), role)
const research = inputs.get('research')
assert.deepEqual(research.counts, manifest.counts)
assert.equal(research.candidates.length, research.counts.insideNcr)
assert.equal(
  new Set(research.candidates.map((c) => c.id)).size,
  research.candidates.length,
)
assert.ok(
  research.candidates.every(
    (c) => c.verification === 'unverified' && c.publicationApproved === false,
  ),
)
const coverage = JSON.parse(
  readFileSync(join(directory, 'coverage.json'), 'utf8'),
)
assert.equal(
  coverage.grid.cells.reduce((sum, c) => sum + c.mappedEntities, 0),
  research.candidates.length,
)
assert.deepEqual(coverage.sourceHashes, research.sourceHashes)
assert.equal(Object.keys(coverage.perLgu).length, 17)
const preservation = readFileSync(
  join(directory, 'poblacion-preservation.json'),
)
assert.equal(hash(preservation), research.sourceHashes.reviews)
assert.deepEqual(
  buildNcrResearch({
    boundaryGeojson: inputs.get('boundaries'),
    osmGeojson: inputs.get('osm'),
    overtureGeojson: inputs.get('overture'),
    priorReviews: JSON.parse(preservation.toString('utf8')),
    asOf: research.sourceAsOf,
    inputHashes: research.sourceHashes,
  }),
  research,
  'Frozen research must reproduce from the archived sources and decisions',
)
assert.deepEqual(
  buildCoverage(research, inputs.get('boundaries')),
  coverage,
  'Frozen coverage must reproduce from the archived research and geography',
)
const licenses = JSON.parse(
  readFileSync(join(directory, 'licenses', 'sources.json'), 'utf8'),
)
for (const license of licenses.files) {
  assert.equal(license.file, basename(license.file))
  const bytes = readFileSync(join(directory, 'licenses', license.file))
  assert.equal(hash(bytes), license.sha256, license.file)
  assert.equal(bytes.length, license.bytes)
}
process.stdout.write(
  JSON.stringify({
    archives: inputs.size,
    candidates: research.candidates.length,
    gridConservesObservations: true,
    physicallyVerified: research.counts.physicallyVerified,
    publicationApproved: research.counts.publicationApproved,
  }) + '\n',
)
