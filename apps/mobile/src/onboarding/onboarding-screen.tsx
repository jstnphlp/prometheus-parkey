import { useRouter } from 'expo-router'
import {
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import compare from '../../assets/figma/onboarding/phase3-compare.png'
import discover from '../../assets/figma/onboarding/phase3-discover.png'
import navigate from '../../assets/figma/onboarding/phase3-navigate.png'
import { BrandButton } from '../components/brand-button'
import { ScreenContainer } from '../components/screen-container'
import { colors, typography } from '../theme'

import { BackButton } from './back-button'
import { useCompletion } from './use-completion'

const steps = {
  discover: {
    number: 1,
    title: 'Accessible Parking Spots.',
    copy: 'From street parking and shopping malls to restaurants, open parking lots, and hidden spots you never knew existed.',
    background: colors.dark,
    muted: colors.onPlumMuted,
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
    title: 'Your route. Your choice.',
    copy: 'You can use your preferred navigation app to find your way to your parking spot.',
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
  const { finish, busy } = useCompletion('/register')
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const artScale = Math.min(Math.min(width, 440) / 390, height / 844)
  return (
    <ScreenContainer
      backgroundColor={page.background}
      contentStyle={[
        styles.content,
        {
          paddingTop: Math.max(64, 97 - insets.top),
          paddingBottom: Math.max(24, 65 - insets.bottom),
        },
      ]}
      overlay={
        <View style={styles.navigation}>
          <View style={styles.back}>
            <BackButton backgroundColor={page.background} />
          </View>
          <BrandButton
            title="Skip"
            variant="text"
            onPress={finish}
            disabled={busy}
          />
        </View>
      }
    >
      <View style={[styles.artworkArea, { height: 351 * artScale }]}>
        <Image
          accessibilityRole="image"
          accessibilityLabel={page.imageLabel}
          source={page.image}
          resizeMode="contain"
          style={{
            width: (step === 'navigate' ? 348 : 390) * artScale,
            height:
              (step === 'compare' ? 251 : step === 'navigate' ? 348 : 351) *
              artScale,
            marginTop:
              (step === 'compare' ? 74 : step === 'navigate' ? 6 : 0) *
              artScale,
          }}
        />
      </View>
      <Text
        accessibilityRole="header"
        accessibilityLabel={`Step ${page.number} of 3. ${page.title.replace('\n', ' ')}`}
        style={styles.title}
      >
        {page.title}
      </Text>
      <Text
        style={[
          styles.copy,
          step === 'discover' && styles.discoverCopy,
          { color: page.muted },
        ]}
      >
        {page.copy}
      </Text>
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
      </View>
      <BrandButton
        title="Continue"
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
  content: { paddingHorizontal: 28 },
  navigation: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 7,
  },
  back: { flex: 1 },
  title: {
    ...typography.title,
    color: colors.white,
    marginTop: 44,
  },
  copy: {
    ...typography.body,
    minHeight: 57,
    marginTop: 20,
    marginHorizontal: 3,
  },
  discoverCopy: { ...typography.welcomeBody },
  artworkArea: { marginHorizontal: -28, alignItems: 'center' },
  controls: {
    flexGrow: 1,
    minHeight: 5,
    marginTop: 34,
    justifyContent: 'flex-end',
  },
  progress: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.progressMuted,
    opacity: 0.48,
  },
  activeSegment: { width: 23, backgroundColor: colors.white, opacity: 1 },
  button: { marginTop: 25 },
})
