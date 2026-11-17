import { useState } from 'react'
import type { ComponentRef, RefObject } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { BrandButton } from '../components/brand-button'
import { BrandLogo } from '../components/brand-logo'
import { useFormLayout } from '../components/form-layout'
import { Icon, IconButton } from '../discovery/ui'
import { fonts } from '../theme'
import { createThemedStyles, useTheme } from '../theme-provider'
import { emailCodeLength } from './email-code'

export function EmailVerificationForm({
  email,
  code,
  error,
  expired,
  verified,
  remaining,
  busy,
  sessionPending,
  continueDisabled,
  inputRef,
  onCodeChange,
  onVerify,
  onResend,
  onDifferentEmail,
  onContinue,
}: {
  email: string
  code: string
  error: string | null
  expired: boolean
  verified: boolean
  remaining: number
  busy: boolean
  sessionPending: boolean
  continueDisabled: boolean
  inputRef: RefObject<ComponentRef<typeof TextInput> | null>
  onCodeChange: (value: string) => void
  onVerify: () => void
  onResend: () => void
  onDifferentEmail: () => void
  onContinue: () => void
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const { space, insets, height, horizontalPadding } = useFormLayout()
  const [focused, setFocused] = useState(false)
  const at = email.indexOf('@')
  const maskedEmail =
    at > 0 ? `${email[0]}\u2022\u2022\u2022${email.slice(at)}` : email
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            minHeight: height,
            paddingHorizontal: horizontalPadding,
            paddingTop: insets.top + space(verified ? 122 : 50),
            paddingBottom: insets.bottom + space(verified ? 51 : 32),
          },
        ]}
      >
        {verified ? (
          <>
            <View
              style={[
                styles.successOuter,
                {
                  width: space(204),
                  height: space(204),
                  borderRadius: space(102),
                },
              ]}
            >
              <View style={styles.successInner}>
                <Icon name="check" size={58} color={colors.onAction} />
              </View>
            </View>
            <Text
              accessibilityRole="header"
              style={[styles.successTitle, { marginTop: space(70) }]}
            >
              Email verified!
            </Text>
            <Text style={[styles.successCopy, { marginTop: space(55) }]}>
              Your email has been confirmed.{'\n'}Complete your profile to
              personalize Parkey.
            </Text>
            <View style={[styles.footer, { paddingTop: space(50) }]}>
              <BrandButton
                title="Continue to Profile Setup"
                busy={busy}
                disabled={continueDisabled}
                onPress={onContinue}
                style={styles.primary}
              />
              <Text
                style={[styles.note, { marginTop: space(30), minHeight: 48 }]}
              >
                Next step: Profile and vehicle types
              </Text>
            </View>
          </>
        ) : (
          <>
            <BrandLogo variant="account" style={{ width: 42, height: 47 }} />
            <View
              style={{
                marginTop: space(43),
                minHeight: space(66),
                justifyContent: 'center',
              }}
            >
              <Text accessibilityRole="header" style={styles.title}>
                {expired ? 'Code expired' : 'Verify your email'}
              </Text>
            </View>
            <View
              style={{
                marginTop: space(5),
                minHeight: space(97),
                justifyContent: 'center',
              }}
            >
              <Text style={styles.copy}>
                {expired
                  ? 'Your verification code is invalid or has expired. Request a new code to continue.'
                  : `We sent a ${emailCodeLength}-digit verification code to your email. Enter it below to continue.`}
              </Text>
            </View>
            <Text
              style={[
                styles.email,
                { minHeight: space(42), marginTop: -space(5) },
              ]}
            >
              {maskedEmail}
            </Text>
            <View
              style={[
                styles.codeRow,
                { marginTop: space(26), minHeight: Math.max(56, space(78)) },
              ]}
            >
              {Array.from({ length: emailCodeLength }, (_, index) => (
                <View
                  key={index}
                  accessible={false}
                  style={[
                    styles.digit,
                    { minHeight: Math.max(56, space(78)) },
                    focused &&
                      index === Math.min(code.length, emailCodeLength - 1) && {
                        borderColor: colors.brand,
                      },
                    expired && { borderColor: colors.error },
                  ]}
                >
                  <Text style={styles.digitText}>{code[index] || '_'}</Text>
                </View>
              ))}
              <TextInput
                ref={inputRef}
                testID="email-verification-code"
                accessibilityLabel="Email verification code"
                accessibilityHint={`${emailCodeLength} digits from your email`}
                value={code}
                onChangeText={onCodeChange}
                editable={!busy && !sessionPending}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={emailCodeLength}
                caretHidden
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onSubmitEditing={onVerify}
                returnKeyType="done"
                style={styles.codeInput}
              />
            </View>
            {error && !expired ? (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={styles.error}
              >
                {error}
              </Text>
            ) : null}
            <Text
              style={[
                styles.note,
                { marginTop: space(24), minHeight: space(28) },
              ]}
            >
              {expired
                ? 'The previous code can no longer be used.'
                : 'Didn\u2019t receive the email?'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={expired ? 'Resend a new code' : 'Resend code'}
              accessibilityState={{
                disabled: busy || sessionPending || remaining > 0,
              }}
              disabled={busy || sessionPending || remaining > 0}
              onPress={onResend}
              style={[
                styles.resend,
                { marginTop: space(14), minHeight: Math.max(44, space(45)) },
                expired && { backgroundColor: colors.brand },
              ]}
            >
              <Text
                style={[
                  styles.resendText,
                  expired && { color: colors.onAction },
                ]}
              >
                {expired ? 'Resend a new code' : 'Resend code'}
                {remaining > 0
                  ? `  \u2022  00:${String(remaining).padStart(2, '0')}`
                  : ''}
              </Text>
            </Pressable>
            <Text
              style={[
                styles.note,
                { marginTop: space(36), minHeight: space(48) },
              ]}
            >
              {expired
                ? 'You can request another code without restarting registration.'
                : 'Check your spam folder if the email is delayed.'}
            </Text>
            <View style={[styles.footer, { paddingTop: space(24) }]}>
              <BrandButton
                title={expired ? 'Send New Code' : 'Verify & Continue'}
                onPress={expired ? onResend : onVerify}
                busy={busy}
                disabled={expired && remaining > 0}
                style={styles.primary}
              />
              <BrandButton
                title="Use a different email"
                variant="text"
                disabled={busy}
                onPress={onDifferentEmail}
                style={{ marginTop: space(24) }}
              />
            </View>
          </>
        )}
      </ScrollView>
      {!verified ? (
        <View
          style={{
            position: 'absolute',
            top: insets.top + 6,
            left: horizontalPadding - 15,
          }}
        >
          <IconButton
            icon="back"
            label="Use a different email"
            onPress={onDifferentEmail}
            disabled={busy}
            color={colors.back}
            style={styles.back}
          />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  )
}

const useStyles = createThemedStyles(({ colors, dark }) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.canvas },
    content: { flexGrow: 1, width: '100%', maxWidth: 540, alignSelf: 'center' },
    title: {
      fontFamily: fonts.extraBold,
      fontSize: 30,
      lineHeight: 36,
      color: colors.ink,
    },
    copy: {
      fontFamily: fonts.medium,
      fontSize: 16,
      lineHeight: 20,
      color: colors.muted,
    },
    email: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      lineHeight: 21,
      color: colors.brand,
      textAlign: 'center',
      textAlignVertical: 'center',
    },
    codeRow: { flexDirection: 'row', gap: 10 },
    digit: {
      flex: 1,
      borderWidth: 1,
      borderColor: dark ? colors.border : '#E5E6EC',
      borderRadius: 14,
      backgroundColor: dark ? colors.surface : '#FAFAFC',
      alignItems: 'center',
      justifyContent: 'center',
    },
    digitText: {
      fontFamily: fonts.semibold,
      fontSize: 29,
      lineHeight: 36,
      color: colors.ink,
    },
    codeInput: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.01,
      color: 'transparent',
      fontSize: 1,
    },
    note: {
      fontFamily: fonts.medium,
      fontSize: 14,
      lineHeight: 19,
      color: colors.muted,
      textAlign: 'center',
      textAlignVertical: 'center',
    },
    resend: {
      width: 248,
      maxWidth: '100%',
      alignSelf: 'center',
      borderRadius: 14,
      backgroundColor: dark ? '#352C43' : '#EFF9F6',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    resendText: {
      fontFamily: fonts.semibold,
      fontSize: 14,
      lineHeight: 19,
      color: colors.ink,
      textAlign: 'center',
    },
    primary: { minHeight: 56, borderRadius: 16 },
    footer: { marginTop: 'auto' },
    error: {
      fontFamily: fonts.medium,
      fontSize: 14,
      lineHeight: 20,
      color: colors.error,
      marginTop: 10,
    },
    back: {
      width: 48,
      height: 48,
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
    successOuter: {
      alignSelf: 'center',
      backgroundColor: dark ? '#332C45' : '#EFF9F6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    successInner: {
      width: 97,
      height: 97,
      borderRadius: 49,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    successTitle: {
      fontFamily: fonts.extraBold,
      fontSize: 36,
      lineHeight: 44,
      color: colors.ink,
      textAlign: 'center',
    },
    successCopy: {
      fontFamily: fonts.medium,
      fontSize: 16,
      lineHeight: 21,
      color: colors.muted,
      textAlign: 'center',
    },
  }),
)
