import { useCallback, useRef, useState } from 'react'
import type { ComponentRef } from 'react'
import { Redirect, useFocusEffect, useRouter } from 'expo-router'
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native'
import type { TextInput } from 'react-native'

import { BrandButton } from '../components/brand-button'
import { useCompletion } from '../onboarding/use-completion'
import { colors, fonts, typography } from '../theme'

import { AuthShell } from './auth-shell'
import { FormField } from './form-field'
import { useAuth } from './provider'
import {
  authErrorMessage,
  emailProblem,
  passwordGuidance,
  registrationProblems,
} from './validation'

export function AccountForm({ mode }: { mode: 'register' | 'login' }) {
  const auth = useAuth()
  const router = useRouter()
  const guest = useCompletion('/')
  const registering = mode === 'register'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [remember, setRemember] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const focused = useRef(false)
  const nameInput = useRef<ComponentRef<typeof TextInput>>(null)
  const emailInput = useRef<ComponentRef<typeof TextInput>>(null)
  const passwordInput = useRef<ComponentRef<typeof TextInput>>(null)
  const confirmationInput = useRef<ComponentRef<typeof TextInput>>(null)
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
  const errors = registrationProblems({ name, email, password, confirmation })
  const busy = auth.busy || guest.busy
  const ready =
    auth.state.status !== 'checking' && auth.state.status !== 'unavailable'

  async function submit() {
    if (busy) return
    setAttempted(true)
    setMessage(null)
    if (registering && errors.name) {
      nameInput.current?.focus()
      return
    }
    if (emailProblem(email)) {
      emailInput.current?.focus()
      return
    }
    if (registering ? errors.password : !password) {
      passwordInput.current?.focus()
      return
    }
    if (registering && errors.confirmation) {
      confirmationInput.current?.focus()
      return
    }
    Keyboard.dismiss()
    try {
      if (registering) {
        const signedIn = await auth.signUp(name, email, password)
        if (!focused.current) return
        setPassword('')
        setConfirmation('')
        if (signedIn) router.replace('/account')
        else {
          setPending(true)
          setAttempted(false)
        }
      } else {
        await auth.signIn(email, password, remember)
        if (focused.current) {
          setPassword('')
          router.replace('/account')
        }
      }
    } catch (error) {
      if (focused.current) setMessage(authErrorMessage(error))
    }
  }

  async function resend() {
    try {
      await auth.sendEmail(email, 'signup')
      if (focused.current)
        setMessage(
          'If confirmation is needed for this address, another email has been requested. Check spam too. Open the latest link on this device.',
        )
    } catch (error) {
      if (focused.current) setMessage(authErrorMessage(error))
    }
  }

  if (auth.state.status === 'signed-in') return <Redirect href="/account" />
  if (auth.state.status === 'recovery')
    return <Redirect href="/reset-password" />
  return (
    <AuthShell
      registering={registering}
      title={
        pending ? (
          'Check your email'
        ) : registering ? (
          'Create an Account'
        ) : (
          <>
            <Text style={styles.cyan}>Sign in</Text> to your{'\n'}Account
          </>
        )
      }
      subtitle={
        pending
          ? 'Confirm your email to finish creating your account'
          : registering
            ? 'Start discovering parking with Parkey'
            : 'Enter your email and password to log in'
      }
    >
      {pending ? (
        <View style={styles.pending}>
          <Text style={styles.body}>
            If this address can register, a confirmation email will arrive. Open
            the latest email link on this device. You can explore parking while
            you wait.
          </Text>
          <BrandButton
            title="Resend confirmation email"
            onPress={() => void resend()}
            busy={auth.busy}
          />
        </View>
      ) : (
        <>
          <View style={[styles.fields, !registering && styles.loginFields]}>
            {registering ? (
              <FormField
                label="Full name"
                icon="◉"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
                maxLength={100}
                inputRef={nameInput}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => emailInput.current?.focus()}
                editable={!busy}
                error={attempted ? errors.name : null}
              />
            ) : null}
            <FormField
              label="Email address"
              placeholder={registering ? 'Email address' : 'you@example.com'}
              icon="✉"
              value={email}
              onChangeText={setEmail}
              autoComplete="email"
              keyboardType="email-address"
              maxLength={254}
              inputRef={emailInput}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordInput.current?.focus()}
              editable={!busy}
              error={attempted ? errors.email : null}
            />
            <FormField
              label="Password"
              icon="♙"
              password
              value={password}
              onChangeText={setPassword}
              autoComplete={registering ? 'new-password' : 'current-password'}
              inputRef={passwordInput}
              accessibilityHint={
                registering ? passwordGuidance : 'Your Parkey account password.'
              }
              returnKeyType={registering ? 'next' : 'go'}
              submitBehavior="submit"
              editable={!busy}
              onSubmitEditing={() =>
                registering ? confirmationInput.current?.focus() : void submit()
              }
              error={
                attempted
                  ? registering
                    ? errors.password
                    : !password
                      ? 'Enter your password.'
                      : null
                  : null
              }
            />
            {registering ? (
              <FormField
                label="Confirm password"
                icon="✉"
                password
                value={confirmation}
                onChangeText={setConfirmation}
                autoComplete="new-password"
                inputRef={confirmationInput}
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
                editable={!busy}
                error={attempted ? errors.confirmation : null}
              />
            ) : null}
          </View>
          {!registering ? (
            <View style={styles.options}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel="Remember me"
                accessibilityHint="Keep this session in secure device storage after closing the app. Passwords are never saved."
                accessibilityState={{ checked: remember, disabled: busy }}
                disabled={busy}
                onPress={() => setRemember((value) => !value)}
                style={styles.remember}
              >
                <View style={styles.checkbox}>
                  {remember ? <Text style={styles.check}>✓</Text> : null}
                </View>
                <Text style={styles.optionText}>Remember me</Text>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                disabled={busy}
                onPress={() => router.push('/forgot-password')}
                style={styles.forgot}
              >
                <Text style={[styles.optionText, styles.cyan]}>
                  Forgot password?
                </Text>
              </Pressable>
            </View>
          ) : null}
          {auth.state.status === 'unavailable' ? (
            <Notice text="Secure sign-in is unavailable in this build. You can still explore parking." />
          ) : null}
          {auth.state.status === 'checking' ? (
            <Notice text="Checking your secure session…" />
          ) : null}
          {auth.state.status === 'error' ? (
            <BrandButton
              title="Retry session check"
              variant="text"
              onPress={() => void auth.retry()}
            />
          ) : null}
          <BrandButton
            title={registering ? 'Create Account' : 'Log In'}
            busy={auth.busy}
            disabled={!ready || guest.busy}
            onPress={() => void submit()}
            style={[styles.primary, !registering && styles.loginPrimary]}
          />
          <Text style={styles.guidance}>
            {registering
              ? passwordGuidance
              : 'Remember me securely saves your session for app restarts. Your password is never stored.'}
          </Text>
        </>
      )}
      {message || guest.error ? (
        <Notice text={message ?? guest.error ?? ''} />
      ) : null}
      {!registering && message ? (
        <BrandButton
          title="Resend confirmation email"
          variant="text"
          busy={auth.busy}
          onPress={() => {
            if (emailProblem(email)) {
              setAttempted(true)
              emailInput.current?.focus()
            } else void resend()
          }}
        />
      ) : null}
      <BrandButton
        title="Explore parking as a guest"
        variant="text"
        onPress={guest.finish}
        disabled={auth.busy}
        busy={guest.busy}
        style={styles.guest}
      />
      <View style={styles.footer}>
        <Text style={[styles.optionText, registering && styles.plumMuted]}>
          {registering ? 'Already have an account?' : "Don't have an account?"}
        </Text>
        <Pressable
          accessibilityRole="link"
          disabled={busy}
          onPress={() => router.replace(registering ? '/login' : '/register')}
          style={styles.alternate}
        >
          <Text style={[styles.alternateText, !registering && styles.cyan]}>
            {registering ? 'Log In' : 'Sign Up'}
          </Text>
        </Pressable>
      </View>
    </AuthShell>
  )
}

