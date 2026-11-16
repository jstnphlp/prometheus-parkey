import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AccountEntry } from '../auth/account-entry'
import { useAuth } from '../auth/provider'
import { BrandLogo } from '../components/brand-logo'
import { Icon, useUI } from '../discovery/ui'
import { diagnosticStatus } from '../discovery/telemetry'
import { fonts } from '../theme'
import { createThemedStyles, useTheme } from '../theme-provider'
import { themes } from '../theme-colors'
import type { ThemeMode } from '../theme-colors'

const sections = [
  ['personal', 'Personal information'],
  ['vehicles', 'My vehicles'],
  ['security', 'Security'],
  ['language', 'Language'],
  ['help', 'Help Center'],
  ['privacy', 'Privacy & Data'],
  ['about', 'About Parkey'],
] as const
type SettingsSection = (typeof sections)[number][0]

export function SettingsPage({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const router = useRouter()
  const styles = useStyles()
  const ui = useUI()
  const { colors } = useTheme()
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.back}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/')
          }
        >
          <Icon name="back" color={colors.back} size={24} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {children}
        <Text style={ui.small}>Explore parking without an account.</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

export function SettingsLinks() {
  const router = useRouter()
  const ui = useUI()
  const styles = useStyles()
  const { colors, mode } = useTheme()
  return (
    <View style={styles.group}>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, pressed && ui.pressed]}
        onPress={() => router.push('/appearance')}
      >
        <View style={ui.flex}>
          <Text style={ui.heading}>Appearance</Text>
          <Text style={ui.small}>
            {mode === 'dark-magenta' ? 'Dark + Magenta' : 'Light + Magenta'}
          </Text>
        </View>
        <Icon name="chevronRight" color={colors.navigationActive} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, pressed && ui.pressed]}
        onPress={() => router.push('/settings')}
      >
        <Text style={[ui.heading, ui.flex]}>Profile & Settings</Text>
        <Icon name="chevronRight" color={colors.navigationActive} />
      </Pressable>
    </View>
  )
}

export function SettingsScreen() {
  const router = useRouter()
  const ui = useUI()
  const styles = useStyles()
  const { colors } = useTheme()
  return (
    <SettingsPage title="Profile & Settings">
      <BrandLogo
        variant="account"
        style={{ width: 42, height: 47, alignSelf: 'flex-start' }}
      />
      <AccountEntry />
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/appearance')}
        style={({ pressed }) => [styles.row, pressed && ui.pressed]}
      >
        <Text style={[ui.heading, ui.flex]}>Appearance</Text>
        <Icon name="chevronRight" color={colors.navigationActive} />
      </Pressable>
      {sections.map(([id, title]) => (
        <Pressable
          key={id}
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: '/settings/[section]',
              params: { section: id },
            })
          }
          style={({ pressed }) => [styles.row, pressed && ui.pressed]}
        >
          <Text style={[ui.heading, ui.flex]}>{title}</Text>
          <Icon name="chevronRight" color={colors.navigationInactive} />
        </Pressable>
      ))}
    </SettingsPage>
  )
}

