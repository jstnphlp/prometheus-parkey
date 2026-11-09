/** Isolated Metro test entry. Never imported by the app or registered as a route. */
import type { DiscoveryParking, ParkingPhoto } from '@parkey/shared-types'
import { registerRootComponent } from 'expo'
import { useFonts } from 'expo-font'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { ParkingDetails } from '../discovery/parking-details'
import { ParkingGallery } from '../discovery/parking-photos'
import { sampleParking } from '../discovery/sample-data'
import { fontSources } from '../discovery/typography'

if (!__DEV__ || process.env.PARKEY_RELEASE_BUILD === 'true')
  throw new Error('Native QA harness requires a development build.')

const states = [
  'known',
  'missing',
  'contradictory',
  'restricted',
  'expired',
  'revoked',
  'image failure',
] as const
type State = (typeof states)[number]

function fixture(state: State): DiscoveryParking {
  const base = sampleParking[0]
  if (!base) throw new Error('Missing test template')
  const record: DiscoveryParking = {
    ...base,
    id: 'synthetic-native-qa',
    name: 'Synthetic QA garage',
    kind: 'garage',
    sourceKind: 'osm',
    sourceUrl: 'https://www.openstreetmap.org/way/0',
    sourceLabel: 'Synthetic test evidence; not published parking',
    verification: 'unverified',
    verifiedAt: null,
    fees: 'PHP 40/hr',
    hours: '24/7',
    osmTags: { fee: 'yes', charge: 'PHP 40/hr', access: 'public' },
    regulations: [],
    entrances: [[121, 14]],
    navigationApproval: {
      entrance: [121, 14],
      entranceConfirmed: true,
      visitorAccessConfirmed: true,
      operatorAuthorized: true,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
  }
  if (state === 'missing')
    return {
      ...record,
      fees: null,
      hours: null,
      osmTags: {},
      entrances: [],
      navigationApproval: null,
    }
  if (state === 'contradictory')
    return {
      ...record,
      hours: 'Mo-Fr 08:00-18:00',
      osmTags: {
        fee: 'no',
        charge: 'PHP 60/hr',
        opening_hours: '24/7',
        access: 'public',
      },
    }
  if (state === 'restricted')
    return { ...record, osmTags: { access: 'private' } }
  if (state === 'revoked') return { ...record, navigationApproval: null }
  if (state === 'expired' && record.navigationApproval)
    return {
      ...record,
      navigationApproval: {
        ...record.navigationApproval,
        expiresAt: '2020-01-01T00:00:00Z',
      },
    }
  return record
}

const unavailableImage: ParkingPhoto = {
  id: 'synthetic-unavailable',
  imageUrl: 'https://native-fixture.invalid/does-not-exist.jpg',
  thumbnailUrl: 'https://native-fixture.invalid/does-not-exist.jpg',
  sourceUrl: 'https://native-fixture.invalid/test',
  caption: 'Synthetic image failure test, not a parking photograph',
  credit: 'Parkey local QA fixture',
  license: 'Test fixture only; not approved for publication',
}

function Harness() {
  const [state, setState] = useState<State>('known')
  const [loaded, error] = useFonts(fontSources)
  if (!loaded && !error) return null
  return (
    <View
      style={{
        flex: 1,
        paddingTop: 40,
        paddingBottom: 24,
        backgroundColor: 'white',
      }}
    >
      <Text accessibilityRole="header">SIMULATED NATIVE QA ONLY — {state}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {states.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={`QA ${value}`}
            onPress={() => setState(value)}
            style={{ padding: 12 }}
          >
            <Text>{value}</Text>
          </Pressable>
        ))}
      </View>
      {state === 'image failure' ? (
        <ParkingGallery
          photos={[unavailableImage]}
          identityKey="synthetic-qa-only"
        />
      ) : (
        <ParkingDetails
          key={state}
          parking={fixture(state)}
          now={new Date()}
          location={null}
          expanded
          onDirections={() => {}}
          onAddDetails={() => {}}
          favorite={false}
          onFavorite={() => {}}
          favoriteDisabled
          storageError={null}
          onContentHeightChange={() => {}}
          onScrollOffsetChange={() => {}}
        />
      )}
    </View>
  )
}

registerRootComponent(Harness)
