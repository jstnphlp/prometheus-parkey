import assert from 'node:assert/strict'
import test from 'node:test'
import process from 'node:process'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

import {
  chooseNearbyDestinationLabel,
  destinationDistanceMeters,
  reviewNearbyDestinations,
} from './ncr-destination-labels.mjs'
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
const clueIdentity = (name) =>
  1 +
  [...name].reduce(
    (hash, char) => (hash * 31 + char.codePointAt(0)) % 100000000,
    0,
  )
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
  sourceId: 'osm:way/' + clueIdentity(name),
  sourceLicense: 'ODbL-1.0',
  sourceRecordUrl: 'https://www.openstreetmap.org/way/' + clueIdentity(name),
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

const anchor = [121.03, 14.56]
const freshMember = (extra = {}) =>
  member({ id: 'parking:1', representativePoint: anchor, ...extra })
const freshClue = (name, kind, coordinate, extra = {}) => ({
  ...clue(name, kind),
  sourceCoordinate: coordinate,
  geometry: { type: 'Point', coordinates: coordinate },
  anchorCoordinate: anchor,
  parkingRecordId: 'parking:1',
  sourceRecordEditedAt: '2026-11-03T00:00:00Z',
  sourceVersion: 4,
  sourceSnapshotSha256: 'a'.repeat(64),
  sourceTags: {},
  ...extra,
})
const review = (clues, record = freshMember(), extra = {}) =>
  reviewNearbyDestinations(
    record,
    { ...evidence(clues), ...extra },
    { privatePreview: true },
  )

test('fresh geometry recomputes haversine distances instead of trusting supplied distance', () => {
  const coordinate = [121.0303, 14.56]
  const result = review([
    freshClue('Corner Cafe', 'amenity:cafe', coordinate, {
      approximateMeters: 0,
    }),
  ])
  assert.equal(result.outcome, 'described')
  assert.ok(
    result.label.approximateStraightLineMeters > 32 &&
      result.label.approximateStraightLineMeters < 33,
  )
  assert.equal(result.label.distanceBasis, 'source_geometry_anchor_haversine')
  assert.deepEqual(result.label.anchorCoordinate, anchor)
  assert.deepEqual(result.label.sourceCoordinate, coordinate)
  assert.equal(result.label.sourceRecordEditedAt, '2026-11-03T00:00:00Z')
  assert.equal(result.label.sourceVersion, 4)
  assert.equal(result.label.sourceSnapshotSha256, 'a'.repeat(64))
  assert.ok(
    Math.abs(destinationDistanceMeters([0, 0], [0, 1]) - 111194.9266) < 0.01,
  )
  assert.throws(
    () => destinationDistanceMeters(anchor, [500, 0]),
    /Invalid geographic anchor/,
  )
  assert.equal(
    review([
      freshClue('Remote Cafe', 'amenity:cafe', [121.04, 14.56], {
        approximateMeters: 0,
      }),
    ]).outcome,
    'no_suitable_destination',
  )
})

const square = (west, south, east, north) => [
  [west, south],
  [east, south],
  [east, north],
  [west, north],
  [west, south],
]
test('polygon containment checks holes and multipolygons instead of trusting relation text', () => {
  const outer = square(121.029, 14.559, 121.031, 14.561)
  const hole = square(121.0299, 14.5599, 121.0301, 14.5601)
  const destination = freshClue(
    'Metro Museum',
    'tourism:museum',
    [121.031, 14.56],
    {
      geometry: { type: 'MultiPolygon', coordinates: [[outer]] },
    },
  )
  const inside = review([destination])
  assert.equal(inside.outcome, 'described')
  assert.equal(inside.label.insideSourcePropertyFootprint, true)
  const withHole = review([
    {
      ...destination,
      geometry: { type: 'Polygon', coordinates: [outer, hole] },
      relation: 'parking_anchor_inside_named_property',
    },
  ])
  assert.equal(withHole.outcome, 'no_suitable_destination')
})

test('proximity can favor a close restaurant over a farther mall while keeping alternatives', () => {
  const result = review([
    freshClue('Regional Mall', 'shop:mall', [121.031, 14.56]),
    freshClue('Corner Restaurant', 'amenity:restaurant', [121.0301, 14.56]),
  ])
  assert.equal(result.outcome, 'described')
  assert.equal(result.label.destination, 'Corner Restaurant')
  assert.equal(result.alternatives.length, 2)
  assert.ok(
    result.label.scoreComponents.proximity >
      result.alternatives[1].scoreComponents.proximity,
  )
})

test('equally plausible destinations remain ambiguous independently of input order', () => {
  const clues = [
    freshClue('Cafe North', 'amenity:cafe', [121.0302, 14.56]),
    freshClue('Cafe South', 'amenity:cafe', [121.0298, 14.56]),
  ]
  const result = review(clues)
  assert.equal(result.outcome, 'ambiguous')
  assert.equal(result.label, null)
  assert.equal(result.alternatives.length, 2)
  assert.deepEqual(result, review([...clues].reverse()))
})

