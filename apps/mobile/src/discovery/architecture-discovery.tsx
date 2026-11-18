import type { DiscoveryParking } from '@parkey/shared-types'
import type { ReactNode, RefObject } from 'react'
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { createThemedStyles, useTheme } from '../theme-provider'
import { MotionView } from './motion'
import type { ParkingReference } from './model'
import { parkingDetailData } from './parking-detail-data'
import { reviewedParkingEntrance } from './parking-navigation'
import { ParkingRow } from './parking-row'
import { fonts } from '../theme'
import { Button, Icon, IconButton, useUI } from './ui'

export const SEARCH_HEADER_HEIGHT = 106
export const MAP_LEGEND_HEIGHT = 82

export function DiscoveryHeader({
  searchTestID,
  listTestID,
  top,
  query,
  onSearch,
  onList,
}: {
  searchTestID?: string
  listTestID?: string
  top: number
  query: string
  onSearch: () => void
  onList: () => void
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  return (
    <View style={[styles.header, { paddingTop: top + 28 }]}>
      <Pressable
        testID={searchTestID}
        accessibilityRole="button"
        accessibilityLabel="Search parking or landmark"
        onPress={onSearch}
        style={styles.search}
      >
        <Icon name="search" size={24} color={colors.brand} />
        <Text numberOfLines={1} style={styles.placeholder}>
          {query || 'Search parking or landmark'}
        </Text>
      </Pressable>
      <IconButton
        testID={listTestID}
        icon="list"
        label="Show parking list"
        onPress={onList}
        style={styles.headerList}
      />
    </View>
  )
}

export function DiscoveryMapActions({
  bottom,
  selected,
  locating,
  onList,
  onFilters,
  onLocate,
}: {
  bottom: number
  selected: boolean
  locating: boolean
  onList: () => void
  onFilters: () => void
  onLocate: () => void
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  return (
    <MotionView
      duration={160}
      distance={0}
      fromOpacity={0.76}
      style={[styles.mapActions, { bottom }, selected && styles.centerActions]}
    >
      <IconButton
        icon="list"
        label="Show parking list"
        color={colors.onAction}
        onPress={onList}
        style={styles.mapAction}
      />
      <IconButton
        icon="filter"
        label="Filter parking"
        color={colors.onAction}
        onPress={onFilters}
        style={styles.mapAction}
      />
      <IconButton
        icon="locate"
        label="Center on my location"
        color={colors.onAction}
        disabled={locating}
        onPress={onLocate}
        style={styles.mapAction}
      />
    </MotionView>
  )
}

export function DiscoveryLegend({
  bottom,
  onInfo,
}: {
  bottom: number
  onInfo: () => void
}) {
  const styles = useStyles()
  return (
    <View style={[styles.legendArea, { bottom }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Map information and parking data sources"
        onPress={onInfo}
        style={styles.legend}
      >
        <Text style={styles.legendText}>
          ● Mapped parking · Availability unconfirmed
        </Text>
      </Pressable>
    </View>
  )
}

export function ParkingListPage({
  top,
  bottom,
  records,
  reference,
  listRef,
  title,
  notice,
  empty,
  onSelect,
  onMap,
  onOffset,
  scrollOffset,
}: {
  top: number
  bottom: number
  records: DiscoveryParking[]
  reference: ParkingReference
  listRef: RefObject<FlatList<DiscoveryParking> | null>
  title: string
  notice: ReactNode
  empty: ReactNode
  onSelect: (id: string) => void
  onMap: () => void
  onOffset: (offset: number) => void
  scrollOffset: number
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  return (
    <MotionView
      duration={220}
      distance={4}
      fromOpacity={0.8}
      testID="parking-list-page"
      style={[styles.listPage, { top, bottom }]}
    >
      <FlatList
        contentOffset={{ x: 0, y: scrollOffset }}
        ref={listRef}
        data={records}
        keyExtractor={(record) => record.id}
        onScroll={({ nativeEvent }) => onOffset(nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        onScrollToIndexFailed={({ averageItemLength, index }) =>
          listRef.current?.scrollToOffset({
            offset: averageItemLength * index,
            animated: false,
          })
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.listHeading}>
            <Text accessibilityRole="header" style={styles.resultsTitle}>
              {title}
            </Text>
            <Text style={styles.resultsSubtitle}>
              {records.length} mapped{' '}
              {records.length === 1 ? 'location' : 'locations'} · No live
              vacancy data
            </Text>
            {notice}
          </View>
        }
        renderItem={({ item }) => (
          <ParkingRow
            parking={item}
            reference={reference}
            onPress={() => onSelect(item.id)}
            testID={`parking-row-${item.id}`}
          />
        )}
        ListEmptyComponent={<View>{empty}</View>}
      />
      <View
        accessibilityRole="tablist"
        accessibilityLabel="Parking view"
        style={styles.viewSwitch}
      >
        <View
          accessibilityRole="tab"
          accessibilityLabel="List"
          accessibilityState={{ selected: true }}
          style={styles.selectedView}
        >
          <Icon name="list" size={18} color={colors.onAction} />
          <Text style={styles.selectedViewText}>List</Text>
        </View>
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel="Map"
          accessibilityState={{ selected: false }}
          onPress={onMap}
          style={styles.viewChoice}
        >
          <Icon name="layers" size={18} color={colors.ink} />
          <Text style={styles.viewText}>Map</Text>
        </Pressable>
      </View>
    </MotionView>
  )
}

export function ParkingPreview({
  parking,
  bottom,
  now,
  favorite,
  disabled,
  onSave,
  onDetails,
  onDirections,
  maxHeight = 600,
  onHeightChange,
}: {
  maxHeight?: number
  onHeightChange?: (height: number) => void
  parking: DiscoveryParking
  bottom: number
  now: Date
  favorite: boolean
  disabled: boolean
  onSave: () => void
  onDetails: () => void
  onDirections: () => void
}) {
  const details = parkingDetailData(parking, null, now)
  return (
    <ParkingPreviewCard
      parkingId={parking.id}
      title={details.title}
      bottom={bottom}
      favorite={favorite}
      disabled={disabled}
      canDirections={!!reviewedParkingEntrance(parking, now.getTime())}
      onSave={onSave}
      onDetails={onDetails}
      onDirections={onDirections}
      maxHeight={maxHeight}
      onHeightChange={onHeightChange}
    />
  )
}

export function ParkingPreviewCard({
  parkingId,
  title,
  bottom,
  favorite,
  disabled,
  canDirections,
  onSave,
  onDetails,
  onDirections,
  maxHeight = 600,
  onHeightChange,
}: {
  parkingId: string
  title: string
  bottom: number
  favorite: boolean
  disabled: boolean
  canDirections: boolean
  onSave: () => void
  onDetails: () => void
  onDirections: () => void
  maxHeight?: number
  onHeightChange?: ((height: number) => void) | undefined
}) {
  const styles = useStyles()
  const ui = useUI()
  return (
    <MotionView
      transitionKey={parkingId}
      duration={220}
      distance={6}
      fromOpacity={0.76}
      testID="parking-preview"
      onLayout={({ nativeEvent }) =>
        onHeightChange?.(nativeEvent.layout.height)
      }
      style={[
        styles.preview,
        { bottom, maxHeight, minHeight: Math.min(258, maxHeight) },
      ]}
    >
      <ScrollView contentContainerStyle={styles.previewContent}>
        <Text style={styles.previewStatus}>AVAILABILITY UNCONFIRMED</Text>
        <Text
          testID="parking-detail-title"
          accessibilityRole="header"
          numberOfLines={2}
          style={styles.previewTitle}
        >
          {title}
        </Text>
        <Text style={styles.previewBody}>
          Confirm availability with the parking operator
        </Text>
        <Button onPress={onDetails}>View Parking Details</Button>
        <View style={styles.previewLinks}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              favorite ? 'Remove from favorites' : 'Save parking'
            }
            disabled={disabled}
            onPress={onSave}
            style={styles.previewLink}
          >
            <Text style={[ui.link, styles.linkText]}>
              {favorite ? 'Saved' : 'Save'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Directions to parking"
            disabled={!canDirections}
            accessibilityState={{
              disabled: !canDirections,
            }}
            onPress={onDirections}
            style={styles.previewLink}
          >
            <Text
              style={[
                ui.link,
                styles.linkText,
                !canDirections && {
                  opacity: 0.5,
                },
              ]}
            >
              Directions
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </MotionView>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 24,
      paddingBottom: 16,
      flexDirection: 'row',
      gap: 9,
      backgroundColor: colors.canvas,
    },
    search: {
      flex: 1,
      minWidth: 0,
      minHeight: 62,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    placeholder: {
      flex: 1,
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
    },
    headerList: {
      width: 52,
      height: 62,
      borderRadius: 15,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mapActions: {
      position: 'absolute',
      left: 25,
      flexDirection: 'row',
      gap: 17,
    },
    centerActions: { left: 0, right: 0, justifyContent: 'center' },
    mapAction: {
      width: 60,
      height: 60,
      borderRadius: 30,
      borderWidth: 0,
      backgroundColor: colors.brand,
    },
    legendArea: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: MAP_LEGEND_HEIGHT,
      paddingHorizontal: 30,
      paddingTop: 10,
      backgroundColor: colors.canvas,
    },
    legend: {
      minHeight: 49,
      justifyContent: 'center',
      paddingHorizontal: 16,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    legendText: {
      fontFamily: fonts.medium,
      fontSize: 12,
      lineHeight: 18,
      color: colors.muted,
    },
    listPage: {
      position: 'absolute',
      left: 0,
      right: 0,
      backgroundColor: colors.canvas,
    },
    listContent: { paddingHorizontal: 27, paddingBottom: 100 },
    listHeading: { paddingTop: 10, paddingBottom: 26, gap: 18 },
    resultsTitle: {
      fontFamily: fonts.semibold,
      fontSize: 18,
      lineHeight: 24,
      color: colors.ink,
    },
    resultsSubtitle: {
      fontFamily: fonts.medium,
      fontSize: 12,
      lineHeight: 18,
      color: colors.muted,
    },
    viewSwitch: {
      position: 'absolute',
      bottom: 24,
      width: 208,
      minHeight: 50,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 25,
      backgroundColor: colors.canvas,
    },
    selectedView: {
      flex: 1,
      minHeight: 40,
      borderRadius: 21,
      backgroundColor: colors.brand,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    viewChoice: {
      flex: 1,
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    selectedViewText: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      lineHeight: 22,
      color: colors.onAction,
    },
    viewText: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      lineHeight: 22,
      color: colors.ink,
    },
    preview: {
      position: 'absolute',
      left: 24,
      right: 24,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.canvas,
      overflow: 'hidden',
    },
    previewContent: {
      paddingHorizontal: 16,
      paddingTop: 19,
      minHeight: 256,
      gap: 14,
    },
    previewStatus: {
      fontFamily: fonts.semibold,
      fontSize: 13,
      lineHeight: 18,
      color: colors.navigationActive,
    },
    previewTitle: {
      fontFamily: fonts.extraBold,
      fontSize: 28,
      lineHeight: 35,
      color: colors.ink,
    },
    previewBody: {
      fontFamily: fonts.medium,
      fontSize: 15,
      lineHeight: 21,
      color: colors.muted,
    },
    previewLinks: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      marginTop: -16,
    },
    previewLink: {
      minHeight: 44,
      minWidth: 70,
      justifyContent: 'center',
      alignItems: 'center',
    },
    linkText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  }),
)
