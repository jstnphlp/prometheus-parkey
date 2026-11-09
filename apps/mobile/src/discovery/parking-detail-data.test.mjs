import assert from 'node:assert/strict'
import test from 'node:test'

import {
  detailDistance,
  parkingDetailData,
  parkingDestination,
  parkingHoursFacts,
} from './parking-detail-data.ts'
import { spotHours } from './spot-hours.ts'
import { sampleParking } from './sample-data.ts'

const minimal = {
  ...sampleParking[0],
  name: 'Unnamed parking · OpenStreetMap',
  kind: 'lot',
  fees: null,
  hours: null,
  regulations: [],
}

test('all recorded access sources remain visible and restrictions override public tags', () => {
  const details = parkingDetailData(
    {
      ...minimal,
      osmTags: { access: 'public', 'parking:access': 'private' },
      regulations: [
        {
          id: 'restriction',
          description: 'Access: permit',
          sourceLabel: 'QA source',
        },
      ],
    },
    null,
  )
  assert.equal(details.access, 'public / private / permit')
  assert.match(details.warning, /Private parking/)
  assert.ok(
    details.rows.some(
      (row) =>
        row.label === 'Access' && row.value === 'public / private / permit',
    ),
  )
})

test('a verified label with an absent or invalid date remains explicit about missing evidence', () => {
  for (const verifiedAt of [null, 'invalid']) {
    const details = parkingDetailData(
      { ...minimal, sourceKind: 'osm', verification: 'verified', verifiedAt },
      null,
    )
    assert.equal(details.verification, 'Verification date unknown')
  }
})
test('sparse records omit repeated type, remote distance, and empty facts', () => {
  const details = parkingDetailData(minimal, [0, 0])
  assert.equal(details.title, 'Parking lot')
  assert.equal(details.meta, '')
  assert.equal(details.sparse, true)
  assert.deepEqual(details.rows, [])
  assert.deepEqual(details.chips, [])
  assert.equal(
    parkingDetailData(
      {
        ...minimal,
        kind: 'street',
        osmTags: { 'addr:street': 'Jupiter Street' },
      },
      null,
    ).title,
    'Street parking on Jupiter Street',
  )
  assert.equal(
    parkingDetailData({ ...minimal, name: 'Named lot' }, null).title,
    'Named lot',
  )
})
test('distance boundaries follow driver-focused units', () => {
  for (const [meters, expected] of [
    [354, '350 m'],
    [1000, '1.0 km'],
    [9999, '10.0 km'],
    [10000, '10 km'],
    [99999, '100 km'],
    [100000, '100 km'],
    [100001, undefined],
  ])
    assert.equal(detailDistance(meters), expected)
})
test('discovery details preserve fees and access without exposing total inventory', () => {
  const detail = parkingDetailData(
    {
      ...minimal,
      osmTags: {
        fee: 'yes',
        charge: '₱40/hr',
        capacity: '120',
        access: 'customers',
        'capacity:disabled': '2',
        'payment:cash': 'yes',
      },
    },
    null,
  )
  assert.deepEqual(detail.chips, ['₱40/hr'])
  assert.equal(Object.hasOwn(detail, 'capacity'), false)
  assert.ok(!detail.rows.some((row) => row.label === 'Spaces'))
  assert.equal(detail.warning, 'Customers only')
  assert.equal(detail.accessibleSpaces, 2)
  assert.deepEqual(detail.paymentMethods, ['cash'])
  assert.ok(!JSON.stringify(detail).includes('available'))
})
test('invalid hours disappear; OSM parser evaluates in the spot timezone', () => {
  const makati = [121.031, 14.566]
  assert.deepEqual(spotHours('nonsense', makati), {})
  assert.equal(spotHours('24/7', makati).summary, 'Open 24 hours')
  const now = new Date('2026-11-02T02:00:00Z') // Monday 10 AM in Makati
  assert.equal(
    spotHours('Mo-Fr 08:00-22:00', makati, now).summary,
    'Open now · closes 10 PM',
  )
  assert.equal(
    spotHours('Mo-Fr 08:00-22:00', [-74.006, 40.713], now).summary,
    'Closed · opens Mon 8 AM',
  )
  assert.equal(
    spotHours('Mo-Fr 08:00-22:00', makati, now).week.find((d) => d.today).day,
    'Monday',
  )
})
test('mapped entrances and facility centers cannot authorize driving directions', () => {
  const entrances = [
    [121.03, 14.566],
    [121.035, 14.566],
  ]
  assert.deepEqual(
    parkingDestination({ ...minimal, entrances }, [121.036, 14.566]),
    null,
  )
  assert.deepEqual(
    parkingDestination({ ...minimal, entrances: [] }, null),
    null,
  )
})
test('import geometry warnings do not expand a sparse spot; import date is not edit date', () => {
  const detail = parkingDetailData(
    {
      ...minimal,
      regulations: [
        {
          description: 'Map point may be a facility centroid, not an entrance.',
          sourceLabel: 'Parkey import geometry note',
        },
      ],
    },
    null,
  )
  assert.equal(detail.sparse, true)
  assert.equal(detail.updated, undefined)
})

