import type { ParkingPhoto } from '@parkey/shared-types'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { createPhotoLoadSession } from './photo-load-state'
import type { PhotoLoadStatus } from './photo-load-state'
import { isParkingPhoto, photoPage, validParkingPhotos } from './photos'
import { colors, Icon, IconButton, ui } from './ui'
import { useReducedMotion } from './use-reduced-motion'

function resourceKey(photo: ParkingPhoto) {
  return JSON.stringify([
    photo.id,
    photo.imageUrl,
    photo.thumbnailUrl,
    photo.caption,
    photo.credit,
    photo.license,
    photo.sourceUrl,
  ])
}

function PhotoPlaceholder({
  unavailable,
  thumbnail,
}: {
  unavailable: boolean
  thumbnail: boolean
}) {
  return (
    <View
      accessibilityLabel={
        unavailable ? 'Parking photo unavailable' : 'No parking photos yet'
      }
      style={styles.placeholder}
    >
      <Icon name="camera" color={colors.disabled} size={thumbnail ? 22 : 32} />
      <Text style={ui.small}>
        {unavailable ? 'Photo unavailable' : 'No photos yet'}
      </Text>
    </View>
  )
}

function LoadedParkingImage({
  photo,
  thumbnail,
}: {
  photo: ParkingPhoto
  thumbnail: boolean
}) {
  const [status, setStatus] = useState<PhotoLoadStatus>('loading')
  const attempt = useRef<ReturnType<typeof createPhotoLoadSession> | null>(null)
  useLayoutEffect(() => {
    const session = createPhotoLoadSession(setStatus)
    attempt.current = session
    return () => {
      session.dispose()
      attempt.current = null
    }
  }, [])
  return status === 'error' ? (
    <PhotoPlaceholder unavailable thumbnail={thumbnail} />
  ) : (
    <>
      <Image
        accessibilityLabel={photo.caption}
        source={{ uri: thumbnail ? photo.thumbnailUrl : photo.imageUrl }}
        resizeMode="cover"
        fadeDuration={0}
        onLoad={() => attempt.current?.loaded()}
        onError={() => attempt.current?.failed()}
        style={[
          StyleSheet.absoluteFill,
          { opacity: status === 'ready' ? 1 : 0 },
        ]}
      />
      {status === 'loading' ? (
        <ActivityIndicator
          accessibilityLabel="Loading parking photo"
          color={colors.action}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </>
  )
}

export function ParkingImage({
  photo,
  thumbnail = false,
  identityKey = '',
}: {
  photo: ParkingPhoto | undefined
  thumbnail?: boolean
  identityKey?: string
}) {
  return (
    <View style={[styles.image, thumbnail ? styles.thumbnail : styles.full]}>
      {isParkingPhoto(photo) ? (
        <LoadedParkingImage
          key={JSON.stringify([identityKey, thumbnail, resourceKey(photo)])}
          photo={photo}
          thumbnail={thumbnail}
        />
      ) : (
        <PhotoPlaceholder unavailable={false} thumbnail={thumbnail} />
      )}
    </View>
  )
}

function PhotoCredit({ photo }: { photo: ParkingPhoto }) {
  const [error, setError] = useState<string | null>(null)
  const active = useRef(true)
  const attempt = useRef(0)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  return (
    <>
      <Text style={ui.body}>{photo.caption}</Text>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Photo source: ${photo.credit}. ${photo.license}`}
        style={styles.credit}
        onPress={() => {
          setError(null)
          const current = ++attempt.current
          void Linking.openURL(photo.sourceUrl).catch(() => {
            if (active.current && current === attempt.current)
              setError('The photo source could not be opened.')
          })
        }}
      >
        <Text style={[ui.small, ui.link]}>
          {photo.credit} · {photo.license} ↗
        </Text>
      </Pressable>
      {error ? (
        <Text accessibilityRole="alert" style={[ui.small, ui.error]}>
          {error}
        </Text>
      ) : null}
    </>
  )
}

/** Only pass location-matched entries returned by parkingPhotos(). */
export function ParkingGallery({
  photos,
  identityKey = '',
}: {
  photos: readonly ParkingPhoto[]
  identityKey?: string
}) {
  const valid = validParkingPhotos(photos)
  return (
    <ParkingGalleryContent
      key={JSON.stringify([identityKey, valid.map(resourceKey)])}
      photos={valid}
      identityKey={identityKey}
    />
  )
}

function ParkingGalleryContent({
  photos,
  identityKey,
}: {
  photos: ParkingPhoto[]
  identityKey: string
}) {
  const [width, setWidth] = useState(0)
  const [index, setIndex] = useState(0)
  const list = useRef<FlatList<ParkingPhoto>>(null)
  const reduced = useReducedMotion()
  const current = photos[index] ?? photos[0]
  function move(next: number) {
    if (next < 0 || next >= photos.length || width <= 0) return
    setIndex(next)
    list.current?.scrollToOffset({ offset: next * width, animated: !reduced })
  }
  return (
    <View
      style={{ gap: 10 }}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width
        if (next !== width) {
          setWidth(next)
          setIndex(0)
          list.current?.scrollToOffset({ offset: 0, animated: false })
        }
      }}
    >
      {current ? (
        <>
          {width > 0 ? (
            <FlatList
              ref={list}
              style={{ height: (width * 9) / 16, flexGrow: 0, flexShrink: 0 }}
              data={photos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(photo) => photo.id}
              initialNumToRender={1}
              maxToRenderPerBatch={2}
              windowSize={3}
              getItemLayout={(_, itemIndex) => ({
                length: width,
                offset: width * itemIndex,
                index: itemIndex,
              })}
              onScroll={(event) =>
                setIndex(
                  photoPage(
                    event.nativeEvent.contentOffset.x,
                    width,
                    photos.length,
                  ),
                )
              }
              scrollEventThrottle={32}
              renderItem={({ item: photo }) => (
                <View style={{ width }}>
                  <ParkingImage photo={photo} identityKey={identityKey} />
                </View>
              )}
            />
          ) : null}
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <IconButton
              icon="back"
              label="Previous parking photo"
              disabled={index === 0}
              onPress={() => move(index - 1)}
            />
            <Text accessibilityLiveRegion="polite" style={ui.small}>
              Photo {index + 1} of {photos.length}
            </Text>
            <IconButton
              icon="arrow"
              label="Next parking photo"
              disabled={index >= photos.length - 1}
              onPress={() => move(index + 1)}
            />
          </View>
          <PhotoCredit key={resourceKey(current)} photo={current} />
        </>
      ) : (
        <ParkingImage photo={undefined} identityKey={identityKey} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.canvas,
    borderRadius: 16,
    overflow: 'hidden',
  },
  thumbnail: { width: 92, height: 96 },
  full: { width: '100%', aspectRatio: 16 / 9 },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 6,
  },
  credit: { minHeight: 44, justifyContent: 'center' },
})
