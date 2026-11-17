import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useAuth } from '../auth/provider'
import { BrandLogo } from '../components/brand-logo'
import { useOpenAppearance } from '../components/appearance-navigation'
import { Icon, IconButton } from '../discovery/ui'
import type { IconName } from '../discovery/ui'
import { fonts } from '../theme'
import { createThemedStyles, useTheme } from '../theme-provider'

/** Frame 16's account hierarchy. Guest copy never implies an existing profile. */
export function AccountMenu({
  onSaved,
  onPreferences,
  onTools,
}: {
  onSaved: () => void
  onPreferences: () => void
  onTools: () => void
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const router = useRouter()
  const openAppearance = useOpenAppearance()
  const { state } = useAuth()
  const section = (id: string) =>
    router.push({ pathname: '/settings/[section]', params: { section: id } })
  const groups: { title: string; icon: IconName; action: () => void }[][] = [
    [
      { title: 'My Vehicles', icon: 'car', action: () => section('vehicles') },
      { title: 'Saved Parking', icon: 'bookmark', action: onSaved },
      {
        title: 'Personal Info',
        icon: 'person',
        action: () => section('personal'),
      },
      { title: 'Parking Preferences', icon: 'filter', action: onPreferences },
      {
        title: 'Language',
        icon: 'language',
        action: () => section('language'),
      },
      { title: 'Appearance', icon: 'appearance', action: openAppearance },
    ],
    [
      { title: 'Help Center', icon: 'help', action: () => section('help') },
      {
        title: 'Privacy & Data',
        icon: 'lock',
        action: () => section('privacy'),
      },
      { title: 'About Parkey', icon: 'info', action: () => section('about') },
    ],
  ]
  return (
    <View>
      <View style={styles.header}>
        <BrandLogo variant="account" style={{ width: 32, height: 36 }} />
        <Text accessibilityRole="header" style={styles.title}>
          Account
        </Text>
        <IconButton
          icon="more"
          label="Device drafts and map tools"
          onPress={onTools}
          style={styles.more}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Your Parkey account"
        onPress={() => router.push('/account')}
        style={styles.account}
      >
        <View style={styles.avatar}>
          <Icon name="person" size={28} color={colors.muted} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.label}>
            {state.status === 'signed-in'
              ? 'Your Parkey account'
              : 'Explore as a guest'}
          </Text>
          <Text numberOfLines={2} style={styles.subtitle}>
            {state.status === 'signed-in'
              ? state.user.email
              : 'Sign in only when you need an account'}
          </Text>
        </View>
        <Icon name="chevronRight" size={14} color={colors.muted} />
      </Pressable>
      {groups.map((group, index) => (
        <View key={index} style={styles.group}>
          {group.map((item) => (
            <Pressable
              key={item.title}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              onPress={item.action}
              style={styles.row}
            >
              <Icon name={item.icon} size={20} />
              <Text style={styles.label}>{item.title}</Text>
              <Icon name="chevronRight" size={14} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/account')}
        style={styles.row}
      >
        <Icon
          name="logout"
          size={20}
          color={state.status === 'signed-in' ? colors.error : colors.ink}
        />
        <Text
          style={[
            styles.label,
            state.status === 'signed-in' && { color: colors.error },
          ]}
        >
          {state.status === 'signed-in' ? 'Log Out' : 'Sign In'}
        </Text>
        <Icon name="chevronRight" size={14} color={colors.muted} />
      </Pressable>
    </View>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 60,
      marginBottom: 12,
    },
    title: {
      flex: 1,
      fontFamily: fonts.bold,
      fontSize: 24,
      lineHeight: 32,
      color: colors.ink,
    },
    more: {
      width: 44,
      height: 44,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.canvas,
    },
    account: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 17,
      minHeight: 84,
      paddingBottom: 14,
    },
    avatar: {
      width: 70,
      height: 70,
      borderRadius: 35,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      flex: 1,
      fontFamily: fonts.semibold,
      fontSize: 16,
      lineHeight: 24,
      color: colors.ink,
    },
    subtitle: {
      fontFamily: fonts.medium,
      fontSize: 13,
      lineHeight: 19,
      color: colors.muted,
      marginTop: 8,
    },
    group: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: 6,
    },
    row: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
      paddingHorizontal: 6,
      paddingVertical: 12,
    },
  }),
)
