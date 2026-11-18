import { useEffect, useRef, useState } from 'react'
import type { ComponentRef } from 'react'
import { useRouter } from 'expo-router'
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import type { LayoutChangeEvent } from 'react-native'

import { FormDropdown } from '../components/form-dropdown'
import { useFormLayout } from '../components/form-layout'
import {
  MotionPressable,
  SelectionPop,
  revealStyle,
  useEntranceProgress,
} from '../discovery/motion'
import { useReducedMotion } from '../discovery/use-reduced-motion'
import { Button, Icon, IconButton } from '../discovery/ui'
import { fonts } from '../theme'
import { createThemedStyles, useTheme } from '../theme-provider'
import {
  otherField,
  profileChoices,
  profileStepCount,
  profileStepIssue,
} from './profile'
import type { AboutField, ProfileDraft, ProfileIssue } from './profile'

const AnimatedKeyboardView =
  Animated.createAnimatedComponent(KeyboardAvoidingView)

const vehicles = [motorcycle, sedan, suv, pickup, van, other]
const titles = [
  'What do you drive?',
  'Tell us about your driving life',
  'Your driving habits',
  'What matters when you park?',
]
const subtitles = [
  'Choose all vehicle types you usually park.',
  'Tell us about your work, where you live, and why you drive.',
  'Choose how often you drive and how long you usually park.',
  'Choose all the parking features you look for. Select at least one.',
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
  saving,
  issue,
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
  saving: boolean
  issue: ProfileIssue | null
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
  const { colors } = useTheme()
  const reduced = useReducedMotion()
  const router = useRouter()
  const progress = useEntranceProgress(210, saved ? 'confirmed' : step)
  const layout = useFormLayout()
  const { space, insets } = layout
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null)
  const inputRefs = useRef<
    Partial<Record<keyof ProfileDraft, ComponentRef<typeof TextInput> | null>>
  >({})
  const fieldPositions = useRef<Partial<Record<keyof ProfileDraft, number>>>({})
  const sectionTop = useRef(0)
  const [focusedField, setFocusedField] = useState<keyof ProfileDraft | null>(
    null,
  )
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false })
  }, [step, saved])
  const completed = Array.from(
    { length: profileStepCount },
    (_, index) =>
      index < profileStepCount - 1 && !profileStepIssue(draft, index),
  )
  const completedCount = completed.filter(Boolean).length

  useEffect(() => {
    if (!issue) return
    const field = issue.field
    const group =
      field === 'workOther'
        ? 'work'
        : field === 'cityOther'
          ? 'city'
          : field === 'drivingPurposeOther'
            ? 'drivingPurpose'
            : field
    const y = fieldPositions.current[group]
    if (typeof y === 'number') {
      const offset = step === 1 || step === 2 ? sectionTop.current : 0
      scroll.current?.scrollTo({ y: offset + y, animated: !reduced })
    }
    inputRefs.current[field]?.focus()
  }, [issue, reduced, step])

  function trackField(field: keyof ProfileDraft, event: LayoutChangeEvent) {
    fieldPositions.current[field] = event.nativeEvent.layout.y
  }

  function trackSection(event: LayoutChangeEvent) {
    sectionTop.current = event.nativeEvent.layout.y
  }

  function privacyLink() {
    return (
      <MotionPressable
        accessibilityRole="link"
        accessibilityLabel="Privacy & Data"
        disabled={busy}
        onPress={() => router.push('/settings/privacy')}
        style={styles.privacyLink}
      >
        <Text style={styles.privacyText}>Privacy & Data</Text>
      </MotionPressable>
    )
  }

  function fieldError(field: keyof ProfileDraft) {
    return issue?.field === field ? (
      <Text
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={styles.error}
      >
        {issue.message}
      </Text>
    ) : null
  }
  function textInput(
    key: 'fullName' | 'workOther' | 'cityOther' | 'drivingPurposeOther',
    label: string,
  ) {
    const invalid = issue?.field === key
    return (
      <TextInput
        ref={(input) => {
          inputRefs.current[key] = input
        }}
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
      <View
        key={key}
        onLayout={(event) => trackField(key, event)}
        style={{ gap: space(12) }}
      >
        <Text style={styles.label}>{label} *</Text>
        <FormDropdown
          label={label}
          value={draft[key]}
          options={profileChoices[key]}
          disabled={busy}
          error={issue?.field === key}
          minHeight={Math.max(48, space(63))}
          onChange={(value) => onChange(key, value)}
        />
        {draft[key] === 'Other'
          ? textInput(otherField(key), `Other: ${label}`)
          : null}
        {fieldError(key)}
        {fieldError(otherField(key))}
      </View>
    )
  }
  function habit(key: 'drivingFrequency' | 'parkingDuration', label: string) {
    return (
      <View
        onLayout={(event) => trackField(key, event)}
        style={{ gap: space(20) }}
      >
        <Text style={styles.label}>{label} *</Text>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={label}
          style={styles.habitChoices}
        >
          {profileChoices[key].map((option, index) => (
            <MotionPressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={option}
              aria-checked={draft[key] === option}
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
              <SelectionPop selected={draft[key] === option}>
                <Text
                  style={[
                    styles.choiceLabel,
                    draft[key] === option && styles.selectedLabel,
                  ]}
                >
                  {option}
                </Text>
              </SelectionPop>
            </MotionPressable>
          ))}
        </View>
        {fieldError(key)}
      </View>
    )
  }
  return (
    <AnimatedKeyboardView
      testID="account-setup-page"
      style={[
        styles.screen,
        revealStyle(progress, { distance: 6, fromOpacity: 0.78 }),
      ]}
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
              You’re ready to explore
            </Text>
            <Text style={[styles.successCopy, { marginTop: space(54) }]}>
              Your profile is saved. You can update your personal details in
              Profile.
            </Text>
            <View style={[styles.footer, { paddingTop: space(45) }]}>
              <Button disabled={busy} onPress={onFinish} icon="arrow">
                Explore parking
              </Button>
            </View>
          </>
        ) : (
          <>
            <View style={styles.header}>
              <IconButton
                icon="back"
                label={step === 0 ? 'Leave setup' : 'Previous setup step'}
                color={colors.back}
                style={styles.back}
                disabled={busy}
                onPress={onBack}
              />
              <Text style={styles.step}>
                Step {step + 1} of {profileStepCount}
              </Text>
            </View>
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel="Account setup progress"
              aria-valuemin={0}
              aria-valuemax={profileStepCount}
              aria-valuenow={completedCount}
              style={styles.progress}
            >
              {completed.map((done, index) => (
                <View
                  key={index}
                  style={[
                    styles.segment,
                    done && styles.segmentDone,
                    !done && index === step && styles.segmentCurrent,
                  ]}
                />
              ))}
            </View>
            <View
              style={{
                marginTop: Math.max(
                  space(24),
                  space(39) - Math.max(0, 82 - space(93)),
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
                <View style={styles.intro}>
                  <Text style={styles.label}>Make Parkey yours</Text>
                  <Text style={styles.subtitle}>
                    To finish setting up your account, answer a few questions
                    about your vehicle and parking habits. Your answers are
                    saved to your account when you finish.
                  </Text>
                  {privacyLink()}
                </View>
                {nameEditable ? (
                  <View
                    onLayout={(event) => trackField('fullName', event)}
                    style={styles.nameField}
                  >
                    <Text style={styles.label}>Full name *</Text>
                    {textInput('fullName', 'Full name')}
                    {fieldError('fullName')}
                  </View>
                ) : null}
                <View onLayout={(event) => trackField('vehicleTypes', event)}>
                  <View
                    style={[
                      styles.vehicleGrid,
                      { marginTop: space(14), rowGap: space(11) },
                    ]}
                  >
                    {profileChoices.vehicleType.map((label, index) => {
                      const selected = draft.vehicleTypes.includes(label)
                      return (
                        <MotionPressable
                          key={label}
                          accessibilityRole="checkbox"
                          accessibilityLabel={label}
                          aria-checked={selected}
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
                                space(126) +
                                Math.max(0, layout.fontScale - 1) * 48,
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
                          <View
                            pointerEvents="none"
                            style={[
                              styles.vehicleCheck,
                              { opacity: selected ? 1 : 0 },
                            ]}
                          >
                            <SelectionPop selected={selected}>
                              <Icon
                                name="check"
                                size={18}
                                color={colors.onAction}
                              />
                            </SelectionPop>
                          </View>
                        </MotionPressable>
                      )
                    })}
                  </View>
                  {fieldError('vehicleTypes')}
                </View>
              </>
            ) : null}
            {step === 1 ? (
              <View
                onLayout={trackSection}
                style={{ marginTop: space(12), gap: space(29) }}
              >
                {(['work', 'city', 'drivingPurpose'] as const).map(aboutField)}
              </View>
            ) : null}
            {step === 2 ? (
              <View
                onLayout={trackSection}
                style={{ marginTop: space(30), gap: space(78) }}
              >
                {habit('drivingFrequency', 'How often do you drive?')}
                {habit('parkingDuration', 'How long do you usually park?')}
              </View>
            ) : null}
            {step === 3 ? (
              <View
                onLayout={(event) => trackField('parkingPreferences', event)}
                style={{ marginTop: space(16), gap: space(20) }}
              >
                {profileChoices.parkingPreferences.map((label) => {
                  const selected = draft.parkingPreferences.includes(label)
                  return (
                    <MotionPressable
                      key={label}
                      accessibilityRole="checkbox"
                      accessibilityLabel={label}
                      aria-checked={selected}
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
                        selected && styles.choiceSelected,
                        { minHeight: Math.max(56, space(70)) },
                      ]}
                    >
                      <Text style={styles.preferenceLabel}>{label}</Text>
                      <SelectionPop selected={selected}>
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
                      </SelectionPop>
                    </MotionPressable>
                  )
                })}
                {fieldError('parkingPreferences')}
                <Text style={styles.subtitle}>
                  Finish Setup saves these answers to your Parkey account in
                  Supabase. You can edit personal details in Profile.
                </Text>
                {privacyLink()}
              </View>
            ) : null}
            <View style={[styles.footer, { paddingTop: space(14) }]}>
              <Button
                testID="profile-next"
                disabled={busy}
                onPress={onNext}
                icon="arrow"
              >
                {saving
                  ? 'Saving…'
                  : step === profileStepCount - 1
                    ? 'Finish Setup'
                    : step === 0
                      ? 'Continue setup'
                      : 'Continue'}
              </Button>
            </View>
          </>
        )}
      </ScrollView>
    </AnimatedKeyboardView>
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
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.border,
    },
    segmentDone: { backgroundColor: colors.link, borderColor: colors.link },
    segmentCurrent: {
      backgroundColor: colors.selected,
      borderColor: colors.link,
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
    intro: { gap: 4 },
    nameField: { gap: 10, marginBottom: 8 },
    privacyLink: {
      minHeight: 44,
      alignSelf: 'flex-start',
      justifyContent: 'center',
    },
    privacyText: {
      fontFamily: fonts.semibold,
      fontSize: 14,
      color: colors.link,
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
      borderColor: colors.link,
      backgroundColor: colors.selected,
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
    selectedLabel: { color: colors.ink },
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
    choiceSelected: {
      borderColor: colors.link,
      backgroundColor: colors.selected,
    },
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
      color: colors.error,
      marginTop: 6,
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
