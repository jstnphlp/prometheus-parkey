import { StyleSheet, useWindowDimensions, View } from 'react-native'

import { useTheme } from '../theme-provider'
import { FigmaAsset } from './figma-assets'

// Decorative exports from the arrival frame. Real map and route data remain underneath.
export function ArrivalCelebration() {
  const { colors } = useTheme()

  const { width } = useWindowDimensions()
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={[
        styles.scene,
        { transform: [{ scale: Math.min(1, width / 390) }] },
      ]}
    >
      <View style={{ position: 'absolute', left: 130, top: 184 }}>
        <FigmaAsset name="arrival-ring" size={130} />
      </View>
      <View style={{ position: 'absolute', left: 145, top: 147 }}>
        <FigmaAsset name="arrived" size={99} />
      </View>
      {(
        [
          [130, 25, -35, colors.action],
          [259, 44, 30, colors.brand],
          [60, 159, -20, colors.amber],
          [330, 170, -60, colors.brand],
          [107, 129, 50, colors.selected],
          [284, 145, -15, colors.action],
        ] as const
      ).map(([left, top, angle, backgroundColor], index) => (
        <View
          key={`bar-${index}`}
          style={{
            position: 'absolute',
            left,
            top,
            width: 16,
            height: 7,
            borderRadius: 3,
            backgroundColor,
            transform: [{ rotate: `${angle}deg` }],
          }}
        />
      ))}
      {(
        [
          ['confetti', 96, 84],
          ['confetti-1', 300, 104],
          ['confetti-2', 170, 4],
          ['confetti-3', 232, 0],
          ['confetti-1', 44, 234],
          ['confetti-2', 346, 264],
        ] as const
      ).map(([name, left, top], index) => (
        <View key={index} style={{ position: 'absolute', left, top }}>
          <FigmaAsset name={name} size={10} />
        </View>
      ))}
    </View>
  )
}
const styles = StyleSheet.create({
  scene: {
    position: 'absolute',
    top: '10%',
    width: 390,
    height: 314,
    alignSelf: 'center',
  },
})
