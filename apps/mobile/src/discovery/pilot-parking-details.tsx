import type { PilotParking } from '@parkey/shared-types'
import type { ReactNode } from 'react'
import { useState } from 'react'
import {
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
import { fonts } from '../theme'
import { createThemedStyles, useTheme } from '../theme-provider'
import { ParkingImage } from './parking-photos'
import { parkingPhotos, parkingPhotoIdentityKey } from './photos'
import ParkingMap from './parking-map'
import { ParkingShareSheet } from './parking-share-sheet'
import { Button, Icon, IconButton } from './ui'

/** Frame 25 composition, retaining pilot records and their stricter access gates. */
export function PilotParkingDetails({
  record,
  publicMode,
  entrance,
  canNavigate,
  busy,
  favorite,
  saveDisabled,
  onSave,
  onDirections,
  onBack,
  entranceOpen,
  onEntrance,
  onEntranceBack,
  children,
}: {
  record: PilotParking
  publicMode: boolean
  entrance: readonly [number, number] | null
  canNavigate: boolean
  busy: boolean
  favorite: boolean
  saveDisabled: boolean
  onSave: () => void
  onDirections: () => void
  onBack: () => void
  entranceOpen: boolean
  onEntrance: () => void
  onEntranceBack: () => void
  children: ReactNode
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const insets = useArchitectureInsets()
  const [localTab, setLocalTab] = useState<'Info' | 'Rates' | 'Amenities'>(
    'Info',
  )
  const tab = entranceOpen ? 'Entrance' : localTab
  const setTab = (value: 'Info' | 'Rates' | 'Amenities' | 'Entrance') => {
    if (value === 'Entrance') onEntrance()
    else setLocalTab(value)
  }
  const [shareOpen, setShareOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const title = record.officialName || record.descriptiveLabel || record.name
  async function share(copy = false) {
    if (!publicMode || !record.evidence.publicationApproved) return
    const message = [
      title,
      record.source.url,
      'Parking information only. Availability and current access are unconfirmed.',
    ]
      .filter(Boolean)
      .join('\n')
    try {
      if (
        Platform.OS === 'web' &&
        (copy || typeof navigator.share !== 'function')
      ) {
        await navigator.clipboard.writeText(message)
        setFeedback('Parking information copied')
      } else await Share.share({ title, message })
    } catch {
      setFeedback(
        'Sharing is unavailable here. Open the original source below.',
      )
    }
  }
  if (tab === 'Entrance')
    return (
      <View style={styles.page}>
        <ArchitecturePage
          title="Entrance & Access"
          subtitle="Locate the correct vehicle entrance."
          onBack={onEntranceBack}
        >
          <View style={styles.entranceMap}>
            {entrance ? (
              <ParkingMap
                records={[]}
                selectedId={null}
                featuredId={null}
                target={{ coordinate: [...entrance], revision: 0 }}
                cameraPadding={{ top: 30, bottom: 30 }}
                userLocation={null}
                parkedLocation={null}
                destination={[...entrance]}
                draftPoints={[]}
                drawing={false}
                searching={false}
                route={null}
                onSelect={() => {}}
                onMapPress={() => {}}
                onViewport={() => {}}
                onPan={() => {}}
                onStatus={() => {}}
              />
            ) : (
              <View style={styles.placeholder}>
                <Icon name="pin" size={40} color={colors.muted} />
                <Text style={styles.body}>No reviewed vehicle entrance</Text>
              </View>
            )}
          </View>
          <Text style={[styles.body, { marginVertical: 24 }]}>
            Directions require a current reviewed entrance, visitor access and
            operator permission. Saved copies do not authorize navigation.
          </Text>
          <Button disabled={!canNavigate} onPress={onDirections}>
            Get Directions
          </Button>
        </ArchitecturePage>
      </View>
    )
  return (
    <View style={styles.page}>
      {shareOpen ? (
        <ParkingShareSheet
          title={title}
          feedback={feedback}
          onClose={() => setShareOpen(false)}
          onShare={() => void share()}
          onCopy={() => void share(true)}
        />
      ) : null}
      <ScrollView
        testID="pilot-details"
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <View style={styles.hero}>
          <ParkingImage
            identityKey={parkingPhotoIdentityKey({
              id: record.id,
              sourceUrl: record.source.url,
            })}
            photo={
              parkingPhotos({ id: record.id, sourceUrl: record.source.url })[0]
            }
          />
          <IconButton
            icon="back"
            label={
              publicMode ? 'Close Parking details' : 'Close Parking observation'
            }
            onPress={onBack}
            style={styles.back}
          />
          {publicMode ? (
            <IconButton
              icon="heart"
              label={favorite ? 'Remove saved parking' : 'Save parking'}
              selected={favorite}
              testID="pilot-favorite"
              disabled={saveDisabled}
              onPress={onSave}
              color={colors.navigationActive}
              style={styles.save}
            />
          ) : null}
        </View>
        <View style={styles.summary}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.body}>
            {record.officialName
              ? record.descriptiveLabel || 'Address not recorded'
              : 'Descriptive label; official name unknown.'}
          </Text>
          <Text style={styles.body}>
            Source information. No live availability information.
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {'\u25cf'} Availability unconfirmed
            </Text>
          </View>
          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button
                testID="pilot-directions"
                icon="arrow"
                disabled={!canNavigate || busy}
                onPress={onDirections}
              >
                {busy ? 'Checking permission…' : 'Get Direction'}
              </Button>
            </View>
            <View style={styles.flex}>
              <Button
                secondary
                disabled={!publicMode || !record.evidence.publicationApproved}
                onPress={() => {
                  setFeedback(null)
                  setShareOpen(true)
                }}
              >
                Share
              </Button>
            </View>
          </View>
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
                style={[styles.tab, value === tab && styles.selectedTab]}
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
          {tab === 'Info' ? (
            children
          ) : tab === 'Rates' ? (
            <>
              <Text style={styles.body}>Fees: {record.fees || 'Unknown'}</Text>
              <Text style={styles.body}>
                Hours: {record.hours || 'Unknown'}
              </Text>
              <Text style={styles.body}>
                Confirm posted charges and opening times before parking.
              </Text>
            </>
          ) : (
            <Text style={styles.body}>
              Amenities are not recorded in this source. Confirm facilities
              before travelling.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    page: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.canvas,
    },
    flex: { flex: 1 },
    hero: { height: 264, backgroundColor: colors.surface },
    back: {
      position: 'absolute',
      top: 20,
      left: 20,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.canvas,
    },
    save: {
      position: 'absolute',
      top: 20,
      right: 20,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.canvas,
    },
    summary: { paddingHorizontal: 26, paddingTop: 32, gap: 16 },
    title: {
      fontFamily: fonts.extraBold,
      fontSize: 32,
      lineHeight: 40,
      color: colors.ink,
    },
    body: {
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 21,
      color: colors.muted,
    },
    badge: {
      alignSelf: 'flex-start',
      padding: 10,
      borderRadius: 12,
      backgroundColor: colors.surface,
    },
    badgeText: {
      fontFamily: fonts.semibold,
      fontSize: 12,
      color: colors.navigationActive,
    },
    actions: { flexDirection: 'row', gap: 16 },
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
    selectedTab: { borderBottomColor: colors.navigationActive },
    tabText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
    content: { paddingHorizontal: 26, paddingTop: 32, gap: 18 },
    sectionTitle: {
      fontFamily: fonts.extraBold,
      fontSize: 23,
      lineHeight: 30,
      color: colors.ink,
    },
    entranceMap: {
      height: 412,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
    placeholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 16,
    },
  }),
)
