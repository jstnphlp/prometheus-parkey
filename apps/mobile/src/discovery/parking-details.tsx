import type { Coordinate, DiscoveryParking } from '@parkey/shared-types'
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native'

import { FigmaAsset } from './figma-assets'
import { MotionPressable, MotionView } from './motion'
import { parkingDetailData } from './parking-detail-data'
import { reviewedParkingEntrance } from './parking-navigation'
import { ParkingStatus } from './parking-status'
import { SpotThumbnail } from './spot-photo-view'
import { fonts } from './typography'
import { Button, colors, IconButton, ui } from './ui'

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
}) {
  const details = parkingDetailData(parking, location, now)
  const hours = details.chips.find((chip) => /open|closed|hours/i.test(chip))
  const tiles = [
    {
      label: 'Hours',
      value: hours === 'Open 24 hours' ? 'Open 24h' : (hours ?? 'Not recorded'),
      icon: 'clock',
    },
    {
      label: 'Fee',
      value:
        details.fee === 'Free'
          ? 'Recorded no fee'
          : (details.fee ?? 'Fee unknown'),
      icon: 'fees',
    },
    {
      label: 'Spaces',
      value: details.capacity?.toLocaleString('en-US') ?? 'Not recorded',
      icon: 'spaces',
    },
    {
      label: 'Access',
      value: details.access?.replaceAll('_', ' ') ?? 'Not recorded',
      icon: 'access',
    },
  ] as const
  const actions = (
    <View style={styles.actions}>
      <View style={ui.flex}>
        <Button
          testID="parking-get-directions"
          icon="arrow"
          disabled={!reviewedParkingEntrance(parking, now.getTime())}
          onPress={onDirections}
        >
          Go
        </Button>
        {!reviewedParkingEntrance(parking, now.getTime()) ? (
          <Text testID="parking-navigation-warning" style={ui.small}>
            Navigation requires a confirmed entrance, visitor access and
            operator authorization.
          </Text>
        ) : null}
      </View>
      <IconButton
        icon="bookmark"
        label={favorite ? 'Remove from favorites' : 'Save parking'}
        selected={favorite}
        disabled={favoriteDisabled || parking.sourceKind === 'sample'}
        onPress={onFavorite}
        style={styles.save}
      />
    </View>
  )
  return (
    <ScrollView
      testID={expanded ? 'parking-details-expanded' : 'parking-preview'}
      style={[ui.sheetScroll, ui.flex]}
      nestedScrollEnabled
      scrollEventThrottle={16}
      onScroll={({ nativeEvent }) =>
        onScrollOffsetChange(nativeEvent.contentOffset.y)
      }
    >
      <MotionView
        style={styles.content}
        transitionKey={parking.id}
        onLayout={({ nativeEvent }) =>
          onContentHeightChange(nativeEvent.layout.height)
        }
      >
        <View style={styles.summary}>
          <View style={ui.flex}>
            <Text
              testID="parking-detail-title"
              accessibilityRole="header"
              style={styles.title}
            >
              {details.title}
            </Text>
            {details.meta ? <Text style={ui.small}>{details.meta}</Text> : null}
          </View>
          <ParkingStatus details={details} />
        </View>
        <Text testID="parking-verification" style={[ui.small, styles.inset]}>
          {details.verification}. No live availability
        </Text>
        <Text style={[ui.small, styles.inset]}>{details.geometryNote}</Text>
        {details.warning ? (
          <Text accessibilityRole="alert" style={[ui.small, styles.warning]}>
            {details.warning}
          </Text>
        ) : null}
        {storageError ? (
          <Text
            accessibilityRole="alert"
            style={[ui.small, ui.error, styles.inset]}
          >
            {storageError}
          </Text>
        ) : null}
        {expanded ? actions : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tiles}
        >
          {tiles.map((tile) => (
            <View key={tile.label} style={styles.tile}>
              <View style={styles.labelRow}>
                <FigmaAsset name={tile.icon} size={24} />
                <Text style={styles.label}>{tile.label}</Text>
              </View>
              <Text style={ui.heading}>{tile.value}</Text>
            </View>
          ))}
        </ScrollView>
        {!expanded ? actions : null}
        {expanded ? (
          <>
            {details.photo?.image ||
            details.photo?.commons ||
            details.photo?.mapillary ? (
              <SpotThumbnail parking={parking} name={details.title} strip />
            ) : (
              <View style={styles.photos}>
                <View style={styles.photoBadge}>
                  <FigmaAsset name="camera-brand" size={24} />
                </View>
                <View style={ui.flex}>
                  <Text style={ui.heading}>No photos yet</Text>
                  <Text style={ui.small}>
                    Save a photo in a private device draft
                  </Text>
                </View>
                <MotionPressable
                  accessibilityRole="button"
                  accessibilityLabel="Add a parking photo"
                  onPress={onAddDetails}
                  style={({ pressed }) => [styles.add, pressed && ui.pressed]}
                >
                  <Text style={[ui.heading, ui.link]}>Add</Text>
                </MotionPressable>
              </View>
            )}
            <View style={styles.source}>
              <View style={styles.sourceRow}>
                <FigmaAsset name="info-brand" size={24} />
                <View style={ui.flex}>
                  <Text style={ui.heading}>Source</Text>
                  <Text style={ui.small}>
                    {parking.sourceLabel} ·{' '}
                    {parking.verification === 'verified'
                      ? 'Verified'
                      : 'Not field verified'}
                  </Text>
                  <Text style={ui.small}>{details.sourceDate}</Text>
                  <Text style={ui.small}>
                    Source dates do not confirm current fees, hours or access.
                  </Text>
                  {details.freshness ? (
                    <Text style={[ui.small, ui.error]}>
                      {details.freshness}
                    </Text>
                  ) : null}
                  {parking.sourceUrl ? (
                    <MotionPressable
                      accessibilityRole="link"
                      onPress={() => {
                        if (parking.sourceUrl)
                          void Linking.openURL(parking.sourceUrl).catch(
                            () => undefined,
                          )
                      }}
                      style={styles.sourceLink}
                    >
                      <Text style={[ui.small, ui.link]}>
                        View source record
                      </Text>
                    </MotionPressable>
                  ) : null}
                  {details.updated ? (
                    <Text style={ui.small}>{details.updated}</Text>
                  ) : null}
                </View>
              </View>
              <MotionPressable
                accessibilityRole="button"
                accessibilityLabel="Suggest a correction"
                onPress={onAddDetails}
                style={({ pressed }) => [
                  styles.sourceRow,
                  styles.correction,
                  pressed && ui.pressed,
                ]}
              >
                <FigmaAsset name="pencil-brand" size={24} />
                <View style={ui.flex}>
                  <Text style={ui.heading}>Suggest a correction</Text>
                  <Text style={ui.small}>
                    Saved on this device only; not sent for review
                  </Text>
                </View>
              </MotionPressable>
            </View>
            {details.rows
              .filter(
                (row) =>
                  !['Fee', 'Spaces', 'Access'].includes(row.label) &&
                  !(
                    hours === 'Open 24 hours' &&
                    details.week?.some((day) => day.day === row.label)
                  ),
              )
              .map((row) => (
                <MotionPressable
                  key={`${row.label}:${row.value}`}
                  disabled={!row.url}
                  accessibilityRole={row.url ? 'link' : undefined}
                  accessibilityLabel={`${row.label}: ${row.value}`}
                  onPress={() => {
                    if (row.url)
                      void Linking.openURL(row.url).catch(() => undefined)
                  }}
                  style={styles.detailRow}
                >
                  <Text style={[styles.label, { minWidth: 80 }]}>
                    {row.label}
                  </Text>
                  <Text
                    style={[ui.body, { flexShrink: 1 }, row.url && ui.link]}
                  >
                    {row.value}
                  </Text>
                </MotionPressable>
              ))}
          </>
        ) : null}
      </MotionView>
    </ScrollView>
  )
}
const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 2 },
  sourceLink: { minHeight: 44, justifyContent: 'center' },
  inset: { marginHorizontal: 16 },
  summary: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  warning: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.warningSurface,
    color: colors.amber,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  save: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  tiles: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    paddingHorizontal: 16,
  },
  tile: {
    width: 132,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
    borderRadius: 16,
    backgroundColor: colors.soft,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: {
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 15,
    color: colors.muted,
  },
  photos: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.soft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  photoBadge: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.selected,
    justifyContent: 'center',
  },
  source: {
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.soft,
    overflow: 'hidden',
  },
  sourceRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  correction: { borderTopWidth: 1, borderColor: colors.border, minHeight: 52 },
  detailRow: {
    marginHorizontal: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
})
