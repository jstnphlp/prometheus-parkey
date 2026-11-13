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
      <BrandLogo variant="welcome" />
      <Text accessibilityLabel="Parkey" style={styles.wordmark}>
        park<Text style={styles.cyan}>ey</Text>
      </Text>
      <Text accessibilityRole="header" style={styles.tagline}>
        Parking, made simpler.
      </Text>
      <Text style={styles.description}>
        Find parking near your destination.
      </Text>
      <View style={styles.artworkArea}>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel="Parking arrival animation placeholder"
          style={styles.placeholder}
        />
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
  content: { paddingTop: 22, paddingBottom: 29 },
  loginBackdrop: { backgroundColor: colors.plum },
  wordmark: {
    ...typography.wordmark,
    color: colors.white,
    textAlign: 'center',
    // The original wordmark's text box overlaps the logo by 12pt.
    marginTop: -12,
  },
  cyan: { color: colors.cyan },
  tagline: {
    ...typography.subtitle,
    color: colors.white,
    textAlign: 'center',
    marginTop: -3,
  },
  description: {
    ...typography.welcomeBody,
    color: colors.onPlumMuted,
    textAlign: 'center',
    marginTop: 23,
  },
  artworkArea: { flexGrow: 1, justifyContent: 'center', marginTop: 34 },
  placeholder: {
    width: '100%',
    aspectRatio: 338 / 347,
    borderRadius: radius.artwork,
    backgroundColor: colors.white,
  },
  button: { marginTop: 17, marginHorizontal: 6, minHeight: 50 },
})
