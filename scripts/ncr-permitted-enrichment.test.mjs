import assert from 'node:assert/strict'
import test from 'node:test'
import process from 'node:process'

import { buildPermittedEnrichment } from './ncr-permitted-enrichment.mjs'
import { loadNcrResearch } from './ncr-quality-review.mjs'

const osm = (id, name, point = [121.03, 14.56], tags = {}) => ({
  id: 'osm:way/' + id + ':Polygon',
  sourceKind: 'osm',
  name,
  representativePoint: point,
  sourceTags: tags,
  sourceRecordUrl: 'https://www.openstreetmap.org/way/' + id,
  sourceLicense: 'ODbL-1.0',
  sourceProviders: [
    { dataset: 'OpenStreetMap', record_id: 'way/' + id, license: 'ODbL-1.0' },
  ],
  geometry: { type: 'Point', coordinates: point },
  type: 'lot',
})
const record = (id, name, point, tags) => osm(id, name, point, tags)
const data = () => ({
  schemaVersion: 1,
  sourceHashes: { osm: 'fixture' },
  sourceAsOf: '2026-11-05T00:00:00Z',
  candidates: [
    record(11, 'Unnamed parking facility', [121.03, 14.56], {
      official_name: 'Station Garage',
      operator: 'Station Property Group',
    }),
    record(12, 'Unnamed parking facility', [121.031, 14.56]),
    record(13, 'Unnamed parking facility', [121.035, 14.56]),
    record(14, 'Riverside Parking', [121.04, 14.56]),
  ],
  facilityGroups: [11, 12, 13, 14].map((id) => ({
    id: 'group:' + id,
    sourceCandidateIds: ['osm:way/' + id + ':Polygon'],
    maximumLocationSpreadMeters: 0,
    flags: [],
  })),
})
const feature = (id, name, props, geometry) => ({
  type: 'Feature',
  properties: { '@type': 'way', '@id': id, name, ...props },
  geometry,
})
const context = () => ({
  type: 'FeatureCollection',
  features: [
    feature(
      600,
      'Shopping Centre North',
      { shop: 'mall' },
      {
        type: 'Polygon',
        coordinates: [
          [
            [121.0308, 14.5598],
            [121.0312, 14.5598],
            [121.0312, 14.5602],
            [121.0308, 14.5602],
            [121.0308, 14.5598],
          ],
        ],
      },
    ),
    feature(
      601,
      'Distant Hotel',
      { tourism: 'hotel' },
      { type: 'Point', coordinates: [121.2, 14.7] },
    ),
  ],
})
const updated = () => ({
  type: 'FeatureCollection',
  features: [
    feature(
      13,
      'South Covered Parking',
      { amenity: 'parking' },
      { type: 'Point', coordinates: [121.035, 14.56] },
    ),
  ],
})
test('source name tags, operator clues and same-identity OSM refresh are distinct from verified names', () => {
  const report = buildPermittedEnrichment(data(), {
    contextOsm: context(),
    refreshedOsm: updated(),
  })
  assert.equal(report.records.length, 4)
  const byId = new Map(report.records.map((r) => [r.groupId, r]))
  const first = byId.get('group:11')
  assert.equal(first.priority, 'name_tag_or_refresh_lead')
  assert.equal(first.nameTagLeads[0].name, 'Station Garage')
  assert.equal(first.operatorClues[0].name, 'Station Property Group')
  assert.equal(first.operatorClues[0].usableAsFacilityName, false)
  const second = byId.get('group:12')
  assert.equal(second.priority, 'property_context_only')
  assert.equal(second.contextClues[0].name, 'Shopping Centre North')
  assert.equal(second.contextClues[0].usableAsParkingName, false)
  assert.equal(second.approvedDisplayName, null)
  const third = byId.get('group:13')
  assert.equal(third.nameTagLeads[0].name, 'South Covered Parking')
  assert.equal(third.nameTagLeads[0].basis, 'same_osm_identity_new_snapshot')
  assert.ok(
    report.records.every((r) => !r.publicationApproved && !r.nameConfirmed),
  )
  assert.equal(report.totals.approvedForPublication, 0)
  assert.match(first.reviewLinks[0].googleMaps, /www.google.com\/maps\/search/)
  assert.match(first.reviewLinks[0].waze, /www.waze.com\/ul/)
})
test('property overlap never automatically creates a parking name', () => {
  const report = buildPermittedEnrichment(data(), { contextOsm: context() })
  const group = report.records.find((x) => x.groupId === 'group:12')
  assert.equal(
    group.contextClues[0].relation,
    'parking_anchor_inside_named_property',
  )
  assert.equal(group.originalSourceName, null)
  assert.equal(group.approvedDisplayName, null)
  assert.equal(group.nameTagLeads.length, 0)
  assert.equal(group.nameConfirmed, false)
})
test('Google/Waze-derived context and refresh records are rejected instead of ingested', () => {
  const c = context()
  c.features[0].properties.source = 'Google Maps'
  assert.throws(
    () => buildPermittedEnrichment(data(), { contextOsm: c }),
    /Unsupported Google/,
  )
  const u = updated()
  u.features[0].properties['source:name'] = 'Waze'
  assert.throws(
    () => buildPermittedEnrichment(data(), { refreshedOsm: u }),
    /Unsupported Google/,
  )
})
test('OSM refresh requires stable identity and rejects conflicting source records', () => {
  const r = updated()
  delete r.features[0].properties['@id']
  assert.throws(
    () => buildPermittedEnrichment(data(), { refreshedOsm: r }),
    /stable/,
  )
  const duplicate = updated()
  duplicate.features.push(
    feature(
      13,
      'Another name',
      { amenity: 'parking' },
      { type: 'Point', coordinates: [121.035, 14.56] },
    ),
  )
  assert.throws(
    () => buildPermittedEnrichment(data(), { refreshedOsm: duplicate }),
    /Contradictory/,
  )
})
test('no additional evidence keeps original 4-name status and never removes source records', () => {
  const original = data(),
    copy = JSON.stringify(original)
  const r = buildPermittedEnrichment(original)
  assert.equal(r.records.length, 4)
  assert.equal(JSON.stringify(original), copy)
  assert.ok(r.records.some((x) => x.priority === 'no_reusable_name_lead'))
  assert.equal(r.totals.approvedForPublication, 0)
})
test('all 3,744 actual facility groups produce an untouched publication-denied research queue', () => {
  const research = loadNcrResearch()
  const result = buildPermittedEnrichment(research)
  assert.equal(result.totals.facilityGroups, 3744)
  assert.equal(result.totals.unnamedBreakdown.groups, 3112)
  assert.equal(result.totals.unnamedBreakdown.withNamedPropertyContext, 0)
  assert.equal(result.baseNameTotals.unnamed_pending_reference, 3112)
  assert.ok(result.records.every((r) => r.publicationApproved === false))
  assert.ok(result.records.every((r) => r.approvedDisplayName === null))
  process.stdout.write(
    'NCR permitted name clues: ' + JSON.stringify(result.totals) + '\n',
  )
})
