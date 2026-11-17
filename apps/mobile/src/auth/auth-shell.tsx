import type { ReactNode } from 'react'
import { Platform, StyleSheet, Text } from 'react-native'

import { useTheme, createThemedStyles } from '../theme-provider'
import { BrandLogo } from '../components/brand-logo'
import { ScreenContainer } from '../components/screen-container'
import { BackButton } from '../onboarding/back-button'
import { fonts, typography } from '../theme'
import { useAuthSystemPopup } from './use-system-popup'

export function AuthShell({
  registering = false,
  title,
  subtitle,
  children,
  onBack,
  recovery = false,
}: {
  registering?: boolean
  title: ReactNode
  subtitle: string
  children: ReactNode
  onBack?: () => void
  recovery?: boolean
}) {
  const { entryColors: colors } = useTheme()
  const styles = useStyles()

  useAuthSystemPopup()
  const background = colors.canvas
  return (
    <ScreenContainer
      backgroundColor={background}
      keyboardAware
      contentStyle={[
        styles.content,
        { paddingTop: Platform.OS === 'web' ? 77 : 33 },
      ]}
      overlay={
        <BackButton
          backgroundColor={background}
          {...(onBack ? { onPress: onBack } : {})}
        />
      }
    >
      <BrandLogo variant="account" style={{ width: 42, height: 47 }} />
      <Text
        accessibilityRole="header"
        style={[
          styles.title,
          registering ? typography.accountTitle : styles.signInTitle,
          !registering && styles.loginTitle,
          recovery && { marginTop: 78 },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.subtitle,
          { color: registering ? colors.onPlumMuted : colors.onDarkMuted },
          !registering && styles.loginSubtitle,
          recovery && { marginTop: 18, lineHeight: 21 },
        ]}
      >
        {subtitle}
      </Text>
      {children}
    </ScreenContainer>
  )
}

const useStyles = createThemedStyles(({ entryColors: colors }) =>
  StyleSheet.create({
    content: { paddingHorizontal: 30, paddingBottom: 44 },
    signInTitle: { fontFamily: fonts.extraBold, fontSize: 32, lineHeight: 38 },
    title: { color: colors.text, marginTop: 17 },
    loginTitle: { marginTop: 34 },
    subtitle: { ...typography.accountBody, marginTop: 18 },
    loginSubtitle: {
      marginTop: 30,
      fontFamily: fonts.regular,
      fontSize: 16,
      lineHeight: 24,
    },
  }),
)
