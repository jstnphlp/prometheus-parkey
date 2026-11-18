import { ActivityIndicator, StyleSheet, Text } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'

import { MotionPressable } from '../discovery/motion'
import type { ParkeyTheme } from '../theme-colors'
import { useTheme } from '../theme-provider'
import { fonts, radius, spacing, typography } from '../theme'

const getVariants = (colors: ParkeyTheme['entryColors']) =>
  ({
    teal: { backgroundColor: colors.teal, color: colors.onAction },
    cyan: { backgroundColor: colors.plum, color: colors.onAction },
    plum: { backgroundColor: colors.plum, color: colors.onAction },
    white: { backgroundColor: colors.accentSoft, color: colors.text },
    accent: { backgroundColor: colors.accentSoft, color: colors.link },
    text: { backgroundColor: 'transparent', color: colors.link },
    plain: { backgroundColor: 'transparent', color: colors.link },
  }) as const

export function BrandButton({
  title,
  onPress,
  variant = 'teal',
  busy = false,
  disabled = false,
  style,
}: {
  title: string
  onPress: () => void
  variant?: keyof ReturnType<typeof getVariants>
  busy?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const { entryColors: colors } = useTheme()
  const variants = getVariants(colors)

  const palette = variants[variant]
  const textButton = variant === 'text' || variant === 'plain'
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.backgroundColor },
        textButton && styles.textButton,
        pressed && !disabled && !busy && styles.dimmed,
        disabled && !textButton && { backgroundColor: colors.border },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={palette.color} />
      ) : (
        <Text
          style={[
            variant === 'text' || variant === 'plain'
              ? typography.link
              : styles.primaryLabel,
            styles.label,
            { color: disabled ? colors.secondary : palette.color },
          ]}
        >
          {title}
        </Text>
      )}
    </MotionPressable>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.button,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButton: { minHeight: 44, borderRadius: 0 },
  primaryLabel: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  label: { alignSelf: 'stretch', textAlign: 'center' },
  dimmed: { opacity: 0.65 },
})
