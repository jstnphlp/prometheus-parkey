import assert from 'node:assert/strict'
import test from 'node:test'
import process from 'node:process'

import {
  buildPermittedEnrichment,
  humanChecklist,
  prioritizedRecords,
} from './ncr-permitted-enrichment.mjs'
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

test('same OSM ID must still be a parking facility; generic name does not mask the actual evidence field', () => {
  const update = updated()
  update.features[0].properties = {
    '@type': 'way',
    '@id': 13,
    name: 'South School',
    amenity: 'school',
  }
  assert.equal(
    buildPermittedEnrichment(data(), { refreshedOsm: update }).records.find(
      (r) => r.groupId === 'group:13',
    ).nameTagLeads.length,
    0,
  )
  update.features[0].properties = {
    '@type': 'way',
    '@id': 13,
    name: 'Parking',
    official_name: 'South Covered Parking',
    amenity: 'parking',
  }
  const result = buildPermittedEnrichment(data(), { refreshedOsm: update })
  const third = result.records.find((r) => r.groupId === 'group:13')
  assert.equal(third.nameTagLeads[0].sourceField, 'official_name')
  assert.equal(third.classification, 'credible_reusable_name_pending_review')
  assert.equal(result.totals.unnamedBreakdown.credibleNameProposals, 2)
  assert.equal(result.totals.unnamedBefore, result.totals.unnamedAfter)
})

test('source restrictions, closure and location conflicts override a same-ID name proposal', () => {
  for (const props of [{ access: 'private' }, { disused: 'yes' }]) {
    const update = updated()
    Object.assign(update.features[0].properties, props)
    const third = buildPermittedEnrichment(data(), {
      refreshedOsm: update,
    }).records.find((r) => r.groupId === 'group:13')
    assert.equal(third.classification, 'unsuitable_for_public_discovery')
    assert.equal(third.proposedName, null)
  }
  const update = updated()
  update.features[0].geometry.coordinates = [121.2, 14.7]
  const third = buildPermittedEnrichment(data(), {
    refreshedOsm: update,
  }).records.find((r) => r.groupId === 'group:13')
  assert.equal(third.identityConflict, true)
  assert.equal(third.classification, 'proposed_name_incomplete_or_conflicting')
  assert.equal(third.proposedName, null)
})

test('a large property footprint remains context when its center is far from parking', () => {
  const c = context()
  c.features[0].geometry.coordinates = [
    [
      [121.029, 14.559],
      [121.05, 14.559],
      [121.05, 14.58],
      [121.029, 14.58],
      [121.029, 14.559],
    ],
  ]
  const result = buildPermittedEnrichment(data(), { contextOsm: c })
  const third = result.records.find((r) => r.groupId === 'group:13')
  assert.equal(
    third.contextClues[0].relation,
    'parking_anchor_inside_named_property',
  )
  assert.ok(third.contextClues[0].approximateMeters > 200)
  assert.equal(third.classification, 'nearby_named_property_only')
  assert.equal(third.proposedName, null)
})

test('licensed independent nearby parking never becomes the unnamed facility identity', () => {
  const original = data()
  const overture = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [121.0351, 14.56] },
        properties: {
          id: 'external-1',
          names: { primary: 'Named External Garage' },
          categories: { primary: 'parking' },
          sources: [
            {
              dataset: 'Foursquare',
              record_id: 'fsq:1',
              license: 'Apache-2.0',
            },
          ],
        },
      },
    ],
  }
  const report = buildPermittedEnrichment(original, {
    refreshedOverture: overture,
  })
  const third = report.records.find((r) => r.groupId === 'group:13')
  assert.equal(third.nearbyParkingLeads[0].sourceIndependent, true)
  assert.equal(third.classification, 'proposed_name_incomplete_or_conflicting')
  assert.equal(third.proposedName, null)
  assert.equal(third.nameTagLeads.length, 0)
  assert.equal(report.totals.unnamedBreakdown.credibleNameProposals, 1)
  overture.features[0].properties.sources[0].license = 'unknown'
  assert.equal(
    buildPermittedEnrichment(original, {
      refreshedOverture: overture,
    }).records.find((r) => r.groupId === 'group:13').nearbyParkingLeads.length,
    0,
  )
})

test('tasks retain every source coordinate and require actual pending identity/access observations', () => {
  const original = data(),
    before = JSON.stringify(original)
  original.candidates[0].accessClass = 'private'
  original.candidates[0].priorHumanReview = {
    reviewStatus: 'excluded_pending_reason',
  }
  const report = buildPermittedEnrichment(original, { contextOsm: context() })
  const checklist = humanChecklist(report)
  for (const r of report.records) {
    assert.ok(checklist.includes(r.groupId))
    assert.ok(checklist.includes(r.reviewLinks[0].googleMaps))
    assert.ok(checklist.includes(r.reviewLinks[0].waze))
    assert.ok(checklist.includes(r.reviewLinks[0].sourceRecordUrl))
    assert.ok(r.onSiteChecks.some((s) => /visitor eligibility/.test(s)))
    assert.ok(r.onSiteChecks.some((s) => /publication approval/.test(s)))
    assert.equal(r.physicalVerified, false)
  }
  const ordered = prioritizedRecords(report)
  assert.equal(ordered.at(-1).accessPriority, 'restricted_or_unsuitable')
  assert.ok(ordered.at(-1).onSiteChecks.some((s) => /prior Poblacion/.test(s)))
  assert.equal(JSON.stringify(data()), before)
})

