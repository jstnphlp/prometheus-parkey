import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'

import { useArchitectureInsets } from '../components/architecture-page'
import { useFormLayout } from '../components/form-layout'
import { fonts } from '../theme'
import { createThemedStyles, useTheme } from '../theme-provider'
import { Button, Icon, IconButton } from './ui'

export function EmptyResultsPage({
  summary,
  onBack,
  onClear,
  onSearch,
  filtered,
}: {
  summary: string
  onBack: () => void
  onClear: () => void
  onSearch: () => void
  filtered: boolean
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const insets = useArchitectureInsets()
  const { height } = useWindowDimensions()
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            minHeight: height,
            paddingTop: insets.top + 6,
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        <IconButton
          icon="back"
          label="Back to map"
          color={colors.back}
          onPress={onBack}
          style={styles.back}
        />
        <Text
          accessibilityRole="header"
          style={[styles.title, { marginTop: 40 }]}
        >
          Search results
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change destination"
          onPress={onSearch}
          style={styles.search}
        >
          <Icon name="search" color={colors.brand} size={22} />
          <Text style={styles.summary} numberOfLines={2}>
            {summary}
          </Text>
        </Pressable>
        <View style={styles.searchRing}>
          <View style={styles.searchCenter}>
            <Icon name="search" size={52} color={colors.brand} />
          </View>
        </View>
        <Text accessibilityRole="header" style={styles.emptyTitle}>
          No parking found
        </Text>
        <Text style={styles.copy}>
          Try another location or remove some filters. Published listings may
          change.
        </Text>
        <View style={styles.actions}>
          <Button onPress={onClear}>
            {filtered ? 'Clear Filters' : 'Explore Parking'}
          </Button>
          <Pressable
            accessibilityRole="button"
            onPress={onSearch}
            style={styles.link}
          >
            <Text style={styles.linkText}>Change Destination</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

export function EmptySavedPage({
  onExplore,
  onTools,
}: {
  onExplore: () => void
  onTools: () => void
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const { insets, height, space } = useFormLayout()
  return (
    <View style={styles.screen}>
      <ScrollView
        alwaysBounceVertical={false}
        contentContainerStyle={[
          styles.content,
          {
            minHeight: height,
            paddingTop: insets.top + 6,
            paddingBottom: insets.bottom + space(38),
          },
        ]}
      >
        <IconButton
          icon="back"
          label="Back to map"
          color={colors.back}
          onPress={onExplore}
          style={styles.back}
        />
        <View style={[styles.savedHeader, { marginTop: space(24) }]}>
          <Text accessibilityRole="header" style={styles.title}>
            Saved parking
          </Text>
          <IconButton
            icon="more"
            label="Saved places and car tools"
            onPress={onTools}
            style={{ backgroundColor: 'transparent' }}
          />
        </View>
        <View
          style={{
            flexGrow: 1,
            justifyContent: 'center',
            gap: space(24),
            paddingVertical: space(24),
          }}
        >
          <View
            style={[
              styles.savedRing,
              {
                width: space(222),
                height: space(222),
                marginTop: 0,
                marginBottom: 0,
              },
            ]}
          >
            <Icon name="heart" size={88} color={colors.brand} />
          </View>
          <Text
            accessibilityRole="header"
            style={[styles.emptyTitle, { marginTop: 0 }]}
          >
            Nothing saved yet
          </Text>
          <Text style={[styles.copy, { marginTop: 0 }]}>
            Save parking locations while browsing. They’ll appear here for quick
            access.
          </Text>
        </View>
        <View style={[styles.actions, { paddingTop: space(16) }]}>
          <Button onPress={onExplore}>Explore Parking</Button>
        </View>
      </ScrollView>
    </View>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.canvas },
    content: {
      flexGrow: 1,
      width: '100%',
      maxWidth: 540,
      alignSelf: 'center',
      paddingHorizontal: 28,
    },
    back: {
      marginLeft: -13,
      width: 48,
      height: 48,
      backgroundColor: 'transparent',
    },
    title: {
      fontFamily: fonts.extraBold,
      fontSize: 32,
      lineHeight: 40,
      color: colors.ink,
      flexShrink: 1,
    },
    search: {
      minHeight: 60,
      marginTop: 30,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 24,
      paddingVertical: 12,
    },
    summary: {
      flex: 1,
      minWidth: 0,
      fontFamily: fonts.medium,
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
    },
    searchRing: {
      width: 260,
      height: 250,
      borderRadius: 130,
      backgroundColor: colors.surface,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 54,
    },
    searchCenter: {
      width: 106,
      height: 106,
      borderRadius: 53,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.canvas,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      fontFamily: fonts.extraBold,
      fontSize: 28,
      lineHeight: 36,
      color: colors.ink,
      textAlign: 'center',
      marginTop: 30,
    },
    copy: {
      fontFamily: fonts.medium,
      fontSize: 16,
      lineHeight: 21,
      color: colors.muted,
      textAlign: 'center',
      marginTop: 32,
    },
    actions: { marginTop: 'auto', paddingTop: 44 },
    link: { minHeight: 56, alignItems: 'center', justifyContent: 'center' },
    linkText: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      lineHeight: 21,
      color: colors.navigationActive,
    },
    savedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    savedRing: {
      width: 222,
      height: 222,
      borderRadius: 111,
      backgroundColor: colors.surface,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 103,
      marginBottom: 26,
    },
  }),
)
