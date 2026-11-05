import type { DiscoveryParking } from '@parkey/shared-types'
import { StyleSheet, Text, View } from 'react-native'

import type { ParkingReference } from './model'
import { parkingDetailData } from './parking-detail-data'
import { reviewedParkingEntrance } from './parking-navigation'
import { FigmaAsset } from './figma-assets'
import { MotionPressable } from './motion'
import { colors, IconButton, ui } from './ui'

export const PARKING_ROW_HEIGHT = 96
export function ParkingRow({
  parking,
  reference,
  onPress,
  onDirections,
  selected = false,
  testID,
}: {
  parking: DiscoveryParking
  reference: ParkingReference
  now?: Date
  onPress: () => void
  onDirections: () => void
  onFavorite: () => void
  favorite: boolean
  disabled?: boolean
  selected?: boolean
  compact?: boolean
  testID?: string | undefined
}) {
  const text = parkingDetailData(
    parking,
    reference.label === 'your location' ? reference.coordinate : null,
  )
  return (
    <View testID={testID} style={[styles.row, selected && styles.selected]}>
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel={`${text.title}. ${text.meta}. Open parking details`}
        onPress={onPress}
        style={({ pressed }) => [styles.content, pressed && ui.pressed]}
      >
        <View style={styles.badge}>
          <FigmaAsset name="pin" size={28} />
        </View>
        <View style={ui.flex}>
          <Text style={ui.heading} numberOfLines={1}>
            {text.title}
          </Text>
          <Text style={ui.small} numberOfLines={1}>
            {text.meta}
          </Text>
        </View>
      </MotionPressable>
      <IconButton
        icon="arrow"
        label={`Directions to ${text.title}`}
        disabled={!reviewedParkingEntrance(parking)}
        color={colors.surface}
        onPress={onDirections}
        style={styles.directions}
      />
    </View>
  )
}
const styles = StyleSheet.create({
  row: {
    minHeight: 80,
    height: PARKING_ROW_HEIGHT - 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.selected,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    minHeight: 60,
    gap: 8,
    borderRadius: 12,
  },
  directions: { width: 44, height: 44, backgroundColor: colors.brand },
  selected: { backgroundColor: colors.selected },
})
