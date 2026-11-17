import { useRouter } from 'expo-router'
import { Image, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useCompletion } from './use-completion'
import { useTheme, createThemedStyles } from '../theme-provider'
import wordmark from '../../assets/figma/interactive/welcome-wordmark.png'
import { BrandButton } from '../components/brand-button'
import { BrandLogo } from '../components/brand-logo'
import { ScreenContainer } from '../components/screen-container'
import { radius, typography } from '../theme'

export function WelcomeScreen() {
  const { entryColors: colors } = useTheme()
  const styles = useStyles()

  const { finish, busy } = useCompletion('/')
  const router = useRouter()
  const insets = useSafeAreaInsets()
  return (
    <ScreenContainer
      backgroundColor={colors.canvas}
      contentStyle={[
        styles.content,
        {
          paddingTop: Math.max(24, 88 - insets.top),
          paddingBottom: Math.max(24, 67 - insets.bottom),
        },
      ]}
    >
      <Text accessibilityRole="header" style={styles.heading}>
        Welcome
      </Text>
      <View style={styles.hero}>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel="Parkey"
          style={styles.lockup}
        >
          <BrandLogo variant="welcome" style={styles.logo} />
          <Image
            source={wordmark}
            resizeMode="contain"
            style={styles.wordmark}
          />
        </View>
        <Text style={styles.tagline}>Designed Around the Driver</Text>
      </View>
      <BrandButton
        title="Explore parking"
        variant="text"
        onPress={() => void finish()}
        busy={busy}
        style={[styles.button, styles.guest]}
      />
      <BrandButton
        title="Get Started"
        onPress={() => router.push('/onboarding/discover')}
        style={styles.button}
      />
    </ScreenContainer>
  )
}

const useStyles = createThemedStyles(({ entryColors: colors }) =>
  StyleSheet.create({
    content: { paddingHorizontal: 29 },
    guest: { position: 'absolute', bottom: 124, left: 29, right: 29 },
    heading: {
      ...typography.subtitle,
      color: colors.text,
      textAlign: 'center',
    },
    hero: {
      flexGrow: 1,
      minHeight: 240,
      justifyContent: 'center',
      paddingBottom: 20,
    },
    lockup: {
      borderRadius: 24,
      paddingVertical: 0,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      gap: 3,
    },
    logo: { width: 42, height: 47, alignSelf: 'flex-start' },
    loginBackdrop: { backgroundColor: colors.canvas },
    wordmark: {
      width: 175,
      height: 62,
    },
    tagline: {
      ...typography.welcomeBody,
      color: colors.onPlumMuted,
      textAlign: 'center',
      alignSelf: 'center',
      width: '100%',
      maxWidth: 306,
      marginLeft: 4,
    },
    button: {
      minHeight: 56,
      borderRadius: radius.compactButton,
    },
  }),
)