test('snapshot import, source edit and field verification dates remain distinct', () => {
  const now = new Date('2026-11-03T00:00:00Z')
  const record = {
    ...minimal,
    sourceKind: 'osm',
    sourceUpdatedAt: '2026-11-02T03:15:22Z',
    osmEditedAt: '2013-02-03T00:33:12Z',
    verification: 'unverified',
    verifiedAt: null,
  }
  const details = parkingDetailData(record, null, now)
  assert.equal(details.verification, 'Not field verified')
  assert.match(details.sourceDate, /^Snapshot imported .*2026/)
  assert.equal(details.updated, 'OSM edited Feb 2013')
  assert.match(details.freshness, /last edited over a year ago/)
  const missing = parkingDetailData(
    { ...record, sourceUpdatedAt: null, osmEditedAt: null },
    null,
    now,
  )
  assert.equal(missing.sourceDate, 'Source date unknown')
  assert.equal(missing.updated, undefined)
  assert.equal(missing.freshness, undefined)
  const oldImport = parkingDetailData(
    { ...record, sourceUpdatedAt: '2026-09-01T00:00:00Z' },
    null,
    now,
  )
  assert.match(oldImport.freshness, /over 30 days old/)
})

test('a mapped point, a mapped entrance and a street extent make different directions claims', () => {
  const unknownEntrance = parkingDetailData({ ...minimal, entrances: [] }, null)
  assert.match(unknownEntrance.geometryNote, /Entrance not mapped/)
  const mappedEntrance = parkingDetailData(
    { ...minimal, entrances: [[121.03, 14.56]] },
    null,
  )
  assert.match(mappedEntrance.geometryNote, /^Mapped entrance/)
  const street = parkingDetailData({ ...sampleParking[2], entrances: [] }, null)
  assert.match(street.geometryNote, /^Mapped street extent/)
  assert.match(street.geometryNote, /check signs and parking restrictions/)
})

test('unnamed records fall back to their actual parking class without using street addresses as lot names', () => {
  for (const [kind, title] of [
    ['lot', 'Parking lot'],
    ['garage', 'Garage'],
    ['street', 'Street parking'],
  ])
    assert.equal(
      parkingDetailData(
        { ...minimal, kind, name: 'Unnamed parking', osmTags: {} },
        null,
      ).title,
      title,
    )
  assert.equal(
    parkingDetailData(
      {
        ...minimal,
        kind: 'garage',
        osmTags: { 'addr:street': 'Fixture Avenue' },
      },
      null,
    ).title,
    'Garage',
  )
})

