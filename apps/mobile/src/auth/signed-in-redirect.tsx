import { useEffect, useRef } from 'react'
import { ActivityIndicator, StyleSheet } from 'react-native'

import { useTheme } from '../theme-provider'
import { BrandButton } from '../components/brand-button'
import { ScreenContainer } from '../components/screen-container'
import { useCompletion } from '../onboarding/use-completion'

// Use the same durable completion/history cleanup as the introduction, including
// when Login was opened directly from Welcome before onboarding was completed.
export function SignedInRedirect() {
  const { entryColors: colors } = useTheme()

  const { finish, busy } = useCompletion('/')
  const attempted = useRef(false)
  useEffect(() => {
    if (attempted.current) return
    attempted.current = true
    void finish()
  }, [finish])
  return (
    <ScreenContainer
      backgroundColor={colors.dark}
      contentStyle={styles.content}
    >
      {busy ? (
        <ActivityIndicator
          color={colors.cyan}
          accessibilityLabel="Opening Parkey"
        />
      ) : (
        <BrandButton title="Continue to Parkey" onPress={() => void finish()} />
      )}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({ content: { justifyContent: 'center' } })
