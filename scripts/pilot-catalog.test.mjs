import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { contentHash } from './ncr-publication.mjs'
import {
  PILOT_CITIES,
  PILOT_SCOPE_VERSION,
  loadPilotGeography,
  preparePilotCatalog,
  pilotCatalogSql,
} from './pilot-catalog.mjs'

const reviewer = 'b5100000-0000-4000-8000-000000000001'
const records = [
  [
    'Manila',
    'osm:node/11729826407:Point',
    'facility_unspecified',
    'osm:node/11729816009',
  ],
  [
    'Mandaluyong',
    'osm:way/1306648012:MultiPolygon',
    'lot',
    'osm:node/746487765',
  ],
]

test('pilot geography is versioned real geometry from the retained licensed 17-LGU snapshot', () => {
  const retained = loadPilotGeography()
  const pilot = JSON.parse(readFileSync('data/pilot-geography.v1.json', 'utf8'))
  assert.equal(retained.boundaries.size, 17)
  assert.equal(pilot.scopeVersion, PILOT_SCOPE_VERSION)
  assert.deepEqual(pilot.allowedCities, PILOT_CITIES)
  assert.equal(pilot.features.length, 2)
  assert.equal(pilot.source.sha256, retained.sourceHash)
  for (const city of PILOT_CITIES)
    assert.deepEqual(
      pilot.features.find((feature) => feature.properties.lgu === city)
        .geometry,
      retained.boundaries.get(city),
    )
})

test('explicit private pilot import preserves real source identities, classifications and frozen destination context', () => {
  for (const [city, id, type, destinationId] of records) {
    const prepared = preparePilotCatalog({
      kind: 'candidates',
      city,
      ids: [id],
    })
    const packageValue = JSON.parse(prepared.packageText)
    assert.equal(packageValue.scopeVersion, PILOT_SCOPE_VERSION)
    assert.equal(packageValue.records.length, 1)
    const record = packageValue.records[0]
    const source = JSON.parse(record.recordText)
    assert.equal(source.id, id)
    assert.equal(source.type, type)
    assert.equal(source.name, 'Unnamed parking facility')
    assert.equal(record.recordHash, contentHash(source))
    assert.equal(
      JSON.parse(record.contextText)[0].destinationReview.label.sourceId,
      destinationId,
    )
    const sql = pilotCatalogSql(prepared, reviewer)
    assert.match(sql, /import_pilot_catalog/)
    assert.doesNotMatch(
      sql,
      /moderate_pilot_destination|decide_discovery_evidence|update.*pilot_city_config/i,
    )
    assert.throws(
      () =>
        pilotCatalogSql(
          { ...prepared, packageText: prepared.packageText + ' ' },
          reviewer,
        ),
      /bytes changed/,
    )
  }
})

test('bounded IDs and exact city scope prevent bulk imports and cross-city source reassignment', () => {
  const base = { kind: 'candidates', city: 'Manila' }
  for (const ids of [
    [],
    Array.from({ length: 51 }, (_, i) => String(i)),
    ['duplicate', 'duplicate'],
  ])
    assert.throws(
      () => preparePilotCatalog({ ...base, ids }),
      /unique explicit original source IDs/,
    )
  assert.throws(
    () =>
      preparePilotCatalog({ ...base, city: 'Makati', ids: [records[0][1]] }),
    /pilot city/,
  )
  assert.throws(
    () => preparePilotCatalog({ ...base, ids: [records[1][1]] }),
    /outside or crosses/,
  )
})

test('independent destination imports preserve source identity and grant no parking or publication rights', () => {
  const prepared = preparePilotCatalog({
    kind: 'destinations',
    city: 'Manila',
    ids: [records[0][3]],
  })
  const value = JSON.parse(prepared.packageText)
  const source = JSON.parse(value.records[0].recordText)
  assert.equal(source.id, 'osm:node/11729816009')
  assert.equal(source.sourceLicense, 'ODbL-1.0')
  assert.equal(
    source.sourceRecordUrl,
    'https://www.openstreetmap.org/node/11729816009',
  )
  assert.equal(source.publicationApproved, undefined)
  assert.equal(source.navigationApproval, undefined)
  assert.deepEqual(JSON.parse(value.records[0].contextText), [])
})
