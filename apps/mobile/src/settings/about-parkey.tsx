import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'

import { BrandLogo } from '../components/brand-logo'
import { Icon } from '../discovery/ui'
import { fonts } from '../theme'
import { createThemedStyles, useTheme } from '../theme-provider'

export function AboutParkey() {
  const styles = useStyles()
  const { colors } = useTheme()
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const items = [
    {
      title: 'Developer',
      action: () => {
        void Linking.openURL(
          'https://github.com/jstnphlp/prometheus-parkey',
        ).catch(() => setMessage('The project page could not be opened.'))
      },
    },
    { title: 'Partnerships', action: null },
    {
      title: 'Accessibility',
      action: () =>
        setMessage(
          'Use your device’s text-size, screen-reader and reduced-motion settings. Change Parkey’s appearance through Appearance settings.',
        ),
    },
    { title: 'Terms of Use (draft)', action: null },
    {
      title: 'Privacy & Data',
      action: () =>
        router.push({
          pathname: '/settings/[section]',
          params: { section: 'privacy' },
        }),
    },
    {
      title: 'Feedback',
      action: () =>
        router.push({
          pathname: '/settings/[section]',
          params: { section: 'help' },
        }),
    },
    { title: 'Rate Parkey (planned)', action: null },
    { title: 'Official Website', action: null },
    { title: 'Follow us on Social Media', action: null },
  ]
  return (
    <View>
      <View style={styles.hero}>
        <BrandLogo variant="account" style={{ width: 108, height: 118 }} />
        <Text style={styles.brand}>Parkey</Text>
        <Text style={styles.version}>
          Version {Constants.expoConfig?.version ?? 'unavailable'}
        </Text>
      </View>
      <View style={styles.links}>
        {items.map((item) =>
          item.action ? (
            <Pressable
              key={item.title}
              accessibilityRole="button"
              onPress={item.action}
              style={styles.row}
            >
              <Text style={styles.label}>{item.title}</Text>
              <Icon name="chevronRight" size={16} color={colors.muted} />
            </Pressable>
          ) : (
            <View
              key={item.title}
              accessibilityState={{ disabled: true }}
              style={styles.row}
            >
              <Text style={[styles.label, { color: colors.muted }]}>
                {item.title}
              </Text>
              <Text style={styles.unavailable}>Not available yet</Text>
            </View>
          ),
        )}
      </View>
      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      ) : null}
    </View>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    hero: { alignItems: 'center', gap: 12, marginTop: -7, paddingBottom: 30 },
    brand: {
      fontFamily: fonts.extraBold,
      fontSize: 32,
      lineHeight: 40,
      color: colors.ink,
    },
    version: {
      fontFamily: fonts.medium,
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
    },
    links: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
    row: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
    },
    label: {
      flex: 1,
      fontFamily: fonts.medium,
      fontSize: 15,
      lineHeight: 21,
      color: colors.ink,
    },
    unavailable: {
      fontFamily: fonts.regular,
      fontSize: 11,
      lineHeight: 16,
      color: colors.muted,
    },
    message: {
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 21,
      color: colors.muted,
      paddingVertical: 20,
    },
  }),
)
