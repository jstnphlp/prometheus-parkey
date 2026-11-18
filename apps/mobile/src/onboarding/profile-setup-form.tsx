import { useEffect, useRef, useState } from 'react'
import type { ComponentRef } from 'react'
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import motorcycle from '../../assets/figma/vehicles/motorcycle.png'
import sedan from '../../assets/figma/vehicles/sedan.png'
import suv from '../../assets/figma/vehicles/suv.png'
import pickup from '../../assets/figma/vehicles/pickup.png'
import van from '../../assets/figma/vehicles/van.png'
import other from '../../assets/figma/vehicles/other.png'
import { FormDropdown } from '../components/form-dropdown'
import { useFormLayout } from '../components/form-layout'
import { Button, Icon, IconButton } from '../discovery/ui'
import { fonts } from '../theme'
import { createThemedStyles, useTheme } from '../theme-provider'
import { otherField, profileChoices } from './profile'
import type { AboutField, ProfileDraft } from './profile'

const vehicles = [motorcycle, sedan, suv, pickup, van, other]
const titles = [
  'Create your profile',
  'What vehicle\ndo you drive?',
  'Make Parkey\nyour own',
  'Your driving\nhabits',
  'Parking\npreferences',
]
const subtitles = [
  'A few details to get you started.',
  'Choose the types you usually park.',
  'Answer all three questions to continue.',
  'Choose your driving frequency and parking duration.',
  'Select at least one parking preference to continue.',
]
const aboutLabels = {
  work: 'What best describes your work?',
  city: 'Which city do you live in?',
  drivingPurpose: 'What do you usually drive for?',
}

