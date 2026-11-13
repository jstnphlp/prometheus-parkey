import { StyleSheet, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'

import { BrandLogo } from '../components/brand-logo'
import { colors } from '../theme'

export function SplashScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <BrandLogo variant="splash" />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.plum,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
