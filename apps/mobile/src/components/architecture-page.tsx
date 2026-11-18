import type { ReactNode } from 'react'
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { IconButton } from '../discovery/ui'
import { fonts } from '../theme'
import { createThemedStyles, useTheme } from '../theme-provider'

export function useArchitectureInsets() {
  const insets = useSafeAreaInsets()
  return {
    top: Platform.OS === 'web' ? Math.max(insets.top, 44) : insets.top,
    bottom: Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom,
  }
}

/** Shared full-page geometry from frames 16A / 22A / 22B; no simulated OS chrome. */
export function ArchitecturePage({
  title,
  subtitle,
  onBack,
  children,
  footer,
  scrollable = true,
}: {
  title: string
  subtitle: string
  onBack: () => void
  children: ReactNode
  footer?: ReactNode
  scrollable?: boolean
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const insets = useArchitectureInsets()
  const content = (
    <>
      <IconButton
        icon="back"
        label="Back"
        color={colors.back}
        onPress={onBack}
        style={styles.back}
      />
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {children}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </>
  )
  const padding = {
    paddingTop: insets.top + 6,
    paddingBottom: insets.bottom + 44,
  }
  return (
    <View style={styles.screen}>
      {scrollable ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, padding]}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={[styles.content, padding, { flex: 1 }]}>{content}</View>
      )}
    </View>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.canvas },
    content: {
      flexGrow: 1,
      width: '100%',
      maxWidth: 540,
      alignSelf: 'center',
      paddingHorizontal: 28,
    },
    back: {
      width: 48,
      height: 48,
      marginLeft: -13,
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
    heading: { marginTop: 40, marginBottom: 36, gap: 28 },
    title: {
      fontFamily: fonts.extraBold,
      fontSize: 32,
      lineHeight: 40,
      color: colors.ink,
    },
    subtitle: {
      fontFamily: fonts.medium,
      fontSize: 16,
      lineHeight: 24,
      color: colors.muted,
    },
    footer: { marginTop: 'auto', paddingTop: 32 },
  }),
)