export function Notice({ text }: { text: string }) {
  return (
    <Text
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={styles.notice}
    >
      {text}
    </Text>
  )
}
const styles = StyleSheet.create({
  fields: { marginTop: 33, gap: 6 },
  loginFields: { marginTop: 19 },
  primary: { marginTop: 24, minHeight: 50, borderRadius: 13 },
  loginPrimary: { marginTop: 23 },
  cyan: { color: colors.cyan },
  plumMuted: { color: colors.onPlumMuted },
  options: {
    marginTop: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  remember: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 8,
  },
  checkbox: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: '#D4E8EB',
    borderRadius: 3,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { fontSize: 11, lineHeight: 12, color: colors.plum },
  forgot: { minHeight: 44, justifyContent: 'center' },
  optionText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.onDarkMuted,
  },
  guidance: { ...typography.accountBody, color: colors.white, marginTop: 16 },
  notice: { ...typography.accountBody, color: colors.white, marginTop: 16 },
  guest: { marginTop: 18 },
  footer: {
    marginTop: 'auto',
    paddingTop: 28,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 7,
  },
  alternate: { minHeight: 44, minWidth: 66, justifyContent: 'center' },
  alternateText: { ...typography.link, fontSize: 12, color: colors.white },
  pending: { marginTop: 32, gap: 24 },
  body: { ...typography.body, color: colors.white },
})
