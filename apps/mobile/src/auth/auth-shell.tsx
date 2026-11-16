import type { ReactNode } from 'react'
import { StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme, createThemedStyles } from '../theme-provider'
import { BrandLogo } from '../components/brand-logo'
import { ScreenContainer } from '../components/screen-container'
import { BackButton } from '../onboarding/back-button'
import { typography } from '../theme'
import { useAuthSystemPopup } from './use-system-popup'

export function AuthShell({
  registering = false,
  title,
  subtitle,
  children,
  onBack,
}: {
  registering?: boolean
  title: ReactNode
  subtitle: string
  children: ReactNode
  onBack?: () => void
}) {
  const { entryColors: colors } = useTheme()
  const styles = useStyles()

  const insets = useSafeAreaInsets()
  useAuthSystemPopup()
  const background = colors.canvas
  return (
    <ScreenContainer
      backgroundColor={background}
      keyboardAware
      contentStyle={[
        styles.content,
        { paddingTop: Math.max(20, 65 - insets.top) },
      ]}
      overlay={
        <BackButton
          backgroundColor={background}
          {...(onBack ? { onPress: onBack } : {})}
        />
      }
    >
      <BrandLogo variant="account" />
      <Text
        accessibilityRole="header"
        style={[
          styles.title,
          registering ? typography.accountTitle : typography.loginTitle,
          !registering && styles.loginTitle,
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.subtitle,
          { color: registering ? colors.onPlumMuted : colors.onDarkMuted },
          !registering && styles.loginSubtitle,
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
    content: { paddingHorizontal: 32, paddingBottom: 28 },
    title: { color: colors.text, marginTop: 17 },
    loginTitle: { marginTop: 19 },
    subtitle: { ...typography.accountBody, marginTop: 6 },
    loginSubtitle: { marginTop: 14 },
  }),
)
