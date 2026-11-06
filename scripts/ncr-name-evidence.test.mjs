import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'

import {
  buildPermittedEnrichment,
  humanChecklist,
} from './ncr-permitted-enrichment.mjs'
import { loadNcrResearch } from './ncr-quality-review.mjs'
import { loadNcrEnrichment } from './ncr-preview-server.mjs'
import { parseCsv } from './parking-open-data.mjs'

const directory = 'data/ncr-enrichment/2026-11-05'
const acquisition = join(directory, 'acquisition-42023326894')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const raw = (path) =>
  path.endsWith('.gz') ? gunzipSync(readFileSync(path)) : readFileSync(path)
const json = (path) => JSON.parse(raw(path).toString('utf8'))

test('versioned research and acquired source derivatives retain verified byte hashes', () => {
  const manifest = json(join(directory, 'review-manifest.json'))
  const sourceManifest = json(
    join(acquisition, 'derivatives/osm-source-manifest.json'),
  )
  for (const [base, artifacts] of [
    [directory, manifest.artifacts],
    [join(acquisition, 'derivatives'), sourceManifest.artifacts],
  ]) {
    for (const artifact of artifacts) {
      const path = join(base, artifact.filename)
      assert.equal(sha(readFileSync(path)), artifact.sha256, path)
      if (artifact.uncompressedSha256)
        assert.equal(sha(raw(path)), artifact.uncompressedSha256, path)
    }
  }
  assert.equal(
    sha(readFileSync(sourceManifest.boundaryFile)),
    sourceManifest.boundarySha256,
  )
  const downloaded = json(join(acquisition, 'acquisition.json'))
  assert.equal(downloaded.publisherChecksumMatched, true)
  assert.equal(downloaded.sameBytesAsFrozenSnapshot, true)
  assert.equal(downloaded.bytes, 612751019)
  assert.equal(
    downloaded.sha256,
    json('data/ncr-research/osm-acquisition.json').sourceMetadata.inputSha256,
  )
  assert.equal(downloaded.md5, downloaded.publisherMd5.split(' ')[0])
  for (const probe of json(join(acquisition, 'probes/source-probes.json'))
    .probes) {
    if (probe.artifact)
      assert.equal(
        sha(raw(join(acquisition, 'probes', probe.artifact))),
        probe.sha256,
      )
  }
})

test('committed review reproduces all groups and counts without turning nearby labels into new names', () => {
  const research = loadNcrResearch()
  const before = JSON.stringify(research)
  const report = loadNcrEnrichment(
    join(directory, 'name-enrichment.json.gz'),
    research,
  )
  const rebuilt = buildPermittedEnrichment(research, {
    refreshedOsm: json(
      join(acquisition, 'derivatives/ncr-osm-parking.geojson.gz'),
    ),
    contextOsm: json(
      join(acquisition, 'derivatives/ncr-name-context.geojson.gz'),
    ),
    osmUpdates: json(join(directory, 'current-osm-updates.geojson.gz')),
  })
  assert.deepEqual(report.records, rebuilt.records)
  assert.deepEqual(report.totals, rebuilt.totals)
  assert.equal(report.totals.facilityGroups, 3744)
  assert.equal(report.totals.unnamedBefore, 3112)
  assert.equal(report.totals.unnamedAfter, 3112)
  assert.equal(report.totals.unnamedBreakdown.withUnusedNameTagLead, 0)
  assert.equal(report.totals.unnamedBreakdown.credibleNameProposals, 0)
  assert.equal(report.totals.unnamedBreakdown.withNearbyParkingLead, 56)
  assert.equal(
    report.totals.unnamedBreakdown.withIndependentNearbyParkingLead,
    41,
  )
  assert.equal(report.totals.unnamedBreakdown.withNamedPropertyContext, 1833)
  assert.equal(report.totals.identityConflicts, 19)
  assert.equal(JSON.stringify(research), before)
  assert.equal(report.totals.approvedForPublication, 0)
  assert.ok(
    report.records.every(
      (r) =>
        !r.physicalVerified &&
        !r.visitorAccessConfirmed &&
        !r.publicationApproved,
    ),
  )
})

test('every unresolved group has a complete pending human checklist and spreadsheet task', () => {
  const report = json(join(directory, 'name-enrichment.json.gz'))
  const tasks = parseCsv(
    raw(join(directory, 'name-review-queue.csv.gz')).toString('utf8'),
  )
  assert.equal(tasks.length, 3744)
  const ids = new Set(tasks.map((t) => t.groupId))
  assert.equal(ids.size, 3744)
  for (const task of tasks) {
    assert.ok(task.sourceCoordinates)
    assert.ok(task.candidateIds)
    assert.match(
      task.googleMaps,
      /https:\/\/www.google.com\/maps\/search\/\?api=1&query=/,
    )
    assert.match(task.waze, /https:\/\/www.waze.com\/ul\?ll=/)
    assert.match(task.evidenceLinks, /https:\/\//)
    assert.match(task.onSiteChecks, /visitor eligibility/)
    assert.match(task.onSiteChecks, /publication approval/)
    assert.ok(task.uncertainties)
    assert.equal(
      task.disposition,
      'pending_human_or_authorized_operator_review',
    )
  }
  assert.equal(
    raw(join(directory, 'human-inspection-checklist.md.gz')).toString('utf8'),
    humanChecklist(report),
  )
})
