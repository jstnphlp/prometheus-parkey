import { useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import { BrandButton } from '../components/brand-button'

import { useOnboarding } from './provider'

export function BackButton({ backgroundColor }: { backgroundColor: string }) {
  const router = useRouter()
  const { completed } = useOnboarding()
  return (
    <View style={styles.row}>
      <BrandButton
        title="Back"
        variant="text"
        style={{ backgroundColor }}
        onPress={() => {
          if (router.canGoBack()) router.back()
          else router.replace(completed ? '/' : '/welcome')
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { width: '100%', alignItems: 'flex-start' },
})
