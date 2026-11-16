import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { Coordinate, DiscoveryParking } from '@parkey/shared-types'

import { useTheme, createThemedStyles } from '../theme-provider'
import { dateLabel, PILOT_CENTER } from './model'
import { fonts } from './typography'
import { parkingTitle } from './presentation'
import { resolveSaved } from './local-state'
import type { SavedRecord } from './local-state'
import { ModalSheet } from './sheets'
import { DestinationSearch } from './search'
import { ParkingPage, ParkingTile } from './parking-profile'
import { useSavedAddresses } from './saved-addresses'
import type { AddressKind } from './saved-addresses'
import { FigmaAsset } from './figma-assets'
import { MotionPressable, MotionView } from './motion'
import { Button, Choice, Notice, UndoToast, useUI } from './ui'
import type { useLocalState } from './use-local-state'

export function SavedPlaces({
  local,
  records,
  locating,
  locationError,
  onSaveParked,
  onCenter,
  onDirections,
  onSelect,
  onAddPlace,
  onLocateAddress,
  onClose,
}: {
  local: ReturnType<typeof useLocalState>
  records: DiscoveryParking[]
  locating: boolean
  locationError: string | null
  onSaveParked: () => void
  onCenter: (point: Coordinate) => void
  onDirections: () => void
  onSelect: (record: DiscoveryParking) => void
  onAddPlace: () => void
  onLocateAddress: () => Promise<Coordinate | null>
  onClose: () => void
}) {
  const { colors } = useTheme()
  const ui = useUI()
  const styles = useStyles()

  const [showAddresses, setShowAddresses] = useState(false)
  const [tab, setTab] = useState<'favorites' | 'recents'>('favorites')
  const savedAddresses = useSavedAddresses()
  const [editing, setEditing] = useState<AddressKind | null>(null)
  const [addressQuery, setAddressQuery] = useState('')
  const [addressBusy, setAddressBusy] = useState(false)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [toast, setToast] = useState<{
    message: string
    undo: () => void
  } | null>(null)
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])
  const disabled = local.status !== 'ready' || local.busy
  function row(saved: SavedRecord) {
    const record = resolveSaved(saved, records)
    const title = parkingTitle(record ?? saved)
    return (
      <View key={saved.key} style={styles.savedRow}>
        <View style={ui.row}>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={`${title}. ${record ? 'View parking' : 'Show saved area'}`}
            onPress={() =>
              record ? onSelect(record) : onCenter(saved.coordinate)
            }
            style={({ pressed }) => [styles.savedAction, pressed && ui.pressed]}
          >
            <View style={styles.badge}>
              <FigmaAsset name="pin" size={28} />
            </View>
            <View style={ui.flex}>
              <Text style={ui.heading} numberOfLines={1}>
                {title}
              </Text>
              <Text style={ui.small} numberOfLines={1}>
                {record
                  ? `${record.kind === 'street' ? 'Street' : record.kind === 'garage' ? 'Garage' : 'Lot'} · View parking`
                  : 'Show saved area'}
              </Text>
            </View>
          </MotionPressable>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${title} from ${tab === 'favorites' ? 'favorites' : 'recently viewed places'}`}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => {
              void local.remove(saved.key, tab).then((savedOk) => {
                if (savedOk)
                  setToast({
                    message: 'Place removed',
                    undo: () => {
                      void local.restoreSaved(saved, tab)
                      setToast(null)
                    },
                  })
              })
            }}
            style={({ pressed }) => [styles.remove, pressed && ui.pressed]}
          >
            <Text
              style={[
                ui.muted,
                ui.link,
                disabled && { color: colors.disabled },
              ]}
            >
              Remove
            </Text>
          </MotionPressable>
        </View>
        {!record ? (
          <Text style={ui.small}>
            This record isn’t in the loaded map data. It may be outside this
            area or no longer listed.
          </Text>
        ) : null}
      </View>
    )
  }
  return (
    <ParkingPage
      title="Saved"
      subtitle="Kept on this device only"
      onClose={onClose}
    >
      <View style={styles.carCard}>
        <View style={ui.row}>
          <View style={styles.carBadge}>
            <FigmaAsset name="car" size={24} />
          </View>
          <View style={ui.flex}>
            <Text style={[ui.sectionTitle, styles.onBrand]}>Your car</Text>
            <Text style={[ui.small, styles.onBrand]}>
              {local.state.parked
                ? `Saved ${dateLabel(local.state.parked.savedAt)} · this device only`
                : 'Save where you parked · this device only'}
            </Text>
          </View>
        </View>
        {local.state.parked ? (
          <>
            <View style={[ui.row, { flexWrap: 'wrap', gap: 8 }]}>
              <MotionPressable
                accessibilityRole="button"
                onPress={onDirections}
                style={({ pressed }) => [
                  styles.carAction,
                  styles.walk,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={[styles.actionText, { color: colors.brandDeep }]}>
                  Walk back
                </Text>
                <FigmaAsset name="walk-back-arrow" size={18} />
              </MotionPressable>
              <MotionPressable
                accessibilityRole="button"
                onPress={() => {
                  const parked = local.state.parked
                  if (parked) onCenter(parked.coordinate)
                }}
                style={({ pressed }) => [
                  styles.carAction,
                  styles.showMap,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={[styles.actionText, styles.onBrand]}>
                  Show on map
                </Text>
              </MotionPressable>
            </View>
            <View style={[ui.row, { flexWrap: 'wrap', gap: 16 }]}>
              <MotionPressable
                accessibilityRole="button"
                disabled={disabled || locating}
                accessibilityState={{ disabled: disabled || locating }}
                onPress={onSaveParked}
                style={styles.carLink}
              >
                <Text
                  style={[
                    styles.linkText,
                    styles.onBrand,
                    (disabled || locating) && { opacity: 0.55 },
                  ]}
                >
                  {locating
                    ? 'Finding your location…'
                    : 'Replace with my location'}
                </Text>
              </MotionPressable>
              <MotionPressable
                accessibilityRole="button"
                accessibilityLabel="Clear parked location"
                disabled={disabled}
                accessibilityState={{ disabled }}
                style={styles.carLink}
                onPress={() => {
                  const previous = local.state.parked
                  void local.park(null).then((ok) => {
                    if (ok)
                      setToast({
                        message: 'Parked location cleared',
                        undo: () => {
                          void local.restoreParked(previous)
                          setToast(null)
                        },
                      })
                  })
                }}
              >
                <Text
                  style={[
                    styles.linkText,
                    styles.onBrand,
                    disabled && { opacity: 0.55 },
                  ]}
                >
                  Clear
                </Text>
              </MotionPressable>
            </View>
          </>
        ) : (
          <MotionPressable
            accessibilityRole="button"
            disabled={disabled || locating}
            accessibilityState={{ disabled: disabled || locating }}
            onPress={onSaveParked}
            style={[
              styles.carAction,
              styles.walk,
              (disabled || locating) && { opacity: 0.55 },
            ]}
          >
            <Text style={[styles.actionText, { color: colors.brandDeep }]}>
              {locating ? 'Finding your location…' : 'Save where I parked'}
            </Text>
          </MotionPressable>
        )}
      </View>
      {locationError ? <Notice>{locationError}</Notice> : null}
      {editing ? (
        <ModalSheet
          title={`Set ${editing} address`}
          onClose={() => setEditing(null)}
        >
          <View style={{ padding: 16, flexShrink: 1 }}>
            <DestinationSearch
              layout="sheet"
              query={addressQuery}
              onQuery={setAddressQuery}
              center={local.state.parked?.coordinate ?? PILOT_CENTER}
              active={!addressBusy}
              onActive={(active) => {
                if (!active && !addressBusy) setEditing(null)
              }}
              onSaved={() => setEditing(null)}
              onLocate={() => {
                if (addressBusy) return
                setAddressBusy(true)
                setAddressError(null)
                void onLocateAddress()
                  .then(async (coordinate) => {
                    if (!coordinate) {
                      setAddressError(
                        'Your location couldn’t be found. Search for an address or enable location access.',
                      )
                      return
                    }
                    const ok = await savedAddresses.save(editing, {
                      id: `pinned-${editing}`,
                      name: 'Current location',
                      address: 'Pinned location',
                      coordinate,
                    })
                    if (ok) setEditing(null)
                  })
                  .catch(() =>
                    setAddressError(
                      'Your location couldn’t be found. Try searching for an address.',
                    ),
                  )
                  .finally(() => setAddressBusy(false))
              }}
              onSelect={(destination) => {
                setAddressBusy(true)
                void savedAddresses
                  .save(editing, destination)
                  .then((ok) => {
                    if (ok) setEditing(null)
                  })
                  .finally(() => setAddressBusy(false))
              }}
            />
            {addressBusy ? <Text style={ui.small}>Saving address…</Text> : null}
            {addressError ? (
              <Text accessibilityRole="alert" style={[ui.small, ui.error]}>
                {addressError}
              </Text>
            ) : null}
            {savedAddresses.error ? (
              <Text accessibilityRole="alert" style={[ui.small, ui.error]}>
                {savedAddresses.error}
              </Text>
            ) : null}
          </View>
        </ModalSheet>
      ) : null}
      {toast ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <UndoToast message={toast.message} onUndo={toast.undo} />
        </View>
      ) : null}
      <View style={styles.content}>
        <View style={[ui.row, { flexWrap: 'wrap' }]}>
          <Choice
            selected={tab === 'favorites'}
            onPress={() => setTab('favorites')}
          >
            Favorites
          </Choice>
          <Choice
            selected={tab === 'recents'}
            onPress={() => setTab('recents')}
          >
            Recently viewed
          </Choice>
        </View>
        <MotionView transitionKey={tab} style={{ gap: 16 }}>
          {local.state[tab].map(row)}
          {local.status === 'ready' && local.state[tab].length === 0 ? (
            <Text style={ui.body}>
              {tab === 'favorites'
                ? 'Star a parking location to save it here.'
                : 'Your last 10 viewed parking locations will appear here.'}
            </Text>
          ) : null}
        </MotionView>
        <MotionPressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showAddresses }}
          onPress={() => setShowAddresses(!showAddresses)}
          style={styles.carLink}
        >
          <Text style={[ui.small, ui.link]}>Saved addresses</Text>
        </MotionPressable>
        {showAddresses ? (
          <>
            <View style={ui.row}>
              {(['home', 'work'] as const).map((kind) => (
                <ParkingTile
                  key={kind}
                  title={kind === 'home' ? 'Home' : 'Work'}
                  subtitle={
                    savedAddresses.addresses[kind]?.name ?? 'Set address'
                  }
                  icon={kind}
                  disabled={!savedAddresses.ready}
                  onPress={() => {
                    const address = savedAddresses.addresses[kind]
                    if (address) onCenter(address.coordinate)
                    else {
                      setAddressError(null)
                      setAddressQuery('')
                      setEditing(kind)
                    }
                  }}
                />
              ))}
            </View>
            {savedAddresses.error ? (
              <Text accessibilityRole="alert" style={[ui.small, ui.error]}>
                {savedAddresses.error}
              </Text>
            ) : null}
            {savedAddresses.ready &&
            (savedAddresses.addresses.home || savedAddresses.addresses.work) ? (
              <View style={ui.row}>
                {(['home', 'work'] as const).map((kind) =>
                  savedAddresses.addresses[kind] ? (
                    <Button
                      key={kind}
                      secondary
                      onPress={() => {
                        setAddressError(null)
                        setAddressQuery('')
                        setEditing(kind)
                      }}
                    >
                      Edit {kind}
                    </Button>
                  ) : null,
                )}
              </View>
            ) : null}
            <Button secondary onPress={onAddPlace}>
              Find a place to save
            </Button>
          </>
        ) : null}
        {local.status === 'loading' ? (
          <Text style={ui.small}>Loading saved places…</Text>
        ) : null}
        {local.error ? (
          <Text accessibilityRole="alert" style={[ui.body, ui.error]}>
            {local.error}
          </Text>
        ) : null}
        {local.status === 'error' ? (
          <>
            <Button secondary onPress={() => void local.retry()}>
              Try loading again
            </Button>
            <Button
              secondary
              disabled={local.busy}
              onPress={() => void local.clear()}
            >
              Clear saved data on this device
            </Button>
          </>
        ) : null}
      </View>
    </ParkingPage>
  )
}

const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    carCard: {
      backgroundColor: colors.brand,
      padding: 16,
      borderRadius: 28,
      gap: 14,
    },
    carBadge: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: '#FFF9F0',
      alignItems: 'center',
      justifyContent: 'center',
    },
    onBrand: { color: colors.onAction },
    carAction: {
      minHeight: 44,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    walk: { backgroundColor: colors.surface, flexGrow: 1 },
    showMap: { backgroundColor: 'rgba(255,255,255,0.22)', flexGrow: 1 },
    actionText: {
      fontFamily: fonts.semibold,
      fontSize: 17,
      lineHeight: 20,
      letterSpacing: -0.34,
    },
    carLink: { minHeight: 44, justifyContent: 'center' },
    linkText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16 },
    content: { paddingBottom: 24, gap: 16 },
    savedRow: {
      padding: 12,
      borderRadius: 28,
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.border,
      gap: 8,
    },
    badge: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.selected,
      alignItems: 'center',
      justifyContent: 'center',
    },
    savedAction: {
      flex: 1,
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 0,
      borderRadius: 12,
    },
    remove: {
      minHeight: 44,
      alignSelf: 'flex-end',
      justifyContent: 'center',
      paddingHorizontal: 8,
      borderRadius: 24,
    },
  }),
)
