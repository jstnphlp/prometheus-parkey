import { StyleSheet, Text, View } from 'react-native'

import { BrandButton } from '../components/brand-button'
import { ScreenContainer } from '../components/screen-container'
import { colors, spacing, typography } from '../theme'

import { useOnboarding } from './provider'

export function StorageRecovery() {
  const { retry, continueThisTime } = useOnboarding()
  return (
    <ScreenContainer
      backgroundColor={colors.plum}
      contentStyle={styles.content}
    >
      <Text accessibilityRole="header" style={styles.title}>
        Your progress could not be read.
      </Text>
      <Text style={styles.body}>
        Try again, or continue this time. If you continue, onboarding may appear
        again on your next launch. Your saved parking will not be changed.
      </Text>
      <View style={styles.actions}>
        <BrandButton title="Try again" onPress={retry} />
        <BrandButton
          title="Continue this time"
          variant="text"
          onPress={continueThisTime}
        />
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  title: { ...typography.subtitle, color: colors.white },
  body: { ...typography.body, color: colors.onPlumMuted },
  actions: { gap: spacing.sm },
})
