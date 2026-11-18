import type { ComponentProps, ComponentRef, ReactNode, RefObject } from 'react'
import { useEffect, useRef } from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import menuIcon from '../../assets/figma/main-ui/menu.png'
import searchIcon from '../../assets/figma/main-ui/search.png'
import legendIcon from '../../assets/figma/main-ui/legend.png'
import upIcon from '../../assets/figma/main-ui/up.png'
import pinIcon from '../../assets/figma/main-ui/pin.png'
import closeIcon from '../../assets/figma/main-ui/close.png'
import bookmarkIcon from '../../assets/figma/main-ui/bookmark.png'
import chevronIcon from '../../assets/figma/main-ui/chevron.png'
import editIcon from '../../assets/figma/main-ui/edit.png'
import appearanceIcon from '../../assets/figma/main-ui/appearance.png'
import helpIcon from '../../assets/figma/main-ui/help.png'
import userIcon from '../../assets/figma/main-ui/user.png'
import loginIcon from '../../assets/figma/main-ui/login.png'
import logoutIcon from '../../assets/figma/main-ui/logout.png'
import backIcon from '../../assets/figma/main-ui/back.png'
import emailIcon from '../../assets/figma/main-ui/email.png'
import accountUserIcon from '../../assets/figma/main-ui/accountUser.png'
import personalIcon from '../../assets/figma/main-ui/personal.png'
import accountRightIcon from '../../assets/figma/main-ui/accountRight.png'
import accountLogoutIcon from '../../assets/figma/main-ui/accountLogout.png'
import { fonts } from '../theme'
import { createThemedStyles, useTheme } from '../theme-provider'
import { mainMarkerImages } from './main-marker-images'
import { mainMarkerIds } from './map-marker-style'
import { MotionLayer, MotionPressable, MotionView } from './motion'

export const MAP_CONTROLS_TOP = 24
const icons = {
  menu: [menuIcon, 24],
  search: [searchIcon, 24],
  legend: [legendIcon, 20],
  up: [upIcon, 17],
  pin: [pinIcon, 24],
  close: [closeIcon, 24],
  bookmark: [bookmarkIcon, 24],
  chevron: [chevronIcon, 18],
  edit: [editIcon, 24],
  appearance: [appearanceIcon, 24],
  help: [helpIcon, 24],
  user: [userIcon, 24],
  login: [loginIcon, 22],
  logout: [logoutIcon, 22],
  back: [backIcon, 24],
  email: [emailIcon, 24],
  accountUser: [accountUserIcon, 30],
  personal: [personalIcon, 24],
  accountRight: [accountRightIcon, 18],
  accountLogout: [accountLogoutIcon, 24],
} as const
export type MainIconName = keyof typeof icons

export function MainIcon({
  name,
  color,
}: {
  name: MainIconName
  color?: string
}) {
  const { colors } = useTheme()
  const [source, size] = icons[name]
  return (
    <Image
      accessible={false}
      aria-hidden
      source={source}
      style={{ width: size, height: size, tintColor: color ?? colors.link }}
    />
  )
}

export function MainMapControls({
  onMenu,
  search,
  searching,
  legendExpanded,
  onLegend,
  obscured,
  pilot = false,
}: {
  onMenu: () => void
  search: ReactNode
  searching: boolean
  legendExpanded: boolean
  onLegend: () => void
  obscured: boolean
  pilot?: boolean
}) {
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  return (
    <View
      pointerEvents={obscured ? 'none' : 'box-none'}
      accessibilityElementsHidden={obscured}
      importantForAccessibility={obscured ? 'no-hide-descendants' : 'auto'}
      aria-hidden={obscured}
      style={[
        styles.controls,
        { top: Math.max(insets.top + MAP_CONTROLS_TOP, 64) },
      ]}
    >
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel="Open menu"
        onPress={onMenu}
        style={styles.hamburger}
      >
        <MainIcon name="menu" />
      </MotionPressable>
      <View pointerEvents="box-none" style={styles.searchSlot}>
        {search}
      </View>
      {!searching ? (
        <MapLegend
          expanded={legendExpanded}
          onToggle={onLegend}
          pilot={pilot}
        />
      ) : null}
    </View>
  )
}

