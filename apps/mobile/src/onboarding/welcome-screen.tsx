import { useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

import { BrandButton } from '../components/brand-button'
import { BrandLogo } from '../components/brand-logo'
import { ScreenContainer } from '../components/screen-container'
import { colors, radius, typography } from '../theme'

export function WelcomeScreen() {
  const router = useRouter()
  return (
    <ScreenContainer
      backgroundColor={colors.plum}
      contentStyle={styles.content}
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
      <View style={styles.hero}>
        <BrandLogo variant="welcome" style={styles.logo} />
        <Text accessibilityLabel="Parkey" style={styles.wordmark}>
          park<Text style={styles.cyan}>ey</Text>
        </Text>
        <Text accessibilityRole="header" style={styles.tagline}>
          Designed Around the Driver.
        </Text>
        <Text style={styles.description}>
          Find parking near your destination. Including street parking, open
          lots, obscure spots.
        </Text>
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
  content: { paddingBottom: 29 },
  hero: { flexGrow: 1, justifyContent: 'center', paddingTop: 72 },
  // Preserve the original logo's optical offset without changing its dimensions.
  logo: { transform: [{ translateX: 13 }] },
  loginBackdrop: { backgroundColor: colors.plum },
  wordmark: {
    ...typography.wordmark,
    color: colors.white,
    textAlign: 'center',
    // The original wordmark's text box overlaps the logo by 12pt.
    marginTop: -12,
    marginLeft: 4,
  },
  cyan: { color: colors.cyan },
  tagline: {
    ...typography.subtitle,
    color: colors.white,
    textAlign: 'center',
    marginTop: -3,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 314,
    marginLeft: 4,
  },
  description: {
    ...typography.welcomeBody,
    color: colors.onPlumMuted,
    textAlign: 'center',
    marginTop: 7,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 306,
    marginLeft: 4,
  },
  button: {
    marginHorizontal: 6,
    minHeight: 50,
    borderRadius: radius.compactButton,
  },
})
