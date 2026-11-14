import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Redirect,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router'
import { useIsFocused } from 'expo-router/react-navigation'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { BrandButton } from '../components/brand-button'
import { usePopup } from '../components/popup-provider'
import { colors } from '../theme'

import { AuthShell } from './auth-shell'
import { authFeedback } from './feedback'
import { callbackCode } from './links'
import { useAuth } from './provider'
import { SignedInRedirect } from './signed-in-redirect'

export function OAuthCallbackScreen() {
  const auth = useAuth()
  const params = useLocalSearchParams()
  const router = useRouter()
  const popup = usePopup()
  const focused = useIsFocused()
  const attempted = useRef<string | null>(null)
  const latestCode = useRef<string | null>(null)
  const active = useRef(false)
  const [failed, setFailed] = useState<string | null>(null)
  const code = callbackCode(params)
  useFocusEffect(
    useCallback(() => {
      active.current = true
      return () => {
        active.current = false
      }
    }, []),
  )
  useEffect(() => {
    if (!code && focused)
      popup.show({
        tone: 'error',
        title: 'Sign-in link unavailable',
        message: 'Return to Log In and try again.',
        group: 'auth-system',
        onceKey: 'oauth-invalid-link',
      })
  }, [code, focused, popup])
  useEffect(() => {
    latestCode.current = code
    if (
      !focused ||
      auth.busy ||
      auth.state.status === 'checking' ||
      auth.state.status === 'signed-in' ||
      auth.state.status === 'recovery'
    )
      return
    if (!code) return
    if (attempted.current === code) return
    attempted.current = code
    void auth.oauthCallback(code).catch((error) => {
      if (!active.current || latestCode.current !== code) return
      setFailed(code)
      popup.show(authFeedback(error, 'Could not sign in'))
    })
  }, [auth, code, focused, popup])
  if (auth.state.status === 'signed-in') return <SignedInRedirect />
  if (auth.state.status === 'recovery')
    return <Redirect href="/reset-password" />
  return (
    <AuthShell
      title={
        failed === code || !code ? 'Sign-in not completed' : 'Signing you in'
      }
      subtitle="Securely connecting to Parkey"
    >
      <View style={styles.content}>
        {auth.busy || auth.state.status === 'checking' ? (
          <ActivityIndicator
            color={colors.cyan}
            accessibilityLabel="Checking secure sign-in"
          />
        ) : null}
        <BrandButton
          title="Back to Log In"
          variant="text"
          disabled={auth.busy}
          onPress={() => router.replace('/login')}
        />
      </View>
    </AuthShell>
  )
}
const styles = StyleSheet.create({ content: { marginTop: 32, gap: 20 } })
