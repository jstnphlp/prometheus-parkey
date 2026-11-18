import { useEffect, useRef, useState } from 'react'
import { Redirect } from 'expo-router'
import { useIsFocused, usePreventRemove } from 'expo-router/react-navigation'
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Text,
  View,
} from 'react-native'

import { useAuth } from '../auth/provider'
import { setupAccess } from '../auth/setup-access'
import { usePopup } from '../components/popup-provider'
import { Button } from '../discovery/ui'
import { useTheme } from '../theme-provider'
import {
  firstIncompleteProfileStep,
  needsProfileName,
  profileFromUser,
  profileStepCount,
  profileStepIssue,
  profileSurveyFields,
} from './profile'
import type { ProfileDraft, ProfileIssue } from './profile'
import { ProfileSetupForm } from './profile-setup-form'
import { useCompletion } from './use-completion'

export function AccountSetupScreen() {
  const auth = useAuth()
  const { colors } = useTheme()
  const popup = usePopup()
  const focused = useIsFocused()
  const completion = useCompletion('/')
  const [loadedUser, setLoadedUser] = useState<string | null>(null)
  const [initiallyComplete, setInitiallyComplete] = useState(false)
  const submitting = useRef(false)
  const [draft, setDraft] = useState(() => profileFromUser(null))
  const [initialDraft, setInitialDraft] = useState(draft)
  const [step, setStep] = useState(0)
  const [issue, setIssue] = useState<ProfileIssue | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const user = auth.state.status === 'signed-in' ? auth.state.user : null
  if (user && loadedUser !== user.id) {
    const existing = profileFromUser(user)
    const incomplete = firstIncompleteProfileStep(existing)
    setLoadedUser(user.id)
    const editable = { ...existing, ...profileSurveyFields(existing) }
    setDraft(editable)
    setInitialDraft(editable)
    setStep(incomplete ?? 0)
    setIssue(null)
    setInitiallyComplete(incomplete === null)
    setSaved(false)
  }

  const access = setupAccess(auth.state)
  const needsSessionRetry = auth.state.status === 'error'
  const busy = saving || auth.busy || completion.busy || leaving

  function askToSignOut() {
    const changed = JSON.stringify(draft) !== JSON.stringify(initialDraft)
    popup.show({
      tone: 'warning',
      title: 'Sign out of Parkey?',
      message: changed
        ? 'Signing out clears your unsaved setup answers. You can explore parking as a guest after signing out.'
        : 'You can explore parking as a guest after signing out.',
      primary: {
        title: 'Sign out',
        restoreFocus: false,
        onPress: () => void leave(),
      },
      secondary: { title: 'Stay in setup' },
    })
  }

  async function leave() {
    setLeaving(true)
    try {
      await auth.signOut()
      await completion.finish()
    } catch {
      popup.show({
        tone: 'error',
        title: 'Could not sign out',
        message: 'Your answers are still here. Try signing out again.',
      })
    } finally {
      setLeaving(false)
    }
  }

  function back() {
    if (busy || submitting.current) return
    if (saved) {
      void completion.finish()
    } else if (step > 0 && !needsSessionRetry) {
      Keyboard.dismiss()
      setStep(step - 1)
      setIssue(null)
    } else {
      askToSignOut()
    }
  }
  const inSetup =
    !initiallyComplete &&
    !leaving &&
    (access === 'allowed' ||
      needsSessionRetry ||
      (access === 'checking' && Boolean(loadedUser)))
  usePreventRemove(focused && inSetup && !saved, back)
  useEffect(() => {
    if (!focused || (!inSetup && !leaving)) return
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        back()
        return true
      },
    )
    return () => subscription.remove()
  })

  if (!leaving && access === 'recovery')
    return <Redirect href="/reset-password" />
  if (!leaving && access === 'login' && !needsSessionRetry)
    return <Redirect href="/login" />
  if (user && loadedUser === user.id && initiallyComplete)
    return <Redirect href="/" />
  if (!leaving && needsSessionRetry)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: 30,
          gap: 16,
          backgroundColor: colors.canvas,
        }}
      >
        <Text accessibilityRole="alert" style={{ color: colors.ink }}>
          Your account could not be verified. Reconnect and try again.
        </Text>
        <Button disabled={busy} onPress={() => void auth.retry()}>
          Retry
        </Button>
        <Button secondary disabled={busy} onPress={askToSignOut}>
          Sign out
        </Button>
      </View>
    )
  if (leaving || access === 'checking' || !user || loadedUser !== user.id)
    return (
      <ActivityIndicator
        style={{ flex: 1, backgroundColor: colors.canvas }}
        color={colors.brand}
        accessibilityLabel={
          leaving ? 'Signing out' : 'Checking account session'
        }
      />
    )

  function change<K extends keyof ProfileDraft>(
    key: K,
    value: ProfileDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }))
    setIssue(null)
  }

  async function next() {
    if (busy || submitting.current) return
    const problem = profileStepIssue(draft, step)
    setIssue(problem)
    if (problem) return
    Keyboard.dismiss()
    if (step < profileStepCount - 1) {
      setStep(step + 1)
      return
    }
    const incomplete = firstIncompleteProfileStep(draft)
    if (incomplete !== null) {
      setStep(incomplete)
      setIssue(profileStepIssue(draft, incomplete))
      return
    }
    submitting.current = true
    setSaving(true)
    try {
      await auth.saveProfile(draft)
      setSaved(true)
    } catch {
      popup.show({
        tone: 'error',
        title: 'Could not save your profile',
        message:
          'Your answers are still here. Check your connection and try Finish Setup again.',
      })
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <ProfileSetupForm
      draft={draft}
      step={step}
      nameEditable={needsProfileName(user)}
      busy={busy}
      saving={saving}
      issue={issue}
      saved={saved}
      onChange={change}
      onBack={back}
      onNext={() => void next()}
      onFinish={() => void completion.finish()}
    />
  )
}