function MapLegend({
  expanded,
  onToggle,
  pilot,
}: {
  expanded: boolean
  onToggle: () => void
  pilot: boolean
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  return (
    <View pointerEvents="box-none" style={styles.legendPosition}>
      {!expanded ? (
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Map legend"
          accessibilityState={{ expanded: false }}
          aria-expanded={false}
          onPress={onToggle}
          hitSlop={{ top: 3, bottom: 3, left: 1, right: 1 }}
          style={styles.legendCollapsed}
        >
          <MainIcon name="legend" />
        </MotionPressable>
      ) : null}
      <MotionLayer
        visible={expanded}
        style={[styles.legendPanel, !expanded && styles.legendClosing]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Map legend"
          accessibilityState={{ expanded: true }}
          aria-expanded={true}
          onPress={onToggle}
          style={styles.legendHeader}
        >
          <MainIcon name="legend" />
          <MainIcon name="up" color={colors.muted} />
        </Pressable>
        <MapMarkerKey pilot={pilot} />
        <Text style={styles.legendNotice}>
          Mapped places, not live{'\n'}parking availability.
        </Text>
      </MotionLayer>
    </View>
  )
}

const parkingLegendEntries = [
  [mainMarkerIds.lot, 'Parking lot'],
  [mainMarkerIds.garage, 'Parking garage'],
  [mainMarkerIds.street, 'Street parking'],
] as const
const pilotLegendEntries = [
  [mainMarkerIds.unclassified, 'Unclassified parking'],
  [mainMarkerIds.space, 'Mapped parking space'],
  [mainMarkerIds.entrance, 'Mapped entrance'],
] as const

export function MapMarkerKey({ pilot = false }: { pilot?: boolean }) {
  const styles = useStyles()
  const entries = pilot
    ? [...parkingLegendEntries, ...pilotLegendEntries]
    : parkingLegendEntries
  return (
    <View style={styles.legendEntries}>
      {entries.map(([marker, label]) => (
        <View key={marker} style={styles.legendRow}>
          <Image
            accessible={false}
            source={mainMarkerImages[marker]}
            style={styles.legendMarker}
          />
          <Text style={styles.legendLabel}>{label}</Text>
        </View>
      ))}
      {pilot ? null : (
        <View style={styles.legendRow}>
          <View>
            <Image
              accessible={false}
              source={mainMarkerImages[mainMarkerIds.lot]}
              style={styles.legendMarker}
            />
            <Image
              accessible={false}
              source={mainMarkerImages[mainMarkerIds.charging]}
              style={[styles.legendMarker, StyleSheet.absoluteFill]}
            />
          </View>
          <Text style={styles.legendLabel}>EV charging at parking</Text>
        </View>
      )}
    </View>
  )
}

export function MapSearchField({
  active,
  query,
  onOpen,
  onClose,
  onClear,
  onChangeText,
  onSubmitEditing,
  maxLength = 180,
  triggerID,
  inputID = 'destination-query',
  inputRef,
}: {
  active: boolean
  query: string
  onOpen: () => void
  onClose: () => void
  onClear?: () => void
  triggerID?: string | undefined
  inputID?: string
  inputRef?: RefObject<ComponentRef<typeof TextInput> | null>
} & Pick<
  ComponentProps<typeof TextInput>,
  'onChangeText' | 'onSubmitEditing' | 'maxLength'
>) {
  const styles = useStyles()
  const { colors } = useTheme()
  const { width } = useWindowDimensions()
  const compact = width < 390
  const internalInput = useRef<ComponentRef<typeof TextInput>>(null)
  const input = inputRef ?? internalInput
  useEffect(() => {
    if (!active) return
    const frame = requestAnimationFrame(() => input.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [active, input])

  if (!active)
    return (
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel="Search a place or destination"
        testID={triggerID}
        onPress={onOpen}
        style={[
          styles.searchBar,
          styles.searchTrigger,
          compact && styles.searchTriggerCompact,
        ]}
      >
        <MainIcon name="search" />
        <Text
          numberOfLines={1}
          style={[
            styles.searchPlaceholder,
            compact && styles.searchPlaceholderCompact,
          ]}
        >
          {query ||
            (width < 350 ? 'Search a place' : 'Search a place or destination')}
        </Text>
      </MotionPressable>
    )
  return (
    <View style={[styles.searchBar, styles.searchActive]}>
      <MainIcon name="search" />
      <TextInput
        ref={input}
        testID={inputID}
        accessibilityLabel="Search a place"
        placeholder="Search a place"
        placeholderTextColor={colors.muted}
        selectionColor={colors.link}
        value={query}
        maxLength={maxLength}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        submitBehavior="submit"
        returnKeyType="search"
        style={styles.searchInput}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          query && onClear
            ? 'Clear destination search'
            : 'Close destination search'
        }
        onPress={query && onClear ? onClear : onClose}
        style={styles.searchClose}
      >
        <MainIcon name="close" />
      </Pressable>
    </View>
  )
}

export function MapSearchPanel({
  children,
  maxHeight,
}: {
  children: ReactNode
  maxHeight: number
}) {
  const styles = useStyles()
  return (
    <MotionView style={styles.searchPanel} duration={180} distance={5}>
      <ScrollView
        testID="destination-results"
        style={{ maxHeight }}
        contentContainerStyle={styles.searchContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text accessibilityRole="header" style={styles.searchHeading}>
          Find parking around a place
        </Text>
        {children}
      </ScrollView>
    </MotionView>
  )
}

export function MapSearchRow({
  label,
  description,
  icon = 'pin',
  onPress,
  testID,
  muted,
}: {
  label: string
  description?: string
  icon?: MainIconName
  onPress: () => void
  testID?: string
  muted?: boolean
}) {
  const styles = useStyles()
  return (
    <MotionPressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.searchRow}
      testID={testID}
    >
      <MainIcon name={icon} />
      <View style={styles.grow}>
        <Text style={[styles.searchRowText, muted && styles.searchPlaceholder]}>
          {label}
        </Text>
        {description ? (
          <Text style={styles.legendNotice}>{description}</Text>
        ) : null}
      </View>
    </MotionPressable>
  )
}

export type MapParkingSummary = {
  id: string
  title: string
  subtitle: string
  rates?: string | undefined
  hours?: string | undefined
  access?: string | undefined
  directionsAvailable: boolean
}
export function MapParkingPanel({
  record,
  open,
  onClose,
  onMore,
  onDirections,
  onHeight,
}: {
  record: MapParkingSummary
  open: boolean
  onClose: () => void
  onMore: () => void
  onDirections: () => void
  onHeight?: (height: number) => void
}) {
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  return (
    <MotionLayer
      visible={open}
      distance={44}
      style={styles.details}
      testID="parking-preview"
    >
      <View
        onLayout={(event) => onHeight?.(event.nativeEvent.layout.height)}
        style={[styles.detailsBody, { paddingBottom: insets.bottom }]}
      >
        <View style={styles.handle} />
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.detailsContent}
          style={styles.detailsScroll}
        >
          <View style={styles.detailsHeading}>
            <Text
              testID="parking-detail-title"
              accessibilityRole="header"
              style={styles.detailsTitle}
            >
              {record.title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close parking details"
              hitSlop={5}
              onPress={onClose}
              style={styles.round}
            >
              <MainIcon name="close" />
            </Pressable>
          </View>
          <Text style={styles.detailsSubtitle}>{record.subtitle}</Text>
          <View style={styles.detailsFacts}>
            <DetailFact label="Rates" value={record.rates} />
            <DetailFact label="Hours" value={record.hours} />
            {record.access ? (
              <DetailFact label="Access" value={record.access} />
            ) : null}
          </View>
          <View style={styles.detailsNote}>
            <Text style={styles.legendNotice}>
              Live availability not tracked
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onMore}
              accessibilityLabel="View Parking Details"
              hitSlop={6}
              style={styles.more}
            >
              <Text style={styles.moreLabel}>More details</Text>
            </Pressable>
          </View>
        </ScrollView>
        <MotionPressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !record.directionsAvailable }}
          accessibilityHint={
            record.directionsAvailable
              ? undefined
              : 'A current approved vehicle entrance is required. See more details.'
          }
          disabled={!record.directionsAvailable}
          onPress={onDirections}
          style={[
            styles.directions,
            !record.directionsAvailable && styles.disabled,
          ]}
        >
          <Text
            style={[
              styles.directionsText,
              !record.directionsAvailable && styles.directionsDisabled,
            ]}
          >
            Get directions
          </Text>
        </MotionPressable>
      </View>
    </MotionLayer>
  )
}

