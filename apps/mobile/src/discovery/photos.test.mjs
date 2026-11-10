import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isParkingPhoto,
  parkingPhotoIdentityKey,
  parkingPhotos,
  photoPage,
  validParkingPhotos,
} from './photos.ts'
import { sampleParking } from './sample-data.ts'

const photo = {
  id: 'entrance',
  thumbnailUrl: 'https://images.example.test/entrance-small.jpg',
  imageUrl: 'https://images.example.test/entrance.jpg',
  caption: 'Entrance from the street',
  credit: 'Location photographer',
  sourceUrl: 'https://example.test/photos/entrance',
  license: 'Used with permission',
}

test('curated photos match the same source identity across local and server IDs', () => {
  const local = {
    ...sampleParking[0],
    id: 'osm:way/123',
    sourceUrl: 'https://www.openstreetmap.org/way/123',
  }
  const remote = { ...local, id: 'server-uuid' }
  const catalog = {
    [local.sourceUrl]: [photo],
    [remote.id]: [{ ...photo, id: 'fallback' }],
  }
  assert.deepEqual(parkingPhotos(local, catalog), [photo])
  assert.deepEqual(parkingPhotos(remote, catalog), [photo])
  // A known, different/missing source key must not inherit photos from a reused ID.
  assert.deepEqual(parkingPhotos(remote, { [remote.id]: [photo] }), [])
  assert.deepEqual(
    parkingPhotos({ id: remote.id, sourceUrl: null }, { [remote.id]: [photo] }),
    [photo],
  )
})

test('missing photos and unknown sources yield an empty gallery, never local contribution evidence', () => {
  assert.deepEqual(parkingPhotos(sampleParking[0]), [])
  assert.deepEqual(
    parkingPhotos({ ...sampleParking[0], sourceUrl: null }, {}),
    [],
  )
  assert.deepEqual(
    parkingPhotos(
      { ...sampleParking[0], id: 'constructor', sourceUrl: null },
      {},
    ),
    [],
  )
  assert.equal(
    isParkingPhoto({ photoUri: 'file:///private/signage.jpg' }),
    false,
  )
})

test('invalid URLs and incomplete photo attribution are rejected without hiding valid photos', () => {
  assert.equal(isParkingPhoto(photo), true)
  for (const patch of [
    { imageUrl: 'http://example.test/photo.jpg' },
    { thumbnailUrl: 'file:///photo.jpg' },
    { imageUrl: 'javascript:alert(1)' },
    { sourceUrl: 'not a URL' },
    { imageUrl: 'https://user:secret@example.test/photo.jpg' },
    { thumbnailUrl: 'https://user:secret@example.test/photo.jpg' },
    { sourceUrl: 'https://user:secret@example.test/photos/entrance' },
    { imageUrl: 'https://images.example.test/photo.jpg?token=private' },
    { thumbnailUrl: 'https://images.example.test/photo.jpg?signature=private' },
    { sourceUrl: 'https://example.test/photos/entrance#session' },
    { imageUrl: ' https://images.example.test/photo.jpg' },
    { imageUrl: 'https://images.example.test/photo\n.jpg' },
    { caption: ' ' },
    { credit: '' },
    { license: '' },
    { id: '' },
    { id: ' duplicate ' },
    { credit: 'Unknown' },
    { credit: 'Not recorded' },
    { license: 'N/A' },
    { license: 'Not provided' },
    { caption: 'Private\u0000data' },
  ])
    assert.equal(isParkingPhoto({ ...photo, ...patch }), false)
  assert.equal(isParkingPhoto(null), false)
  assert.equal(isParkingPhoto({}), false)
  assert.equal(isParkingPhoto(Object.create(photo)), false)
  assert.equal(isParkingPhoto([]), false)
  assert.deepEqual(
    parkingPhotos(
      { id: sampleParking[0].id, sourceUrl: null },
      {
        [sampleParking[0].id]: [{ ...photo, credit: '' }, photo],
      },
    ),
    [photo],
  )
})

test('the catalog explicitly matches location identity and deduplicates valid photo IDs', () => {
  const identity = {
    id: 'public-uuid',
    sourceUrl: 'https://www.openstreetmap.org/way/123',
  }
  const other = {
    ...identity,
    sourceUrl: 'https://www.openstreetmap.org/way/999',
  }
  const catalog = {
    [identity.sourceUrl]: [
      { ...photo, credit: '' },
      photo,
      { ...photo, imageUrl: 'https://images.example.test/other-location.jpg' },
      { ...photo, id: 'second' },
    ],
    [identity.id]: [photo],
  }
  assert.deepEqual(parkingPhotos(identity, catalog), [
    photo,
    { ...photo, id: 'second' },
  ])
  assert.deepEqual(parkingPhotos(other, catalog), [])
  assert.deepEqual(
    parkingPhotos({ ...identity, id: 'new-server-uuid' }, catalog),
    [photo, { ...photo, id: 'second' }],
  )
  assert.deepEqual(
    parkingPhotos({ id: 'not-in-catalog', sourceUrl: null }, catalog),
    [],
  )
  assert.deepEqual(validParkingPhotos({ id: 'not-an-array' }), [])
  assert.deepEqual(validParkingPhotos([photo, photo, null]), [photo])
  assert.equal(
    parkingPhotoIdentityKey(identity),
    `source:${identity.sourceUrl}`,
  )
  assert.equal(
    parkingPhotoIdentityKey({ id: identity.id, sourceUrl: null }),
    `record:${identity.id}`,
  )
  for (const invalid of [
    { id: '', sourceUrl: null },
    { id: ' public-uuid ', sourceUrl: null },
    { ...identity, sourceUrl: 'https://user:secret@example.test/record' },
    { ...identity, sourceUrl: 'http://example.test/record' },
  ]) {
    assert.equal(parkingPhotoIdentityKey(invalid), '')
    assert.deepEqual(parkingPhotos(invalid, catalog), [])
  }
})

test('raw source image tags and local contribution photos never authorize consumer imagery', () => {
  const parking = {
    ...sampleParking[0],
    osmTags: {
      image: 'https://images.example.test/unreviewed.jpg',
      wikimedia_commons: 'File:Unreviewed.jpg',
      mapillary: '123456',
    },
    photoUri: 'file:///private/contribution.jpg',
  }
  assert.deepEqual(parkingPhotos(parking), [])
})

test('gallery paging handles swipe offsets, overscroll, single images, and empty galleries', () => {
  assert.equal(photoPage(0, 320, 3), 0)
  assert.equal(photoPage(320, 320, 3), 1)
  assert.equal(photoPage(640, 320, 3), 2)
  assert.equal(photoPage(-200, 320, 3), 0)
  assert.equal(photoPage(2000, 320, 3), 2)
  assert.equal(photoPage(320, 320, 1), 0)
  assert.equal(photoPage(320, 0, 3), 0)
  assert.equal(photoPage(0, 320, 0), 0)
  assert.equal(photoPage(NaN, 320, 3), 0)
})
