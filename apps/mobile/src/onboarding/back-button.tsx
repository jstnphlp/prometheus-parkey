import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'

import { Icon } from '../discovery/ui'
import { useTheme } from '../theme-provider'
import { useOnboarding } from './provider'

export function BackButton({
  backgroundColor,
  onPress,
}: {
  backgroundColor: string
  onPress?: () => void
}) {
  const { colors } = useTheme()
  const router = useRouter()
  const { completed } = useOnboarding()
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={{
          backgroundColor,
          width: 48,
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onPress={() => {
          if (onPress) {
            onPress()
            return
          }
          if (router.canGoBack()) router.back()
          else router.replace(completed ? '/' : '/welcome')
        }}
      >
        <Icon name="back" color={colors.back} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { width: '100%', alignItems: 'flex-start' },
})
