import { useCallback, useRef, useState } from 'react'
import type { ComponentRef } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { BackHandler, Keyboard, StyleSheet, Text, View } from 'react-native'
import type { TextInput } from 'react-native'

import { useTheme, createThemedStyles } from '../theme-provider'
import { BrandButton } from '../components/brand-button'
import { BrandIcon } from '../components/brand-icon'
import { usePopup } from '../components/popup-provider'
import { typography } from '../theme'
import { AuthShell } from './auth-shell'
import { authFeedback } from './feedback'
import { FormField } from './form-field'
import { useAuth } from './provider'
import { PasswordRequirements } from './password-requirements'
import { SignedInRedirect } from './signed-in-redirect'
import { emailProblem, passwordGuidance, passwordProblem } from './validation'

export function ForgotPasswordScreen() {
  const styles = useStyles()
  const router = useRouter()

  const auth = useAuth()
  const popup = usePopup()
  const emailInput = useRef<ComponentRef<typeof TextInput>>(null)
  const [email, setEmail] = useState('')
  const [requested, setRequested] = useState(false)
  const focused = useRef(false)
  useFocusEffect(
    useCallback(() => {
      focused.current = true
      return () => {
        focused.current = false
      }
    }, []),
  )
  async function send() {
    if (auth.busy) return
    const problem = emailProblem(email)
    if (problem) {
      popup.show({
        tone: 'warning',
        title: 'Check your email address',
        message: problem,
        returnFocus: () => emailInput.current?.focus(),
      })
      return
    }
    Keyboard.dismiss()
    try {
      await auth.sendEmail(email, 'recovery')
      if (focused.current) setRequested(true)
    } catch (error) {
      if (focused.current)
        popup.show({
          ...authFeedback(error, 'Could not send reset email'),
          primary: {
            title: 'Retry',
            onPress: () => void send(),
            restoreFocus: false,
          },
          secondary: { title: 'Not now' },
          returnFocus: () => emailInput.current?.focus(),
        })
    }
  }
  if (auth.state.status === 'signed-in') return <SignedInRedirect />
  return (
    <AuthShell
      recovery
      title={requested ? 'Check your email' : 'Forgot your\npassword?'}
      subtitle={
        requested
          ? 'Open the latest reset link on this device'
          : 'Enter the email linked to your account and we’ll send a reset link.'
      }
    >
      <View style={[styles.form, styles.forgotForm]}>
        {requested ? (
          <Text style={styles.body}>
            If an account exists, check your inbox and spam. Open the latest
            reset link on this device.
          </Text>
        ) : null}
        <FormField
          label="Email address"
          icon="mail"
          value={email}
          onChangeText={(value) => {
            setEmail(value)
            setRequested(false)
          }}
          autoComplete="email"
          keyboardType="email-address"
          returnKeyType="send"
          maxLength={254}
          inputRef={emailInput}
          editable={!auth.busy}
          onSubmitEditing={() => void send()}
        />
        <Text style={[styles.body, { marginTop: 44 }]}>
          Check that the email address is correct before continuing.
        </Text>
        <BrandButton
          title={requested ? 'Send another reset email' : 'Send Reset Link'}
          busy={auth.busy}
          disabled={
            auth.state.status === 'checking' ||
            auth.state.status === 'unavailable'
          }
          onPress={() => void send()}
          style={{ marginTop: 52, minHeight: 58, borderRadius: 15 }}
        />
        <BrandButton
          title="Back to Sign In"
          variant="text"
          onPress={() => router.replace('/login')}
          style={{ marginTop: 36, minHeight: 52 }}
        />
        <Text
          style={[
            styles.body,
            {
              marginTop: 32,
              fontSize: 12,
              lineHeight: 18,
              textAlign: 'center',
            },
          ]}
        >
          For privacy, Parkey does not reveal whether an account exists.
        </Text>
      </View>
    </AuthShell>
  )
}