export function AppearanceChoices() {
  const { mode, setMode, saving, error } = useTheme()
  const styles = useStyles()
  const ui = useUI()
  return (
    <View style={styles.group}>
      <Text style={ui.body}>
        Choose your Parkey colors. Your places and progress stay the same.
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Parkey appearance"
        style={styles.group}
      >
        {(['light-magenta', 'dark-magenta'] satisfies ThemeMode[]).map(
          (choice) => {
            const preview = themes[choice]
            const selected = mode === choice
            const title = preview.dark ? 'Dark + Magenta' : 'Light + Magenta'
            return (
              <Pressable
                key={choice}
                accessibilityRole="radio"
                accessibilityLabel={title}
                aria-checked={selected}
                accessibilityState={{ checked: selected, disabled: saving }}
                disabled={saving}
                onPress={() => void setMode(choice)}
                style={({ pressed }) => [
                  styles.option,
                  selected && styles.selected,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <View
                  accessible={false}
                  style={[
                    styles.preview,
                    {
                      backgroundColor: preview.tokens.canvas,
                      borderColor: preview.tokens.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.previewHeader,
                      { backgroundColor: preview.tokens.border },
                    ]}
                  />
                  <View
                    style={[
                      styles.previewAction,
                      { backgroundColor: preview.tokens.primary },
                    ]}
                  />
                </View>
                <View style={ui.flex}>
                  <Text style={ui.heading}>{title}</Text>
                  <Text style={ui.small}>
                    {preview.dark ? 'Dark' : 'White'} background · magenta
                    actions
                  </Text>
                  {selected ? (
                    <Text style={[ui.small, { color: preview.tokens.pending }]}>
                      Selected
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )
          },
        )}
      </View>
      <Text accessibilityLiveRegion="polite" style={ui.muted}>
        {saving
          ? 'Saving appearance…'
          : error
            ? 'You can retry saving by choosing a theme.'
            : 'Saved on this device. You can change it anytime.'}
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={[ui.body, ui.error]}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}

export function AppearanceScreen() {
  return (
    <SettingsPage title="Appearance">
      <AppearanceChoices />
    </SettingsPage>
  )
}

const help = [
  [
    'Do I need an account?',
    'No. Explore, search, saved parking and directions are available without registration.',
  ],
  [
    'Does Parkey show free spaces?',
    'Parkey shows known parking records, not live vacancy. Check signs, access rules and conditions when you arrive.',
  ],
  [
    'Can I search without location access?',
    'Yes. Open Search and enter a destination. Location is optional; enable it only when you want to recenter or navigate.',
  ],
  [
    'How do saved places work?',
    'Saved parking stays on this device. A saved label is a reminder, not confirmation of current access or availability.',
  ],
  [
    'How do I report a correction?',
    'Open parking details and save a local correction draft. Sending for private review requires the separately enabled report service and explicit consent. A report never publishes a record automatically.',
  ],
  [
    'Why are directions unavailable?',
    'Parking directions need a current reviewed entrance and the configured provider. If either is missing, Parkey explains the limitation instead of routing to an unverified entrance.',
  ],
] as const

export function SettingsDetailScreen({ section }: { section: string }) {
  const ui = useUI()
  const styles = useStyles()
  const router = useRouter()
  const { state } = useAuth()
  const [expanded, setExpanded] = useState<number | null>(null)
  const match = sections.find(([id]) => id === section)
  const id: SettingsSection | undefined = match?.[0]
  return (
    <SettingsPage title={match?.[1] ?? 'Settings'}>
      {id === 'help' ? (
        help.map(([question, answer], index) => (
          <View key={question} style={styles.group}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: expanded === index }}
              onPress={() => setExpanded(expanded === index ? null : index)}
              style={styles.row}
            >
              <Text style={ui.heading}>{question}</Text>
            </Pressable>
            {expanded === index ? <Text style={ui.body}>{answer}</Text> : null}
          </View>
        ))
      ) : id === 'privacy' ? (
        <>
          <Text style={ui.heading}>Local by default</Text>
          <Text style={ui.body}>
            Saved parking, recent places, parked-car pins, appearance and unsent
            drafts stay on this device. Deleting browser or app storage removes
            local data.
          </Text>
          <Text style={ui.heading}>When you use a provider</Text>
          <Text style={ui.body}>
            Maps and search contact their configured providers. Search sends
            your query and map area. Directions share your start and destination
            only when requested. Account actions use the configured
            authentication service.
          </Text>
          <Text style={ui.body}>
            Reports stay local unless you explicitly send them through the
            enabled private review service. Sending does not publish or verify
            parking. Deleting a local copy does not withdraw a sent report.
          </Text>
          <Text style={ui.body}>
            Usage reporting is {diagnosticStatus.analytics ? 'enabled' : 'off'}.
            Error reporting is {diagnosticStatus.crashes ? 'enabled' : 'off'}.
          </Text>
        </>
      ) : id === 'about' ? (
        <>
          <BrandLogo variant="account" />
          <Text style={ui.heading}>
            Parkey · {Constants.expoConfig?.version ?? 'Version unavailable'}
          </Text>
          <Text style={ui.body}>
            Discover parking, compare sourced information and find directions.
            No bookings or guaranteed spaces.
          </Text>
          <Text style={ui.muted}>
            MapLibre renders the map. Map and parking data include ©
            OpenStreetMap contributors. See Map information in Explore for the
            sources used by that experience.
          </Text>
        </>
      ) : id === 'language' ? (
        <>
          <Text style={ui.heading}>English</Text>
          <Text style={ui.body}>
            English is the currently supported language. Additional translations
            are not available yet.
          </Text>
        </>
      ) : id === 'vehicles' ? (
        <>
          <Text style={ui.heading}>
            Vehicle management is not available yet
          </Text>
          <Text style={ui.body}>
            You do not need to add a vehicle to discover parking. Vehicle
            storage, editing and deletion require an approved account
            integration and data policy.
          </Text>
        </>
      ) : id === 'personal' ? (
        <>
          {state.status === 'signed-in' ? (
            <>
              <Text selectable style={ui.heading}>
                {state.user.email}
              </Text>
              <Text style={ui.body}>
                This is the email from your current authenticated session.
              </Text>
            </>
          ) : (
            <Text style={ui.body}>
              You are browsing without a signed-in account.
            </Text>
          )}
          <Text style={ui.muted}>
            Editing personal information and extended profile setup are not
            enabled.
          </Text>
          <AccountEntry />
        </>
      ) : id === 'security' ? (
        <>
          <Text style={ui.body}>
            Account access uses the existing authentication service. Remember-me
            preferences are set when signing in. Password resets require a real
            reset email and a valid recovery link.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={styles.row}
            onPress={() => router.push('/forgot-password')}
          >
            <Text style={[ui.heading, ui.link]}>Reset password</Text>
          </Pressable>
          <Text style={ui.muted}>
            Account deletion and additional security settings are not enabled.
          </Text>
        </>
      ) : (
        <Text style={ui.body}>This setting is not available.</Text>
      )}
    </SettingsPage>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.canvas },
    content: {
      width: '100%',
      maxWidth: 540,
      alignSelf: 'center',
      paddingHorizontal: 28,
      paddingBottom: 32,
      gap: 20,
    },
    back: {
      minWidth: 48,
      minHeight: 48,
      alignSelf: 'flex-start',
      justifyContent: 'center',
    },
    title: {
      fontFamily: fonts.extraBold,
      fontSize: 32,
      lineHeight: 40,
      color: colors.ink,
      marginTop: 20,
    },
    group: { gap: 16 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 60,
      paddingVertical: 12,
      gap: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      backgroundColor: colors.surface,
      padding: 16,
      minHeight: 100,
    },
    selected: { borderColor: colors.navigationActive, borderWidth: 2 },
    preview: {
      width: 74,
      height: 66,
      borderWidth: 1,
      borderRadius: 12,
      padding: 9,
      gap: 14,
    },
    previewHeader: { height: 8, borderRadius: 4 },
    previewAction: { height: 22, borderRadius: 7 },
  }),
)
