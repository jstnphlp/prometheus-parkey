import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { AccountEntry } from '../auth/account-entry'
import {
  personalInfoFromUser,
  personalInfoProblem,
} from '../auth/personal-info'
import type { PersonalInfoDraft } from '../auth/personal-info'
import { useAuth } from '../auth/provider'
import { FormDropdown } from '../components/form-dropdown'
import { usePopup } from '../components/popup-provider'
import { Button, Icon } from '../discovery/ui'
import { profileChoices } from '../onboarding/profile'
import { fonts } from '../theme'
import { createThemedStyles, useTheme } from '../theme-provider'

export function PersonalInfo() {
  const auth = useAuth()
  const { colors } = useTheme()
  const styles = useStyles()
  const popup = usePopup()
  const inFlight = useRef(false)
  const [draft, setDraft] = useState(() => personalInfoFromUser(null))
  const [loadedUser, setLoadedUser] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const user = auth.state.status === 'signed-in' ? auth.state.user : null
  if (user && loadedUser !== user.id) {
    setLoadedUser(user.id)
    setDraft(personalInfoFromUser(user))
    setEditing(false)
    setError(null)
  } else if (!user && auth.state.status !== 'checking' && loadedUser !== null) {
    setLoadedUser(null)
    setDraft(personalInfoFromUser(null))
    setEditing(false)
    setError(null)
  }
  const values = editing ? draft : personalInfoFromUser(user)
  const update = (key: keyof PersonalInfoDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setError(null)
  }
  async function save() {
    if (auth.busy || inFlight.current) return
    const problem = personalInfoProblem(draft)
    setError(problem)
    if (problem) return
    inFlight.current = true
    Keyboard.dismiss()
    try {
      await auth.savePersonalInfo(draft)
      setEditing(false)
      popup.show({
        tone: 'success',
        title: 'Personal info updated',
        message: 'Your changes have been saved.',
      })
    } catch {
      setError(
        'Could not save your changes. Check your connection and try again.',
      )
    } finally {
      inFlight.current = false
    }
  }
  function input(key: 'fullName' | 'cityOther' | 'workOther', label: string) {
    return (
      <TextInput
        accessibilityLabel={label}
        value={values[key]}
        onChangeText={(value) => update(key, value)}
        editable={!auth.busy}
        maxLength={100}
        autoCapitalize="words"
        autoComplete={key === 'fullName' ? 'name' : 'off'}
        placeholder={label}
        placeholderTextColor={colors.muted}
        selectionColor={colors.brand}
        style={styles.input}
      />
    )
  }
  function selection(key: 'ageRange' | 'city' | 'work', label: string) {
    const custom =
      key === 'city' ? 'cityOther' : key === 'work' ? 'workOther' : null
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        {editing ? (
          <>
            <FormDropdown
              label={label}
              value={values[key]}
              options={profileChoices[key]}
              onChange={(value) => update(key, value)}
              disabled={auth.busy}
              minHeight={48}
            />
            {custom && values[key] === 'Other'
              ? input(custom, `Other ${label.toLowerCase()}`)
              : null}
          </>
        ) : (
          <Text selectable style={styles.value}>
            {(custom && values[key] === 'Other'
              ? values[custom]
              : values[key]) || 'Not provided'}
          </Text>
        )}
      </View>
    )
  }
  if (auth.state.status === 'checking')
    return (
      <ActivityIndicator
        color={colors.brand}
        accessibilityLabel="Loading personal info"
      />
    )
  if (!user) return <AccountEntry />
  return (
    <View style={styles.content}>
      <View style={styles.avatar}>
        <Icon name="person" size={44} color={colors.muted} />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Full name</Text>
        {editing ? (
          input('fullName', 'Full name')
        ) : (
          <Text selectable style={styles.value}>
            {values.fullName || 'Not provided'}
          </Text>
        )}
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <Text selectable style={styles.value}>
          {user.email || 'Not provided'}
        </Text>
      </View>
      {selection('ageRange', 'Age range')}
      {selection('city', 'City of residence')}
      {selection('work', 'Occupation')}
      {error ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.error}
        >
          {error}
        </Text>
      ) : null}
      {editing ? (
        <View style={styles.actions}>
          <Button disabled={auth.busy} onPress={() => void save()}>
            {auth.busy ? 'Saving…' : 'Save Changes'}
          </Button>
          <Button
            secondary
            disabled={auth.busy}
            onPress={() => {
              Keyboard.dismiss()
              setEditing(false)
              setError(null)
            }}
          >
            Cancel
          </Button>
        </View>
      ) : (
        <Button
          disabled={auth.busy}
          onPress={() => {
            setDraft(personalInfoFromUser(user))
            setEditing(true)
            setError(null)
          }}
        >
          Edit Details
        </Button>
      )}
    </View>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    content: { gap: 20 },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 8,
    },
    field: {
      gap: 8,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.brand,
    },
    label: {
      fontFamily: fonts.semibold,
      fontSize: 14,
      lineHeight: 20,
      color: colors.ink,
    },
    value: {
      fontFamily: fonts.medium,
      fontSize: 16,
      lineHeight: 24,
      color: colors.muted,
    },
    input: {
      minHeight: 48,
      fontFamily: fonts.medium,
      fontSize: 16,
      lineHeight: 24,
      paddingVertical: 10,
      color: colors.ink,
    },
    error: {
      fontFamily: fonts.medium,
      fontSize: 14,
      lineHeight: 20,
      color: colors.error,
    },
    actions: { gap: 12 },
  }),
)
