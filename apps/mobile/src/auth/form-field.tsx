import { useState } from 'react'
import type { ComponentRef, Ref } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import type { TextInputProps } from 'react-native'

import type { ParkeyTheme } from '../theme-colors'
import { useTheme, createThemedStyles } from '../theme-provider'
import { BrandIcon } from '../components/brand-icon'
import type { BrandIconName } from '../components/brand-icon'
import { fonts, radius, typography } from '../theme'

export function FormField({
  label,
  icon,
  error,
  password = false,
  inputRef,
  compact = false,
  ...props
}: TextInputProps & {
  label: string
  icon: BrandIconName
  error?: string | null
  password?: boolean
  compact?: boolean
  inputRef?: Ref<ComponentRef<typeof TextInput>>
}) {
  const { entryColors: colors } = useTheme()
  const fieldColors = getFieldColors(colors)
  const styles = useStyles()

  const [visible, setVisible] = useState(false)
  const [focused, setFocused] = useState(false)
  const { fontScale } = useWindowDimensions()
  const fieldId = `auth-${label.toLowerCase().replaceAll(' ', '-')}`
  return (
    <View style={[styles.group, compact && { gap: 4 }]}>
      <Text
        accessible={false}
        importantForAccessibility="no"
        accessibilityElementsHidden
        style={[
          styles.visibleLabel,
          compact && { fontSize: 12, lineHeight: 16 },
        ]}
      >
        {label}
      </Text>
      <View
        testID={`${fieldId}-container`}
        style={[
          styles.field,
          {
            borderColor: error
              ? colors.pending
              : focused
                ? colors.primary
                : colors.border,
            backgroundColor:
              props.editable === false ? colors.surface : colors.card,
          },
          {
            height: Math.max(compact ? 47 : 57, Math.ceil(18 * fontScale + 28)),
          },
        ]}
      >
        {!password && !compact ? (
          <View testID={`${fieldId}-icon`} style={styles.icon}>
            <BrandIcon name={icon} />
          </View>
        ) : null}
        <View style={styles.inputSlot}>
          <TextInput
            {...props}
            ref={inputRef}
            accessibilityLabel={label}
            accessibilityHint={error || props.accessibilityHint}
            placeholder={props.placeholder ?? label}
            placeholderTextColor={colors.secondary}
            secureTextEntry={password && !visible}
            multiline={false}
            numberOfLines={1}
            scrollEnabled
            underlineColorAndroid="transparent"
            autoCorrect={false}
            autoCapitalize={props.autoCapitalize ?? 'none'}
            selectionColor={fieldColors.icon}
            onFocus={(event) => {
              setFocused(true)
              props.onFocus?.(event)
            }}
            onBlur={(event) => {
              setFocused(false)
              props.onBlur?.(event)
            }}
            style={[
              styles.input,
              props.editable === false && { color: colors.secondary },
              compact && { fontSize: 14 },
            ]}
          />
        </View>
        {password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
            accessibilityState={{ disabled: props.editable === false }}
            disabled={props.editable === false}
            onPress={() => setVisible((value) => !value)}
            style={styles.toggle}
          >
            <BrandIcon name={visible ? 'eye-off' : 'eye'} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[styles.error, { color: colors.error }]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  )
}

const getFieldColors = (colors: ParkeyTheme['entryColors']) =>
  ({
    ink: colors.fieldInk,
    icon: colors.fieldIcon,
  }) as const
const useStyles = createThemedStyles(({ entryColors: colors }) =>
  StyleSheet.create({
    group: { gap: 8, width: '100%', minWidth: 0 },
    visibleLabel: {
      fontFamily: fonts.semibold,
      fontSize: 14,
      lineHeight: 20,
      color: colors.text,
    },
    field: {
      width: '100%',
      minWidth: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 16,
      paddingRight: 6,
      gap: 14,
      borderRadius: radius.compactButton,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    icon: {
      width: 22,
      height: 22,
      flexShrink: 0,
    },
    inputSlot: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      height: '100%',
      overflow: 'hidden',
    },
    input: {
      flex: 1,
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      height: '100%',
      paddingVertical: 0,
      paddingHorizontal: 0,
      textAlignVertical: 'center',
      color: colors.fieldInk,
      fontFamily: fonts.medium,
      fontSize: 15,
      lineHeight: 20,
    },
    toggle: {
      width: 44,
      minHeight: 44,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    error: { ...typography.accountBody, color: colors.text },
  }),
)