function DetailFact({
  label,
  value,
}: {
  label: string
  value?: string | undefined
}) {
  const styles = useStyles()
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value?.trim() || 'Not confirmed'}</Text>
    </View>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    controls: {
      position: 'absolute',
      left: 20,
      right: 20,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      zIndex: 8,
    },
    hamburger: {
      width: 58,
      height: 58,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchSlot: { flex: 1, minWidth: 0 },
    searchBar: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderRadius: 22,
      borderColor: colors.border,
    },
    searchTrigger: { gap: 14, paddingHorizontal: 19 },
    searchTriggerCompact: { paddingHorizontal: 12, gap: 8 },
    searchPlaceholderCompact: { fontSize: 14 },
    searchActive: { paddingLeft: 15, gap: 9, borderColor: colors.link },
    searchPlaceholder: {
      flexShrink: 1,
      color: colors.muted,
      fontFamily: fonts.medium,
      fontSize: 15,
      lineHeight: 22,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      color: colors.ink,
      paddingVertical: 10,
      fontSize: 15,
      lineHeight: 22,
      fontFamily: fonts.medium,
    },
    searchClose: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 47,
      height: 48,
    },
    searchPanel: {
      marginTop: 17,
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    searchContent: { paddingHorizontal: 17, paddingTop: 16, paddingBottom: 10 },
    searchHeading: {
      fontSize: 17,
      lineHeight: 24,
      fontFamily: fonts.semibold,
      color: colors.ink,
      marginBottom: 10,
    },
    searchRow: {
      flexDirection: 'row',
      gap: 13,
      alignItems: 'center',
      minHeight: 57,
      paddingVertical: 8,
    },
    searchRowText: {
      fontSize: 15,
      lineHeight: 22,
      fontFamily: fonts.medium,
      color: colors.ink,
    },
    grow: { flex: 1, minWidth: 0 },
    legendPosition: {
      position: 'absolute',
      left: 0,
      top: 75,
      width: 255,
      maxWidth: '100%',
    },
    legendClosing: { position: 'absolute', top: 0, left: 0, right: 0 },
    legendCollapsed: {
      width: 46,
      height: 43,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 19,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    legendPanel: {
      paddingHorizontal: 16,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    legendHeader: {
      minHeight: 49,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    legendEntries: {
      borderColor: colors.border,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      paddingVertical: 6,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 45,
      gap: 10,
    },
    legendLabel: {
      fontFamily: fonts.medium,
      fontSize: 14,
      color: colors.ink,
      flexShrink: 1,
    },
    legendNotice: {
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 18,
      color: colors.muted,
      paddingVertical: 5,
    },
    legendMarker: { width: 33, height: 34 },
    details: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 6,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      maxHeight: '62%',
    },
    detailsBody: { flexShrink: 1 },
    detailsScroll: { flexGrow: 0, flexShrink: 1 },
    detailsContent: { paddingHorizontal: 24 },
    handle: {
      width: 56,
      height: 5,
      borderRadius: 3,
      alignSelf: 'center',
      backgroundColor: colors.border,
      marginTop: 12,
      marginBottom: 22,
    },
    detailsHeading: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    detailsTitle: {
      fontFamily: fonts.extraBold,
      fontSize: 25,
      lineHeight: 32,
      color: colors.ink,
      flexShrink: 1,
    },
    round: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.selected,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailsSubtitle: {
      fontFamily: fonts.medium,
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
      marginTop: 8,
      marginBottom: 26,
    },
    detailsFacts: { borderTopWidth: 1, borderColor: colors.border },
    fact: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      minHeight: 60,
      borderBottomWidth: 1,
      borderColor: colors.border,
      paddingVertical: 9,
    },
    factLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
    factValue: {
      fontFamily: fonts.medium,
      fontSize: 14,
      color: colors.muted,
      flexShrink: 1,
      textAlign: 'right',
    },
    detailsNote: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 4,
      marginTop: 4,
    },
    more: { minHeight: 44, justifyContent: 'center' },
    moreLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.link },
    directions: {
      marginHorizontal: 24,
      marginTop: 4,
      minHeight: 49,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.action,
    },
    directionsText: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      color: colors.onAction,
    },
    disabled: { backgroundColor: colors.selected },
    directionsDisabled: { color: colors.muted },
  }),
)
