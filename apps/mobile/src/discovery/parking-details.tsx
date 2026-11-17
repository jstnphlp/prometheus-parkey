import type { Coordinate, DiscoveryParking } from '@parkey/shared-types'
import { useState } from 'react'
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import {
  ArchitecturePage,
  useArchitectureInsets,
} from '../components/architecture-page'
import { AppearanceButton } from '../components/appearance-button'
import { fonts } from '../theme'
import { createThemedStyles, useTheme } from '../theme-provider'
import { ParkingShareSheet } from './parking-share-sheet'
import { parkingDetailData } from './parking-detail-data'
import { reviewedParkingEntrance } from './parking-navigation'
import { parkingPhotos } from './photos'
import { ParkingImage } from './parking-photos'
import { SpotThumbnail } from './spot-photo-view'
import ParkingMap from './parking-map'
import { Button, Icon, IconButton, useUI } from './ui'

export function ParkingDetails({
  parking,
  now,
  onAddDetails,
  location,
  expanded,
  onDirections,
  favorite,
  onFavorite,
  favoriteDisabled,
  storageError,
  onContentHeightChange,
  onScrollOffsetChange,
  onBack,
  detailTab,
  onTabChange,
  onViewSaved,
}: {
  parking: DiscoveryParking
  now: Date
  onAddDetails: () => void
  location: Coordinate | null
  expanded: boolean
  onDirections: () => void
  favorite: boolean
  onFavorite: () => void
  favoriteDisabled: boolean
  storageError: string | null
  onContentHeightChange: (height: number) => void
  onScrollOffsetChange: (offset: number) => void
  onBack?: () => void
  detailTab?: 'Info' | 'Rates' | 'Amenities' | 'Entrance'
  onTabChange?: (tab: 'Info' | 'Rates' | 'Amenities' | 'Entrance') => void
  onViewSaved?: () => void
}) {
  const ui = useUI()
  const styles = useStyles()
  const insets = useArchitectureInsets()
  const { colors } = useTheme()
  const [localTab, setLocalTab] = useState<
    'Info' | 'Rates' | 'Amenities' | 'Entrance'
  >('Info')
  const tab = detailTab ?? localTab
  const setTab = onTabChange ?? setLocalTab
  const [shareOpen, setShareOpen] = useState(false)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  const details = parkingDetailData(parking, location, now)
  const photos = parkingPhotos(parking)
  const entrance = reviewedParkingEntrance(parking, now.getTime())
  async function shareParking(copy = false) {
    const message = [
      details.title,
      parking.sourceUrl,
      'Parking information only. No live availability or guaranteed access.',
    ]
      .filter(Boolean)
      .join('\n')
    setShareFeedback(null)
    try {
      if (
        Platform.OS === 'web' &&
        (copy || typeof navigator.share !== 'function')
      ) {
        await navigator.clipboard.writeText(message)
        setShareFeedback('Parking information copied')
      } else await Share.share({ title: details.title, message })
    } catch {
      setShareFeedback(
        'Sharing is unavailable here. Open the source record below.',
      )
    }
  }
  const rows = details.rows.filter(
    (row) =>
      tab === 'Info' ||
      (tab === 'Rates'
        ? /fee|charge|hours|payment|stay|mon|tue|wed|thu|fri|sat|sun/i.test(
            row.label,
          )
        : /covered|lit|supervised|accessible|charging|vehicles|height|surface/i.test(
            row.label,
          )),
  )
  if (tab === 'Entrance')
    return (
      <ArchitecturePage
        title="Entrance & Access"
        subtitle="Locate the correct vehicle entrance."
        onBack={() => setTab('Info')}
      >
        <View style={styles.entranceMap}>
          {entrance ? (
            <ParkingMap
              route={null}
              records={[parking]}
              selectedId={parking.id}
              featuredId={null}
              target={{ coordinate: entrance, revision: 0 }}
              cameraPadding={{ top: 30, bottom: 30 }}
              userLocation={null}
              parkedLocation={null}
              destination={entrance}
              draftPoints={[]}
              drawing={false}
              searching={false}
              onSelect={() => {}}
              onMapPress={() => {}}
              onViewport={() => {}}
              onPan={() => {}}
              onStatus={() => {}}
            />
          ) : (
            <View style={styles.unknownEntrance}>
              <Icon name="pin" size={40} color={colors.muted} />
              <Text style={styles.body}>No reviewed vehicle entrance</Text>
            </View>
          )}
        </View>
        <View style={styles.entranceNote}>
          <Text style={styles.body}>
            {entrance
              ? 'Reviewed vehicle entrance. Confirm current signs and access on arrival.'
              : 'Directions require a confirmed entrance, visitor access and operator authorization.'}
          </Text>
        </View>
        <Button disabled={!entrance} onPress={onDirections}>
          Get Directions
        </Button>
      </ArchitecturePage>
    )
  return (
    <>
      {shareOpen ? (
        <ParkingShareSheet
          title={details.title}
          onClose={() => setShareOpen(false)}
          onShare={() => void shareParking()}
          onCopy={() => void shareParking(true)}
          feedback={shareFeedback}
        />
      ) : null}
      <ScrollView
        testID={expanded ? 'parking-details-expanded' : 'parking-preview'}
        style={ui.flex}
        contentContainerStyle={{
          paddingBottom:
            favorite && onViewSaved ? 100 + insets.bottom : insets.bottom,
        }}
        onScroll={({ nativeEvent }) =>
          onScrollOffsetChange(nativeEvent.contentOffset.y)
        }
        scrollEventThrottle={16}
        onContentSizeChange={(_, height) => onContentHeightChange(height)}
      >
        <View style={styles.hero}>
          <ParkingImage
            photo={photos[0]}
            identityKey={parking.sourceUrl ?? parking.id}
          />
          <View style={styles.heroBack}>
            {onBack ? (
              <IconButton
                icon="back"
                label="Back to parking preview"
                onPress={onBack}
                color={colors.back}
                style={styles.heroButton}
              />
            ) : null}
          </View>
          <View style={styles.heroActions}>
            <IconButton
              icon="heart"
              color={colors.navigationActive}
              label={favorite ? 'Remove from favorites' : 'Save parking'}
              selected={favorite}
              disabled={favoriteDisabled || parking.sourceKind === 'sample'}
              onPress={onFavorite}
              style={styles.heroButton}
            />
            <IconButton
              icon="arrow"
              label="Directions to parking"
              disabled={!entrance}
              onPress={onDirections}
              style={styles.heroButton}
            />
          </View>
        </View>
        <View style={styles.summary}>
          <Text
            testID="parking-detail-title"
            accessibilityRole="header"
            style={styles.title}
          >
            {details.title}
          </Text>
          <Text style={styles.body}>
            {parking.address || 'Address not recorded'}
          </Text>
          <Text testID="parking-verification" style={styles.body}>
            {details.verification}. No live availability
          </Text>
          <View style={styles.statusRow}>
            <View style={styles.status}>
              <Text style={styles.statusText}>
                {'\u25cf'} Availability unconfirmed
              </Text>
            </View>
            <Text style={styles.distance}>
              {details.meta || 'Travel time unavailable'}
            </Text>
          </View>
          <View style={styles.actions}>
            <View style={ui.flex}>
              <Button
                testID="parking-get-directions"
                icon="arrow"
                disabled={!entrance}
                onPress={onDirections}
              >
                Get Direction
              </Button>
            </View>
            <View style={ui.flex}>
              <Button
                secondary
                onPress={() => {
                  setShareFeedback(null)
                  setShareOpen(true)
                }}
              >
                Share
              </Button>
            </View>
          </View>
          {details.warning ? (
            <Text accessibilityRole="alert" style={[ui.small, styles.warning]}>
              {details.warning}
            </Text>
          ) : null}
          {storageError ? (
            <Text accessibilityRole="alert" style={[ui.small, ui.error]}>
              {storageError}
            </Text>
          ) : null}
          {shareFeedback ? (
            <Text accessibilityLiveRegion="polite" style={ui.small}>
              {shareFeedback}
            </Text>
          ) : null}
        </View>
        <View
          accessibilityRole="tablist"
          accessibilityLabel="Parking information"
          style={styles.tabs}
        >
          {(['Info', 'Rates', 'Amenities', 'Entrance'] as const).map(
            (value) => (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityLabel={value}
                accessibilityState={{ selected: value === tab }}
                aria-selected={value === tab}
                onPress={() => setTab(value)}
                style={[styles.tab, value === tab && styles.activeTab]}
              >
                <Text
                  style={[
                    styles.tabText,
                    value === tab && { color: colors.navigationActive },
                  ]}
                >
                  {value}
                </Text>
              </Pressable>
            ),
          )}
        </View>
        <View style={styles.content}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {tab === 'Info' ? 'About' : tab}
          </Text>
          {!entrance ? (
            <Text testID="parking-navigation-warning" style={ui.small}>
              Navigation requires a confirmed entrance, visitor access and
              operator authorization.
            </Text>
          ) : null}
          {tab === 'Info' ? (
            <>
              <Text style={styles.body}>
                Sourced parking information for your journey. Confirm posted
                restrictions, fees and access before parking.
              </Text>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Parking
              </Text>
              <View style={styles.factCard}>
                <Text style={styles.body}>{details.geometryNote}</Text>
                <Text style={styles.body}>
                  {details.chips
                    .find((chip) => /open|closed|hours/i.test(chip))
                    ?.replace('Open 24 hours', 'Open 24h') ||
                    'Hours not recorded'}
                </Text>
                <Text style={styles.body}>{details.fee || 'Fee unknown'}</Text>
                <Text style={styles.body}>
                  {entrance
                    ? 'Reviewed vehicle entrance'
                    : 'Entrance not reviewed'}
                </Text>
              </View>
            </>
          ) : null}
          {rows.length ? (
            rows.map((row, index) => (
              <Pressable
                key={`${index}:${row.label}`}
                disabled={!row.url}
                accessibilityRole={row.url ? 'link' : undefined}
                accessibilityLabel={`${row.label}: ${row.value}`}
                onPress={() => {
                  if (row.url)
                    void Linking.openURL(row.url).catch(() => undefined)
                }}
                style={styles.factRow}
              >
                <Text style={styles.factLabel}>{row.label}</Text>
                <Text style={[styles.body, { flex: 1 }, row.url && ui.link]}>
                  {row.value}
                </Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.body}>
              No {tab.toLowerCase()} recorded by this source.
            </Text>
          )}
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Source information
          </Text>
          <View style={styles.factCard}>
            <Text style={styles.body}>
              {parking.sourceLabel}
              {' \u00b7 '}
              {details.verification}
            </Text>
            <Text style={styles.body}>{details.sourceDate}</Text>
            <Text style={styles.body}>
              Source dates do not confirm current fees, hours or access.
            </Text>
            {details.freshness ? (
              <Text style={[ui.small, ui.error]}>{details.freshness}</Text>
            ) : null}
            {details.updated ? (
              <Text style={styles.body}>{details.updated}</Text>
            ) : null}
            {parking.sourceUrl ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => {
                  if (parking.sourceUrl)
                    void Linking.openURL(parking.sourceUrl).catch(
                      () => undefined,
                    )
                }}
                style={styles.link}
              >
                <Text style={ui.link}>View source record</Text>
              </Pressable>
            ) : null}
          </View>
          {photos.length ? (
            <SpotThumbnail parking={parking} name={details.title} strip />
          ) : null}
          <Button secondary onPress={onAddDetails}>
            Suggest a correction
          </Button>
          <Text style={ui.small}>
            Saved on this device only; not sent for review.
          </Text>
          <View style={styles.appearance}>
            <Text style={styles.body}>Appearance</Text>
            <AppearanceButton />
          </View>
        </View>
      </ScrollView>
      {favorite && onViewSaved ? (
        <View
          style={{
            position: 'absolute',
            bottom: insets.bottom + 14,
            left: 26,
            right: 26,
          }}
        >
          <Button onPress={onViewSaved}>View Saved Parking</Button>
        </View>
      ) : null}
    </>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    hero: { height: 264, backgroundColor: colors.surface, overflow: 'hidden' },
    heroBack: { position: 'absolute', top: 12, left: 15 },
    heroActions: {
      position: 'absolute',
      top: 20,
      right: 20,
      flexDirection: 'row',
      gap: 8,
    },
    heroButton: {
      width: 48,
      height: 48,
      borderWidth: 0,
      backgroundColor: colors.canvas,
    },
    summary: { paddingHorizontal: 26, paddingTop: 30, gap: 16 },
    title: {
      fontFamily: fonts.extraBold,
      fontSize: 32,
      lineHeight: 40,
      color: colors.ink,
    },
    body: {
      fontFamily: fonts.medium,
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap',
    },
    status: {
      minHeight: 36,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: colors.surface,
    },
    statusText: {
      fontFamily: fonts.semibold,
      fontSize: 12,
      lineHeight: 18,
      color: colors.navigationActive,
    },
    distance: {
      flex: 1,
      minWidth: 100,
      fontFamily: fonts.regular,
      fontSize: 11,
      lineHeight: 16,
      color: colors.muted,
    },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    warning: {
      padding: 12,
      borderRadius: 12,
      color: colors.amber,
      backgroundColor: colors.warningSurface,
    },
    tabs: {
      flexDirection: 'row',
      marginTop: 20,
      paddingHorizontal: 24,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      minHeight: 56,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomWidth: 3,
      borderBottomColor: 'transparent',
    },
    activeTab: { borderBottomColor: colors.navigationActive },
    tabText: {
      fontFamily: fonts.semibold,
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
    },
    content: {
      paddingHorizontal: 26,
      paddingTop: 32,
      paddingBottom: 24,
      gap: 18,
    },
    sectionTitle: {
      fontFamily: fonts.extraBold,
      fontSize: 23,
      lineHeight: 30,
      color: colors.ink,
      marginTop: 4,
    },
    factCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 18,
      gap: 12,
    },
    factRow: {
      flexDirection: 'row',
      gap: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    factLabel: {
      width: 100,
      fontFamily: fonts.semibold,
      fontSize: 14,
      lineHeight: 20,
      color: colors.ink,
    },
    link: { minHeight: 44, justifyContent: 'center' },
    appearance: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    entranceMap: {
      height: 412,
      marginHorizontal: -8,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
    unknownEntrance: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: 24,
    },
    entranceNote: {
      padding: 22,
      borderRadius: 13,
      backgroundColor: colors.surface,
      marginVertical: 24,
    },
  }),
)
