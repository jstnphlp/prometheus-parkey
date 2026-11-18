import { StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { useTheme } from '../theme-provider'

/** SVG uses the same palette and rendering approach as the existing icons. */
export function ChipFade() {
  const { colors } = useTheme()

  return (
    <View pointerEvents="none" accessible={false} style={styles.edge}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="chip-edge" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.canvas} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.canvas} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#chip-edge)" />
      </Svg>
    </View>
  )
}
const styles = StyleSheet.create({
  edge: { position: 'absolute', right: 0, top: 0, bottom: 4, width: 28 },
})