test('Overture closure and same-ID source relocation apply even without a name change', () => {
  const original = data()
  original.candidates[3] = {
    ...original.candidates[3],
    id: 'overture:stable',
    sourceKind: 'overture',
    sourceProviders: [
      { dataset: 'Foursquare', record_id: 'stable', license: 'Apache-2.0' },
    ],
    sourceLicense: 'Apache-2.0',
  }
  original.facilityGroups[3].sourceCandidateIds = ['overture:stable']
  const refresh = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [121.04, 14.56] },
        properties: {
          id: 'stable',
          names: { primary: 'Riverside Parking' },
          categories: { primary: 'parking' },
          operating_status: 'permanently_closed',
          sources: original.candidates[3].sourceProviders,
        },
      },
    ],
  }
  const closed = buildPermittedEnrichment(original, {
    refreshedOverture: refresh,
  }).records.find((r) => r.groupId === 'group:14')
  assert.equal(closed.classification, 'unsuitable_for_public_discovery')
  assert.equal(closed.proposedName, null)
  assert.deepEqual(closed.unsuitableSourceIds, ['overture:stable'])
  const update = updated()
  update.features[0].properties['@id'] = 14
  update.features[0].properties.name = 'Riverside Parking'
  update.features[0].geometry.coordinates = [121.2, 14.7]
  const moved = buildPermittedEnrichment(data(), {
    refreshedOsm: update,
  }).records.find((r) => r.groupId === 'group:14')
  assert.equal(moved.nameTagLeads.length, 0)
  assert.equal(moved.identityConflict, true)
  assert.equal(moved.proposedName, null)
})

test('dated OSM audit overlays older same-ID names but cannot regress to an older revision', () => {
  const refresh = updated()
  refresh.features[0].properties['@timestamp'] = '2026-11-03T00:00:00Z'
  const audit = updated()
  audit.features[0].properties.name = 'Revised South Parking'
  audit.features[0].properties['@timestamp'] = '2026-11-04T00:00:00Z'
  const get = () =>
    buildPermittedEnrichment(data(), {
      refreshedOsm: refresh,
      osmUpdates: audit,
    }).records.find((r) => r.groupId === 'group:13')
  assert.equal(get().proposedName, 'Revised South Parking')
  audit.features[0].properties['@timestamp'] = '2026-11-02T00:00:00Z'
  assert.equal(get().proposedName, 'South Covered Parking')
  delete audit.features[0].properties['@timestamp']
  assert.throws(get, /edit timestamp/)
})

test('unsupported Overture origins and contradictory same-ID records fail before output', () => {
  const refresh = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [121.035, 14.56] },
        properties: {
          id: 'external-1',
          names: { primary: 'External Garage' },
          categories: { primary: 'parking' },
          sources: [
            {
              dataset: 'Google',
              record_id: 'forbidden',
              license: 'Apache-2.0',
            },
          ],
        },
      },
    ],
  }
  assert.throws(
    () => buildPermittedEnrichment(data(), { refreshedOverture: refresh }),
    /Google\/Waze/,
  )
  refresh.features[0].properties.sources[0].dataset = 'Foursquare'
  refresh.features.push({
    ...refresh.features[0],
    properties: {
      ...refresh.features[0].properties,
      names: { primary: 'Conflicting Garage' },
    },
  })
  assert.throws(
    () => buildPermittedEnrichment(data(), { refreshedOverture: refresh }),
    /Contradictory Overture/,
  )
})

test('same-ID line geometry retains its existing source anchor without a false conflict', () => {
  const original = data()
  original.candidates[3].geometry = {
    type: 'LineString',
    coordinates: [
      [121.039, 14.56],
      [121.041, 14.56],
    ],
  }
  const refresh = updated()
  refresh.features[0] = {
    ...refresh.features[0],
    properties: {
      '@type': 'way',
      '@id': 14,
      amenity: 'parking',
      name: 'Riverside Parking',
    },
    geometry: original.candidates[3].geometry,
  }
  const last = buildPermittedEnrichment(original, {
    refreshedOsm: refresh,
  }).records.find((r) => r.groupId === 'group:14')
  assert.equal(last.identityConflict, false)
  assert.equal(last.proposedName, 'Riverside Parking')
})
