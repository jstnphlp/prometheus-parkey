import assert from 'node:assert/strict'
import test from 'node:test'

import { parkingMapSources } from './map-data.ts'
import { sampleParking } from './sample-data.ts'

test('cluster sources include one anchor per parking record while retaining street geometry', () => {
  const sources = parkingMapSources(sampleParking, null)
  assert.ok(sources.streets.features.length > 0)
  assert.ok(sources.facilities.features.length > 0)
  assert.ok(
    sources.streets.features.every(
      (feature) => feature.geometry.type === 'LineString',
    ),
  )
  assert.ok(
    sources.facilities.features.every(
      (feature) => feature.geometry.type === 'Point',
    ),
  )
  assert.equal(sources.selected.features.length, 0)
  assert.equal(sources.facilities.features.length, sampleParking.length)
})

test('a selected pin renders independently above clusters without being counted twice', () => {
  const facility = sampleParking.find(
    (record) => record.geometry.type === 'Point',
  )
  const sources = parkingMapSources(sampleParking, facility.id)
  assert.deepEqual(
    sources.selected.features.map((feature) => feature.id),
    [facility.id],
  )
  assert.ok(
    sources.facilities.features.every((feature) => feature.id !== facility.id),
  )
  assert.equal(
    Object.values(sources).flatMap((source) => source.features).length,
    sampleParking.length + sources.streets.features.length,
  )
  const street = sampleParking.find(
    (record) => record.geometry.type === 'LineString',
  )
  const streetSources = parkingMapSources(sampleParking, street.id)
  assert.equal(streetSources.selected.features.length, 1)
  assert.equal(streetSources.streets.features[0].properties.selected, true)
})

test('southern pins have higher draw priority and source ordering is stable across input order', () => {
  const facility = sampleParking.find(
    (record) => record.geometry.type === 'Point',
  )
  const records = [
    {
      ...facility,
      id: 'north',
      geometry: { type: 'Point', coordinates: [121.03, 14.57] },
    },
    {
      ...facility,
      id: 'south',
      geometry: { type: 'Point', coordinates: [121.03, 14.56] },
    },
    {
      ...facility,
      id: 'south-tie',
      geometry: { type: 'Point', coordinates: [121.03, 14.56] },
    },
  ]
  const pins = parkingMapSources(records, null).facilities.features
  const north = pins.find((feature) => feature.id === 'north')
  const south = pins.find((feature) => feature.id === 'south')
  assert.ok(south.properties.sortKey > north.properties.sortKey)
  assert.deepEqual(
    parkingMapSources(records.toReversed(), null).facilities.features,
    pins,
  )
  assert.deepEqual(parkingMapSources([], null).facilities.features, [])
})

test('selected street keeps its line and gains a mascot anchor at its midpoint', () => {
  const street = sampleParking.find(
    (record) => record.geometry.type === 'LineString',
  )
  const sources = parkingMapSources(sampleParking, street.id)
  assert.ok(
    sources.streets.features.some((feature) => feature.id === street.id),
  )
  assert.deepEqual(sources.selected.features[0].geometry, {
    type: 'Point',
    coordinates:
      street.geometry.coordinates[
        Math.floor(street.geometry.coordinates.length / 2)
      ],
  })
  assert.ok(
    !sources.facilities.features.some((feature) => feature.id === street.id),
  )
})

test('map fee bubbles use recorded values and mark missing fees without a free claim', () => {
  const base = { ...sampleParking[0], fees: null, osmTags: {} }
  const records = [
    { ...base, id: 'free', osmTags: { fee: 'no' } },
    { ...base, id: 'paid', osmTags: { fee: 'yes', charge: '₱40/hr' } },
    { ...base, id: 'unknown', fees: 'Free after validation' },
    { ...base, id: 'paid-unknown', osmTags: { fee: 'yes', charge: 'unknown' } },
  ]
  const sources = parkingMapSources(records, null, 'free')
  const properties = Object.fromEntries(
    sources.facilities.features.map((f) => [f.id, f.properties]),
  )
  assert.equal(properties.free.label, 'Free')
  assert.equal(properties.free.featured, true)
  assert.equal(properties.paid.label, '₱40/hr')
  assert.equal(properties.paid.free, false)
  assert.equal(properties.unknown.label, 'Fee ?')
  assert.equal(properties.unknown.knownFee, false)
  assert.equal(properties['paid-unknown'].label, 'Paid')
  assert.equal(sources.facilities.features.length, records.length)
})

test('garage and street classifications survive selection, and charging needs a positive recorded capacity', () => {
  const garage = {
    ...sampleParking.find((record) => record.geometry.type === 'Point'),
    id: 'garage',
    kind: 'garage',
    osmTags: { 'capacity:charging': '2' },
  }
  const street = {
    ...sampleParking.find((record) => record.geometry.type === 'LineString'),
    id: 'street',
    kind: 'street',
    osmTags: { 'capacity:charging': '0' },
  }
  const records = parkingMapSources([garage, street], garage.id)
  assert.equal(records.selected.features[0].properties.kind, 'garage')
  assert.equal(records.selected.features[0].properties.hasEVCharging, true)
  assert.equal(records.facilities.features[0].properties.kind, 'street')
  assert.equal(records.facilities.features[0].properties.hasEVCharging, false)
})
