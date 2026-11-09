import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'

import { isParking } from './data.ts'
import { parkingDestination } from './parking-detail-data.ts'
import {
  isParkingNavigationApproval,
  reviewedParkingEntrance,
  publicParkingAccess,
} from './parking-navigation.ts'
import { sampleParking } from './sample-data.ts'

const now = Date.parse('2026-11-05T00:00:00Z')
const entrance = [121.031, 14.56]
const approved = () => ({
  ...sampleParking[0],
  sourceKind: 'osm',
  entrances: [entrance, [121.04, 14.56]],
  navigationApproval: {
    entrance,
    entranceConfirmed: true,
    visitorAccessConfirmed: true,
    operatorAuthorized: true,
    expiresAt: '2026-11-06T00:00:00Z',
  },
})

test('only the authorized entrance is used, even if a different mapped entrance is closer', () => {
  const record = approved()
  assert.equal(isParking(record), true)
  assert.deepEqual(parkingDestination(record, [121.04, 14.56], now), entrance)
  assert.deepEqual(reviewedParkingEntrance(record, now), entrance)
})

test('missing, expired, revoked or mismatched authorization never falls back to mapped geometry', () => {
  const record = approved()
  for (const candidate of [
    { ...record, navigationApproval: null },
    { ...record, navigationApproval: undefined },
    {
      ...record,
      navigationApproval: {
        ...record.navigationApproval,
        operatorAuthorized: false,
      },
    },
    {
      ...record,
      navigationApproval: {
        ...record.navigationApproval,
        visitorAccessConfirmed: false,
      },
    },
    {
      ...record,
      navigationApproval: {
        ...record.navigationApproval,
        entranceConfirmed: false,
      },
    },
    {
      ...record,
      navigationApproval: {
        ...record.navigationApproval,
        expiresAt: '2026-11-04T00:00:00Z',
      },
    },
    {
      ...record,
      navigationApproval: {
        ...record.navigationApproval,
        entrance: [121.1, 14.6],
      },
    },
    { ...record, entrances: [] },
    { ...record, sourceKind: 'sample' },
    { ...record, osmTags: { access: 'private' } },
    { ...record, osmTags: { 'construction:amenity': 'parking' } },
  ])
    assert.equal(reviewedParkingEntrance(candidate, now), null)
  assert.equal(
    reviewedParkingEntrance(
      record,
      Date.parse(record.navigationApproval.expiresAt),
    ),
    null,
  )
})

test('wire validation rejects malformed approval metadata while preserving legacy browsing records', () => {
  const record = approved()
  for (const approval of [
    { ...record.navigationApproval, entranceConfirmed: 'true' },
    { ...record.navigationApproval, entrance: [181, 14.56] },
    { ...record.navigationApproval, expiresAt: 'invalid' },
  ]) {
    assert.equal(isParkingNavigationApproval(approval), false)
    assert.equal(isParking({ ...record, navigationApproval: approval }), false)
  }
  assert.equal(isParking({ ...record, navigationApproval: null }), true)
})

test('contradictory access tags, normalized restrictions and unsupported access fail closed', () => {
  for (const restriction of [
    'private',
    ' customers ',
    'MEMBERS',
    'yes;private',
    'residents',
    'delivery',
    'permit',
    'unsupported',
  ]) {
    assert.equal(publicParkingAccess(restriction), false)
    for (const tag of ['access', 'parking:access'])
      assert.equal(
        reviewedParkingEntrance(
          { ...approved(), osmTags: { access: 'public', [tag]: restriction } },
          now,
        ),
        null,
      )
    assert.equal(
      reviewedParkingEntrance(
        {
          ...approved(),
          regulations: [
            {
              description: `Access recorded by OpenStreetMap: ${restriction}`,
              sourceLabel: 'Actual source',
              sourceUrl: null,
              observedAt: null,
            },
          ],
        },
        now,
      ),
      null,
    )
  }
  for (const value of [
    undefined,
    null,
    '',
    'unknown',
    'yes',
    'public',
    'permissive',
    ' public_visitors ',
  ])
    assert.equal(publicParkingAccess(value), true)
})

test('the preserved unverified Poblacion archive has no authorized navigation targets', () => {
  const records = JSON.parse(
    readFileSync(new URL('./osm-pilot.json', import.meta.url)),
  )
  assert.ok(records.length > 0)
  assert.ok(records.every(isParking))
  assert.equal(
    records.filter((record) => reviewedParkingEntrance(record, now)).length,
    0,
  )
})
