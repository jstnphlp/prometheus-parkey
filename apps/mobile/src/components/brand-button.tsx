import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'

import { colors, layout, radius, spacing, typography } from '../theme'

const variants = {
  teal: { backgroundColor: colors.teal, color: colors.white },
  cyan: { backgroundColor: colors.cyan, color: colors.white },
  plum: { backgroundColor: colors.plum, color: colors.white },
  white: { backgroundColor: colors.white, color: colors.plum },
  text: { backgroundColor: 'transparent', color: colors.white },
  plain: { backgroundColor: 'transparent', color: colors.plum },
} as const

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
  variant?: keyof typeof variants
  busy?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const palette = variants[variant]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.backgroundColor },
        (variant === 'text' || variant === 'plain') && styles.textButton,
        (pressed || disabled || busy) && styles.dimmed,
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
              : typography.button,
            styles.label,
            { color: palette.color },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: layout.buttonHeight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.button,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButton: { minHeight: layout.touchTarget, borderRadius: 0 },
  label: { alignSelf: 'stretch', textAlign: 'center' },
  dimmed: { opacity: 0.65 },
})
