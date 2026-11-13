import { useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

import { BrandButton } from '../components/brand-button'
import { BrandLogo } from '../components/brand-logo'
import { ScreenContainer } from '../components/screen-container'
import { colors, spacing, typography } from '../theme'

import { BackButton } from './back-button'
import { useCompletion } from './use-completion'

// Phase 1 destinations only. No credentials collected or simulated auth success.
export function AccountDestination({ mode }: { mode: 'register' | 'login' }) {
  const router = useRouter()
  const { finish, busy, error } = useCompletion('/')
  const registering = mode === 'register'
  return (
    <ScreenContainer
      backgroundColor={registering ? colors.plum : colors.dark}
      contentStyle={styles.content}
      overlay={<BackButton />}
    >
      <BrandLogo variant="account" />
      <Text
        accessibilityRole="header"
        style={[
          styles.title,
          registering ? typography.accountTitle : typography.loginTitle,
        ]}
      >
        {registering ? (
          'Create an Account'
        ) : (
          <>
            <Text style={styles.cyan}>Sign in</Text> to your{'\n'}Account
          </>
        )}
      </Text>
      <Text style={styles.subtitle}>
        {registering
          ? 'Start discovering parking with Parkey'
          : 'Welcome back to Parkey'}
      </Text>
      <View style={styles.message}>
        <Text style={styles.body}>
          {registering
            ? 'Account registration is not available in this build.'
            : 'Sign-in is not available in this build.'}
        </Text>
        <Text style={styles.body}>
          You can explore parking without an account.
        </Text>
      </View>
      {error ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.body}
        >
          {error}
        </Text>
      ) : null}
      <BrandButton title="Explore parking" busy={busy} onPress={finish} />
      <BrandButton
        title={
          registering ? 'Already have an account? Log In' : 'Create an Account'
        }
        variant="text"
        disabled={busy}
        onPress={() => router.replace(registering ? '/login' : '/register')}
        style={styles.alternate}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: 18,
    paddingBottom: spacing.xl,
  },
  title: {
    color: colors.white,
    marginTop: 17,
  },
  cyan: { color: colors.cyan },
  subtitle: {
    ...typography.accountBody,
    color: colors.white,
    marginTop: spacing.sm,
  },
  message: { paddingVertical: spacing.xxl, gap: spacing.md },
  body: { ...typography.body, color: colors.white },
  alternate: { marginTop: spacing.md },
})
