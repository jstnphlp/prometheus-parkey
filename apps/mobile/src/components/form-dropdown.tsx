import { useRef, useState } from 'react'
import type { ComponentRef } from 'react'
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'

import { Icon } from '../discovery/ui'
import { fonts } from '../theme'
import { createThemedStyles, useTheme } from '../theme-provider'
import { useArchitectureInsets } from './architecture-page'

type Anchor = { x: number; y: number; width: number; height: number }

export function FormDropdown({
  label,
  value,
  options,
  onChange,
  disabled = false,
  error = false,
  minHeight = 63,
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
  disabled?: boolean
  error?: boolean
  minHeight?: number
}) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const field = useRef<ComponentRef<typeof View>>(null)
  const { width, height } = useWindowDimensions()
  const insets = useArchitectureInsets()
  const { colors } = useTheme()
  const styles = useStyles()
  function measure(show: boolean) {
    field.current?.measureInWindow((x, y, fieldWidth, fieldHeight) => {
      setAnchor({ x, y, width: fieldWidth, height: fieldHeight })
      if (show) setOpen(true)
    })
  }
  const below = anchor
    ? height - insets.bottom - anchor.y - anchor.height - 12
    : 0
  const above = anchor ? anchor.y - insets.top - 12 : 0
  const useBelow = below >= 160 || below >= above
  const menuHeight = Math.min(305, Math.max(104, useBelow ? below : above))
  const menuWidth = Math.min(anchor?.width ?? 341, width - 24)
  const menuX = Math.max(12, Math.min(anchor?.x ?? 12, width - menuWidth - 12))
  const menuY = Math.max(
    insets.top + 8,
    anchor
      ? useBelow
        ? anchor.y + anchor.height + 8
        : anchor.y - menuHeight - 8
      : insets.top + 8,
  )
  return (
    <>
      <Pressable
        ref={field}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value || 'Choose an option' }}
        accessibilityHint="Opens the list of choices"
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss()
          measure(true)
        }}
        style={({ pressed }) => [
          styles.field,
          {
            minHeight,
            borderColor: error || open ? colors.brand : colors.border,
            backgroundColor: disabled ? colors.soft : colors.surface,
          },
          pressed && { opacity: 0.75 },
        ]}
      >
        <Text
          style={[
            styles.value,
            (!value || disabled) && { color: colors.muted },
          ]}
        >
          {value || 'Choose an option'}
        </Text>
        <View style={styles.chevron}>
          <View style={{ transform: [{ rotate: '180deg' }] }}>
            <Icon
              name="chevron"
              size={20}
              color={disabled ? colors.muted : colors.ink}
            />
          </View>
        </View>
      </Pressable>
      <Modal
        visible={open && !disabled && anchor !== null}
        transparent
        animationType="none"
        onShow={() => measure(false)}
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Close choices"
            onPress={() => setOpen(false)}
          />
          <View
            accessibilityViewIsModal
            accessibilityLabel={label}
            style={[
              styles.menu,
              {
                left: menuX,
                top: menuY,
                width: menuWidth,
                maxHeight: menuHeight,
              },
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              alwaysBounceVertical={false}
              style={{ maxHeight: menuHeight - 24 }}
              contentContainerStyle={styles.options}
            >
              {options.map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityLabel={option}
                  accessibilityState={{ checked: value === option }}
                  onPress={() => {
                    onChange(option)
                    setOpen(false)
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    value === option && styles.selected,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      value === option && { color: colors.ink },
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    field: {
      borderRadius: 13,
      borderWidth: 1.3,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingLeft: 16,
      paddingRight: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    value: {
      flex: 1,
      fontFamily: fonts.medium,
      fontSize: 16,
      lineHeight: 22,
      color: colors.ink,
    },
    chevron: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    overlay: { flex: 1 },
    menu: {
      position: 'absolute',
      borderRadius: 16,
      backgroundColor: colors.surface,
      padding: 12,
      boxShadow: `0px 4px 24px ${colors.shadow}`,
    },
    options: { gap: 8 },
    option: {
      minHeight: 52,
      paddingHorizontal: 12,
      paddingVertical: 16,
      justifyContent: 'center',
      borderRadius: 12,
    },
    optionText: {
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
    },
    selected: { backgroundColor: colors.soft },
  }),
)
