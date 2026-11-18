import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComponentRef } from 'react'
import { Redirect, useFocusEffect, useRouter } from 'expo-router'
import {
  AppState,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { TextInput } from 'react-native'

import { useTheme, createThemedStyles } from '../theme-provider'
import { BrandButton } from '../components/brand-button'
import { BrandIcon } from '../components/brand-icon'
import { useFormLayout } from '../components/form-layout'
import { usePopup } from '../components/popup-provider'
import { useCompletion } from '../onboarding/use-completion'
import { fonts, typography } from '../theme'
import { AuthShell } from './auth-shell'
import { FormField } from './form-field'
import { authErrorCode, authFeedback } from './feedback'
import { useAuth } from './provider'
import { PasswordRequirements } from './password-requirements'
import { PendingConfirmation } from './pending-confirmation'
import { SignedInRedirect } from './signed-in-redirect'
import { SocialButtons } from './social-buttons'
import type { SocialProvider } from './oauth-policy'
import {
  authErrorMessage,
  emailProblem,
  passwordGuidance,
  registrationProblems,
} from './validation'

export function AccountForm({ mode }: { mode: 'register' | 'login' }) {
  const { entryColors: colors } = useTheme()
  const styles = useStyles()
  const { compact } = useFormLayout()

  const auth = useAuth()
  const router = useRouter()
  const guest = useCompletion('/')
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
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        setPassword('')
        setConfirmation('')
      }
    })
    return () => subscription.remove()
  }, [])
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
        setConfirmation('')
        if (signedIn) {
          setPassword('')
        } else {
          setPassword('')
          setPending(true)
          setAttempted(false)
        }
      } else {
        await auth.signIn(email, password, remember)
        if (focused.current) {
          setPassword('')
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
      if (focused.current) {
        setPassword('')
        setPending(true)
      }
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

  async function socialSignIn(provider: SocialProvider) {
    if (busy || !focused.current) return
    Keyboard.dismiss()
    try {
      await auth.signInWithProvider(provider, !registering && remember)
    } catch (error) {
      if (focused.current) popup.show(authFeedback(error, 'Could not sign in'))
    }
  }

  if (auth.state.status === 'recovery')
    return <Redirect href="/reset-password" />
  if (pending)
    return (
      <PendingConfirmation
        email={email}
        onDifferentEmail={() => {
          setPending(false)
          setEmail('')
          setPassword('')
          setConfirmation('')
          setAttempted(false)
          if (!registering) router.replace('/register')
        }}
      />
    )
  if (auth.state.status === 'signed-in')
    return <SignedInRedirect user={auth.state.user} />
  return (
    <AuthShell
      registering={registering}
      title={registering ? 'Create an Account' : 'Sign in to your\naccount'}
    >
      <>
        <View
          style={[
            styles.fields,
            !registering && styles.loginFields,
            compact && { marginTop: 20, gap: 8 },
          ]}
        >
          {registering ? (
            <FormField
              compact={registering || compact}
              label="Full name"
              placeholder="Enter your full name"
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
            compact={registering || compact}
            label="Email address"
            placeholder={registering ? 'Enter your email' : 'you@example.com'}
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
            compact={registering || compact}
            label="Password"
            placeholder={registering ? 'Create a password' : 'Password'}
            icon="lock"
            password
            value={password}
            onChangeText={(value) => {
              setPassword(value)
              setServerPasswordError(null)
            }}
            autoComplete={registering ? 'new-password' : 'current-password'}
            inputRef={passwordInput}
            {...(registering ? { accessibilityHint: passwordGuidance } : {})}
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
          {registering && (password || attempted) ? (
            <PasswordRequirements password={password} />
          ) : null}
          {registering ? (
            <FormField
              compact={registering}
              label="Confirm password"
              placeholder="Confirm your password"
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
          style={[
            styles.primary,
            !registering && styles.loginPrimary,
            compact && { marginTop: 16, minHeight: 52 },
          ]}
        />
        <SocialButtons
          providers={auth.socialProviders}
          disabled={busy || !ready}
          onPress={(provider) => void socialSignIn(provider)}
        />
      </>
      <View style={[styles.footer, compact && { paddingTop: 12 }]}>
        <Text style={[styles.optionText, registering && styles.plumMuted]}>
          {registering ? 'Already have an account?' : 'New to Parkey?'}
        </Text>
        <Pressable
          accessibilityRole="link"
          disabled={busy}
          onPress={() => router.replace(registering ? '/login' : '/register')}
          style={styles.alternate}
        >
          <Text style={[styles.alternateText, !registering && styles.cyan]}>
            {registering ? 'Log In' : 'Create an account'}
          </Text>
        </Pressable>
      </View>
      <BrandButton
        title="Explore as guest"
        variant="text"
        disabled={busy}
        busy={guest.busy}
        onPress={() => void guest.finish()}
      />
    </AuthShell>
  )
}

const useStyles = createThemedStyles(({ entryColors: colors }) =>
  StyleSheet.create({
    fields: { marginTop: 33, gap: 6 },
    loginFields: { marginTop: 39, gap: 16 },
    primary: { marginTop: 24, minHeight: 56, borderRadius: 14 },
    loginPrimary: { marginTop: 23, minHeight: 58, borderRadius: 15 },
    cyan: { color: colors.cyan },
    plumMuted: { color: colors.onPlumMuted },
    options: {
      marginTop: 12,
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
      width: 22,
      height: 22,
      borderWidth: 1,
      borderColor: colors.controlBorder,
      borderRadius: 3,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    forgot: { minHeight: 44, justifyContent: 'center' },
    optionText: {
      fontFamily: fonts.medium,
      fontSize: 14,
      lineHeight: 20,
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
    alternateText: { ...typography.link, fontSize: 12, color: colors.text },
  }),
)
