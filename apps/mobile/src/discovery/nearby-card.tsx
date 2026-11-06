import type { DiscoveryParking } from '@parkey/shared-types'
import { useEffect, useState } from 'react'
import { Animated, Platform, StyleSheet, Text, View } from 'react-native'

import { FigmaAsset } from './figma-assets'
import { MotionPressable } from './motion'
import { colors } from './palette'
import { parkingDetailData } from './parking-detail-data'
import { reviewedParkingEntrance } from './parking-navigation'
import type { ParkingReference } from './model'
import { parkingRowText } from './presentation'
import { ParkingStatus } from './parking-status'
import { ui } from './ui'
import { useReducedMotion } from './use-reduced-motion'

export function NearbyLoading() {
  const reduced = useReducedMotion()
  const [opacity] = useState(() => new Animated.Value(1))
  useEffect(() => {
    if (reduced) {
      opacity.setValue(1)
      return
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          isInteraction: false,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          isInteraction: false,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    )
    animation.start()
    return () => animation.stop()
  }, [opacity, reduced])
  return (
    <View
      accessibilityLabel="Finding spots near you"
      accessibilityState={{ busy: true }}
      style={styles.loadingStrip}
    >
      {[0, 1].map((index) => (
        <Animated.View key={index} style={[styles.card, { opacity }]}>
          <View style={[styles.content, { gap: 10 }]}>
            <View
              style={[
                styles.skeleton,
                { width: 70, height: 24, borderRadius: 999 },
              ]}
            />
            <View style={[styles.skeleton, { width: '90%', height: 16 }]} />
            <View style={[styles.skeleton, { width: '75%', height: 12 }]} />
          </View>
          <View style={[styles.go, styles.skeleton]} />
        </Animated.View>
      ))}
    </View>
  )
}

export function NearbyCard({
  parking,
  reference,
  now,
  onPress,
  onGo,
}: {
  parking: DiscoveryParking
  reference: ParkingReference
  now: Date
  onPress: () => void
  onGo: () => void
}) {
  const details = parkingDetailData(parking, null, now)
  const row = parkingRowText(parking, reference, now)
  const summary = [details.meta, `${row.distance} · straight-line`]
    .filter(Boolean)
    .join(' · ')
  const canNavigate = Boolean(reviewedParkingEntrance(parking, now.getTime()))
  return (
    <View style={styles.card}>
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel={`${details.title}. ${summary}. Open parking details`}
        onPress={onPress}
        style={({ pressed }) => [styles.content, pressed && ui.pressed]}
      >
        <ParkingStatus details={details} />
        <Text style={ui.heading} numberOfLines={1}>
          {details.title}
        </Text>
        <Text style={ui.small} numberOfLines={1}>
          {summary}
        </Text>
      </MotionPressable>
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel={`Go to ${details.title}`}
        disabled={!canNavigate}
        accessibilityState={{ disabled: !canNavigate }}
        onPress={onGo}
        style={({ pressed }) => [
          styles.go,
          pressed && ui.pressed,
          !canNavigate && ui.disabled,
        ]}
      >
        <FigmaAsset name="go" size={24} />
      </MotionPressable>
    </View>
  )
}

const styles = StyleSheet.create({
  loadingStrip: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  skeleton: { backgroundColor: colors.border, borderRadius: 6 },
  card: {
    width: 300,
    padding: 16,
    borderRadius: 24,
    backgroundColor: colors.soft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  content: { flex: 1, minWidth: 0, gap: 6 },
  go: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
