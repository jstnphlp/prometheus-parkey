import type { User } from '@supabase/supabase-js'
import { useCallback, useRef } from 'react'
import { useFocusEffect } from 'expo-router'
import { ActivityIndicator, StyleSheet } from 'react-native'

import { useTheme } from '../theme-provider'
import { BrandButton } from '../components/brand-button'
import { ScreenContainer } from '../components/screen-container'
import { useCompletion } from '../onboarding/use-completion'
import { postAuthDestination } from './setup-access'

// Use the same durable completion/history cleanup as the introduction, including
// when Login was opened directly from Welcome before onboarding was completed.
export function SignedInRedirect({ user }: { user: User }) {
  const { entryColors: colors } = useTheme()

  const destination = postAuthDestination(user)
  const { finish, busy } = useCompletion(destination)
  const attempted = useRef(false)
  useFocusEffect(
    useCallback(() => {
      if (attempted.current) return
      attempted.current = true
      void finish()
    }, [finish]),
  )
  return (
    <ScreenContainer
      backgroundColor={colors.dark}
      contentStyle={styles.content}
    >
      {busy ? (
        <ActivityIndicator
          color={colors.cyan}
          accessibilityLabel={
            destination === '/' ? 'Opening discovery' : 'Opening account setup'
          }
        />
      ) : (
        <BrandButton
          title={
            destination === '/'
              ? 'Explore parking'
              : 'Continue to account setup'
          }
          onPress={() => void finish()}
        />
      )}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({ content: { justifyContent: 'center' } })
