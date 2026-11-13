import type {
  Coordinate,
  NcrFeatureType,
  PilotBounds,
  PilotCity,
  PilotDestination,
  PilotParking,
} from '@parkey/shared-types'
import { Stack, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  FlatList,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { Viewport } from './model'
import { BottomNavigation } from './bottom-navigation'
import { detailDistance } from './parking-detail-data'
import { ParkingGallery } from './parking-photos'
import { parkingPhotos, parkingPhotoIdentityKey } from './photos'
import {
  partitionPilotParking,
  rankPilotParking,
  pilotTypeLabel,
} from './pilot-presentation'
import type { PilotFeeFilter } from './pilot-presentation'
import { pilotSavedKey } from './pilot-saved'
import { usePilotSaved } from './use-pilot-saved'
import { useLocalState } from './use-local-state'
import { useConnectivity } from './use-connectivity'
import { publicPilotCache } from './pilot-cache-storage'
import { PUBLIC_PILOT_CACHE_TTL_MS } from './pilot-cache'
import { samePilotRecords, uniquePilotRecords } from './pilot-performance'
import NcrMap from './ncr-map'
import { colors } from './palette'
import {
  createPilotRequestGate,
  fetchPilotPage,
  fetchPilotParkingRecord,
  mergePilotPage,
  PilotAccessError,
  pilotAreas,
  pilotNavigationEntrance,
  pilotRecordCanDisplay,
  pilotRequestKey,
  pilotSelectionKey,
  pilotSelectedRecord,
} from './pilot-client'
import type { PilotRequest } from './pilot-client'
import {
  candidateResearchEnabled,
  pilotConfig,
  pilotCities,
} from './pilot-config'
import { ModalSheet } from './sheets'
import { useLocation } from './use-location'

function Action({
  children,
  onPress,
  selected = false,
  disabled = false,
  testID,
}: {
  children: string
  onPress: () => void
  selected?: boolean
  disabled?: boolean
  testID?: string
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={[
        styles.action,
        selected && styles.active,
        disabled && styles.disabled,
      ]}
    >
      <Text style={{ color: selected ? colors.surface : colors.ink }}>
        {children}
      </Text>
    </Pressable>
  )
}
const filters: { value: 'all' | NcrFeatureType; label: string }[] = [
  { value: 'all', label: 'All loaded' },
  { value: 'lot', label: 'Lots' },
  { value: 'garage', label: 'Garages' },
  { value: 'facility_unspecified', label: 'Unclassified' },
  { value: 'street_segment', label: 'Street' },
  { value: 'entrance', label: 'Entrances' },
  { value: 'space', label: 'Bays' },
]
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'The city service could not be reached. Retry.'

export default function PilotDiscovery({
  allowLegacy,
  onOpenLegacy,
}: {
  allowLegacy: boolean
  onOpenLegacy: () => void
}) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [city, setCity] = useState<PilotCity>('Manila')
  const [mode, setMode] = useState<PilotRequest['mode']>('public')
  const [token, setToken] = useState<string | null>(null)
  const [draftToken, setDraftToken] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [bounds, setBounds] = useState<PilotBounds>(pilotAreas.Manila.bounds)
  const [target, setTarget] = useState<{
    coordinate: Coordinate
    zoom: number
  }>({ coordinate: pilotAreas.Manila.coordinate, zoom: 13 })
  const [category, setCategory] = useState<'all' | NcrFeatureType>('all')
  const [feeFilter, setFeeFilter] = useState<PilotFeeFilter>('all')
  const [sheet, setSheet] = useState<
    'results' | 'search' | 'access' | 'detail' | 'sources' | 'saved' | null
  >(null)
  const [selection, setSelection] = useState<{
    key: string
    record: PilotParking
    cachedAt?: number | null
  } | null>(null)
  const [destination, setDestination] = useState<PilotDestination | null>(null)
  const [query, setQuery] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [clock, setClock] = useState(Date.now())
  const [mapFailed, setMapFailed] = useState(false)
  const [navBusy, setNavBusy] = useState(false)
  const [cachedAt, setCachedAt] = useState<number | null>(null)
  const request = useMemo<PilotRequest>(
    () => ({
      city,
      mode,
      bounds,
      token: mode === 'candidate_research' ? token : null,
    }),
    [city, mode, bounds, token],
  )
  const key = pilotRequestKey(request)
  const currentKey = useRef(key)
  currentKey.current = key
  const parkingGate = useRef(createPilotRequestGate())
  const searchGate = useRef(createPilotRequestGate())
  const navigationGate = useRef(createPilotRequestGate())
  const cacheEpoch = useRef(0)
  const cursors = useRef(new Set<string>())
  const searchCursors = useRef(new Set<string>())
  const [parking, setParking] = useState<{
    key: string
    records: PilotParking[]
    next: string | null
    notice: string
    status: 'loading' | 'ready' | 'error'
    error: string
  }>({
    key: '',
    records: [],
    next: null,
    notice: '',
    status: 'loading',
    error: '',
  })
  const searchKey = JSON.stringify([city, mode, token, query.trim()])
  const [destinations, setDestinations] = useState<{
    key: string
    records: PilotDestination[]
    next: string | null
    status: 'loading' | 'ready' | 'error'
    error: string
  }>({ key: '', records: [], next: null, status: 'loading', error: '' })
  const location = useLocation()
  const local = useLocalState()
  const saved = usePilotSaved()
  const connectivity = useConnectivity()
  const [savedError, setSavedError] = useState('')

  useEffect(() => {
    if (mode !== 'candidate_research' || !connectivity.offline) return
    parkingGate.current.cancel()
    searchGate.current.cancel()
    navigationGate.current.cancel()
    setToken(null)
    setDraftToken('')
    setMode('public')
    setSelection(null)
    setDestination(null)
    setSheet(null)
    setAuthMessage(
      'The research session was closed while offline. Browse public parking or reconnect with an authorized session.',
    )
  }, [mode, connectivity.offline])

  useEffect(() => {
    if (Platform.OS === 'web') return
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!sheet) return false
      setSheet(null)
      setDraftToken('')
      return true
    })
    return () => listener.remove()
  }, [sheet])

  const accessFailed = useCallback(
    (error: unknown) => {
      if (error instanceof PilotAccessError && mode === 'public') {
        cacheEpoch.current++
        setSelection(null)
        setCachedAt(null)
        setParking((previous) => ({
          ...previous,
          records: [],
          next: null,
          status: 'error',
          error: error.message,
        }))
        void publicPilotCache.invalidate(request)
        return
      }
      if (!(error instanceof PilotAccessError) || mode !== 'candidate_research')
        return
      setToken(null)
      setDraftToken('')
      setMode('public')
      setSelection(null)
      setDestination(null)
      setAuthMessage(error.message)
    },
    [mode, request],
  )
  useEffect(() => {
    const parkingRequests = parkingGate.current,
      destinationRequests = searchGate.current,
      navigationRequests = navigationGate.current
    const interval = setInterval(() => setClock(Date.now()), 1000)
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setClock(Date.now())
        setSelection(null)
        setRefresh((n) => n + 1)
      }
    })
    return () => {
      clearInterval(interval)
      subscription.remove()
      parkingRequests.cancel()
      destinationRequests.cancel()
      navigationRequests.cancel()
    }
  }, [])
  useEffect(() => {
    const requests = parkingGate.current
    navigationGate.current.cancel()
    setNavBusy(false)
    const attempt = requests.begin()
    const capturedCacheEpoch = cacheEpoch.current
    let networkSucceeded = false
    let cacheAllowed = request.mode === 'public'
    setCachedAt(null)
    cursors.current = new Set()
    setParking({
      key,
      records: [],
      next: null,
      notice: '',
      status: pilotConfig.ready ? 'loading' : 'error',
      error: pilotConfig.ready
        ? ''
        : pilotConfig.configurationError ||
          'Parking information is unavailable.',
    })
    if (!pilotConfig.ready) return () => requests.cancel()
    if (cacheAllowed)
      void publicPilotCache.get(request).then((entry) => {
        if (
          !entry ||
          networkSucceeded ||
          !cacheAllowed ||
          capturedCacheEpoch !== cacheEpoch.current ||
          !attempt.current() ||
          currentKey.current !== key
        )
          return
        setCachedAt(entry.fetchedAt)
        setParking((previous) =>
          previous.key === key
            ? { ...previous, records: entry.records }
            : previous,
        )
      })
    const timer = setTimeout(() => {
      void fetchPilotPage(
        pilotConfig,
        request,
        'pilot_discovery',
        attempt.signal,
      )
        .then((page) => {
          if (attempt.current() && currentKey.current === key) {
            networkSucceeded = true
            const records =
              request.mode === 'public'
                ? uniquePilotRecords(page.records)
                : page.records
            setCachedAt(null)
            setParking({
              key,
              records,
              next: page.nextCursor,
              notice: page.notice,
              status: 'ready',
              error: '',
            })
            if (request.mode === 'public')
              void publicPilotCache.put(request, records)
          }
        })
        .catch((error) => {
          if (!attempt.current() || currentKey.current !== key) return
          if (error instanceof PilotAccessError) {
            cacheAllowed = false
            setCachedAt(null)
            if (request.mode === 'public')
              void publicPilotCache.invalidate(request)
          }
          accessFailed(error)
          setParking((previous) => ({
            key,
            records:
              cacheAllowed && previous.key === key ? previous.records : [],
            next: null,
            notice: '',
            status: 'error',
            error: message(error),
          }))
        })
    }, 250)
    return () => {
      clearTimeout(timer)
      requests.cancel()
    }
  }, [key, refresh, request, accessFailed])
  useEffect(() => {
    const requests = searchGate.current
    const attempt = requests.begin()
    searchCursors.current = new Set()
    setDestinations({
      key: searchKey,
      records: [],
      next: null,
      status: !pilotConfig.ready
        ? 'error'
        : sheet === 'search'
          ? 'loading'
          : 'ready',
      error: pilotConfig.ready
        ? ''
        : pilotConfig.configurationError ||
          'Destination search is unavailable.',
    })
    if (sheet !== 'search' || !pilotConfig.ready) return () => requests.cancel()
    const timer = setTimeout(() => {
      void fetchPilotPage(
        pilotConfig,
        { ...request, bounds: pilotAreas[city].bounds },
        'pilot_destinations',
        attempt.signal,
        null,
        query,
      )
        .then((page) => {
          if (attempt.current())
            setDestinations({
              key: searchKey,
              records: page.records,
              next: page.nextCursor,
              status: 'ready',
              error: '',
            })
        })
        .catch((error) => {
          if (!attempt.current()) return
          accessFailed(error)
          setDestinations({
            key: searchKey,
            records: [],
            next: null,
            status: 'error',
            error: message(error),
          })
        })
    }, 300)
    return () => {
      clearTimeout(timer)
      requests.cancel()
    }
  }, [searchKey, sheet, refresh, request, city, query, accessFailed])
  const cacheNow = Date.now()
  const cacheCurrent =
    cachedAt === null ||
    (cacheNow >= cachedAt && cacheNow - cachedAt < PUBLIC_PILOT_CACHE_TTL_MS)
  const eligible =
    parking.key === key &&
    cacheCurrent &&
    !(mode === 'candidate_research' && connectivity.offline)
      ? parking.records.filter((record) =>
          pilotRecordCanDisplay(record, mode, clock),
        )
      : []
  // React's guarded derived-state pattern preserves object identity between
  // expiry ticks, but immediately observes changed/revoked source objects.
  const [stableRecords, setStableRecords] = useState<PilotParking[]>([])
  let records = stableRecords
  if (!samePilotRecords(stableRecords, eligible)) {
    records = eligible
    setStableRecords(eligible)
  }
  const partition = useMemo(
    () => partitionPilotParking(records, category, feeFilter),
    [records, category, feeFilter],
  )
  const visible = partition.matched
  const currentLocation = location.status === 'idle' ? location.point : null
  const reference = useMemo(
    () =>
      destination?.coordinate ??
      currentLocation ??
      ([
        (bounds.west + bounds.east) / 2,
        (bounds.south + bounds.north) / 2,
      ] satisfies Coordinate),
    [destination, currentLocation, bounds],
  )
  const referenceLabel = destination
    ? destination.name
    : currentLocation
      ? 'your location'
      : 'map center'
  const ranked = useMemo(
    () => rankPilotParking(visible, reference),
    [visible, reference],
  )
  const selectedCacheCurrent =
    selection?.cachedAt == null ||
    (cacheNow >= selection.cachedAt &&
      cacheNow - selection.cachedAt < PUBLIC_PILOT_CACHE_TTL_MS)
  const selected =
    selectedCacheCurrent &&
    !(mode === 'candidate_research' && connectivity.offline)
      ? pilotSelectedRecord(selection, request, clock)
      : null
  const mapData = useMemo(
    () => ({
      mode:
        mode === 'public' ? ('public' as const) : ('research_preview' as const),
      items: visible.map((record) => ({
        ...record,
        name: record.officialName || record.descriptiveLabel || record.name,
      })),
      clusters: [],
    }),
    [visible, mode],
  )
  const updateViewport = useCallback((viewport: Viewport) => {
    const next = {
      west: Math.round(viewport.west * 100000) / 100000,
      south: Math.round(viewport.south * 100000) / 100000,
      east: Math.round(viewport.east * 100000) / 100000,
      north: Math.round(viewport.north * 100000) / 100000,
    }
    setBounds((previous) =>
      JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
    )
  }, [])
  const clusterTarget = useCallback(
    (coordinate: Coordinate) => setTarget({ coordinate, zoom: 16 }),
    [],
  )
  const mapError = useCallback(() => setMapFailed(true), [])
  function chooseCity(next: PilotCity) {
    parkingGate.current.cancel()
    searchGate.current.cancel()
    navigationGate.current.cancel()
    setCity(next)
    setBounds(pilotAreas[next].bounds)
    setTarget({ coordinate: pilotAreas[next].coordinate, zoom: 13 })
    setSelection(null)
    setDestination(null)
    setQuery('')
    setCategory('all')
    setFeeFilter('all')
    setSheet(null)
  }
  function publicMode() {
    parkingGate.current.cancel()
    searchGate.current.cancel()
    navigationGate.current.cancel()
    setMode('public')
    setToken(null)
    setDraftToken('')
    setSelection(null)
    setDestination(null)
    setAuthMessage('')
    setSheet(null)
  }
  function connect() {
    if (!candidateResearchEnabled) {
      publicMode()
      return
    }
    const value = draftToken.trim()
    if (value.length > 16000 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(value)) {
      setAuthMessage(
        'Enter a valid current reviewer session token. The server checks access and MFA.',
      )
      return
    }
    parkingGate.current.cancel()
    searchGate.current.cancel()
    setToken(value)
    setDraftToken('')
    setMode('candidate_research')
    setSelection(null)
    setDestination(null)
    setAuthMessage('')
    setSheet(null)
  }
  async function saveParked() {
    setSavedError('')
    const point = await location.locate()
    if (!point) {
      setSavedError(
        'Could not get your current location. Nothing was saved. You can still browse or search.',
      )
      return
    }
    if (!(await local.park(point)))
      setSavedError('Your parked location could not be saved. Try again.')
  }
  function showSavedArea(place: { city: PilotCity; coordinate: Coordinate }) {
    publicMode()
    chooseCity(place.city)
    setTarget({ coordinate: place.coordinate, zoom: 16 })
    setBounds({
      west: place.coordinate[0] - 0.01,
      east: place.coordinate[0] + 0.01,
      south: place.coordinate[1] - 0.01,
      north: place.coordinate[1] + 0.01,
    })
  }
  async function loadMore() {
    if (!parking.next || parking.status !== 'ready' || parking.key !== key)
      return
    const cursor = parking.next,
      attempt = parkingGate.current.begin()
    setParking((previous) => ({ ...previous, status: 'loading', error: '' }))
    try {
      const page = await fetchPilotPage(
        pilotConfig,
        request,
        'pilot_discovery',
        attempt.signal,
        cursor,
      )
      if (!attempt.current() || currentKey.current !== key) return
      const pages = mergePilotPage(
        parking.records,
        page.records,
        cursor,
        cursors.current,
      )
      const merged =
        request.mode === 'public' ? uniquePilotRecords(pages) : pages
      setParking({
        key,
        records: merged,
        next: page.nextCursor,
        notice: page.notice,
        status: 'ready',
        error: '',
      })
      if (request.mode === 'public') void publicPilotCache.put(request, merged)
    } catch (error) {
      if (attempt.current()) {
        accessFailed(error)
        setParking((previous) => ({
          ...previous,
          status: 'error',
          error: message(error),
        }))
      }
    }
  }
  async function loadMoreDestinations() {
    if (
      !destinations.next ||
      destinations.status !== 'ready' ||
      destinations.key !== searchKey
    )
      return
    const cursor = destinations.next,
      attempt = searchGate.current.begin()
    setDestinations((previous) => ({ ...previous, status: 'loading' }))
    try {
      const page = await fetchPilotPage(
        pilotConfig,
        { ...request, bounds: pilotAreas[city].bounds },
        'pilot_destinations',
        attempt.signal,
        cursor,
        query,
      )
      if (attempt.current())
        setDestinations({
          key: searchKey,
          records: mergePilotPage(
            destinations.records,
            page.records,
            cursor,
            searchCursors.current,
          ),
          next: page.nextCursor,
          status: 'ready',
          error: '',
        })
    } catch (error) {
      if (attempt.current()) {
        accessFailed(error)
        setDestinations((previous) => ({
          ...previous,
          status: 'error',
          error: message(error),
        }))
      }
    }
  }
  const chooseRecord = useCallback(
    (id: string) => {
      const record = visible.find((item) => item.id === id)
      if (!record || !pilotRecordCanDisplay(record, request.mode)) return
      setSelection({ key: pilotSelectionKey(request), record, cachedAt })
      setSheet('detail')
    },
    [visible, request, cachedAt],
  )
  async function directions(record: PilotParking) {
    if (
      !pilotNavigationEntrance(record, mode) ||
      navBusy ||
      connectivity.offline ||
      cachedAt !== null
    )
      return
    const attempt = navigationGate.current.begin(),
      captured = key
    setNavBusy(true)
    try {
      const fresh = await fetchPilotParkingRecord(
        pilotConfig,
        request,
        record.id,
        attempt.signal,
      )
      if (!attempt.current() || currentKey.current !== captured) return
      const entrance = fresh && pilotNavigationEntrance(fresh, mode)
      if (!entrance) {
        setSelection(null)
        setRefresh((n) => n + 1)
        throw new Error(
          'Navigation approval was revoked or expired. Refresh the record.',
        )
      }
      await Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(entrance[1] + ',' + entrance[0])}&travelmode=driving`,
      )
    } catch (error) {
      if (attempt.current()) {
        accessFailed(error)
        setParking((previous) => ({ ...previous, error: message(error) }))
      }
    } finally {
      if (attempt.current()) setNavBusy(false)
    }
  }
  const status = !pilotConfig.ready
    ? pilotConfig.configurationError ||
      'Pilot discovery has not been configured.'
    : parking.key !== key || (parking.status === 'loading' && !records.length)
      ? 'Loading this city…'
      : `${visible.length} loaded ${mode === 'public' ? 'approved records' : 'research observations'}`
  return (
    <View testID="pilot-screen" style={styles.screen}>
      <Stack.Screen
        options={{ headerShown: false, title: 'Parkey discovery' }}
      />
      <View testID="pilot-map" style={StyleSheet.absoluteFill}>
        <NcrMap
          data={pilotConfig.ready ? mapData : null}
          selectedId={selected?.id || null}
          target={target}
          onViewport={updateViewport}
          onSelect={chooseRecord}
          onCluster={clusterTarget}
          onError={mapError}
        />
      </View>
      <View style={[styles.top, { top: insets.top + 10 }]}>
        <View style={styles.row}>
          {pilotCities.map((value) => (
            <Action
              key={value}
              selected={city === value}
              onPress={() => chooseCity(value)}
              testID={`pilot-city-${value}`}
            >
              {value === 'Manila' ? 'City of Manila' : 'Mandaluyong City'}
            </Action>
          ))}
        </View>
        {candidateResearchEnabled ? (
          <View style={styles.row}>
            <Action
              selected={mode === 'public'}
              onPress={publicMode}
              testID="pilot-mode-public"
            >
              Approved parking
            </Action>
            <Action
              selected={mode === 'candidate_research'}
              onPress={() => setSheet('access')}
              testID="pilot-mode-candidate"
            >
              Candidate research
            </Action>
          </View>
        ) : null}
        <Action onPress={() => setSheet('search')} testID="pilot-search-open">
          {destination
            ? `Near ${destination.name}`
            : 'Search destinations in this city'}
        </Action>
        <View style={styles.row}>
          <Action
            onPress={() => {
              void location.locate().then((point) => {
                if (point) setTarget({ coordinate: point, zoom: 16 })
              })
            }}
            testID="pilot-location"
          >
            {location.status === 'locating' ? 'Locating…' : 'My location'}
          </Action>
          <Action onPress={() => chooseCity(city)}>City center</Action>
          <Action onPress={() => router.push('/account')}>Account</Action>
          <Action
            onPress={() => {
              setSelection(null)
              setRefresh((n) => n + 1)
            }}
            testID="pilot-refresh"
          >
            Refresh
          </Action>
        </View>
        {mode === 'candidate_research' ? (
          <Text
            testID="pilot-candidate-warning"
            selectable
            style={styles.warning}
          >
            Restricted research. Unverified source observations; visitor access,
            names and entrances are unconfirmed. Navigation is disabled.
          </Text>
        ) : null}
        {authMessage ? (
          <Text selectable style={styles.warning}>
            {authMessage}
          </Text>
        ) : null}
      </View>
      <View style={[styles.bottom, { bottom: insets.bottom + 104 }]}>
        {cachedAt !== null ? (
          <Text testID="pilot-cache-notice" style={styles.warning}>
            {cacheCurrent
              ? `Showing a saved public copy from ${new Date(cachedAt).toLocaleTimeString()}. Facts may have changed; directions require current approval.`
              : 'Saved public information expired. Connect and retry to refresh this area.'}
          </Text>
        ) : null}
        {connectivity.offline ? (
          <Text accessibilityRole="alert" style={styles.warning}>
            Offline. Fresh parking and map tiles may be unavailable. Saved
            places remain on this device.
          </Text>
        ) : null}
        <Text selectable style={styles.status}>
          {status}
        </Text>
        {parking.status === 'loading' ? (
          <ActivityIndicator accessibilityLabel="Loading pilot records" />
        ) : null}
        {parking.error || !pilotConfig.ready ? (
          <Text testID="pilot-error" selectable style={styles.error}>
            {parking.error || pilotConfig.configurationError}
          </Text>
        ) : null}
        {parking.status === 'error' ? (
          <Action testID="pilot-retry" onPress={() => setRefresh((n) => n + 1)}>
            Retry parking
          </Action>
        ) : null}
        {mapFailed ? (
          <Text selectable style={styles.warning}>
            Map tiles are unavailable. Loaded records remain accessible in the
            list.
          </Text>
        ) : null}
        {location.status === 'denied' || location.status === 'error' ? (
          <Text selectable style={styles.warning}>
            Location unavailable. Select a city or search a destination.
          </Text>
        ) : null}
        {parking.key === key &&
        parking.status === 'ready' &&
        !records.length ? (
          <Text testID="pilot-empty" selectable>
            No {mode === 'public' ? 'approved parking' : 'research records'} in
            this view. Empty results do not establish an absence of parking.
          </Text>
        ) : null}
        <View style={styles.row}>
          <Action onPress={() => setSheet('results')} testID="pilot-results">
            Parking list and filters
          </Action>
          <Action onPress={() => setSheet('sources')}>Sources</Action>
        </View>
      </View>
      <BottomNavigation
        bottom={insets.bottom}
        selected={
          sheet === 'saved' ? 'saved' : sheet === 'sources' ? 'you' : 'map'
        }
        onSelect={(tab) =>
          setSheet(tab === 'saved' ? 'saved' : tab === 'you' ? 'sources' : null)
        }
      />
      {sheet === 'access' && candidateResearchEnabled ? (
        <ModalSheet
          title="Restricted candidate research"
          onClose={() => {
            setSheet(null)
            setDraftToken('')
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <Text selectable>
              Only an explicitly authorized reviewer session with MFA can access
              candidates. The server decides access. Your token stays in memory
              and is cleared on disconnect or app restart.
            </Text>
            <TextInput
              testID="pilot-reviewer-token"
              accessibilityLabel="Reviewer session token"
              secureTextEntry
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect={false}
              value={draftToken}
              onChangeText={setDraftToken}
              maxLength={16000}
              style={styles.input}
            />
            {authMessage ? (
              <Text selectable style={styles.error}>
                {authMessage}
              </Text>
            ) : null}
            <Action onPress={connect} testID="pilot-reviewer-connect">
              Connect reviewer session
            </Action>
            <Action onPress={publicMode} testID="pilot-reviewer-disconnect">
              Disconnect and use approved parking
            </Action>
          </ScrollView>
        </ModalSheet>
      ) : null}
      {sheet === 'results' ? (
        <ModalSheet
          title={`${city} parking in view`}
          onClose={() => setSheet(null)}
        >
          <View style={styles.content}>
            <ScrollView horizontal contentContainerStyle={styles.row}>
              {filters.map((filter) => (
                <Action
                  key={filter.value}
                  selected={category === filter.value}
                  onPress={() => {
                    setCategory(filter.value)
                    setSelection(null)
                  }}
                >
                  {filter.label}
                </Action>
              ))}
            </ScrollView>
            <View style={styles.row}>
              {(['all', 'free', 'paid'] as const).map((value) => (
                <Action
                  key={value}
                  testID={`pilot-fees-${value}`}
                  selected={feeFilter === value}
                  onPress={() => {
                    setFeeFilter(value)
                    setSelection(null)
                  }}
                >
                  {value === 'all'
                    ? 'All prices'
                    : value === 'free'
                      ? 'Recorded no fee'
                      : 'Fee applies'}
                </Action>
              ))}
            </View>
            <Text>
              Straight-line distance to {referenceLabel}. This is not a walking
              route.
            </Text>
            {feeFilter !== 'all' && partition.unknown.length > 0 ? (
              <Text>
                {partition.unknown.length} loaded records have unknown fees and
                are excluded by this filter.
              </Text>
            ) : null}
            {destination ? (
              <Action
                onPress={() => {
                  setDestination(null)
                  setQuery('')
                }}
              >
                Clear destination
              </Action>
            ) : null}
            <Text selectable>
              Filters apply to loaded parking records. Load more to inspect
              additional records.
            </Text>
          </View>
          <FlatList
            data={ranked}
            keyExtractor={({ record }) => record.id}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: { record: item, straightLineMeters } }) => (
              <Pressable
                testID={`pilot-record-${item.id}`}
                accessibilityRole="button"
                onPress={() => {
                  chooseRecord(item.id)
                  setTarget({ coordinate: item.representativePoint, zoom: 17 })
                }}
                style={styles.record}
              >
                <Text style={styles.status}>
                  {item.officialName || item.descriptiveLabel || item.name}
                </Text>
                <Text>
                  {pilotTypeLabel(item.featureType, mode)} ·{' '}
                  {item.accessClass || 'Access unknown'}
                </Text>
                <Text>
                  {straightLineMeters === null
                    ? 'Distance unknown'
                    : `${detailDistance(straightLineMeters) ?? 'Distance unknown'} straight-line to ${referenceLabel}`}{' '}
                  · Fees: {item.fees || 'Unknown'}
                </Text>
                {item.descriptiveLabel && !item.officialName ? (
                  <Text>Descriptive label; official name unknown.</Text>
                ) : null}
              </Pressable>
            )}
            ListEmptyComponent={
              <Text selectable>
                {parking.status === 'loading'
                  ? 'Loading records…'
                  : parking.status === 'error'
                    ? parking.error
                    : 'No loaded records match this filter.'}
              </Text>
            }
            ListFooterComponent={
              <View style={styles.content}>
                {parking.next ? (
                  <Action
                    onPress={() => {
                      void loadMore()
                    }}
                    disabled={parking.status === 'loading'}
                    testID="pilot-load-more"
                  >
                    Load more parking
                  </Action>
                ) : null}
                {parking.error ? (
                  <View style={styles.content}>
                    <Text selectable style={styles.error}>
                      {parking.error}
                    </Text>
                    <Action onPress={() => setRefresh((n) => n + 1)}>
                      Retry parking results
                    </Action>
                  </View>
                ) : null}
                {category !== 'all' || feeFilter !== 'all' ? (
                  <Action
                    onPress={() => {
                      setCategory('all')
                      setFeeFilter('all')
                    }}
                  >
                    Clear filters
                  </Action>
                ) : null}
              </View>
            }
          />
        </ModalSheet>
      ) : null}
      {sheet === 'search' ? (
        <ModalSheet
          title={`Destinations in ${city}`}
          onClose={() => setSheet(null)}
        >
          <View style={styles.content}>
            <TextInput
              testID="pilot-destination-search"
              accessibilityLabel="Search city destinations"
              value={query}
              onChangeText={(value) => {
                setQuery(value)
                setDestination(null)
              }}
              maxLength={100}
              placeholder="Destination name"
              style={styles.input}
            />
            <Text selectable>
              A destination is a map reference, not parking identity or
              permission to park.
            </Text>
          </View>
          <FlatList
            data={
              destinations.key === searchKey
                ? destinations.records.filter(
                    (d) =>
                      mode !== 'public' ||
                      (d.publicationApproved &&
                        Date.parse(d.reviewDueAt || '') > clock),
                  )
                : []
            }
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            renderItem={({ item }) => (
              <Pressable
                testID={`pilot-destination-${item.id}`}
                accessibilityRole="button"
                style={styles.record}
                onPress={() => {
                  setDestination(item)
                  setSelection(null)
                  setTarget({ coordinate: item.coordinate, zoom: 16 })
                  setBounds({
                    west: item.coordinate[0] - 0.01,
                    south: item.coordinate[1] - 0.01,
                    east: item.coordinate[0] + 0.01,
                    north: item.coordinate[1] + 0.01,
                  })
                  setSheet(null)
                }}
              >
                <Text style={styles.status}>{item.name}</Text>
                <Text>
                  {item.category} · {item.source.attribution}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text selectable>
                {destinations.key !== searchKey ||
                destinations.status === 'loading'
                  ? 'Searching this city…'
                  : destinations.status === 'error'
                    ? destinations.error
                    : 'No approved destinations match. Try another name or browse the city map.'}
              </Text>
            }
            ListFooterComponent={
              <View style={styles.content}>
                {destinations.next ? (
                  <Action
                    onPress={() => {
                      void loadMoreDestinations()
                    }}
                    disabled={destinations.status === 'loading'}
                  >
                    More destinations
                  </Action>
                ) : null}
                {destinations.status === 'error' ? (
                  <Action
                    testID="pilot-search-retry"
                    onPress={() => setRefresh((n) => n + 1)}
                  >
                    Retry search
                  </Action>
                ) : null}
              </View>
            }
          />
        </ModalSheet>
      ) : null}
      {sheet === 'detail' && selected ? (
        <ModalSheet
          title={mode === 'public' ? 'Parking details' : 'Parking observation'}
          onClose={() => setSheet(null)}
        >
          <ScrollView
            testID="pilot-details"
            contentContainerStyle={styles.content}
          >
            <Text selectable style={styles.status}>
              {selected.officialName ||
                selected.descriptiveLabel ||
                selected.name}
            </Text>
            <Text selectable>
              Official name: {selected.officialName || 'Unknown'}
            </Text>
            <Text selectable>
              Descriptive label: {selected.descriptiveLabel || 'None recorded'}{' '}
              · Original source: {selected.name}
            </Text>
            <Text selectable>
              Type: {pilotTypeLabel(selected.featureType)} · Access:{' '}
              {selected.accessClass || 'Unknown'}
            </Text>
            <Text selectable>
              Fees: {selected.fees || 'Unknown'} · Hours:{' '}
              {selected.hours || 'Unknown'}
            </Text>
            <Text selectable>No live availability information.</Text>
            <ParkingGallery
              identityKey={parkingPhotoIdentityKey({
                id: selected.id,
                sourceUrl: selected.source.url,
              })}
              photos={parkingPhotos({
                id: selected.id,
                sourceUrl: selected.source.url,
              })}
            />
            <Text>
              Only location-matched, licensed parking photos are shown. Missing
              imagery does not establish the condition of this location.
            </Text>
            {mode === 'public' ? (
              <Action
                testID="pilot-favorite"
                disabled={saved.status !== 'ready' || saved.busy}
                onPress={() => {
                  void saved.toggle(selected, city, mode, clock)
                }}
              >
                {saved.items.some(
                  (item) => item.key === pilotSavedKey(selected, city),
                )
                  ? 'Remove saved parking'
                  : 'Save parking'}
              </Action>
            ) : null}
            {saved.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {saved.error}
              </Text>
            ) : null}
            <Text selectable>
              Research: {selected.evidence.researchStatus} · Operator confirmed:{' '}
              {selected.evidence.operatorConfirmed ? 'Yes' : 'No'} · Physically
              verified: {selected.evidence.physicallyVerified ? 'Yes' : 'No'} ·
              Publication approved:{' '}
              {selected.evidence.publicationApproved ? 'Yes' : 'No'}
            </Text>
            {selected.destinationContext.map((item) => (
              <View key={item.sourceId} style={styles.context}>
                <Text selectable>
                  Nearby destination context: {item.label}. This is not a
                  confirmed parking name, entrance or access approval.
                </Text>
                <Text selectable>
                  Category: {item.category || 'Unknown'} · Estimated
                  straight-line distance:{' '}
                  {typeof item.approximateStraightLineMeters === 'number'
                    ? `approximately ${Math.round(item.approximateStraightLineMeters)} m`
                    : 'Unknown'}
                  . Actual walking access is unconfirmed.
                </Text>
                <Text selectable>
                  Source property footprint:{' '}
                  {item.insideSourcePropertyFootprint === true
                    ? 'contains source anchor; ownership unconfirmed'
                    : item.insideSourcePropertyFootprint === false
                      ? 'nearby geometry; ownership unconfirmed'
                      : 'Unknown'}{' '}
                  · {item.sourceLicense}
                </Text>
                {(item.uncertainties || []).map((uncertainty, index) => (
                  <Text selectable key={index}>
                    {uncertainty}
                  </Text>
                ))}
                <Action
                  onPress={() => {
                    void Linking.openURL(item.sourceRecordUrl).catch(() =>
                      setAuthMessage(
                        'The destination source could not be opened.',
                      ),
                    )
                  }}
                >
                  Open destination source
                </Action>
              </View>
            ))}
            {selected.warnings.map((warning, i) => (
              <Text selectable style={styles.warning} key={i}>
                {warning}
              </Text>
            ))}
            <Text selectable>
              {selected.source.attribution} · {selected.source.license} · Source
              date: {selected.source.updatedAt || 'Unknown'}
            </Text>
            {selected.source.url ? (
              <Action
                onPress={() => {
                  if (selected.source.url)
                    void Linking.openURL(selected.source.url).catch(() =>
                      setAuthMessage('The source link could not be opened.'),
                    )
                }}
              >
                Open original source
              </Action>
            ) : null}
            <Text selectable>
              Directions open Google Maps and share only the reviewed entrance
              coordinate. Approval is checked again before opening.
            </Text>
            <Action
              testID="pilot-directions"
              disabled={
                !pilotNavigationEntrance(selected, mode, clock) ||
                navBusy ||
                connectivity.offline ||
                cachedAt !== null
              }
              onPress={() => {
                void directions(selected)
              }}
            >
              {navBusy
                ? 'Checking current permission…'
                : 'Open reviewed entrance in Maps'}
            </Action>
            {!pilotNavigationEntrance(selected, mode, clock) ? (
              <Text selectable>
                Navigation unavailable: a current reviewed entrance, visitor
                access and operator navigation permission are required.
              </Text>
            ) : null}
            {selection?.cachedAt != null ||
            cachedAt !== null ||
            connectivity.offline ? (
              <View style={styles.content}>
                <Text>
                  Connect and refresh current parking facts before requesting
                  entrance directions. Saved public copies never authorize
                  navigation.
                </Text>
                <Action
                  onPress={() => {
                    setSelection(null)
                    setSheet('results')
                    setRefresh((n) => n + 1)
                  }}
                >
                  Refresh current parking details
                </Action>
              </View>
            ) : null}
            {parking.error ? (
              <Text selectable style={styles.error}>
                {parking.error}
              </Text>
            ) : null}
          </ScrollView>
        </ModalSheet>
      ) : null}
      {sheet === 'sources' ? (
        <ModalSheet title="Map information" onClose={() => setSheet(null)}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text>
              Parkey helps you discover parking. It does not offer bookings or
              guarantee parking space. Saved places and your parked-car pin stay
              on this device. Analytics collection is disabled pending privacy
              and release review.
            </Text>
            {allowLegacy ? (
              <Action
                onPress={() => {
                  publicMode()
                  onOpenLegacy()
                }}
              >
                Original Poblacion map
              </Action>
            ) : null}
            <Text selectable>
              City of Manila and Mandaluyong City are founder-selected pilot
              areas. This does not establish demand or parking scarcity.
            </Text>
            <Text selectable>
              {parking.notice ||
                'Approved parking and restricted research use separate server projections. No research record is automatically published.'}
            </Text>
            <Text selectable>
              Source geometry is a research anchor. It is never a confirmed
              vehicle entrance. Nearby destination descriptions do not establish
              parking identity.
            </Text>
            {[
              ...new Set(
                records.map(
                  (record) =>
                    `${record.source.attribution} · ${record.source.license}`,
                ),
              ),
            ].map((value) => (
              <Text selectable key={value}>
                {value}
              </Text>
            ))}
            <Text selectable>
              Original records and review decisions remain in their original
              archives. Unknown facts remain unknown.
            </Text>
          </ScrollView>
        </ModalSheet>
      ) : null}
      {sheet === 'saved' ? (
        <ModalSheet title="Saved places" onClose={() => setSheet(null)}>
          <FlatList
            data={saved.items}
            keyExtractor={(item) => item.key}
            contentContainerStyle={styles.content}
            ListHeaderComponent={
              <View style={styles.content}>
                <Text>
                  Kept on this device only. Saved parking labels are reminders,
                  not current access or entrance approval. Open the saved area
                  to load current public details.
                </Text>
                <Action
                  disabled={
                    local.status !== 'ready' ||
                    local.busy ||
                    location.status === 'locating'
                  }
                  onPress={() => {
                    void saveParked()
                  }}
                >
                  {location.status === 'locating'
                    ? 'Finding your location…'
                    : 'Save where I parked'}
                </Action>
                {local.state.parked ? (
                  <View style={styles.content}>
                    <Text>
                      Your car · Saved{' '}
                      {new Date(local.state.parked.savedAt).toLocaleString()}
                    </Text>
                    <Action
                      onPress={() => {
                        const point = local.state.parked?.coordinate
                        if (point) {
                          setTarget({ coordinate: point, zoom: 17 })
                          setSheet(null)
                        }
                      }}
                    >
                      Show parked location
                    </Action>
                    <Action
                      onPress={() => {
                        const point = local.state.parked?.coordinate
                        if (point)
                          void Linking.openURL(
                            `https://www.google.com/maps/dir/?api=1&destination=${point[1]},${point[0]}&travelmode=walking`,
                          ).catch(() =>
                            setSavedError(
                              'Maps could not be opened. Try again.',
                            ),
                          )
                      }}
                    >
                      Walk back in Maps
                    </Action>
                    <Action
                      disabled={local.busy}
                      onPress={() => {
                        void local.park(null)
                      }}
                    >
                      Clear parked location
                    </Action>
                  </View>
                ) : null}
                {saved.status === 'loading' ? (
                  <ActivityIndicator accessibilityLabel="Loading saved places" />
                ) : null}
                {saved.error || savedError || local.error ? (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {saved.error || savedError || local.error}
                  </Text>
                ) : null}
                {saved.status === 'error' ? (
                  <View style={styles.row}>
                    <Action
                      onPress={() => {
                        void saved.retry()
                      }}
                    >
                      Retry saved places
                    </Action>
                    <Action
                      onPress={() => {
                        void saved.clear()
                      }}
                    >
                      Clear damaged saved places
                    </Action>
                  </View>
                ) : null}
                {local.status === 'error' ? (
                  <View style={styles.content}>
                    <Text>
                      Retry loading your saved car location. Clearing damaged
                      data also removes previous favorites and recent places;
                      city parking favorites remain saved separately.
                    </Text>
                    <Action
                      disabled={local.busy}
                      onPress={() => {
                        void local.retry()
                      }}
                    >
                      Retry parked location
                    </Action>
                    <Action
                      disabled={local.busy}
                      onPress={() => {
                        void local.clear()
                      }}
                    >
                      Clear saved car and previous saved places
                    </Action>
                  </View>
                ) : null}
              </View>
            }
            ListEmptyComponent={
              saved.status === 'ready' ? (
                <Text>
                  No saved parking yet. Save an approved parking record from its
                  details.
                </Text>
              ) : undefined
            }
            renderItem={({ item }) => (
              <View style={styles.record}>
                <Action
                  onPress={() => showSavedArea(item)}
                >{`${item.name} · ${item.city} · Show saved area`}</Action>
                <Text>
                  {pilotTypeLabel(item.featureType)} · Last saved label; current
                  details must be loaded.
                </Text>
                <Action
                  disabled={saved.busy}
                  onPress={() => {
                    void saved.remove(item.key)
                  }}
                >
                  Remove saved place
                </Action>
              </View>
            )}
          />
        </ModalSheet>
      ) : null}
    </View>
  )
}
const styles = StyleSheet.create({
  context: {
    gap: 8,
    padding: 12,
    backgroundColor: colors.soft,
    borderRadius: 12,
  },
  screen: { flex: 1, backgroundColor: colors.canvas },
  top: {
    position: 'absolute',
    left: 12,
    right: 12,
    gap: 6,
    maxWidth: 600,
    alignSelf: 'center',
  },
  bottom: {
    position: 'absolute',
    left: 12,
    right: 12,
    padding: 12,
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 16,
    maxWidth: 600,
    alignSelf: 'center',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  action: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 14,
  },
  active: { backgroundColor: colors.brand, borderColor: colors.brand },
  disabled: { opacity: 0.45 },
  content: { padding: 16, gap: 12 },
  status: { fontSize: 16, fontWeight: '600', color: colors.ink },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
    borderRadius: 12,
    padding: 12,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  record: {
    padding: 14,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  warning: {
    color: colors.amber,
    backgroundColor: colors.warningSurface,
    padding: 8,
    borderRadius: 8,
  },
  error: { color: colors.error },
})
