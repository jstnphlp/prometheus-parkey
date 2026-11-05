import assert from 'node:assert/strict'
import test from 'node:test'
import process from 'node:process'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

import { chooseNearbyDestinationLabel } from './ncr-destination-labels.mjs'
import { loadNcrResearch } from './ncr-quality-review.mjs'

const member = (extra = {}) => ({
  type: 'lot',
  name: 'Unnamed parking facility',
  flags: [],
  restrictedAccess: false,
  publicationApproved: false,
  operatingStatus: 'unknown',
  ...extra,
})
const clue = (
  name,
  placeKind,
  distance = 36,
  relation = 'nearby_named_property_only',
) => ({
  name,
  placeKind,
  approximateMeters: distance,
  relation,
  sourceId: 'osm:way/123',
  sourceLicense: 'ODbL-1.0',
  sourceRecordUrl: 'https://www.openstreetmap.org/way/123',
  usableAsParkingName: false,
})
const evidence = (clues, classification = 'nearby_named_property_only') => ({
  classification,
  contextClues: clues,
})
test('destination phrase is useful, attributed, and explicitly NOT a facility name', () => {
  const d = chooseNearbyDestinationLabel(
    member(),
    evidence([clue('The Corner Restaurant', 'amenity:restaurant')]),
    { privatePreview: true },
  )
  assert.equal(d.label, 'Parking near The Corner Restaurant')
  assert.equal(d.status, 'research_context_only')
  assert.equal(d.parkingNameConfirmed, false)
  assert.equal(d.visitorAccessConfirmed, false)
  assert.equal(d.navigationEntranceConfirmed, false)
  assert.equal(d.publicationApproved, false)
  assert.equal(d.approximateStraightLineMeters, 36)
})
test('prioritizes major travel destinations over generic nearby offices', () => {
  const d = chooseNearbyDestinationLabel(
    member(),
    evidence([
      clue('Some Office Building', 'building:office', 10),
      clue('National Museum', 'tourism:museum', 58),
    ]),
    { privatePreview: true },
  )
  assert.equal(d.destination, 'National Museum')
})
test('nearest is not automatically the best, but distant places cannot label a lot', () => {
  const d = chooseNearbyDestinationLabel(
    member(),
    evidence([
      clue('Far Restaurant', 'amenity:restaurant', 220),
      clue('Close Mall', 'shop:mall', 75),
    ]),
    { privatePreview: true },
  )
  assert.equal(d.destination, 'Close Mall')
  assert.equal(
    chooseNearbyDestinationLabel(
      member(),
      evidence([clue('Distant Mall', 'shop:mall', 280)]),
      { privatePreview: true },
    ),
    null,
  )
})
test('restricted, closed, unsuitable, published, named, and non-facility records never receive a label', () => {
  const e = evidence([clue('Famous Mall', 'shop:mall')])
  for (const m of [
    member({ restrictedAccess: true }),
    member({ operatingStatus: 'disused' }),
    member({ flags: ['mapped_closed_or_disused'] }),
    member({ flags: ['prior_human_exclusion_requires_resolution'] }),
    member({ publicationApproved: true }),
    member({ name: 'Authorized Garage' }),
    member({ type: 'street_segment' }),
    member({ type: 'entrance' }),
    member({ type: 'space' }),
  ])
    assert.equal(
      chooseNearbyDestinationLabel(m, e, { privatePreview: true }),
      null,
    )
  assert.equal(chooseNearbyDestinationLabel(member(), e), null)
  assert.equal(
    chooseNearbyDestinationLabel(
      member(),
      evidence(e.contextClues, 'unsuitable_for_public_discovery'),
      { privatePreview: true },
    ),
    null,
  )
})
test('unknown or non-ODbL origin, misleading generic names and invalid distances fail closed', () => {
  const base = clue('Restaurant One', 'amenity:restaurant')
  for (const bad of [
    { ...base, sourceLicense: 'unknown' },
    { ...base, sourceRecordUrl: 'https://maps.google.com/place/x' },
    { ...base, sourceId: 'overture:abc' },
    { ...base, name: 'Unnamed' },
    { ...base, approximateMeters: -1 },
    { ...base, approximateMeters: NaN },
    { ...base, placeKind: 'building:apartments' },
  ])
    assert.equal(
      chooseNearbyDestinationLabel(member(), evidence([bad]), {
        privatePreview: true,
      }),
      null,
    )
})
// The committed research report remains immutable; descriptors are computed at query time.
test('frozen NCR research can use existing named-property clues without changing any stored names', () => {
  const research = loadNcrResearch()
  const bytes = readFileSync(
    'data/ncr-enrichment/2026-11-05/name-enrichment.json.gz',
  )
  const report = JSON.parse(gunzipSync(bytes).toString('utf8'))
  const lookup = new Map(research.candidates.map((x) => [x.id, x]))
  const result = report.records.flatMap((r) =>
    r.candidateIds
      .map((id) =>
        chooseNearbyDestinationLabel(lookup.get(id), r, {
          privatePreview: true,
        }),
      )
      .filter(Boolean),
  )
  assert.ok(
    result.length > 0,
    'existing reusable property clues should yield contextual labels',
  )
  process.stdout.write(
    'Private NCR nearby-destination descriptors: ' + result.length + '\n',
  )
  assert.ok(
    result.every((x) => !x.parkingNameConfirmed && !x.publicationApproved),
  )
  assert.equal(report.totals.unnamedAfter, 3112)
})
