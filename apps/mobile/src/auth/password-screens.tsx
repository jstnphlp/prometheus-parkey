import { useCallback, useRef, useState } from 'react'
import type { ComponentRef } from 'react'
import { Redirect, useFocusEffect, useRouter } from 'expo-router'
import { BackHandler, Keyboard, StyleSheet, Text, View } from 'react-native'
import type { TextInput } from 'react-native'

import { BrandButton } from '../components/brand-button'
import { useCompletion } from '../onboarding/use-completion'
import { colors, typography } from '../theme'

import { Notice } from './account-form'
import { AuthShell } from './auth-shell'
import { FormField } from './form-field'
import { useAuth } from './provider'
import {
  authErrorMessage,
  emailProblem,
  passwordGuidance,
  passwordProblem,
} from './validation'

export function ForgotPasswordScreen() {
  const auth = useAuth()
  const guest = useCompletion('/')
  const [email, setEmail] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
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
    if (auth.busy || guest.busy) return
    setAttempted(true)
    setMessage(null)
    if (emailProblem(email)) return
    Keyboard.dismiss()
    try {
      await auth.sendEmail(email, 'recovery')
      if (focused.current) setRequested(true)
    } catch (error) {
      if (focused.current) setMessage(authErrorMessage(error))
    }
  }
  if (auth.state.status === 'signed-in') return <Redirect href="/account" />
  return (
    <AuthShell
      title={requested ? 'Check your email' : 'Reset password'}
      subtitle={
        requested
          ? 'Open the latest reset link on this device'
          : 'Enter the email address for your Parkey account'
      }
    >
      <View style={styles.form}>
        {requested ? (
          <Text style={styles.body}>
            If an account exists for this address, a reset email has been
            requested. Check spam too. Open the link on the device where you
            requested it. Parking discovery remains available.
          </Text>
        ) : null}
        <FormField
          label="Email address"
          icon="✉"
          value={email}
          onChangeText={(value) => {
            setEmail(value)
            setRequested(false)
          }}
          autoComplete="email"
          keyboardType="email-address"
          returnKeyType="send"
          maxLength={254}
          editable={!auth.busy}
          error={attempted ? emailProblem(email) : null}
          onSubmitEditing={() => void send()}
        />
        <BrandButton
          title={requested ? 'Send another reset email' : 'Send reset email'}
          busy={auth.busy}
          disabled={
            auth.state.status === 'checking' ||
            auth.state.status === 'unavailable' ||
            guest.busy
          }
          onPress={() => void send()}
        />
        {auth.state.status === 'unavailable' ? (
          <Notice text="Secure authentication is unavailable in this build. Use an Android or iOS build with the public Supabase configuration." />
        ) : null}
        {message || guest.error ? (
          <Notice text={message ?? guest.error ?? ''} />
        ) : null}
        <BrandButton
          title="Explore parking as a guest"
          variant="text"
          disabled={auth.busy}
          busy={guest.busy}
          onPress={guest.finish}
        />
      </View>
    </AuthShell>
  )
}

export function ResetPasswordScreen() {
  const auth = useAuth()
  const { busy, signOut } = auth
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const focused = useRef(false)
  const confirmationInput = useRef<ComponentRef<typeof TextInput>>(null)
  const cancel = useCallback(async () => {
    if (busy) return
    try {
      await signOut()
      if (focused.current) router.replace('/login')
    } catch {
      if (focused.current)
        setMessage('Could not clear this recovery session. Try again.')
    }
  }, [busy, signOut, router])
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
    setAttempted(true)
    setMessage(null)
    if (passwordProblem(password) || !confirmation || password !== confirmation)
      return
    Keyboard.dismiss()
    try {
      await auth.updatePassword(password)
      setPassword('')
      setConfirmation('')
      const revoked = await auth.signOut()
      if (focused.current) {
        setDone(true)
        if (!revoked)
          setMessage(
            'Signed out on this device. Server sign-out could not be confirmed.',
          )
      }
    } catch (error) {
      if (focused.current) setMessage(authErrorMessage(error))
    }
  }
  const authorized = auth.state.status === 'recovery'
  return (
    <AuthShell
      title={done ? 'Password changed' : 'Choose a new password'}
      subtitle={done ? 'Log in with your new password' : passwordGuidance}
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
              icon="♙"
              password
              value={password}
              onChangeText={setPassword}
              autoComplete="new-password"
              accessibilityHint={passwordGuidance}
              editable={!auth.busy}
              error={attempted ? passwordProblem(password) : null}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => confirmationInput.current?.focus()}
            />
            <FormField
              label="Confirm password"
              icon="✉"
              password
              value={confirmation}
              onChangeText={setConfirmation}
              autoComplete="new-password"
              editable={!auth.busy}
              inputRef={confirmationInput}
              error={
                attempted && password !== confirmation
                  ? 'Passwords must match.'
                  : null
              }
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
            <Notice
              text={
                auth.state.status === 'checking'
                  ? 'Checking your secure recovery session…'
                  : 'A verified reset link is required. Request a new email from this device.'
              }
            />
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
        {message ? <Notice text={message} /> : null}
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

const styles = StyleSheet.create({
  form: { marginTop: 32, gap: 16 },
  body: { ...typography.body, color: colors.white },
})
