import { StyleSheet, Text } from 'react-native'

import { colors } from './palette'
import type { SpotDetails } from './parking-detail-data'
import { fonts } from './typography'

export function ParkingStatus({ details }: { details: SpotDetails }) {
  const free = details.fee === 'Free'
  return (
    <Text
      style={[styles.chip, free && styles.free, !details.fee && styles.unknown]}
    >
      {free ? 'Recorded no fee' : (details.fee ?? 'Fee unknown')}
    </Text>
  )
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 14.4,
    color: colors.muted,
    backgroundColor: colors.soft,
  },
  free: { backgroundColor: colors.successSurface, color: colors.success },
  unknown: { backgroundColor: colors.warningSurface, color: colors.amber },
})