test('same destination node and polygon are deduplicated but distinct branches remain alternatives', () => {
  const one = freshClue('Community Mall', 'shop:mall', [121.0302, 14.56])
  const two = {
    ...one,
    sourceId: 'osm:way/987654321',
    sourceRecordUrl: 'https://www.openstreetmap.org/way/987654321',
    geometry: {
      type: 'Polygon',
      coordinates: [square(121.029, 14.559, 121.031, 14.561)],
    },
  }
  const duplicate = review([one, two])
  assert.equal(duplicate.outcome, 'described')
  assert.equal(duplicate.alternatives.length, 1)
  assert.equal(duplicate.label.duplicateSourceIds.length, 2)
  const distantBranches = review([
    freshClue('Coffee Chain', 'amenity:cafe', [121.03025, 14.56]),
    {
      ...freshClue('Coffee Chain', 'amenity:cafe', [121.02975, 14.56]),
      sourceId: 'osm:node/9999999',
      sourceRecordUrl: 'https://www.openstreetmap.org/node/9999999',
    },
  ])
  assert.equal(distantBranches.outcome, 'ambiguous')
  assert.equal(distantBranches.alternatives.length, 2)
})

test('restricted parking, restricted or closed destinations and refreshed group exclusions fail closed', () => {
  const destination = freshClue(
    'Visitor Museum',
    'tourism:museum',
    [121.0302, 14.56],
  )
  for (const accessClass of [
    'private',
    'no',
    'permit',
    'residents',
    'military',
    'members',
  ])
    assert.equal(
      review([destination], freshMember({ accessClass })).outcome,
      'restricted_or_unsuitable',
    )
  for (const sourceTags of [
    { access: 'private' },
    { 'disused:amenity': 'restaurant' },
    { opening_hours: 'closed' },
    { source: 'Google Maps' },
  ])
    assert.equal(
      review([{ ...destination, sourceTags }]).outcome,
      'no_suitable_destination',
    )
  assert.equal(
    review([destination], freshMember(), {
      unsuitableSourceIds: ['other:group-member'],
    }).outcome,
    'restricted_or_unsuitable',
  )
  assert.equal(
    review([destination], freshMember(), { identityConflict: true }).outcome,
    'ambiguous',
  )
})

test('source identity URL mismatches, contradictory identities and conflicting coordinates are excluded', () => {
  const destination = freshClue(
    'Visitor Museum',
    'tourism:museum',
    [121.0302, 14.56],
  )
  for (const bad of [
    {
      ...destination,
      sourceRecordUrl: 'https://www.openstreetmap.org/way/999',
    },
    { ...destination, sourceCoordinate: [121.04, 14.56] },
    { ...destination, anchorCoordinate: [121.04, 14.56] },
    { ...destination, parkingRecordId: 'other:member' },
    { ...destination, sourceCoordinate: null },
    {
      ...destination,
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [121.029, 14.559],
            [121.031, 14.559],
            [121.031, 14.561],
          ],
        ],
      },
    },
    { ...destination, geometry: { type: 'Polygon', coordinates: [] } },
    {
      ...destination,
      geometry: { type: 'Point', coordinates: [Infinity, 14.56] },
    },
  ])
    assert.equal(review([bad]).outcome, 'no_suitable_destination')
  assert.equal(
    review([destination, { ...destination, name: 'Contradictory Name' }])
      .outcome,
    'no_suitable_destination',
  )
})

test('source FIXME and uncertain boundaries preserve review alternatives without assigning a label', () => {
  const destination = freshClue(
    'Visitor Museum',
    'tourism:museum',
    [121.0302, 14.56],
  )
  for (const sourceTags of [
    { fixme: 'verify location or if still existing' },
    { FIXME: 'area is estimated' },
    { note: 'verify hospital boundary' },
    {
      note: 'improve hospital compound boundary with better knowledge/imagery',
    },
  ]) {
    const result = review([{ ...destination, sourceTags }])
    assert.equal(result.outcome, 'ambiguous')
    assert.equal(result.label, null)
    assert.equal(result.alternatives.length, 1)
    assert.ok(
      result.alternatives[0].uncertainties.some((text) =>
        text.includes('source warning'),
      ),
    )
    assert.equal(result.alternatives[0].scoreComponents.containment, 0)
  }
  assert.equal(
    review([
      {
        ...destination,
        sourceTags: {
          note: 'collections of ethnographic artifacts and scientific specimens',
        },
      },
    ]).outcome,
    'described',
  )
  assert.equal(
    review(
      [destination],
      freshMember({ sourceTags: { fixme: 'rough outline only' } }),
    ).outcome,
    'ambiguous',
  )
  assert.equal(
    review(
      [destination],
      freshMember({ sourceTags: { fixme: 'verification required' } }),
    ).outcome,
    'ambiguous',
  )
  assert.equal(
    review([destination], freshMember({ sourceTags: { fixme: 'fees' } }))
      .outcome,
    'described',
  )
  const classificationConflict = review([
    freshClue("Julita's Parking Lot", 'leisure:park', [121.0302, 14.56]),
  ])
  assert.equal(classificationConflict.outcome, 'ambiguous')
  assert.ok(
    classificationConflict.alternatives[0].uncertainties.some((text) =>
      text.includes('classification requires review'),
    ),
  )
})
