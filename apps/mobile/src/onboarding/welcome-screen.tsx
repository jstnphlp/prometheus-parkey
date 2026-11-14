import { useRouter } from 'expo-router'
import { Image, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import wordmark from '../../assets/figma/onboarding/phase3-welcome-wordmark.png'

import { BrandButton } from '../components/brand-button'
import { BrandLogo } from '../components/brand-logo'
import { ScreenContainer } from '../components/screen-container'
import { colors, radius, typography } from '../theme'

export function WelcomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  return (
    <ScreenContainer
      backgroundColor={colors.plum}
      contentStyle={[
        styles.content,
        {
          paddingTop: Math.max(24, 61 - insets.top),
          paddingBottom: Math.max(24, 65 - insets.bottom),
        },
      ]}
      overlay={
        <View style={styles.loginBackdrop}>
          <BrandButton
            title="Log In"
            variant="text"
            onPress={() => router.push('/login')}
          />
        </View>
      }
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
        title="Get Started"
        onPress={() => router.push('/onboarding/discover')}
        style={styles.button}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 29 },
  heading: { ...typography.subtitle, color: colors.white, textAlign: 'center' },
  hero: { flexGrow: 1, minHeight: 240, justifyContent: 'center' },
  lockup: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 3,
    transform: [{ translateX: 7 }],
  },
  logo: { width: 42, height: 47, alignSelf: 'flex-start' },
  loginBackdrop: { backgroundColor: colors.plum },
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
    minHeight: 50,
    borderRadius: radius.compactButton,
  },
})
