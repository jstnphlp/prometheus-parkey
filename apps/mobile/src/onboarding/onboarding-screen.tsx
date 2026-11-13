import { useRouter } from 'expo-router'
import { Image, StyleSheet, Text, View } from 'react-native'

import compare from '../../assets/figma/onboarding/compare-preview.png'
import discover from '../../assets/figma/onboarding/discover-illustration.png'
import navigate from '../../assets/figma/onboarding/navigate-preview.png'
import { BrandButton } from '../components/brand-button'
import { ScreenContainer } from '../components/screen-container'
import { colors, radius, typography } from '../theme'

import { BackButton } from './back-button'
import { useCompletion } from './use-completion'

const steps = {
  discover: {
    number: 1,
    title: 'Find parking.\nGo places.',
    copy: 'Explore mapped parking locations\nnear your destination.',
    background: colors.dark,
    muted: colors.onDarkMuted,
    button: 'cyan',
    image: discover,
    imageLabel: 'Static illustration: discovering parking with Parkey',
    next: '/onboarding/compare',
  },
  compare: {
    number: 2,
    title: 'Know before\nyou park.',
    copy: 'Compare parking details when\nreliable information is available.',
    background: colors.teal,
    muted: colors.onTealMuted,
    button: 'plum',
    image: compare,
    imageLabel: 'Static preview: parking lot and garage information',
    next: '/onboarding/navigate',
  },
  navigate: {
    number: 3,
    title: 'Find your way\nto parking.',
    copy: 'Follow available directions and\ncheck the confirmed entrance.',
    background: colors.plum,
    muted: colors.onPlumMuted,
    button: 'white',
    image: navigate,
    imageLabel: 'Static preview: directions to a parking entrance',
    next: null,
  },
} as const

export function OnboardingScreen({ step }: { step: keyof typeof steps }) {
  const page = steps[step]
  const router = useRouter()
  const { finish, busy, error } = useCompletion('/register')
  return (
    <ScreenContainer
      backgroundColor={page.background}
      contentStyle={styles.content}
      overlay={<BackButton backgroundColor={page.background} />}
    >
      <Text
        accessibilityRole="header"
        accessibilityLabel={`Step ${page.number} of 3. ${page.title.replace('\n', ' ')}`}
        style={styles.title}
      >
        {page.title}
      </Text>
      <Text style={[styles.copy, { color: page.muted }]}>{page.copy}</Text>
      <View
        style={[
          styles.artworkArea,
          step === 'discover' && styles.discoverArtworkArea,
        ]}
      >
        <Image
          accessibilityRole="image"
          accessibilityLabel={page.imageLabel}
          source={page.image}
          resizeMode={step === 'discover' ? 'cover' : 'contain'}
          style={[
            styles.artwork,
            step === 'discover' && styles.discoverArtwork,
          ]}
        />
      </View>
      <View style={styles.controls}>
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={styles.progress}
        >
          {[1, 2, 3].map((number) => (
            <View
              key={number}
              style={[
                styles.segment,
                number === page.number && styles.activeSegment,
              ]}
            />
          ))}
        </View>
        <BrandButton
          title="Skip"
          variant="text"
          onPress={finish}
          disabled={busy}
          style={styles.skip}
        />
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
      <BrandButton
        title={page.next ? 'Continue' : 'Create Account'}
        variant={page.button}
        busy={busy}
        onPress={() => {
          if (page.next) router.push(page.next)
          else void finish()
        }}
        style={styles.button}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: { paddingTop: 98, paddingBottom: 31 },
  title: {
    ...typography.title,
    color: colors.white,
    marginHorizontal: 2,
  },
  copy: { ...typography.body, marginTop: 35, marginHorizontal: 2 },
  artworkArea: { flexGrow: 1, justifyContent: 'center', marginTop: 53 },
  discoverArtworkArea: { marginLeft: -13, marginRight: -14 },
  artwork: {
    width: '100%',
    // Clear Image's intrinsic bitmap height so the slot ratio controls layout.
    height: undefined,
    aspectRatio: 338 / 274,
  },
  discoverArtwork: {
    aspectRatio: 365 / 274,
    borderRadius: radius.rasterArtwork,
  },
  controls: { minHeight: 44, marginTop: 11, justifyContent: 'center' },
  progress: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  segment: {
    width: 33,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.progressMuted,
    opacity: 0.48,
  },
  activeSegment: { backgroundColor: colors.white, opacity: 1 },
  skip: { alignSelf: 'flex-end', paddingHorizontal: 2 },
  button: { marginTop: 29, marginHorizontal: 2 },
  error: { ...typography.body, color: colors.white, marginTop: 16 },
})
