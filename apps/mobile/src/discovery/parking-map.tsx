import Constants, { ExecutionEnvironment } from 'expo-constants'
import { StyleSheet, Text, View } from 'react-native'

import { createThemedStyles } from '../theme-provider'
import type { ParkingMapProps } from './map-types'
import NativeMap from './native-map'
import { useUI } from './ui'

export default function ParkingMap(props: ParkingMapProps) {
  const ui = useUI()
  const styles = useStyles()

  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return (
      <View style={styles.unavailable}>
        <Text style={ui.heading}>Parkey needs a development build</Text>
        <Text style={ui.body}>
          The interactive map uses MapLibre Native. Install the Parkey
          development build; Expo Go does not include this map renderer.
        </Text>
      </View>
    )
  }
  // MapLibre is already in the main graph through the pilot renderer. Avoid a
  // separate development chunk fetch/eval while retaining the Expo Go notice.
  return <NativeMap {...props} />
}
const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    unavailable: {
      flex: 1,
      padding: 28,
      justifyContent: 'center',
      gap: 12,
      backgroundColor: colors.canvas,
    },
  }),
)
