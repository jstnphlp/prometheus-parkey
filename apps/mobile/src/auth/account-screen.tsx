import { useCallback, useEffect, useRef } from 'react'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { useIsFocused } from 'expo-router/react-navigation'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BrandButton } from '../components/brand-button'
import { BrandIcon } from '../components/brand-icon'
import { usePopup } from '../components/popup-provider'
import { useMainDrawer } from '../discovery/main-drawer-state'
import { MainIcon } from '../discovery/main-map-ui'
import type { MainIconName } from '../discovery/main-map-ui'
import { MotionPressable } from '../discovery/motion'
import { profileComplete, profileFromUser } from '../onboarding/profile'
import { fonts, typography } from '../theme'
import { useTheme, createThemedStyles } from '../theme-provider'
import { AuthShell } from './auth-shell'
import { useAuth } from './provider'
import { postAuthDestination } from './setup-access'

export function AccountScreen() {
  const { colors, mode } = useTheme()
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  const auth = useAuth()
  const focused = useIsFocused()
  const router = useRouter()
  const popup = usePopup()
  const { setOpen: setDrawerOpen } = useMainDrawer()
  const { signOut: signOutRequested } = useLocalSearchParams<{
    signOut?: string
  }>()
  const fromGuest = useRef(false)
  const handledRequest = useRef(false)
  const user = auth.state.status === 'signed-in' ? auth.state.user : null
  const guest =
    auth.state.status === 'signed-out' || auth.state.status === 'unavailable'

  useEffect(() => {
    if (!focused) {
      fromGuest.current = false
      return
    }
    if (guest) fromGuest.current = true
    if (fromGuest.current && user) {
      fromGuest.current = false
      if (postAuthDestination(user) === '/') router.dismissTo('/')
    }
  }, [focused, guest, router, user])

  const signOut = useCallback(
    async function signOut() {
      try {
        const revoked = await auth.signOut()
        popup.show({
          tone: revoked ? 'success' : 'warning',
          title: 'Signed out',
          message: revoked
            ? 'Your saved parking stays on this device.'
            : 'Signed out on this device. Server sign-out could not be confirmed.',
        })
      } catch {
        popup.show({
          tone: 'error',
          title: 'Could not sign out',
          message: 'Could not clear secure storage. Please try again.',
          primary: {
            title: 'Retry',
            onPress: () => void signOut(),
            restoreFocus: false,
          },
          secondary: { title: 'Not now' },
        })
      }
    },
    [auth, popup],
  )

  const confirmSignOut = useCallback(() => {
    popup.show({
      tone: 'warning',
      presentation: 'sign-out',
      title: 'Sign out?',
      message: 'Your saved parking and appearance stay on this device.',
      primary: {
        title: 'Sign out',
        onPress: () => void signOut(),
        restoreFocus: false,
      },
      secondary: { title: 'Stay signed in' },
    })
  }, [popup, signOut])

  useEffect(() => {
    if (!signOutRequested) handledRequest.current = false
    if (
      !focused ||
      !user ||
      !profileComplete(user) ||
      signOutRequested !== '1' ||
      handledRequest.current
    )
      return
    handledRequest.current = true
    confirmSignOut()
    router.setParams({ signOut: undefined })
  }, [confirmSignOut, focused, router, signOutRequested, user])

  if (user && !profileComplete(user)) return <Redirect href="/account-setup" />

  if (!user && !guest) {
    return (
      <AuthShell title="Your account">
        <View style={styles.recovery}>
          {auth.state.status === 'checking' ? (
            <ActivityIndicator
              color={colors.link}
              accessibilityLabel="Checking session"
            />
          ) : auth.state.status === 'recovery' ? (
            <>
              <BrandIcon name="lock" color={colors.link} size={44} />
              <BrandButton
                title="Continue password reset"
                onPress={() => router.replace('/reset-password')}
              />
              <BrandButton
                title="Cancel and sign out"
                onPress={() => void signOut()}
                busy={auth.busy}
              />
            </>
          ) : (
            <>
              <Text style={styles.body}>Session unavailable</Text>
              <BrandButton
                title="Retry session check"
                onPress={() => void auth.retry()}
              />
              <BrandButton
                title="Sign out of this device"
                onPress={() => void signOut()}
                busy={auth.busy}
              />
              <BrandButton
                title="Log In"
                disabled={auth.busy}
                onPress={() => {
                  setDrawerOpen(false)
                  router.push('/login')
                }}
              />
              <BrandButton
                title="Create an Account"
                variant="text"
                disabled={auth.busy}
                onPress={() => router.push('/register')}
              />
            </>
          )}
        </View>
      </AuthShell>
    )
  }

  function back() {
    if (router.canGoBack()) router.back()
    else router.replace('/')
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.page,
          {
            paddingTop: Math.max(66, insets.top + 26),
            paddingBottom: Math.max(28, insets.bottom + 28),
          },
        ]}
      >
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={back}
          style={styles.back}
        >
          <MainIcon name="back" />
        </MotionPressable>
        {user ? (
          <>
            <Text
              accessibilityRole="header"
              style={[styles.title, styles.sectionTitle]}
            >
              Your account
            </Text>
            <View style={styles.identity}>
              <View style={styles.avatar}>
                <MainIcon name="accountUser" />
              </View>
              <View style={styles.rowLabels}>
                <Text style={styles.name}>
                  {profileFromUser(user).fullName.trim() || 'Your account'}
                </Text>
                <Text style={styles.email}>{user.email}</Text>
              </View>
            </View>
            <MotionPressable
              accessibilityRole="button"
              onPress={() => router.push('/settings')}
              style={styles.settingsLink}
            >
              <Text style={styles.secondaryLabel}>Profile & settings</Text>
            </MotionPressable>
            <View style={styles.accountLinks}>
              <AccountRow
                icon="personal"
                title="Personal Info"
                onPress={() =>
                  router.push({
                    pathname: '/settings/[section]',
                    params: { section: 'personal' },
                  })
                }
              />
              <AccountRow
                icon="edit"
                title="Appearance"
                subtitle={
                  mode === 'dark-magenta' ? 'Dark + Magenta' : 'Light + Magenta'
                }
                onPress={() => router.push('/appearance')}
              />
            </View>
            <View style={styles.signedFooter}>
              <MotionPressable
                accessibilityRole="button"
                accessibilityState={{ disabled: auth.busy }}
                disabled={auth.busy}
                onPress={confirmSignOut}
                style={styles.logout}
              >
                <MainIcon name="accountLogout" />
                <Text style={styles.rowTitle}>Sign out</Text>
              </MotionPressable>
            </View>
          </>
        ) : (
          <>
            <Text
              accessibilityRole="header"
              style={[styles.title, styles.sectionTitle]}
            >
              Account
            </Text>
            <View style={styles.guestActions}>
              <AccountRow
                icon="email"
                title="Sign in with email"
                onPress={() => router.push('/login')}
              />
              <BrandButton
                title="Create an account"
                variant="accent"
                onPress={() => {
                  setDrawerOpen(false)
                  router.push('/register')
                }}
                style={styles.register}
              />
            </View>
            <View style={styles.guestFooter}>
              <MotionPressable
                accessibilityRole="button"
                onPress={() => {
                  setDrawerOpen(false)
                  router.dismissTo('/')
                }}
                style={styles.continue}
              >
                <Text style={styles.continueLabel}>Continue exploring</Text>
              </MotionPressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}

function AccountRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: MainIconName
  title: string
  subtitle?: string
  onPress: () => void
}) {
  const styles = useStyles()
  return (
    <MotionPressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.row, icon === 'email' && styles.emailRow]}
    >
      <MainIcon name={icon} />
      <View style={styles.rowLabels}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.secondaryLabel}>{subtitle}</Text>
        ) : null}
      </View>
      <MainIcon name="accountRight" />
    </MotionPressable>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    screen: { backgroundColor: colors.canvas, flex: 1 },
    page: {
      flexGrow: 1,
      width: '100%',
      maxWidth: 540,
      alignSelf: 'center',
      paddingHorizontal: 24,
    },
    back: {
      width: 44,
      height: 44,
      marginLeft: -4,
      borderRadius: 22,
      backgroundColor: colors.selected,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontFamily: fonts.extraBold,
      color: colors.ink,
      fontSize: 32,
      lineHeight: 40,
    },
    body: { ...typography.body, color: colors.muted },
    sectionTitle: { marginTop: 34 },
    identity: {
      marginTop: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 28,
      padding: 17,
      minHeight: 127,
      flexDirection: 'row',
      gap: 20,
      alignItems: 'center',
    },
    avatar: {
      width: 63,
      height: 63,
      borderRadius: 32,
      backgroundColor: colors.selected,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      fontFamily: fonts.semibold,
      color: colors.ink,
      fontSize: 20,
      lineHeight: 26,
    },
    email: {
      fontFamily: fonts.regular,
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 5,
    },
    settingsLink: { minHeight: 44, justifyContent: 'center' },
    accountLinks: { marginTop: 34, gap: 14 },
    row: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderRadius: 22,
      borderColor: colors.border,
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 17,
      paddingVertical: 10,
      gap: 14,
    },
    emailRow: {
      minHeight: 67,
      borderRadius: 28,
      gap: 20,
      paddingHorizontal: 22,
    },
    rowLabels: { flex: 1, minWidth: 0 },
    rowTitle: {
      fontFamily: fonts.semibold,
      color: colors.ink,
      fontSize: 17,
      lineHeight: 23,
    },
    secondaryLabel: {
      fontFamily: fonts.regular,
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 3,
    },
    signedFooter: { marginTop: 'auto', paddingTop: 40, paddingBottom: 26 },
    logout: {
      flexDirection: 'row',
      gap: 18,
      minHeight: 70,
      alignItems: 'center',
      paddingHorizontal: 21,
      borderTopWidth: 1,
      borderColor: colors.border,
    },
    guestActions: { marginTop: 24, gap: 17 },
    register: { minHeight: 67, borderRadius: 28 },
    guestFooter: { marginTop: 'auto', paddingTop: 36 },
    continue: {
      minHeight: 72,
      borderTopWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    continueLabel: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      lineHeight: 22,
      color: colors.link,
    },
    recovery: { marginTop: 32, gap: 16 },
  }),
)