test('conflicting fees and raw hours retain evidence without computed Free or Open claims', () => {
  const input = {
    ...minimal,
    fees: 'Paid',
    hours: 'Mo-Su off',
    osmTags: {
      fee: 'no',
      charge: 'PHP 40/hr',
      opening_hours: '24/7',
      access: 'customers',
    },
  }
  const original = JSON.stringify(input)
  const details = parkingDetailData(
    input,
    null,
    new Date('2026-11-06T02:00:00Z'),
  )
  assert.deepEqual(details.chips, [])
  assert.equal(details.fee, undefined)
  assert.equal(details.week, undefined)
  assert.match(details.warning, /Customers only/)
  assert.match(details.warning, /Fee sources conflict/)
  assert.match(details.warning, /Hours sources conflict/)
  for (const [label, value] of [
    ['OSM fee', 'no'],
    ['OSM charge', 'PHP 40/hr'],
    ['Recorded fee', 'Paid'],
    ['OSM opening hours', '24/7'],
    ['Recorded opening hours', 'Mo-Su off'],
  ])
    assert.ok(
      details.rows.some((row) => row.label === label && row.value === value),
      label,
    )
  assert.ok(!details.rows.some((row) => row.label === 'Fee'))
  assert.equal(JSON.stringify(input), original)
})

test('known, missing and invalid source hours remain separate from schedule claims', () => {
  const now = new Date('2026-11-06T02:00:00Z')
  const known = parkingDetailData(
    { ...minimal, hours: '24/7', osmTags: { opening_hours: ' 24/7 ' } },
    null,
    now,
  )
  assert.ok(known.chips.includes('Open 24 hours'))
  assert.equal(known.warning, undefined)
  assert.ok(
    known.rows.some(
      (row) => row.label === 'OSM opening hours' && row.value === '24/7',
    ),
  )
  const invalid = parkingDetailData(
    { ...minimal, hours: 'not a schedule' },
    null,
    now,
  )
  assert.deepEqual(invalid.chips, [])
  assert.equal(invalid.week, undefined)
  assert.ok(
    invalid.rows.some(
      (row) =>
        row.label === 'Recorded opening hours' &&
        row.value === 'not a schedule',
    ),
  )
  const missing = parkingDetailData(
    { ...minimal, hours: null, osmTags: {} },
    null,
    now,
  )
  assert.equal(missing.week, undefined)
  assert.deepEqual(missing.rows, [])
})

test('hours-fact helper suppresses contradictory schedules for every consumer', () => {
  const record = {
    ...minimal,
    hours: 'Mo-Su off',
    osmTags: { opening_hours: '24/7' },
  }
  const result = parkingHoursFacts(record, new Date('2026-11-06T02:00:00Z'))
  assert.equal(result.conflict, true)
  assert.deepEqual(result.parsed, {})
  assert.deepEqual(result.sources, [
    { label: 'OSM opening hours', value: '24/7' },
    { label: 'Recorded opening hours', value: 'Mo-Su off' },
  ])
})

test('amenities use recorded values only and malformed counts cannot manufacture amenities', () => {
  const empty = parkingDetailData({ ...minimal, osmTags: {} }, null)
  for (const key of [
    'covered',
    'lit',
    'supervised',
    'wheelchair',
    'accessibleSpaces',
    'chargingSpaces',
  ])
    assert.equal(empty[key], undefined, key)
  const details = parkingDetailData(
    {
      ...minimal,
      osmTags: {
        covered: 'yes',
        lit: 'no',
        supervised: 'unknown',
        wheelchair: 'limited',
        'capacity:disabled': 'two',
        'capacity:charging': '9'.repeat(400),
        capacity: '120',
      },
    },
    null,
  )
  assert.equal(details.covered, 'yes')
  assert.equal(details.lit, 'no')
  assert.equal(details.wheelchair, 'limited')
  assert.equal(details.supervised, undefined)
  assert.equal(details.accessibleSpaces, undefined)
  assert.equal(details.chargingSpaces, undefined)
  assert.equal(Object.hasOwn(details, 'capacity'), false)
  assert.ok(!details.rows.some((row) => row.label === 'Spaces'))
})
