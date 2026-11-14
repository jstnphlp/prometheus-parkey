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

import { BrandIcon } from '../components/brand-icon'
import type { BrandIconName } from '../components/brand-icon'
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
  icon: BrandIconName
  error?: string | null
  password?: boolean
  inputRef?: Ref<ComponentRef<typeof TextInput>>
}) {
  const [visible, setVisible] = useState(false)
  const { fontScale } = useWindowDimensions()
  const fieldId = `auth-${label.toLowerCase().replaceAll(' ', '-')}`
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
      <View
        testID={`${fieldId}-container`}
        style={[
          styles.field,
          { height: Math.max(50, Math.ceil(18 * fontScale + 28)) },
        ]}
      >
        <View testID={`${fieldId}-icon`} style={styles.icon}>
          <BrandIcon name={icon} />
        </View>
        <View style={styles.inputSlot}>
          <TextInput
            {...props}
            ref={inputRef}
            accessibilityLabel={label}
            accessibilityHint={error || props.accessibilityHint}
            placeholder={props.placeholder ?? label}
            placeholderTextColor={fieldColors.ink}
            secureTextEntry={password && !visible}
            multiline={false}
            numberOfLines={1}
            scrollEnabled
            underlineColorAndroid="transparent"
            autoCorrect={false}
            autoCapitalize={props.autoCapitalize ?? 'none'}
            selectionColor={fieldColors.icon}
            style={styles.input}
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
          style={styles.error}
        >
          {error}
        </Text>
      ) : null}
    </View>
  )
}

export const fieldColors = {
  ink: colors.fieldInk,
  icon: colors.fieldIcon,
} as const
const styles = StyleSheet.create({
  group: { gap: 4, width: '100%', minWidth: 0 },
  visibleLabel: { ...typography.accountBody, color: colors.white },
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
    backgroundColor: colors.white,
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
    color: fieldColors.ink,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  toggle: {
    width: 44,
    minHeight: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { ...typography.accountBody, color: colors.white },
})
