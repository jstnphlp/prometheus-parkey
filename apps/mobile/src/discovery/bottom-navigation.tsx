import { StyleSheet, Text, View } from 'react-native'

import { useTheme, createThemedStyles } from '../theme-provider'
import { MotionPressable } from './motion'
import { Icon } from './ui'
import { fonts } from './typography'

export type DiscoveryTab = 'map' | 'saved' | 'you'
export const TAB_BAR_HEIGHT = 72
const tabs = [
  { id: 'map', label: 'Explore', icon: 'locate' },
  { id: 'saved', label: 'Saved', icon: 'heart' },
  { id: 'you', label: 'Profile', icon: 'person' },
] as const

export function BottomNavigation({
  selected,
  bottom,
  onHeightChange,
  onSelect,
  onAdd,
}: {
  selected: DiscoveryTab
  bottom: number
  onHeightChange?: (height: number) => void
  onSelect: (tab: DiscoveryTab) => void
  onAdd?: () => void
}) {
  const { colors } = useTheme()
  const styles = useStyles()
  return (
    <View
      onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
      style={[styles.row, { paddingBottom: Math.max(bottom, 12) }]}
    >
      <View accessibilityRole="tablist" style={styles.bar}>
        {tabs.map((tab) => {
          const active = selected === tab.id
          const color = active
            ? colors.navigationActive
            : colors.navigationInactive
          return (
            <MotionPressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
              aria-selected={active}
              onPress={() => onSelect(tab.id)}
              style={({ pressed }) => [
                styles.tab,
                pressed && { opacity: 0.65 },
              ]}
            >
              <Icon
                name={tab.icon}
                color={color}
                size={24}
                filled={active && tab.id === 'saved'}
              />
              <Text style={[styles.label, { color }]}>{tab.label}</Text>
            </MotionPressable>
          )
        })}
      </View>
      {onAdd ? (
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Add a spot"
          onPress={onAdd}
          style={styles.add}
        >
          <Icon name="plus" color={colors.onAction} size={24} />
        </MotionPressable>
      ) : null}
    </View>
  )
}
const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    row: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: 10,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.canvas,
      borderTopColor: colors.border,
      borderTopWidth: 1,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      maxWidth: 620,
      alignSelf: 'center',
    },
    tab: {
      flex: 1,
      minHeight: 60,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      padding: 6,
    },
    label: {
      fontFamily: fonts.semibold,
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
    },
    activeLine: { height: 2, width: 24, borderRadius: 2 },
    add: {
      marginLeft: 4,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
)
