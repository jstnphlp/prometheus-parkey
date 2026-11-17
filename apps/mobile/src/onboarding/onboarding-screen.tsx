import { useRouter } from 'expo-router'
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'

import compare from '../../assets/figma/interactive/compare.png'
import discover from '../../assets/figma/interactive/discover.png'
import navigate from '../../assets/figma/interactive/navigate.png'
import { useArchitectureInsets } from '../components/architecture-page'
import { BrandButton } from '../components/brand-button'
import { fonts } from '../theme'
import { createThemedStyles } from '../theme-provider'
import { useCompletion } from './use-completion'

const steps = {
  discover: {
    number: 1,
    title: 'Accessible Parking\nSpots.',
    copy: 'Find street parking, commercial lots and hidden spots near your destination.',
    image: discover,
    next: '/onboarding/compare',
  },
  compare: {
    number: 2,
    title: 'Know before\nyou park.',
    copy: 'Compare parking rates, hours and useful details when reliable data is available.',
    image: compare,
    next: '/onboarding/navigate',
  },
  navigate: {
    number: 3,
    title: 'Your route. Your\nchoice.',
    copy: 'Use your preferred navigation app to find your way to your parking spot.',
    image: navigate,
    next: null,
  },
} as const

export function OnboardingScreen({ step }: { step: keyof typeof steps }) {
  const styles = useStyles()
  const router = useRouter()
  const insets = useArchitectureInsets()
  const { width, height } = useWindowDimensions()
  const scale = Math.min(width / 430, 1.15)
  const page = steps[step]
  const { finish, busy } = useCompletion('/')
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            minHeight: height,
            paddingTop: insets.top,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        <View style={[styles.artArea, { height: 478 * scale }]}>
          <Image
            source={page.image}
            accessibilityLabel={`Illustration only: ${step === 'compare' ? 'example parking details, rates and distances' : step === 'discover' ? 'a parking facility' : 'navigation app choices'}`}
            resizeMode="contain"
            fadeDuration={0}
            style={[
              styles.art,
              step === 'discover'
                ? { width: 458 * scale, height: 344 * scale, top: 94 * scale }
                : step === 'compare'
                  ? {
                      width: 420 * scale,
                      height: 260 * scale,
                      top: 140 * scale,
                    }
                  : {
                      width: 380 * scale,
                      height: 380 * scale,
                      top: 70 * scale,
                    },
            ]}
          />
        </View>
        <View style={styles.text}>
          <Text
            accessibilityRole="header"
            accessibilityLabel={`Step ${page.number} of 3. ${page.title.replace('\n', ' ')}`}
            style={styles.title}
          >
            {page.title}
          </Text>
          <Text style={styles.copy}>{page.copy}</Text>
          {step === 'compare' ? (
            <Text style={styles.disclosure}>
              Illustration only{' \u00b7 '}example rates and distances
            </Text>
          ) : null}
        </View>
        <View style={styles.footer}>
          <View accessible={false} style={styles.progress}>
            {[1, 2, 3].map((number) => (
              <View
                key={number}
                style={[styles.dot, page.number === number && styles.activeDot]}
              />
            ))}
          </View>
          <View style={styles.actions}>
            <BrandButton
              title="Skip"
              variant="white"
              disabled={busy}
              onPress={() => void finish()}
              style={styles.skip}
            />
            <BrandButton
              title={page.next ? 'Next' : 'Continue'}
              busy={busy}
              onPress={() =>
                page.next ? router.push(page.next) : void finish()
              }
              style={styles.next}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.canvas },
    content: { flexGrow: 1, width: '100%', maxWidth: 540, alignSelf: 'center' },
    artArea: { overflow: 'hidden', alignItems: 'center', flexShrink: 0 },
    art: { position: 'absolute' },
    text: { paddingHorizontal: 30, paddingTop: 48 },
    title: {
      fontFamily: fonts.black,
      fontSize: 37,
      lineHeight: 44,
      color: colors.ink,
    },
    copy: {
      fontFamily: fonts.regular,
      fontSize: 16,
      lineHeight: 20,
      color: colors.muted,
      marginTop: 48,
    },
    disclosure: {
      fontFamily: fonts.medium,
      fontSize: 11,
      lineHeight: 16,
      color: colors.muted,
      marginTop: 8,
    },
    footer: { marginTop: 'auto', paddingTop: 36, paddingHorizontal: 25 },
    progress: {
      alignSelf: 'center',
      flexDirection: 'row',
      gap: 10,
      marginBottom: 32,
    },
    dot: {
      width: 12,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    activeDot: { width: 28, backgroundColor: colors.brand },
    actions: { flexDirection: 'row', gap: 13 },
    skip: { flex: 0.6, minHeight: 58, borderRadius: 17 },
    next: { flex: 1, minHeight: 58, borderRadius: 17 },
  }),
)
