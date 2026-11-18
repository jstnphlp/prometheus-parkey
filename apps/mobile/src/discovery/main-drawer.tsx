import { useRouter } from 'expo-router'
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuth } from '../auth/provider'
import { BrandLogo } from '../components/brand-logo'
import { profileFromUser } from '../onboarding/profile'
import { fonts } from '../theme'
import { createThemedStyles, useTheme } from '../theme-provider'
import { MainIcon } from './main-map-ui'
import { MotionLayer, MotionPressable } from './motion'

export function MainDrawer({
  open,
  onClose,
  onSaved,
  onReport,
  onAppearance,
  onHelp,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  onReport: () => void
  onAppearance: () => void
  onHelp: () => void
}) {
  const styles = useStyles()
  const { colors, dark } = useTheme()
  const { state } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const drawerWidth = Math.min(320 + insets.left, width - 48)
  const keepMounted = Platform.OS === 'android'
  const user = state.status === 'signed-in' ? state.user : null
  const name = user
    ? profileFromUser(user).fullName.trim() || 'Your account'
    : 'Sign In'
  const menu = [
    ['bookmark', 'Saved parking', onSaved],
    ['edit', 'Report parking', onReport],
    ['appearance', 'Appearance', onAppearance],
    ['help', 'Help & privacy', onHelp],
  ] as const

  function account(signOut = false) {
    Keyboard.dismiss()
    router.push({
      pathname: '/account',
      params: signOut ? { signOut: '1' } : {},
    })
  }

  return (
    <>
      <MotionLayer
        visible={open}
        keepMounted={keepMounted}
        direction="fade"
        style={styles.backdrop}
      />
      {open ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss menu"
          onPress={onClose}
          style={styles.dismiss}
        />
      ) : null}
      <MotionLayer
        visible={open}
        keepMounted={keepMounted}
        direction="horizontal"
        distance={-drawerWidth}
        fromOpacity={1}
        accessibilityViewIsModal={open}
        style={[
          styles.drawer,
          {
            width: drawerWidth,
            paddingLeft: insets.left,
            paddingBottom: insets.bottom + 8,
          },
        ]}
        testID="main-navigation-drawer"
      >
        <ScrollView
          contentContainerStyle={[
            styles.menu,
            { paddingTop: Math.max(76, insets.top + 36) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.brand}>
              <View
                aria-hidden
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <BrandLogo
                  variant="account"
                  artwork="magenta"
                  style={styles.logo}
                />
              </View>
              <Text
                accessibilityRole="header"
                accessibilityLabel="Parkey"
                style={styles.title}
              >
                arkey
              </Text>
            </View>
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel="Close menu"
              onPress={onClose}
              style={styles.close}
            >
              <MainIcon name="close" />
            </MotionPressable>
          </View>
          {menu.map(([icon, label, action], index) => (
            <MotionPressable
              key={label}
              accessibilityRole="button"
              onPress={() => {
                onClose()
                action()
              }}
              style={[styles.menuRow, index > 0 && styles.divider]}
            >
              <MainIcon name={icon} />
              <Text style={styles.menuLabel}>{label}</Text>
              <MainIcon
                name="chevron"
                color={dark ? colors.link : colors.muted}
              />
            </MotionPressable>
          ))}
        </ScrollView>
        <View style={styles.footer}>
          <MotionPressable
            accessibilityRole="button"
            onPress={() => account()}
            style={[styles.account, styles.divider]}
          >
            <View style={styles.avatar}>
              <MainIcon name="user" />
            </View>
            <View style={styles.accountLabels}>
              <Text style={styles.accountLabel} numberOfLines={2}>
                {name}
              </Text>
              {user?.email ? (
                <Text style={styles.accountSubtitle}>{user.email}</Text>
              ) : null}
            </View>
            <MainIcon name="chevron" color={colors.muted} />
          </MotionPressable>
          {user ? (
            <MotionPressable
              accessibilityRole="button"
              onPress={() => account(true)}
              style={[styles.accountAction, styles.divider]}
            >
              <MainIcon name="logout" />
              <Text style={[styles.accountLabel, styles.accountLabels]}>
                Log Out
              </Text>
              <MainIcon name="chevron" color={colors.muted} />
            </MotionPressable>
          ) : null}
        </View>
      </MotionLayer>
    </>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFill,
      zIndex: 25,
      backgroundColor: 'rgba(28, 20, 36, 0.46)',
    },
    dismiss: { ...StyleSheet.absoluteFill, zIndex: 25 },
    drawer: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      zIndex: 26,
      backgroundColor: colors.surface,
    },
    menu: { paddingHorizontal: 36, paddingBottom: 16 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 20,
      marginRight: -10,
    },
    brand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3 },
    logo: { width: 32, height: 35 },
    title: {
      fontFamily: fonts.extraBold,
      fontSize: 32,
      lineHeight: 42,
      color: colors.link,
      flexShrink: 1,
    },
    close: {
      width: 44,
      height: 44,
      borderRadius: 20,
      backgroundColor: colors.selected,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuRow: {
      minHeight: 79,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 12,
      marginRight: -11,
      paddingRight: 0,
    },
    menuLabel: {
      flex: 1,
      fontFamily: fonts.medium,
      fontSize: 17,
      lineHeight: 24,
      color: colors.ink,
    },
    divider: { borderTopWidth: 1, borderColor: colors.border },
    footer: { marginHorizontal: 20 },
    account: {
      minHeight: 92,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 10,
    },
    avatar: {
      height: 46,
      width: 46,
      borderRadius: 23,
      backgroundColor: colors.selected,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accountLabels: { flex: 1, minWidth: 0 },
    accountLabel: {
      fontFamily: fonts.semibold,
      color: colors.ink,
      fontSize: 16,
      lineHeight: 22,
    },
    accountSubtitle: {
      fontFamily: fonts.regular,
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 5,
    },
    accountAction: {
      minHeight: 63,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingLeft: 4,
      paddingVertical: 12,
    },
  }),
)
