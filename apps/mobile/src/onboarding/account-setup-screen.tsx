import { useEffect, useRef, useState } from 'react'
import { Redirect, useRouter } from 'expo-router'
import { ActivityIndicator, BackHandler, View } from 'react-native'

import { useAuth } from '../auth/provider'
import { setupAccess } from '../auth/setup-access'
import { useTheme } from '../theme-provider'
import {
  needsProfileName,
  profileComplete,
  profileFromUser,
  profileStepProblem,
} from './profile'
import type { ProfileDraft } from './profile'
import { ProfileSetupForm } from './profile-setup-form'
import { useCompletion } from './use-completion'

export function AccountSetupScreen() {
  const auth = useAuth()
  const { colors } = useTheme()
  const router = useRouter()
  const completion = useCompletion('/')
  const [loadedUser, setLoadedUser] = useState<string | null>(null)
  const submitting = useRef(false)
  const [draft, setDraft] = useState(() => profileFromUser(null))
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const user = auth.state.status === 'signed-in' ? auth.state.user : null
  if (user && loadedUser !== user.id) {
    setLoadedUser(user.id)
    setDraft(profileFromUser(user))
    setStep(0)
    setError(null)
    setSaved(profileComplete(user))
  } else if (user && !Array.isArray(draft.vehicleTypes)) {
    // Migrate an unsaved draft retained by Fast Refresh from the previous form.
    setDraft(
      profileFromUser({
        ...user,
        user_metadata: {
          ...user.user_metadata,
          full_name: draft.fullName,
          parkey_profile: draft,
        },
      }),
    )
  }
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (submitting.current || completion.busy) return true
        if (step === 0 || saved) return false
        setStep((current) => current - 1)
        setError(null)
        return true
      },
    )
    return () => subscription.remove()
  }, [step, saved, completion.busy])
  const access = setupAccess(auth.state)
  if (access === 'recovery') return <Redirect href="/reset-password" />
  if (access === 'login') return <Redirect href="/login" />
  if (access === 'checking' || !user || loadedUser !== user.id)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.canvas,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator
          color={colors.brand}
          accessibilityLabel="Checking account session"
        />
      </View>
    )

  const busy = saving || auth.busy || completion.busy
  function change<K extends keyof ProfileDraft>(
    key: K,
    value: ProfileDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }))
    setError(null)
  }
  function back() {
    if (busy) return
    if (step === 0 || saved) router.replace('/account')
    else {
      setStep((current) => current - 1)
      setError(null)
    }
  }
  async function next() {
    if (busy || submitting.current) return
    const problem = profileStepProblem(draft, step)
    setError(problem)
    if (problem) return
    if (step < 4) {
      setStep((current) => current + 1)
      return
    }
    submitting.current = true
    setSaving(true)
    try {
      await auth.saveProfile(draft)
      setSaved(true)
    } catch {
      setError(
        'Could not save your profile. Check your connection and try Finish Setup again. Your answers are still here.',
      )
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
      error={error}
      saved={saved}
      onChange={change}
      onBack={back}
      onNext={() => void next()}
      onFinish={() => void completion.finish()}
    />
  )
}
