import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'

import type { ParkeyTheme } from '../theme-colors'
import { useTheme } from '../theme-provider'
import { layout, radius, spacing, typography } from '../theme'

const getVariants = (colors: ParkeyTheme['entryColors']) =>
  ({
    teal: { backgroundColor: colors.teal, color: colors.onAction },
    cyan: { backgroundColor: colors.plum, color: colors.onAction },
    plum: { backgroundColor: colors.plum, color: colors.onAction },
    white: { backgroundColor: colors.accentSoft, color: colors.link },
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
