import { Pressable, StyleSheet, Text, View } from 'react-native'

import { fonts } from '../theme'
import { createThemedStyles, useTheme } from '../theme-provider'
import { Icon } from './ui'

export function FavoriteFeedback({
  added,
  onUndo,
}: {
  added: boolean
  onUndo: () => void
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  return (
    <View style={styles.container}>
      <View accessibilityLiveRegion="polite" style={styles.confirmation}>
        <Icon name="check" color={colors.onAction} size={18} />
        <Text style={styles.label}>
          {added ? 'Added to Saved Parking' : 'Removed from Saved Parking'}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Undo last change"
        onPress={onUndo}
        style={styles.undo}
      >
        <Text style={styles.undoText}>Undo</Text>
      </Pressable>
    </View>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    container: { alignItems: 'center', alignSelf: 'center', maxWidth: '100%' },
    confirmation: {
      minHeight: 58,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.brand,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    label: {
      flexShrink: 1,
      fontFamily: fonts.semibold,
      fontSize: 14,
      lineHeight: 20,
      color: colors.onAction,
    },
    undo: {
      minHeight: 44,
      minWidth: 70,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.canvas,
      borderRadius: 12,
    },
    undoText: {
      fontFamily: fonts.semibold,
      fontSize: 12,
      lineHeight: 18,
      color: colors.navigationActive,
    },
  }),
)
