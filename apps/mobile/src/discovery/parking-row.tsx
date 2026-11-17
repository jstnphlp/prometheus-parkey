import type { DiscoveryParking } from '@parkey/shared-types'
import { StyleSheet, Text, View } from 'react-native'

import { createThemedStyles } from '../theme-provider'
import type { ParkingReference } from './model'
import { parkingDetailData } from './parking-detail-data'
import { parkingRowText } from './presentation'
import { MotionPressable } from './motion'
import { fonts } from '../theme'
import { useUI } from './ui'

export const PARKING_ROW_HEIGHT = 114
export function ParkingRow({
  parking,
  reference,
  now = new Date(),
  onPress,
  selected = false,
  testID,
}: {
  parking: DiscoveryParking
  reference: ParkingReference
  now?: Date
  onPress: () => void
  onDirections?: () => void
  onFavorite?: () => void
  favorite?: boolean
  disabled?: boolean
  selected?: boolean
  compact?: boolean
  testID?: string | undefined
}) {
  const ui = useUI()
  const styles = useStyles()

  const text = parkingDetailData(parking, null, now)
  const row = parkingRowText(parking, reference, now)
  const summary = [text.meta, `${row.distance} · straight-line`]
    .filter(Boolean)
    .join(' · ')
  return (
    <View testID={testID} style={[styles.row, selected && styles.selected]}>
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel={`${text.title}. ${summary}. Open parking details`}
        onPress={onPress}
        style={({ pressed }) => [styles.content, pressed && ui.pressed]}
      >
        <View style={styles.badge}>
          <Text style={styles.parkingLetter}>P</Text>
        </View>
        <View style={ui.flex}>
          <Text style={styles.title} numberOfLines={1}>
            {text.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {summary}
          </Text>
        </View>
      </MotionPressable>
    </View>
  )
}
const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    row: {
      minHeight: 103,
      marginBottom: 11,
      padding: 12,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    badge: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 0,
      minHeight: 60,
      gap: 14,
      borderRadius: 12,
    },
    parkingLetter: {
      fontFamily: fonts.bold,
      fontSize: 30,
      lineHeight: 38,
      color: colors.onAction,
    },
    title: {
      fontFamily: fonts.semibold,
      fontSize: 18,
      lineHeight: 24,
      color: colors.ink,
    },
    subtitle: {
      fontFamily: fonts.medium,
      fontSize: 12,
      lineHeight: 18,
      color: colors.muted,
      marginTop: 12,
    },
    selected: { backgroundColor: colors.selected },
  }),
)
