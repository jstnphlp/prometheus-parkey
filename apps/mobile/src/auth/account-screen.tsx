import { useEffect, useRef } from 'react'
import { useRouter } from 'expo-router'
import { useIsFocused } from 'expo-router/react-navigation'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { SettingsLinks } from '../settings/settings-screen'
import { useTheme, createThemedStyles } from '../theme-provider'
import { BrandButton } from '../components/brand-button'
import { BrandIcon } from '../components/brand-icon'
import { usePopup } from '../components/popup-provider'
import { typography } from '../theme'
import { profileComplete } from '../onboarding/profile'
import { AuthShell } from './auth-shell'
import { useAuth } from './provider'
import { AuthChoices } from './auth-choices'

export function AccountScreen() {
  const { entryColors: colors } = useTheme()
  const styles = useStyles()

  const auth = useAuth()
  const focused = useIsFocused()
  const signingInFromChoices = useRef(false)
  const router = useRouter()
  const popup = usePopup()
  const name: unknown = auth.state.user?.user_metadata.full_name
  useEffect(() => {
    if (!focused) {
      signingInFromChoices.current = false
      return
    }
    if (
      auth.state.status === 'signed-out' ||
      auth.state.status === 'unavailable'
    )
      signingInFromChoices.current = true
    if (signingInFromChoices.current && auth.state.status === 'signed-in') {
      signingInFromChoices.current = false
      router.replace('/account-setup')
    }
  }, [auth.state.status, focused, router])
  async function signOut() {
    try {
      const revoked = await auth.signOut()
      popup.show({
        tone: revoked ? 'success' : 'warning',
        title: 'Signed out',
        message: revoked
          ? 'Your saved parking stays on this device.'
          : 'Signed out on this device. Server sign-out could not be confirmed.',
      })
    } catch {
      popup.show({
        tone: 'error',
        title: 'Could not sign out',
        message: 'Could not clear secure storage. Please try again.',
        primary: {
          title: 'Retry',
          onPress: () => void signOut(),
          restoreFocus: false,
        },
        secondary: { title: 'Not now' },
      })
    }
  }
  if (auth.state.status === 'signed-out' || auth.state.status === 'unavailable')
    return <AuthChoices />
  return (
    <AuthShell title="Your account" subtitle="Your Parkey account">
      <View style={styles.content}>
        <SettingsLinks />
        {auth.state.status === 'checking' ? (
          <ActivityIndicator
            color={colors.cyan}
            accessibilityLabel="Checking session"
          />
        ) : auth.state.status === 'signed-in' ? (
          <>
            <Text style={styles.body}>
              Signed in
              {typeof name === 'string' && name.trim() ? ` as ${name}` : ''}
            </Text>
            <Text style={styles.body}>{auth.state.user.email}</Text>
            {!profileComplete(auth.state.user) ? (
              <BrandButton
                title="Complete your profile"
                disabled={auth.busy}
                onPress={() => router.push('/account-setup')}
              />
            ) : null}
            <BrandButton
              title="Sign out"
              busy={auth.busy}
              onPress={() =>
                popup.show({
                  tone: 'warning',
                  title: 'Sign out?',
                  message:
                    'Your saved parking and appearance stay on this device.',
                  primary: {
                    title: 'Sign out',
                    onPress: () => void signOut(),
                    restoreFocus: false,
                  },
                  secondary: { title: 'Stay signed in' },
                })
              }
            />
          </>
        ) : auth.state.status === 'recovery' ? (
          <>
            <BrandIcon name="lock" color={colors.cyan} size={44} />
            <BrandButton
              title="Continue password reset"
              onPress={() => router.replace('/reset-password')}
            />
            <BrandButton
              title="Cancel and sign out"
              onPress={() => void signOut()}
              busy={auth.busy}
            />
          </>
        ) : (
          <>
            <Text style={styles.body}>
              {auth.state.status === 'error'
                ? 'Session unavailable'
                : auth.state.status === 'unavailable'
                  ? 'Sign-in unavailable'
                  : 'Exploring as a guest'}
            </Text>
            {auth.state.status === 'error' ? (
              <>
                <BrandButton
                  title="Retry session check"
                  onPress={() => void auth.retry()}
                />
                <BrandButton
                  title="Sign out of this device"
                  onPress={() => void signOut()}
                  busy={auth.busy}
                />
              </>
            ) : null}
            <BrandButton
              title="Log In"
              disabled={auth.busy}
              onPress={() => router.push('/login')}
            />
            <BrandButton
              title="Create an Account"
              variant="text"
              disabled={auth.busy}
              onPress={() => router.push('/register')}
            />
          </>
        )}
      </View>
    </AuthShell>
  )
}
const useStyles = createThemedStyles(({ entryColors: colors }) =>
  StyleSheet.create({
    content: { marginTop: 32, gap: 16 },
    body: { ...typography.body, color: colors.text },
  }),
)
