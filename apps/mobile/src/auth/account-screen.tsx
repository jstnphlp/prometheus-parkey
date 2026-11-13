import { useState } from 'react'
import { useRouter } from 'expo-router'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { BrandButton } from '../components/brand-button'
import { useCompletion } from '../onboarding/use-completion'
import { colors, typography } from '../theme'

import { Notice } from './account-form'
import { AuthShell } from './auth-shell'
import { useAuth } from './provider'

export function AccountScreen() {
  const auth = useAuth()
  const router = useRouter()
  const guest = useCompletion('/')
  const [notice, setNotice] = useState<string | null>(null)
  const name: unknown = auth.state.user?.user_metadata.full_name
  async function signOut() {
    try {
      const revoked = await auth.signOut()
      setNotice(
        revoked
          ? 'Signed out on this device. Your saved parking stays here.'
          : 'Signed out on this device. Server sign-out could not be confirmed. Your saved parking stays here.',
      )
    } catch {
      setNotice(
        'Could not clear secure session storage. Please retry signing out.',
      )
    }
  }
  return (
    <AuthShell
      title="Your account"
      subtitle="Parking discovery is always available without an account"
    >
      <View style={styles.content}>
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
            <BrandButton
              title="Sign out"
              busy={auth.busy}
              onPress={() => void signOut()}
            />
          </>
        ) : auth.state.status === 'recovery' ? (
          <>
            <Notice text="Finish your password reset or sign out of this recovery session." />
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
                ? 'Your session could not be verified. Reconnect and retry, sign out of this device, or continue exploring.'
                : auth.state.status === 'unavailable'
                  ? 'Secure sign-in is unavailable in this build.'
                  : 'You are exploring as a guest.'}
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
        {notice || guest.error ? (
          <Notice text={notice ?? guest.error ?? ''} />
        ) : null}
        <BrandButton
          title="Explore parking"
          variant="text"
          disabled={auth.busy}
          busy={guest.busy}
          onPress={guest.finish}
        />
        <Text style={styles.body}>
          Saved parking and onboarding progress stay on this device when you
          sign in or out.
        </Text>
      </View>
    </AuthShell>
  )
}
const styles = StyleSheet.create({
  content: { marginTop: 32, gap: 16 },
  body: { ...typography.body, color: colors.white },
})
