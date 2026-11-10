import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { ParkingGallery, ParkingImage } from './parking-photos'
import { parkingPhotoIdentityKey, parkingPhotos } from './photos'
import type { ParkingPhotoIdentity } from './photos'
import { colors, IconButton, ui } from './ui'
import { useReducedMotion } from './use-reduced-motion'

/** Raw source image tags, Commons and nearby imagery never authorize a photo. */
export function SpotThumbnail({
  parking,
  name,
  strip = false,
}: {
  strip?: boolean
  parking: ParkingPhotoIdentity
  name: string
}) {
  const identityKey = parkingPhotoIdentityKey(parking)
  const photos = parkingPhotos(parking)
  return (
    <SpotThumbnailContent
      key={JSON.stringify([identityKey, photos])}
      photos={photos}
      identityKey={identityKey}
      name={name}
      strip={strip}
    />
  )
}

function SpotThumbnailContent({
  photos,
  identityKey,
  name,
  strip,
}: {
  photos: ReturnType<typeof parkingPhotos>
  identityKey: string
  name: string
  strip: boolean
}) {
  const [visible, setVisible] = useState(false)
  const reduced = useReducedMotion()
  if (strip)
    return (
      <View style={styles.strip}>
        <ParkingGallery photos={photos} identityKey={identityKey} />
      </View>
    )
  return (
    <>
      <Pressable
        disabled={!photos.length}
        accessibilityRole="button"
        accessibilityLabel={
          photos.length
            ? `Open approved parking photos for ${name}`
            : 'No parking photos yet'
        }
        onPress={() => setVisible(true)}
      >
        <ParkingImage photo={photos[0]} thumbnail identityKey={identityKey} />
      </Pressable>
      {photos.length && visible ? (
        <Modal
          visible
          transparent
          animationType={reduced ? 'none' : 'fade'}
          onRequestClose={() => setVisible(false)}
        >
          <View style={styles.viewer} accessibilityViewIsModal>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close parking photos backdrop"
              onPress={() => setVisible(false)}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.card}>
              <View style={[ui.row, { justifyContent: 'space-between' }]}>
                <Text accessibilityRole="header" style={[ui.heading, ui.flex]}>
                  Parking photos for {name}
                </Text>
                <IconButton
                  icon="close"
                  label="Close parking photos"
                  onPress={() => setVisible(false)}
                />
              </View>
              <ParkingGallery photos={photos} identityKey={identityKey} />
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  strip: { paddingHorizontal: 16, paddingTop: 16, gap: 8 },
  viewer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: colors.backdrop,
  },
  card: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
})