export function ResetPasswordScreen() {
  const { entryColors: colors } = useTheme()
  const styles = useStyles()

  const auth = useAuth()
  const { busy, signOut } = auth
  const router = useRouter()
  const popup = usePopup()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [done, setDone] = useState(false)
  const focused = useRef(false)
  const passwordInput = useRef<ComponentRef<typeof TextInput>>(null)
  const confirmationInput = useRef<ComponentRef<typeof TextInput>>(null)
  const cancel = useCallback(async () => {
    if (busy) return
    try {
      await signOut()
      if (focused.current) router.replace('/login')
    } catch {
      if (focused.current)
        popup.show({
          tone: 'error',
          title: 'Could not sign out',
          message: 'Could not clear secure storage. Please try again.',
        })
    }
  }, [busy, signOut, router, popup])
  useFocusEffect(
    useCallback(() => {
      focused.current = true
      return () => {
        focused.current = false
        setPassword('')
        setConfirmation('')
      }
    }, []),
  )
  useFocusEffect(
    useCallback(() => {
      const listener = BackHandler.addEventListener('hardwareBackPress', () => {
        void cancel()
        return true
      })
      return () => listener.remove()
    }, [cancel]),
  )
  async function save() {
    if (auth.busy) return
    const problem = passwordProblem(password)
    if (problem) {
      passwordInput.current?.focus()
      return
    }
    if (!confirmation || password !== confirmation) {
      popup.show({
        tone: 'warning',
        title: 'Passwords do not match',
        message: 'Enter the same password in both fields.',
        returnFocus: () => confirmationInput.current?.focus(),
      })
      return
    }
    Keyboard.dismiss()
    try {
      await auth.updatePassword(password)
      setPassword('')
      setConfirmation('')
      const revoked = await auth.signOut()
      if (focused.current) {
        setDone(true)
        if (!revoked)
          popup.show({
            tone: 'warning',
            title: 'Signed out on this device',
            message:
              'Server sign-out could not be confirmed. Reconnect before using other sessions.',
          })
      }
    } catch (error) {
      if (focused.current)
        popup.show({
          ...authFeedback(error, 'Could not update password'),
          returnFocus: () => passwordInput.current?.focus(),
          primary: {
            title: 'Retry',
            onPress: () => void save(),
            restoreFocus: false,
          },
          secondary: { title: 'Not now' },
        })
    }
  }
  const authorized = auth.state.status === 'recovery'
  return (
    <AuthShell
      title={done ? 'Password changed' : 'Choose a new password'}
      subtitle={
        done ? 'Log in with your new password' : 'Secure your Parkey account'
      }
      onBack={() => void cancel()}
    >
      <View style={styles.form}>
        {done ? (
          <BrandButton
            title="Back to Log In"
            onPress={() => router.replace('/login')}
          />
        ) : authorized ? (
          <>
            <FormField
              label="New password"
              icon="lock"
              password
              value={password}
              onChangeText={setPassword}
              autoComplete="new-password"
              accessibilityHint={passwordGuidance}
              editable={!auth.busy}
              inputRef={passwordInput}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => confirmationInput.current?.focus()}
            />
            <PasswordRequirements password={password} />
            <FormField
              label="Confirm password"
              icon="shield-check"
              password
              value={confirmation}
              onChangeText={setConfirmation}
              autoComplete="new-password"
              editable={!auth.busy}
              inputRef={confirmationInput}
              returnKeyType="go"
              onSubmitEditing={() => void save()}
            />
            <BrandButton
              title="Update password"
              busy={auth.busy}
              onPress={() => void save()}
            />
          </>
        ) : (
          <>
            <BrandIcon name="lock" color={colors.cyan} size={44} />
            <Text style={styles.body}>
              {auth.state.status === 'checking'
                ? 'Checking session…'
                : 'Open a reset link from this device.'}
            </Text>
            {auth.state.status === 'error' ? (
              <BrandButton
                title="Retry session check"
                onPress={() => void auth.retry()}
              />
            ) : null}
            <BrandButton
              title="Request a new reset link"
              onPress={() => router.replace('/forgot-password')}
            />
          </>
        )}
        {!done ? (
          <BrandButton
            title="Cancel password reset"
            variant="text"
            disabled={auth.busy}
            onPress={() => void cancel()}
          />
        ) : null}
      </View>
    </AuthShell>
  )
}

const useStyles = createThemedStyles(({ entryColors: colors }) =>
  StyleSheet.create({
    form: { marginTop: 32, gap: 16 },
    forgotForm: { marginTop: 80, gap: 0 },
    body: { ...typography.body, color: colors.text },
  }),
)
