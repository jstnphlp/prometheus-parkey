import { StyleSheet, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'

import { useTheme, createThemedStyles } from '../theme-provider'
import { BrandLogo } from '../components/brand-logo'

export function SplashScreen() {
  const { dark } = useTheme()
  const styles = useStyles()

  return (
    <View style={styles.screen}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <BrandLogo variant="splash" />
    </View>
  )
}

const useStyles = createThemedStyles(({ entryColors: colors }) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.canvas,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
)
