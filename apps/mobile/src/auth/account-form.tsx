import { useCallback, useRef, useState } from 'react'
import type { ComponentRef } from 'react'
import { Redirect, useFocusEffect, useRouter } from 'expo-router'
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native'
import type { TextInput } from 'react-native'

import { BrandButton } from '../components/brand-button'
import { BrandIcon } from '../components/brand-icon'
import { usePopup } from '../components/popup-provider'
import { colors, fonts, typography } from '../theme'

import { AuthShell } from './auth-shell'
import { FormField } from './form-field'
import { authErrorCode, authFeedback } from './feedback'
import { useAuth } from './provider'
import { PasswordRequirements } from './password-requirements'
import {
  authErrorMessage,
  emailProblem,
  passwordGuidance,
  registrationProblems,
} from './validation'

export function AccountForm({ mode }: { mode: 'register' | 'login' }) {
  const auth = useAuth()
  const router = useRouter()
  const registering = mode === 'register'
  const popup = usePopup()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [remember, setRemember] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [serverPasswordError, setServerPasswordError] = useState<string | null>(
    null,
  )
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
  const busy = auth.busy
  const ready =
    auth.state.status !== 'checking' && auth.state.status !== 'unavailable'

  async function submit() {
    if (busy || !focused.current) return
    setAttempted(true)
    setServerPasswordError(null)
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
      if (!focused.current) return
      if (registering && authErrorCode(error) === 'weak_password') {
        setServerPasswordError(authErrorMessage(error))
        passwordInput.current?.focus()
        return
      }
      popup.show({
        ...authFeedback(
          error,
          registering ? 'Could not create account' : 'Could not sign in',
        ),
        returnFocus: () => passwordInput.current?.focus(),
        primary:
          authErrorCode(error) === 'email_not_confirmed'
            ? {
                title: 'Resend email',
                onPress: () => void resend(),
                restoreFocus: false,
              }
            : { title: 'Try again' },
      })
    }
  }

  async function resend() {
    if (busy || !focused.current) return
    try {
      await auth.sendEmail(email, 'signup')
      if (focused.current)
        popup.show({
          tone: 'info',
          title: 'Email requested',
          message:
            'If confirmation is needed, check your inbox and spam. Open the latest link on this device.',
        })
    } catch (error) {
      if (focused.current)
        popup.show({
          ...authFeedback(error, 'Could not resend email'),
          primary:
            authErrorCode(error) === 'verification_request_missing'
              ? {
                  title: 'Start registration',
                  onPress: () => {
                    setPending(false)
                    router.replace('/register')
                  },
                  restoreFocus: false,
                }
              : {
                  title: 'Try again',
                  onPress: () => void resend(),
                  restoreFocus: false,
                },
          secondary: { title: 'Not now' },
        })
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
          <BrandIcon name="mail" color={colors.cyan} size={44} />
          <Text style={styles.body}>
            If this address can register, check your inbox and spam. Open the
            latest confirmation link on this device.
          </Text>
          <BrandButton
            title="Resend confirmation email"
            onPress={() => void resend()}
            busy={auth.busy}
          />
          <BrandButton
            title="Didn't receive it?"
            variant="text"
            onPress={() =>
              popup.show({
                tone: 'info',
                title: 'Check your inbox',
                message:
                  'Delivery may take a few minutes. If you already have an account, log in instead.',
                primary: {
                  title: 'Log In',
                  onPress: () => router.replace('/login'),
                  restoreFocus: false,
                },
                secondary: { title: 'Got it' },
              })
            }
          />
        </View>
      ) : (
        <>
          <View style={[styles.fields, !registering && styles.loginFields]}>
            {registering ? (
              <FormField
                label="Full name"
                icon="person"
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
              icon="mail"
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
              icon="lock"
              password
              value={password}
              onChangeText={(value) => {
                setPassword(value)
                setServerPasswordError(null)
              }}
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
                    ? (serverPasswordError ??
                      (errors.password
                        ? 'Meet the password requirements below.'
                        : null))
                    : !password
                      ? 'Enter your password.'
                      : null
                  : null
              }
            />
            {registering ? <PasswordRequirements password={password} /> : null}
            {registering ? (
              <FormField
                label="Confirm password"
                icon="shield-check"
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
                  {remember ? (
                    <BrandIcon name="check" size={12} color={colors.plum} />
                  ) : null}
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
            disabled={!ready}
            onPress={() => void submit()}
            style={[styles.primary, !registering && styles.loginPrimary]}
          />
          {!registering ? (
            <BrandButton
              title="About Remember me"
              variant="text"
              onPress={() =>
                popup.show({
                  tone: 'info',
                  title: 'Remember me',
                  message:
                    'Keeps your session in secure device storage after closing the app. Your password is never saved.',
                })
              }
            />
          ) : null}
        </>
      )}
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
  forgot: { minHeight: 44, justifyContent: 'center' },
  optionText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.onDarkMuted,
  },
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
