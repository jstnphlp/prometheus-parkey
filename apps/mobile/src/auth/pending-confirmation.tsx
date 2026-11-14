import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { ComponentRef } from 'react'
import { useFocusEffect } from 'expo-router'
import { useIsFocused } from 'expo-router/react-navigation'
import {
  ActivityIndicator,
  AppState,
  Keyboard,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { TextInput } from 'react-native'

import { BrandButton } from '../components/brand-button'
import { BrandIcon } from '../components/brand-icon'
import { usePopup } from '../components/popup-provider'
import { colors, typography } from '../theme'

import { watchConfirmation } from './confirmation-watch'
import { authErrorCode, authFeedback } from './feedback'
import { FormField } from './form-field'
import { useAuth } from './provider'

export function PendingConfirmation({
  email,
  password,
  setPassword,
  resend,
}: {
  email: string
  password: string
  setPassword: (password: string) => void
  resend: () => Promise<void>
}) {
  const auth = useAuth()
  const popup = usePopup()
  const focused = useIsFocused()
  const [foreground, setForeground] = useState(
    AppState.currentState === 'active',
  )
  const [progress, setProgress] = useState<'waiting' | 'checking' | 'paused'>(
    'waiting',
  )
  const [revision, setRevision] = useState(0)
  const [resumePassword, setResumePassword] = useState('')
  const input = useRef<ComponentRef<typeof TextInput>>(null)
  const monitor = useRef<ReturnType<typeof watchConfirmation> | null>(null)
  const latest = useRef({ auth, popup, setPassword })
  useLayoutEffect(() => {
    latest.current = { auth, popup, setPassword }
  }, [auth, popup, setPassword])
  const clearSecrets = useCallback(() => {
    monitor.current?.stop()
    latest.current.setPassword('')
    setResumePassword('')
  }, [])
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active')
      if (state !== 'active') clearSecrets()
    })
    return () => subscription.remove()
  }, [clearSecrets])
  useFocusEffect(useCallback(() => () => clearSecrets(), [clearSecrets]))
  useEffect(() => {
    if (!focused || !foreground || !password) return
    const watcher = watchConfirmation({
      async check() {
        if (latest.current.auth.busy) return false
        try {
          // A real credential check, not a public email-status lookup. The
          // password stays in memory, and the session is not remembered.
          await latest.current.auth.signIn(email, password, false)
          return true
        } catch (error) {
          if (authErrorCode(error) === 'email_not_confirmed') return false
          throw error
        }
      },
      checking: () => setProgress('checking'),
      waiting: () => setProgress('waiting'),
      confirmed() {
        clearSecrets()
        // The signed-in parent opens discovery through SignedInRedirect.
      },
      expired() {
        clearSecrets()
        setProgress('paused')
      },
      failed(error) {
        setProgress('paused')
        clearSecrets()
        latest.current.popup.show({
          ...authFeedback(error, 'Could not check confirmation'),
          returnFocus: () => input.current?.focus(),
          primary: { title: 'Try again' },
          secondary: { title: 'Not now', restoreFocus: false },
        })
      },
    })
    monitor.current = watcher
    return () => {
      watcher.stop()
      if (monitor.current === watcher) monitor.current = null
    }
  }, [email, password, focused, foreground, revision, clearSecrets])

  function resume() {
    if (!resumePassword) {
      input.current?.focus()
      return
    }
    Keyboard.dismiss()
    setPassword(resumePassword)
    setResumePassword('')
    setProgress('waiting')
    setRevision((value) => value + 1)
  }
  return (
    <View style={styles.content}>
      <BrandIcon name="mail" color={colors.cyan} size={44} />
      <Text style={styles.body}>
        Confirm from the email on any device. Parkey will continue here
        automatically.
      </Text>
      {!password ? (
        <>
          <Text style={styles.body}>
            Enter your password to continue checking.
          </Text>
          <FormField
            label="Password"
            icon="lock"
            password
            value={resumePassword}
            onChangeText={setResumePassword}
            inputRef={input}
            autoComplete="current-password"
            editable={!auth.busy}
            returnKeyType="go"
            onSubmitEditing={resume}
          />
          <BrandButton title="Continue" onPress={resume} disabled={auth.busy} />
        </>
      ) : (
        <>
          <View style={styles.status} accessibilityLiveRegion="polite">
            {progress === 'checking' ? (
              <ActivityIndicator color={colors.cyan} />
            ) : null}
            <Text style={styles.body}>
              {progress === 'checking'
                ? 'Checking confirmation…'
                : progress === 'paused'
                  ? 'Automatic checks paused'
                  : 'Waiting for confirmation'}
            </Text>
          </View>
          <BrandButton
            title={progress === 'paused' ? 'Resume checking' : 'Check now'}
            variant="text"
            disabled={auth.busy}
            onPress={() => {
              if (progress === 'paused') {
                setProgress('waiting')
                setRevision((value) => value + 1)
              } else void monitor.current?.checkNow()
            }}
          />
        </>
      )}
      <BrandButton
        title="Resend confirmation email"
        variant="text"
        disabled={auth.busy}
        onPress={() => void resend()}
      />
    </View>
  )
}
const styles = StyleSheet.create({
  content: { marginTop: 32, gap: 20 },
  body: { ...typography.body, color: colors.white },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10 },
})
