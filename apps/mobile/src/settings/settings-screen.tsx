import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { AboutParkey } from './about-parkey'
import { AccountMenu } from './account-menu'
import { HelpCenter } from './help-center'
import { PersonalInfo } from './personal-info'
import { BottomNavigation } from '../discovery/bottom-navigation'
import { useArchitectureInsets } from '../components/architecture-page'
import { ArchitecturePage } from '../components/architecture-page'
import { useOpenAppearance } from '../components/appearance-navigation'
import { Icon, IconButton, useUI } from '../discovery/ui'
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
  const { colors } = useTheme()
  const insets = useArchitectureInsets()
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.detailHeader}>
          <IconButton
            icon="back"
            label="Back"
            color={colors.back}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/')
            }
            style={{ backgroundColor: 'transparent' }}
          />
          <Text accessibilityRole="header" style={styles.detailTitle}>
            {title}
          </Text>
        </View>
        {children}
      </ScrollView>
    </View>
  )
}

export function SettingsLinks() {
  const router = useRouter()
  const ui = useUI()
  const styles = useStyles()
  const { colors, mode } = useTheme()
  const openAppearance = useOpenAppearance()
  return (
    <View style={styles.group}>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, pressed && ui.pressed]}
        onPress={openAppearance}
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
  const styles = useStyles()
  const insets = useArchitectureInsets()
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 23,
          paddingTop: insets.top + 6,
          paddingBottom: insets.bottom + 96,
        }}
      >
        <AccountMenu
          onSaved={() => router.replace('/?panel=saved')}
          onPreferences={() => router.replace('/?panel=filters')}
        />
      </ScrollView>
      <BottomNavigation
        selected="you"
        bottom={insets.bottom}
        onSelect={(tab) =>
          router.replace(
            tab === 'map'
              ? '/'
              : tab === 'saved'
                ? '/?panel=saved'
                : '/settings',
          )
        }
      />
    </View>
  )
}

export function AppearanceChoices() {
  const { mode, setMode, saving, error, colors } = useTheme()
  const styles = useStyles()
  const ui = useUI()
  return (
    <View style={styles.group}>
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
                  <Text style={styles.optionTitle}>{title}</Text>
                  <Text style={styles.optionSubtitle}>
                    {preview.dark ? 'Dark' : 'White'} background · magenta
                    actions
                  </Text>
                </View>
                <Icon
                  name={selected ? 'check' : 'chevronRight'}
                  size={18}
                  color={colors.navigationActive}
                />
              </Pressable>
            )
          },
        )}
      </View>
      {saving ? (
        <Text accessibilityLiveRegion="polite" style={ui.small}>
          Saving appearance...
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={[ui.body, ui.error]}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}

export function AppearanceScreen({ onBack }: { onBack?: () => void }) {
  const { error, saving } = useTheme()
  const router = useRouter()
  const styles = useStyles()
  return (
    <ArchitecturePage
      title="Appearance"
      subtitle="Select your preferred visual theme. You can change this any time."
      onBack={
        onBack ??
        (() => (router.canGoBack() ? router.back() : router.replace('/')))
      }
      footer={
        <View style={styles.appearanceNote}>
          <Text style={styles.optionSubtitle}>
            {saving
              ? 'Saving your appearance...'
              : error
                ? 'Appearance is active for this session. Select it again to retry saving on this device.'
                : 'Your appearance is saved on this device. You can change it anytime.'}
          </Text>
        </View>
      }
    >
      <AppearanceChoices />
    </ArchitecturePage>
  )
}

export function SettingsDetailScreen({ section }: { section: string }) {
  const ui = useUI()
  const styles = useStyles()
  const router = useRouter()
  const match = sections.find(([id]) => id === section)
  const id: SettingsSection | undefined = match?.[0]
  return (
    <SettingsPage title={match?.[1] ?? 'Settings'}>
      {id === 'help' ? (
        <HelpCenter />
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
        <AboutParkey />
      ) : id === 'language' ? (
        <>
          <Text style={ui.heading}>Suggested</Text>
          <View style={styles.languageRow}>
            <Text style={[ui.body, ui.flex]}>English (US)</Text>
            <Icon name="check" />
          </View>
          <Text style={ui.small}>
            Additional translations are not available yet.
          </Text>
          <View style={styles.divider} />
          <Text style={ui.heading}>Language</Text>
          {[
            'English (UK)',
            'Filipino (PH)',
            'Mandarin',
            'Spanish',
            'French',
            'Arabic',
            'Bengali',
            'Russian',
            'Japanese',
            'Korean',
            'Indonesian',
          ].map((language) => (
            <View
              key={language}
              accessibilityState={{ disabled: true }}
              style={styles.languageRow}
            >
              <Text style={[ui.body, { opacity: 0.65 }]}>{language}</Text>
            </View>
          ))}
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
        <PersonalInfo />
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
    detailHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      marginLeft: -13,
      marginBottom: 8,
    },
    detailTitle: {
      fontFamily: fonts.semibold,
      fontSize: 24,
      lineHeight: 32,
      color: colors.ink,
      flex: 1,
    },
    languageRow: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    divider: { height: 1, backgroundColor: colors.border },
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
      borderRadius: 14,
      backgroundColor: colors.surface,
      padding: 14,
      minHeight: 100,
    },
    optionTitle: {
      fontFamily: fonts.semibold,
      fontSize: 18,
      lineHeight: 24,
      color: colors.ink,
    },
    optionSubtitle: {
      fontFamily: fonts.medium,
      fontSize: 12,
      lineHeight: 18,
      color: colors.muted,
    },
    appearanceNote: {
      minHeight: 75,
      borderRadius: 13,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      padding: 18,
    },
    preview: {
      width: 84,
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