export function ProfileSetupForm({
  draft,
  step,
  nameEditable,
  busy,
  error,
  saved,
  onChange,
  onBack,
  onNext,
  onFinish,
}: {
  draft: ProfileDraft
  step: number
  nameEditable: boolean
  busy: boolean
  error: string | null
  saved: boolean
  onChange: <K extends keyof ProfileDraft>(
    key: K,
    value: ProfileDraft[K],
  ) => void
  onBack: () => void
  onNext: () => void
  onFinish: () => void
}) {
  const styles = useStyles()
  const { colors, dark } = useTheme()
  const layout = useFormLayout()
  const { space, insets } = layout
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null)
  const [focusedField, setFocusedField] = useState<keyof ProfileDraft | null>(
    null,
  )
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false })
  }, [step, saved])
  function next() {
    onNext()
  }
  function back() {
    onBack()
  }
  function textInput(
    key: 'fullName' | 'workOther' | 'cityOther' | 'drivingPurposeOther',
    label: string,
  ) {
    const invalid =
      Boolean(error) &&
      (draft[key].trim().length < 2 || draft[key].trim().length > 100)
    return (
      <TextInput
        testID={`profile-${key}`}
        accessibilityLabel={label}
        value={draft[key]}
        onChangeText={(value) => onChange(key, value)}
        onFocus={() => setFocusedField(key)}
        onBlur={() => setFocusedField(null)}
        editable={!busy}
        maxLength={100}
        autoCapitalize="words"
        autoComplete={key === 'fullName' ? 'name' : 'off'}
        placeholder={label}
        placeholderTextColor={colors.muted}
        selectionColor={colors.brand}
        style={[
          styles.input,
          {
            minHeight: Math.max(48, space(60)),
            borderColor:
              invalid || focusedField === key ? colors.brand : colors.border,
            backgroundColor: busy ? colors.soft : colors.surface,
            color: busy ? colors.muted : colors.ink,
          },
        ]}
      />
    )
  }
  function aboutField(key: AboutField) {
    const label = aboutLabels[key]
    return (
      <View key={key} style={{ gap: space(12) }}>
        <Text style={styles.label}>{label} *</Text>
        <FormDropdown
          label={label}
          value={draft[key]}
          options={profileChoices[key]}
          disabled={busy}
          error={
            Boolean(error) &&
            !profileChoices[key].some((option) => option === draft[key])
          }
          minHeight={Math.max(48, space(63))}
          onChange={(value) => onChange(key, value)}
        />
        {draft[key] === 'Other'
          ? textInput(otherField(key), `Other: ${label}`)
          : null}
      </View>
    )
  }
  function habit(key: 'drivingFrequency' | 'parkingDuration', label: string) {
    return (
      <View style={{ gap: space(20) }}>
        <Text style={styles.label}>{label} *</Text>
        <View style={styles.habitChoices}>
          {profileChoices[key].map((option, index) => (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={option}
              accessibilityState={{
                checked: draft[key] === option,
                disabled: busy,
              }}
              disabled={busy}
              onPress={() => onChange(key, option)}
              style={[
                styles.habitChoice,
                {
                  minHeight: Math.max(48, space(55)),
                  flexBasis:
                    key === 'parkingDuration' && index === 2
                      ? '100%'
                      : key === 'parkingDuration'
                        ? '47%'
                        : layout.width < 390 || layout.fontScale > 1
                          ? 'auto'
                          : '29%',
                },
                draft[key] === option && styles.choiceSelected,
              ]}
            >
              <Text
                style={[
                  styles.choiceLabel,
                  draft[key] === option && styles.selectedLabel,
                ]}
              >
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    )
  }
  return (
    <KeyboardAvoidingView
      testID="account-setup-page"
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            minHeight: layout.height,
            paddingHorizontal: layout.horizontalPadding,
            paddingTop: insets.top + 6,
            paddingBottom: insets.bottom + space(38),
          },
        ]}
      >
        {saved ? (
          <>
            <View style={[styles.successOuter, { marginTop: space(132) }]}>
              <View style={styles.successInner}>
                <Icon name="check" size={64} color={colors.onAction} />
              </View>
            </View>
            <Text
              accessibilityRole="header"
              style={[styles.successTitle, { marginTop: space(54) }]}
            >
              You’re all set!
            </Text>
            <Text style={[styles.successCopy, { marginTop: space(54) }]}>
              Your profile is ready.{'\n'}Discover parking that suits your
              needs.
            </Text>
            <View style={[styles.footer, { paddingTop: space(45) }]}>
              <Button disabled={busy} onPress={onFinish} icon="arrow">
                Find Parking
              </Button>
            </View>
          </>
        ) : (
          <>
            <View style={styles.header}>
              <IconButton
                icon="back"
                label={step === 0 ? 'Back to account' : 'Previous setup step'}
                color={colors.back}
                style={styles.back}
                disabled={busy}
                onPress={back}
              />
              {dark ? (
                <Text style={styles.step}>SETUP {step + 1} / 5</Text>
              ) : null}
            </View>
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`Account setup, step ${step + 1} of 5`}
              accessibilityValue={{ min: 1, max: 5, now: step + 1 }}
              style={styles.progress}
            >
              {[0, 1, 2, 3, 4].map((index) => (
                <View
                  key={index}
                  style={[
                    styles.segment,
                    index <= step && { backgroundColor: colors.brand },
                  ]}
                />
              ))}
            </View>
            <View
              style={{
                marginTop: Math.max(
                  space(24),
                  space(39) - Math.max(0, (step === 0 ? 41 : 82) - space(93)),
                ),
                minHeight: space(93),
                justifyContent: 'center',
              }}
            >
              <Text accessibilityRole="header" style={styles.title}>
                {titles[step]}
              </Text>
            </View>
            <View style={{ minHeight: space(67), justifyContent: 'center' }}>
              <Text style={styles.subtitle}>{subtitles[step]}</Text>
            </View>
            {step === 0 ? (
              <>
                <View
                  style={[
                    styles.avatar,
                    {
                      width: space(150),
                      height: space(150),
                      borderRadius: space(75),
                    },
                  ]}
                >
                  <View
                    style={{
                      position: 'absolute',
                      left: space(59),
                      top: space(28),
                      width: space(32),
                      height: space(32),
                      borderRadius: space(16),
                      backgroundColor: '#9A9AAC',
                    }}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      left: space(37),
                      top: space(75),
                      width: space(77),
                      height: space(51),
                      borderRadius: space(35),
                      backgroundColor: '#9A9AAC',
                    }}
                  />
                </View>
                <View style={{ gap: space(24), marginTop: space(48) }}>
                  <View style={{ gap: space(12) }}>
                    <Text style={styles.label}>
                      Full name{nameEditable ? ' *' : ''}
                    </Text>
                    {nameEditable ? (
                      textInput('fullName', 'Full name')
                    ) : (
                      <View
                        style={[
                          styles.input,
                          {
                            minHeight: Math.max(48, space(60)),
                            justifyContent: 'center',
                          },
                        ]}
                      >
                        <Text selectable style={styles.value}>
                          {draft.fullName}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ gap: space(12) }}>
                    <Text style={styles.label}>Age range *</Text>
                    <FormDropdown
                      label="Age range"
                      value={draft.ageRange}
                      options={profileChoices.ageRange}
                      disabled={busy}
                      error={
                        Boolean(error) &&
                        !profileChoices.ageRange.some(
                          (option) => option === draft.ageRange,
                        )
                      }
                      minHeight={Math.max(48, space(60))}
                      onChange={(value) => onChange('ageRange', value)}
                    />
                  </View>
                </View>
              </>
            ) : null}
            {step === 1 ? (
              <View
                style={[
                  styles.vehicleGrid,
                  { marginTop: space(14), rowGap: space(11) },
                ]}
              >
                {profileChoices.vehicleType.map((label, index) => {
                  const selected = draft.vehicleTypes.includes(label)
                  return (
                    <Pressable
                      key={label}
                      accessibilityRole="checkbox"
                      accessibilityLabel={label}
                      accessibilityState={{ checked: selected, disabled: busy }}
                      disabled={busy}
                      onPress={() =>
                        onChange(
                          'vehicleTypes',
                          selected
                            ? draft.vehicleTypes.filter(
                                (value) => value !== label,
                              )
                            : [...draft.vehicleTypes, label],
                        )
                      }
                      style={[
                        styles.vehicleCard,
                        {
                          minHeight:
                            space(126) + Math.max(0, layout.fontScale - 1) * 48,
                          paddingTop: space(7),
                        },
                        selected && styles.vehicleSelected,
                      ]}
                    >
                      <Image
                        source={vehicles[index]}
                        resizeMode="contain"
                        accessibilityIgnoresInvertColors
                        accessible={false}
                        fadeDuration={0}
                        style={{
                          width: 112 * layout.horizontalScale,
                          height: 64 * layout.horizontalScale,
                        }}
                      />
                      <Text
                        style={[
                          styles.vehicleLabel,
                          { minHeight: space(41) },
                          selected && styles.selectedLabel,
                        ]}
                      >
                        {label}
                      </Text>
                      {selected ? (
                        <View style={styles.vehicleCheck}>
                          <Icon
                            name="check"
                            size={18}
                            color={colors.onAction}
                          />
                        </View>
                      ) : null}
                    </Pressable>
                  )
                })}
              </View>
            ) : null}
            {step === 2 ? (
              <View style={{ marginTop: space(12), gap: space(29) }}>
                {(['work', 'city', 'drivingPurpose'] as const).map(aboutField)}
              </View>
            ) : null}
            {step === 3 ? (
              <View style={{ marginTop: space(30), gap: space(78) }}>
                {habit('drivingFrequency', 'How often do you drive?')}
                {habit('parkingDuration', 'How long do you usually park?')}
              </View>
            ) : null}
            {step === 4 ? (
              <View style={{ marginTop: space(16), gap: space(20) }}>
                {profileChoices.parkingPreferences.map((label) => {
                  const selected = draft.parkingPreferences.includes(label)
                  return (
                    <Pressable
                      key={label}
                      accessibilityRole="checkbox"
                      accessibilityLabel={label}
                      accessibilityState={{ checked: selected, disabled: busy }}
                      disabled={busy}
                      onPress={() =>
                        onChange(
                          'parkingPreferences',
                          selected
                            ? draft.parkingPreferences.filter(
                                (value) => value !== label,
                              )
                            : [...draft.parkingPreferences, label],
                        )
                      }
                      style={[
                        styles.preference,
                        { minHeight: Math.max(56, space(70)) },
                      ]}
                    >
                      <Text style={styles.preferenceLabel}>{label}</Text>
                      <View
                        style={[styles.checkbox, selected && styles.checked]}
                      >
                        {selected ? (
                          <Icon
                            name="check"
                            size={22}
                            color={colors.onAction}
                          />
                        ) : null}
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            ) : null}
            <View style={[styles.footer, { paddingTop: space(14) }]}>
              {error ? (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={styles.error}
                >
                  {error}
                </Text>
              ) : null}
              <Button
                testID="profile-next"
                disabled={busy}
                onPress={next}
                icon="arrow"
              >
                {busy ? 'Saving...' : step === 4 ? 'Finish Setup' : 'Continue'}
              </Button>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.canvas },
    content: { flexGrow: 1, width: '100%', maxWidth: 540, alignSelf: 'center' },
    header: {
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    back: {
      width: 48,
      height: 48,
      marginLeft: -15,
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
    step: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
    progress: {
      flexDirection: 'row',
      gap: 11,
      marginTop: 10,
      marginHorizontal: 3,
    },
    segment: {
      flex: 1,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    title: {
      fontFamily: fonts.extraBold,
      fontSize: 34,
      lineHeight: 41,
      color: colors.ink,
    },
    subtitle: {
      fontFamily: fonts.regular,
      fontSize: 16,
      lineHeight: 20,
      color: colors.muted,
    },
    label: {
      fontFamily: fonts.semibold,
      fontSize: 16,
      lineHeight: 22,
      color: colors.ink,
    },
    input: {
      borderRadius: 13,
      borderWidth: 1.3,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontFamily: fonts.medium,
      fontSize: 15,
      lineHeight: 22,
      color: colors.ink,
    },
    value: {
      fontFamily: fonts.medium,
      fontSize: 15,
      lineHeight: 22,
      color: colors.ink,
    },
    avatar: {
      alignSelf: 'center',
      backgroundColor: colors.soft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    vehicleGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    vehicleCard: {
      width: '48%',
      borderRadius: 16,
      borderWidth: 1.3,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    vehicleSelected: {
      borderColor: colors.brand,
      borderWidth: 2.4,
      backgroundColor: '#E8F7F4',
    },
    vehicleLabel: {
      width: '100%',
      fontFamily: fonts.semibold,
      fontSize: 15,
      lineHeight: 19,
      textAlign: 'center',
      textAlignVertical: 'center',
      color: colors.ink,
      paddingTop: 7,
      paddingBottom: 7,
    },
    selectedLabel: { color: '#20162E' },
    vehicleCheck: {
      position: 'absolute',
      top: 7,
      right: 7,
      width: 25,
      height: 25,
      borderRadius: 7,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    habitChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
    habitChoice: {
      flexGrow: 1,
      borderRadius: 13,
      borderWidth: 1.3,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
      paddingVertical: 8,
    },
    choiceSelected: { borderColor: colors.brand, backgroundColor: '#E0F5F0' },
    choiceLabel: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      lineHeight: 19,
      textAlign: 'center',
      color: colors.ink,
    },
    preference: {
      borderRadius: 13,
      borderWidth: 1.3,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 18,
      paddingVertical: 12,
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    preferenceLabel: {
      flex: 1,
      fontFamily: fonts.semibold,
      fontSize: 17,
      lineHeight: 23,
      color: colors.ink,
    },
    checkbox: {
      width: 30,
      height: 30,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checked: { borderColor: colors.brand, backgroundColor: colors.brand },
    footer: { marginTop: 'auto' },
    error: {
      fontFamily: fonts.medium,
      fontSize: 14,
      lineHeight: 20,
      color: colors.brand,
      marginBottom: 12,
    },
    successOuter: {
      width: 204,
      height: 204,
      borderRadius: 102,
      backgroundColor: colors.soft,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
    },
    successInner: {
      width: 101,
      height: 101,
      borderRadius: 51,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    successTitle: {
      fontFamily: fonts.extraBold,
      fontSize: 36,
      lineHeight: 44,
      textAlign: 'center',
      color: colors.ink,
    },
    successCopy: {
      fontFamily: fonts.medium,
      fontSize: 18,
      lineHeight: 24,
      textAlign: 'center',
      color: colors.muted,
    },
  }),
)
