import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'

import { FigmaAsset } from './figma-assets'
import { MotionPressable, MotionView } from './motion'
import { colors } from './palette'
import { fonts } from './typography'
import { useReducedMotion } from './use-reduced-motion'

export type DiscoveryTab = 'map' | 'saved' | 'you'
export const TAB_BAR_HEIGHT = 64
const tabs = [
  { id: 'map', label: 'Map', icon: 'map', active: 'map-active' },
  { id: 'saved', label: 'Saved', icon: 'saved', active: 'saved-active' },
  { id: 'you', label: 'You', icon: 'user', active: 'user-active' },
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
  const reduced = useReducedMotion()
  const [layouts, setLayouts] = useState<
    Partial<Record<DiscoveryTab, { x: number; width: number }>>
  >({})
  const [offset] = useState(() => new Animated.Value(0))
  const [width] = useState(() => new Animated.Value(0))
  const initialized = useRef(false)
  const layout = layouts[selected]
  useEffect(() => {
    if (!layout) return
    const duration = reduced || !initialized.current ? 0 : 220
    initialized.current = true
    const animation = Animated.parallel(
      [
        { value: offset, toValue: layout.x },
        { value: width, toValue: layout.width },
      ].map(({ value, toValue }) =>
        Animated.timing(value, {
          toValue,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ),
    )
    animation.start()
    return () => animation.stop()
  }, [layout, offset, width, reduced])
  return (
    <View
      onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
      style={[styles.row, { bottom: Math.max(bottom, 24) }]}
    >
      <View accessibilityRole="tablist" style={styles.bar}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            { width, transform: [{ translateX: offset }] },
          ]}
        />
        {tabs.map((tab) => (
          <MotionPressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: selected === tab.id }}
            onLayout={({ nativeEvent }) => {
              const { x, width } = nativeEvent.layout
              setLayouts((current) =>
                current[tab.id]?.x === x && current[tab.id]?.width === width
                  ? current
                  : { ...current, [tab.id]: { x, width } },
              )
            }}
            onPress={() => onSelect(tab.id)}
            style={({ pressed }) => [
              styles.tab,
              selected === tab.id && styles.active,
              pressed && { opacity: 0.65 },
            ]}
          >
            <FigmaAsset
              name={selected === tab.id ? tab.active : tab.icon}
              size={24}
            />
            {selected === tab.id ? (
              <MotionView>
                <Text style={styles.label}>{tab.label}</Text>
              </MotionView>
            ) : null}
          </MotionPressable>
        ))}
      </View>
      {onAdd ? (
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Add a spot"
          onPress={onAdd}
          style={styles.add}
        >
          <FigmaAsset name="add-spot" size={24} />
        </MotionPressable>
      ) : null}
    </View>
  )
}
const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    maxWidth: 620,
    marginHorizontal: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 4,
    borderRadius: 999,
    backgroundColor: colors.dark,
    boxShadow: '0px 8px 24px rgba(30,27,56,0.16)',
  },
  tab: {
    minHeight: 48,
    padding: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    borderRadius: 999,
    backgroundColor: colors.brand,
  },
  active: { paddingHorizontal: 18 },
  add: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.surface,
  },
})
