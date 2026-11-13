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

import { colors, fonts, radius, typography } from '../theme'

export function FormField({
  label,
  icon,
  error,
  password = false,
  inputRef,
  ...props
}: TextInputProps & {
  label: string
  icon: string
  error?: string | null
  password?: boolean
  inputRef?: Ref<ComponentRef<typeof TextInput>>
}) {
  const [visible, setVisible] = useState(false)
  const { fontScale } = useWindowDimensions()
  return (
    <View style={styles.group}>
      {fontScale >= 1.3 ? (
        <Text
          accessible={false}
          importantForAccessibility="no"
          accessibilityElementsHidden
          style={styles.visibleLabel}
        >
          {label}
        </Text>
      ) : null}
      <View style={styles.field}>
        <Text accessible={false} style={styles.icon}>
          {icon}
        </Text>
        <TextInput
          {...props}
          ref={inputRef}
          accessibilityLabel={label}
          accessibilityHint={error || props.accessibilityHint}
          placeholder={props.placeholder ?? label}
          placeholderTextColor={fieldColors.ink}
          secureTextEntry={password && !visible}
          autoCorrect={false}
          autoCapitalize={props.autoCapitalize ?? 'none'}
          selectionColor={fieldColors.icon}
          style={styles.input}
        />
        {password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
            accessibilityState={{ disabled: props.editable === false }}
            disabled={props.editable === false}
            onPress={() => setVisible((value) => !value)}
            style={styles.toggle}
          >
            <Text style={styles.toggleText}>{visible ? 'Hide' : 'Show'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.error}
        >
          {error}
        </Text>
      ) : null}
    </View>
  )
}

export const fieldColors = { ink: '#233D49', icon: '#007F88' } as const
const styles = StyleSheet.create({
  group: { gap: 4 },
  visibleLabel: { ...typography.accountBody, color: colors.white },
  field: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 6,
    gap: 14,
    borderRadius: radius.compactButton,
    backgroundColor: colors.white,
  },
  icon: {
    width: 22,
    fontFamily: 'InterRegular',
    fontSize: 17,
    color: fieldColors.icon,
    textAlign: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 50,
    paddingVertical: 14,
    paddingHorizontal: 0,
    color: fieldColors.ink,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  toggle: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: fieldColors.icon,
  },
  error: { ...typography.accountBody, color: colors.white },
})
