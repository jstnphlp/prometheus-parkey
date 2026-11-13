import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { BrandButton } from '../components/brand-button'
import { colors } from '../theme'

import { Notice } from './account-form'
import { AuthShell } from './auth-shell'
import { callbackCode } from './links'
import { useAuth } from './provider'
import { authErrorMessage } from './validation'

export function CallbackScreen() {
  const auth = useAuth()
  const params = useLocalSearchParams()
  const router = useRouter()
  const attemptedCode = useRef<string | null>(null)
  const latestCode = useRef<string | null>(null)
  const focused = useRef(false)
  const [failure, setMessage] = useState<{
    code: string
    message: string
  } | null>(null)
  const code = callbackCode(params)
  const message =
    !code || auth.state.status === 'unavailable'
      ? 'This email link is invalid or cannot be verified here. Request a new email from this app on this device.'
      : failure?.code === code
        ? failure.message
        : null
  useFocusEffect(
    useCallback(() => {
      focused.current = true
      return () => {
        focused.current = false
      }
    }, []),
  )
  useEffect(() => {
    latestCode.current = code
    if (
      !code ||
      attemptedCode.current === code ||
      auth.busy ||
      auth.state.status === 'checking' ||
      auth.state.status === 'unavailable'
    )
      return
    attemptedCode.current = code
    void auth
      .callback(code)
      .then((kind) => {
        if (focused.current && latestCode.current === code)
          router.replace(kind === 'recovery' ? '/reset-password' : '/account')
      })
      .catch((error) => {
        if (focused.current && latestCode.current === code)
          setMessage({ code, message: authErrorMessage(error) })
      })
  }, [auth, code, router])
  return (
    <AuthShell
      title="Verify your email link"
      subtitle="Securely connecting to Parkey"
    >
      <View style={styles.content}>
        {message ? (
          <>
            <Notice text={message} />
            <BrandButton
              title="Request a password reset"
              onPress={() => router.replace('/forgot-password')}
            />
            <BrandButton
              title="Back to Log In"
              variant="text"
              onPress={() => router.replace('/login')}
            />
          </>
        ) : (
          <ActivityIndicator
            color={colors.cyan}
            accessibilityLabel="Verifying email link"
          />
        )}
      </View>
    </AuthShell>
  )
}
const styles = StyleSheet.create({ content: { marginTop: 32, gap: 16 } })
