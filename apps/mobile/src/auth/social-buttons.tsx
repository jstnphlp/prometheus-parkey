import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import googleG from '../../assets/auth/google-g.png'
import { colors, fonts } from '../theme'

import type { SocialProvider } from './oauth-policy'

export function SocialButtons({
  providers,
  disabled,
  onPress,
}: {
  providers: Record<SocialProvider, boolean>
  disabled: boolean
  onPress: (provider: SocialProvider) => void
}) {
  if (!providers.google && !providers.facebook) return null
  return (
    <View style={styles.group}>
      <View style={styles.separator}>
        <View style={styles.rule} />
        <Text style={styles.or}>or</Text>
        <View style={styles.rule} />
      </View>
      {(['google', 'facebook'] as const)
        .filter((provider) => providers[provider])
        .map((provider) => (
          <Pressable
            key={provider}
            accessibilityRole="button"
            accessibilityLabel={`Continue with ${provider === 'google' ? 'Google' : 'Facebook'}`}
            accessibilityHint="Opens secure sign-in in your browser."
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => onPress(provider)}
            style={({ pressed }) => [
              styles.button,
              (pressed || disabled) && styles.dimmed,
            ]}
          >
            <View
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              style={styles.icon}
            >
              {provider === 'google' ? (
                <Image source={googleG} style={styles.google} />
              ) : (
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="#0866FF">
                  <Path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.095 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.974h-1.513c-1.491 0-1.956.931-1.956 1.887v2.26h3.328l-.532 3.49h-2.796V24C19.612 23.095 24 18.1 24 12.073Z" />
                </Svg>
              )}
            </View>
            <Text style={styles.label}>
              Continue with {provider === 'google' ? 'Google' : 'Facebook'}
            </Text>
            <View style={styles.icon} />
          </Pressable>
        ))}
    </View>
  )
}

const styles = StyleSheet.create({
  group: { gap: 12, marginTop: 24 },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  rule: {
    height: 1,
    flex: 1,
    backgroundColor: colors.onDarkMuted,
    opacity: 0.4,
  },
  or: {
    color: colors.onDarkMuted,
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    minHeight: 50,
    borderRadius: 13,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  icon: { width: 20, height: 20, flexShrink: 0 },
  google: { width: 20, height: 20, resizeMode: 'contain' },
  label: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.fieldInk,
    textAlign: 'center',
    flex: 1,
    minWidth: 0,
  },
  dimmed: { opacity: 0.65 },
})
