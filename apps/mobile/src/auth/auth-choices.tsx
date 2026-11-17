import { useRouter } from 'expo-router'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'

import google from '../../assets/auth/google-g.png'
import { useArchitectureInsets } from '../components/architecture-page'
import { BrandLogo } from '../components/brand-logo'
import { usePopup } from '../components/popup-provider'
import { Icon } from '../discovery/ui'
import { fonts } from '../theme'
import { createThemedStyles, useTheme } from '../theme-provider'
import { authFeedback } from './feedback'
import { useAuth } from './provider'

export function AuthChoices() {
  const styles = useStyles()
  const { colors } = useTheme()
  const auth = useAuth()
  const router = useRouter()
  const popup = usePopup()
  const insets = useArchitectureInsets()
  const { height } = useWindowDimensions()
  async function social(provider: 'google' | 'facebook') {
    try {
      await auth.signInWithProvider(provider, false)
    } catch (error) {
      popup.show({
        ...authFeedback(error, 'Could not sign in'),
        primary: { title: 'Try again' },
      })
    }
  }
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            minHeight: height,
            paddingTop: insets.top + 40,
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        <BrandLogo variant="welcome" style={{ width: 118, height: 137 }} />
        <Text accessibilityRole="header" style={styles.title}>
          Let’s get you parked.
        </Text>
        <Text style={styles.subtitle}>
          Sign in to manage your Parkey account.
        </Text>
        <View style={styles.providers}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            accessibilityState={{
              disabled: !auth.socialProviders.google || auth.busy,
            }}
            disabled={!auth.socialProviders.google || auth.busy}
            onPress={() => void social('google')}
            style={styles.provider}
          >
            <Image source={google} style={styles.providerIcon} />
            <Text style={styles.providerText}>Continue with Google</Text>
          </Pressable>
          <View accessibilityState={{ disabled: true }} style={styles.provider}>
            <Icon name="phone" color={colors.muted} size={24} />
            <Text style={[styles.providerText, { color: colors.muted }]}>
              Continue with phone · unavailable
            </Text>
          </View>
          <View style={styles.separator}>
            <View style={styles.rule} />
            <Text style={styles.small}>or</Text>
            <View style={styles.rule} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue with Facebook"
            accessibilityState={{
              disabled: !auth.socialProviders.facebook || auth.busy,
            }}
            disabled={!auth.socialProviders.facebook || auth.busy}
            onPress={() => void social('facebook')}
            style={styles.provider}
          >
            <Text style={styles.facebook}>f</Text>
            <Text style={styles.providerText}>Continue with Facebook</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/login')}
          style={styles.email}
        >
          <Text style={styles.emailText}>Sign in with email</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/register')}
          style={styles.create}
        >
          <Text style={styles.small}>
            New to Parkey? <Text style={styles.link}>Create an account</Text>
          </Text>
        </Pressable>
        <Text
          style={[styles.small, { textAlign: 'center', marginTop: 'auto' }]}
        >
          Disabled sign-in methods are unavailable.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/')}
          style={styles.guest}
        >
          <Text style={styles.link}>Continue exploring</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.canvas },
    content: {
      flexGrow: 1,
      paddingHorizontal: 30,
      width: '100%',
      maxWidth: 540,
      alignSelf: 'center',
    },
    title: {
      fontFamily: fonts.extraBold,
      fontSize: 30,
      lineHeight: 38,
      color: colors.ink,
      textAlign: 'center',
      marginTop: 82,
    },
    subtitle: {
      fontFamily: fonts.regular,
      fontSize: 16,
      lineHeight: 22,
      color: colors.muted,
      textAlign: 'center',
      marginTop: 28,
    },
    providers: { marginTop: 50, gap: 14 },
    provider: {
      minHeight: 58,
      borderRadius: 29,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      gap: 18,
      backgroundColor: colors.surface,
    },
    providerIcon: { width: 22, height: 22 },
    providerText: {
      flex: 1,
      fontFamily: fonts.semibold,
      fontSize: 18,
      lineHeight: 24,
      color: colors.ink,
      textAlign: 'center',
      paddingRight: 22,
    },
    facebook: {
      fontFamily: fonts.bold,
      fontSize: 24,
      lineHeight: 26,
      color: '#1877F2',
      width: 22,
      textAlign: 'center',
    },
    separator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 28,
      minHeight: 30,
      paddingHorizontal: 10,
    },
    rule: { flex: 1, height: 1, backgroundColor: colors.border },
    small: {
      fontFamily: fonts.medium,
      fontSize: 12,
      lineHeight: 18,
      color: colors.muted,
    },
    email: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 18,
    },
    emailText: {
      fontFamily: fonts.semibold,
      fontSize: 18,
      lineHeight: 24,
      color: colors.navigationActive,
    },
    create: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 24,
      marginBottom: 12,
    },
    guest: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    link: {
      fontFamily: fonts.semibold,
      fontSize: 14,
      lineHeight: 20,
      color: colors.navigationActive,
    },
  }),
)
