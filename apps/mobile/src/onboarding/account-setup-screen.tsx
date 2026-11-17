import { Redirect, useRouter } from 'expo-router'
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { useAuth } from '../auth/provider'
import { setupAccess } from '../auth/setup-access'
import { useArchitectureInsets } from '../components/architecture-page'
import { Button, Icon, IconButton } from '../discovery/ui'
import { fonts } from '../theme'
import { createThemedStyles, useTheme } from '../theme-provider'
import { useCompletion } from './use-completion'

/** Figma 8 is the post-authentication entry. No account-save API exists yet. */
export function AccountSetupScreen() {
  const auth = useAuth()
  const { colors, dark } = useTheme()
  const styles = useStyles()
  const router = useRouter()
  const insets = useArchitectureInsets()
  const guest = useCompletion('/')
  const access = setupAccess(auth.state)
  if (access === 'recovery') return <Redirect href="/reset-password" />
  if (access === 'login') return <Redirect href="/login" />
  if (access === 'checking' || auth.state.status !== 'signed-in')
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          color={colors.brand}
          accessibilityLabel="Checking account session"
        />
      </View>
    )
  const fullName: unknown = auth.state.user.user_metadata.full_name
  return (
    <View testID="account-setup-page" style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={styles.header}>
          <IconButton
            icon="back"
            label="Back to account"
            color={colors.back}
            style={styles.back}
            onPress={() => router.replace('/account')}
          />
          {dark ? <Text style={styles.step}>SETUP 1 / 5</Text> : null}
        </View>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Account setup, step 1 of 5"
          accessibilityValue={{ min: 1, max: 5, now: 1 }}
          style={styles.progress}
        >
          {[0, 1, 2, 3, 4].map((index) => (
            <View
              key={index}
              style={[
                styles.segment,
                index === 0 && { backgroundColor: colors.brand },
              ]}
            />
          ))}
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          Create your profile
        </Text>
        <Text style={styles.subtitle}>A few details to get you started.</Text>
        <View style={styles.avatar}>
          <Icon name="person" size={88} color={colors.muted} />
          <IconButton
            icon="plus"
            label="Add profile photo unavailable"
            disabled
            onPress={() => {}}
            style={styles.addPhoto}
            color={colors.onAction}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Full name</Text>
          <View
            accessibilityLabel="Full name from your account, read only"
            style={styles.input}
          >
            <Text selectable style={styles.value}>
              {typeof fullName === 'string' && fullName.trim()
                ? fullName
                : 'Not provided in your account'}
            </Text>
          </View>
        </View>
        <View style={[styles.field, { marginTop: 24 }]}>
          <Text style={styles.label}>Age (optional)</Text>
          <View
            accessibilityLabel="Age selection unavailable"
            accessibilityState={{ disabled: true }}
            style={styles.input}
          >
            <Text style={styles.value}>Choose age range</Text>
          </View>
        </View>
        <Text style={styles.notice}>
          Profile, vehicle and preference setup needs the account-saving
          service. Your account setup is not complete.
        </Text>
        <Button disabled onPress={() => {}}>
          Continue
        </Button>
        <View style={{ marginTop: 8 }}>
          <Button
            secondary
            onPress={() => void guest.finish()}
            disabled={guest.busy}
          >
            Explore parking without setup
          </Button>
        </View>
      </ScrollView>
    </View>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.canvas },
    loading: {
      flex: 1,
      backgroundColor: colors.canvas,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flexGrow: 1,
      width: '100%',
      maxWidth: 540,
      alignSelf: 'center',
      paddingHorizontal: 30,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    back: {
      width: 48,
      height: 48,
      marginLeft: -15,
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
    step: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
    progress: {
      flexDirection: 'row',
      gap: 11,
      marginTop: 10,
      marginHorizontal: 3,
    },
    segment: {
      flex: 1,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    title: {
      fontFamily: fonts.extraBold,
      fontSize: 34,
      lineHeight: 42,
      color: colors.ink,
      marginTop: 60,
    },
    subtitle: {
      fontFamily: fonts.regular,
      fontSize: 16,
      lineHeight: 24,
      color: colors.muted,
      marginTop: 48,
    },
    avatar: {
      alignSelf: 'center',
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 26,
      marginBottom: 48,
    },
    addPhoto: {
      position: 'absolute',
      right: -1,
      bottom: -10,
      width: 49,
      height: 49,
      borderRadius: 25,
      borderWidth: 0,
      backgroundColor: colors.brand,
    },
    field: { gap: 12 },
    label: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      lineHeight: 22,
      color: colors.ink,
    },
    input: {
      minHeight: 60,
      borderRadius: 13,
      borderWidth: 1.3,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 16,
      justifyContent: 'center',
    },
    value: {
      fontFamily: fonts.medium,
      fontSize: 15,
      lineHeight: 23,
      color: colors.ink,
      ...(Platform.OS === 'web' ? { overflowWrap: 'anywhere' as const } : {}),
    },
    notice: {
      fontFamily: fonts.medium,
      fontSize: 13,
      lineHeight: 20,
      color: colors.muted,
      marginTop: 28,
      marginBottom: 24,
    },
  }),
)
