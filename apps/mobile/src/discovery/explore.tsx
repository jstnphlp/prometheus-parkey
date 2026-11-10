import type {
  Coordinate,
  DiscoveryParking,
  ParkingContribution,
  ParkingKind,
} from '@parkey/shared-types'
import type { ComponentRef } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AppState,
  BackHandler,
  FlatList,
  Linking,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { discoveryState } from './discovery-state'
import { StateCard } from './state-card'
import { useConnectivity } from './use-connectivity'
import { ArrivalCelebration } from './arrival-celebration'
import { BottomNavigation, TAB_BAR_HEIGHT } from './bottom-navigation'
import { NearbyCard, NearbyLoading } from './nearby-card'
import { ParkingProfile } from './parking-profile'
import { ContributionForm } from './contribution-form'
import { readContributions, writeContributions } from './contributions'
import type { Destination } from './data'
import { draftParking } from './draft-parking'
import { useNavigation } from './use-navigation'
import { useDirectionsConsent } from './use-directions-consent'
import { DiscoverySheet, MapAttribution } from './discovery-sheet'
import { partitionParking } from './filters'
import type { DiscoveryFilter, FeeFilter } from './filters'
import { MapInformation } from './information'
import { recordKey } from './local-state'
import { SavedPlaces } from './saved-places'
import { useLocalState } from './use-local-state'
import { track } from './telemetry'
import { config } from './config'
import { refreshReviewedParking } from './parking-navigation-refresh'
import {
  anchor,
  distanceMeters,
  directionsUrl,
  inViewport,
  isCoordinate,
  kindLabels,
  PILOT_CENTER,
  PILOT_VIEWPORT,
  parkingReference,
  rankParking,
  validateContribution,
} from './model'
import type { Viewport } from './model'
import ParkingMap from './parking-map'
import type { CameraTarget } from './map-types'
import { parkingDestination } from './parking-detail-data'
import { ParkingDetails } from './parking-details'
import { ParkingRow } from './parking-row'
import {
  developmentSamplesEnabled,
  millisecondsToNextMinute,
  parkingTitle,
} from './presentation'
import { NavigationBanner, RouteDetails } from './route-details'
import { nextParking } from './drive-math'
import { useDriveNavigation } from './use-drive-navigation'
import { sampleParking } from './sample-data'
import { DestinationSearch } from './search'
import { FigmaAsset } from './figma-assets'
import { ModalSheet } from './sheets'
import { discoveryCameraPadding, stepSheet } from './sheet-state'
import type { SheetPosition } from './sheet-state'
import { fonts } from './typography'
import {
  Button,
  Choice,
  colors,
  detailsPeekHeight,
  IconButton,
  LoadingRows,
  UndoToast,
  ui,
} from './ui'
import { useGrantedLocation } from './use-granted-location'
import { useDirectDirections } from './use-direct-directions'
import { useLocation } from './use-location'
import { useParking } from './use-parking'
import { useRoute } from './use-route'

const EMPTY_POINTS: Coordinate[] = []
function sameNavigationContext(
  before: ReturnType<typeof useNavigation>['state'],
  after: ReturnType<typeof useNavigation>['state'],
) {
  return (
    before.selectedId === after.selectedId &&
    before.panel === after.panel &&
    before.searching === after.searching &&
    before.route === after.route
  )
}

export default function Explore() {
  const insets = useSafeAreaInsets()
  const connectivity = useConnectivity()
  const [locationSettingsOpen, setLocationSettingsOpen] = useState(false)
  const { height: screenHeight } = useWindowDimensions()
  const [viewport, setViewport] = useState(PILOT_VIEWPORT)
  const navigation = useNavigation(routeExited)
  const {
    update: updateNavigation,
    close: closeNavigation,
    getState: getNavigationState,
  } = navigation
  const nav = navigation.state
  const panned = useRef(false)
  const searchedCenter = useRef(nav.center)
  const [areaRefresh, setAreaRefresh] = useState(false)
  useEffect(() => {
    searchedCenter.current = nav.center
  }, [nav.center])
  const [longitude, latitude] = nav.center
  const cameraRevision = navigation.cameraRevision
  const target = useMemo<CameraTarget>(
    () => ({ coordinate: [longitude, latitude], revision: cameraRevision }),
    [longitude, latitude, cameraRevision],
  )
  const filter = nav.filter
  const feeFilter = nav.fees
  const setFeeFilter = (fees: FeeFilter) => updateNavigation({ fees })
  const [now, setNow] = useState(() => new Date())

  const setSelected = useCallback(
    (record: DiscoveryParking | null) => {
      if (record)
        updateNavigation({
          selectedId: record.id,
          center: anchor(record.geometry),
        })
      else if (nav.selectedId)
        closeNavigation({ selectedId: null, center: nav.center })
    },
    [updateNavigation, closeNavigation, nav.center, nav.selectedId],
  )
  const changeSheetPosition = useCallback(
    (position: SheetPosition) => {
      if (position === 'compact') {
        Keyboard.dismiss()
        updateNavigation({ position, searching: false })
      } else updateNavigation({ position })
    },
    [updateNavigation],
  )
  const list = useRef<FlatList<DiscoveryParking>>(null)
  const browseScrollOffset = useRef(0)
  const parkingScrollOffset = useRef(0)
  const getBrowseScrollOffset = useCallback(
    () => browseScrollOffset.current,
    [],
  )
  const getParkingScrollOffset = useCallback(
    () => parkingScrollOffset.current,
    [],
  )
  const [sheetContent, setSheetContent] = useState<{
    id: string
    height: number
  } | null>(null)
  useEffect(() => {
    parkingScrollOffset.current = 0
  }, [nav.selectedId])
  const [toast, setToast] = useState<{
    message: string
    undo: () => void
  } | null>(null)
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])
  const consent = useDirectionsConsent(
    nav.consent,
    () => updateNavigation({ consent: true }),
    () => {
      navigationActionGeneration.current++
      entranceRequest.current?.abort()
      setEntranceCheck(false)
      closeNavigation({ consent: false })
    },
  )
  const [sheetHeight, setSheetHeight] = useState(116 + insets.bottom)
  const [menuOpen, setMenuOpen] = useState(false)
  const [drawingPanelHeight, setDrawingPanelHeight] = useState(0)
  const [topOverlayHeight, setTopOverlayHeight] = useState(0)
  const [routeTarget, setRouteTarget] = useState<{
    name: string
    coordinate: Coordinate
    parking: DiscoveryParking | null
  } | null>(null)
  const [routeHeight, setRouteHeight] = useState(detailsPeekHeight)
  const destination = useMemo<Pick<Destination, 'name' | 'coordinate'> | null>(
    () =>
      nav.searchPoint && nav.query
        ? { name: nav.query, coordinate: nav.searchPoint }
        : null,
    [nav.searchPoint, nav.query],
  )
  const clearDestination = () =>
    updateNavigation({ searchPoint: null, query: '' }, 'replace')
  const searchActive = nav.searching
  const panel = nav.panel
  const fullPageActive = panel === 'saved' || panel === 'you'
  const mapInterface = useRef<ComponentRef<typeof View>>(null)
  useEffect(() => {
    const element = mapInterface.current
    if (Platform.OS === 'web' && element instanceof HTMLElement)
      element.inert = fullPageActive
  }, [fullPageActive])
  const setPanel = (value: 'info' | 'saved' | 'you' | null) =>
    value
      ? updateNavigation({ panel: value })
      : closeNavigation({ panel: null })
  const [samplesRequested, setSamples] = useState(false)
  const samples = developmentSamplesEnabled(
    samplesRequested,
    process.env.NODE_ENV,
  )
  const [revision, setRevision] = useState(0)
  const [mapRevision, setMapRevision] = useState(0)
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const [drawingRequested, setDrawing] = useState(false)
  const drawing = drawingRequested && nav.panel === 'add'
  const [kind, setKind] = useState<ParkingKind>('lot')
  const [points, setPoints] = useState<Coordinate[]>([])
  const [form, setForm] = useState<ParkingContribution | null>(null)
  const [adjusted, setAdjusted] = useState<ParkingContribution | null>(null)
  const [drafts, setDrafts] = useState<ParkingContribution[]>([])
  const [storage, setStorage] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const navigationViewportPrivate = useRef(false)
  const saving = useRef(false)
  const savingFavorite = useRef(false)
  const location = useLocation()
  useGrantedLocation(location.locate)
  const currentLocation = location.status === 'idle' ? location.point : null
  const local = useLocalState()
  const [saveLocationError, setSaveLocationError] = useState<string | null>(
    null,
  )
  const {
    load: loadRoute,
    clear: clearRoute,
    cancel: cancelRoute,
    ...routeState
  } = useRoute()
  const [parkedHere, setParkedHere] = useState(false)
  const [rejected, setRejected] = useState<ReadonlySet<string>>(() => new Set())
  const [resumeTarget, setResumeTarget] = useState<typeof routeTarget>(null)
  const [navigationMessage, setNavigationMessage] = useState<string | null>(
    null,
  )
  const entranceRequest = useRef<AbortController | null>(null)
  const navigationActionGeneration = useRef(0)
  const [entranceCheck, setEntranceCheck] = useState(false)
  const [entranceError, setEntranceError] = useState<string | null>(null)
  useEffect(
    () => () => {
      navigationActionGeneration.current++
      entranceRequest.current?.abort()
    },
    [],
  )
  useEffect(() => {
    navigationActionGeneration.current++
    entranceRequest.current?.abort()
    setEntranceCheck(false)
  }, [nav.selectedId, nav.panel, nav.searching])
  const reroute = useCallback(
    async (from: Coordinate, to: Coordinate, heading?: number) => {
      entranceRequest.current?.abort()
      const request = new AbortController()
      entranceRequest.current = request
      const context = getNavigationState()
      try {
        const fresh = routeTarget?.parking
          ? await refreshReviewedParking(
              routeTarget.parking,
              { url: config.supabaseUrl, publicKey: config.supabaseKey },
              request.signal,
            )
          : null
        if (
          request.signal.aborted ||
          !sameNavigationContext(context, getNavigationState())
        )
          return null
        if (fresh) {
          const coordinate = parkingDestination(fresh, from)
          if (!coordinate) throw new Error('Entrance approval expired.')
          setRouteTarget({
            name: parkingTitle(fresh),
            coordinate,
            parking: fresh,
          })
        }
        return loadRoute(
          fresh
            ? () => {
                const entrance = parkingDestination(fresh, from)
                if (!entrance) throw new Error('Entrance approval expired.')
                return entrance
              }
            : to,
          async () => from,
          true,
          heading,
        )
      } catch (error) {
        if (
          !request.signal.aborted &&
          sameNavigationContext(context, getNavigationState())
        ) {
          clearRoute()
          setEntranceError(
            error instanceof Error
              ? error.message
              : 'Current entrance approval could not be confirmed.',
          )
        }
        return null
      }
    },
    [loadRoute, clearRoute, routeTarget, getNavigationState],
  )
  const drive = useDriveNavigation({
    route: routeState.route,
    destination: nav.route ? (routeTarget?.coordinate ?? null) : null,
    reroute,
    cancel: cancelRoute,
  })
  const stopDrive = drive.stop
  useEffect(() => {
    if (entranceError && routeTarget?.parking && nav.route) {
      stopDrive(false)
      clearRoute()
    }
  }, [entranceError, routeTarget?.parking, nav.route, stopDrive, clearRoute])
  const directNavigation = useDirectDirections(
    nav.route && routeState.status === 'ready' && routeState.route !== null,
    drive.start,
  )
  const navigating = nav.route && drive.phase === 'navigating'
  const mapNavigation = useMemo(
    () =>
      navigating
        ? {
            following: drive.following,
            along: drive.progress?.along ?? 0,
            onPan: drive.pan,
          }
        : undefined,
    [navigating, drive.following, drive.progress?.along, drive.pan],
  )
  function routeExited() {
    navigationActionGeneration.current++
    entranceRequest.current?.abort()
    setEntranceCheck(false)
    directNavigation.cancel()
    setResumeTarget(routeTarget)
    drive.stop(drive.phase === 'navigating')
    clearRoute()
  }
  function endNavigation() {
    entranceRequest.current?.abort()
    setEntranceCheck(false)
    routeExited()
    updateNavigation({ route: false, selectedId: null }, 'replace')
  }
  const parking = useParking(viewport, revision)
  const previews = useMemo(
    () => drafts.filter((draft) => draft.intent === 'add').map(draftParking),
    [drafts],
  )
  const selected =
    [
      ...parking.knownRecords,
      ...previews,
      ...(samples ? sampleParking : []),
    ].find((record) => record.id === nav.selectedId) ?? null
  const sheet = { position: nav.position }
  useEffect(() => {
    if (
      storage === 'ready' &&
      nav.selectedId?.startsWith('local-') &&
      !drafts.some((draft) => draft.id === nav.selectedId)
    )
      updateNavigation({ selectedId: null }, 'replace')
  }, [storage, nav.selectedId, drafts, updateNavigation])
  const initialLocation = useRef(false)
  useEffect(() => {
    if (!location.point || initialLocation.current) return
    initialLocation.current = true
    if (
      !nav.selectedId &&
      nav.center[0] === PILOT_CENTER[0] &&
      nav.center[1] === PILOT_CENTER[1]
    )
      updateNavigation({ center: location.point }, 'replace')
  }, [location.point, nav.selectedId, nav.center, updateNavigation])
  useEffect(() => {
    if (selected)
      updateNavigation({ center: anchor(selected.geometry) }, 'replace')
  }, [selected, updateNavigation])
  const records = useMemo(
    () =>
      samples
        ? sampleParking.filter((item) => inViewport(item.geometry, viewport))
        : [
            ...parking.records,
            ...previews.filter((record) =>
              inViewport(record.geometry, viewport),
            ),
          ],
    [samples, viewport, parking.records, previews],
  )
  const partitions = useMemo(
    () => partitionParking(records, filter, feeFilter),
    [records, filter, feeFilter],
  )
  const visible = useMemo(
    () =>
      feeFilter !== 'all'
        ? partitions.matched
        : [...partitions.matched, ...partitions.unknown],
    [partitions, feeFilter],
  )
  const reference = useMemo(
    () =>
      parkingReference(
        destination?.coordinate ?? null,
        currentLocation,
        viewport,
      ),
    [destination, currentLocation, viewport],
  )
  const ranked = useMemo(
    () => (parking.canQuery ? rankParking(visible, reference.coordinate) : []),
    [visible, reference.coordinate, parking.canQuery],
  )
  const farFromCenter =
    distanceMeters(
      [
        (viewport.west + viewport.east) / 2,
        (viewport.south + viewport.north) / 2,
      ],
      nav.center,
    ) > 600
  const filteredOut = parking.canQuery && records.length > 0 && !visible.length
  const browseState = discoveryState({
    canQuery: parking.canQuery,
    locationDenied: location.status === 'denied',
    filteredOut,
    loading:
      !samples &&
      (parking.status === 'loading' ||
        (mapStatus === 'loading' && !records.length)),
    count: visible.length,
  })
  const stateCard =
    browseState === 'zoomed-out' ? (
      <StateCard
        icon="zoom-in-brand"
        title="Zoom in to see parking"
        body="Spots appear once the map is a little closer."
        action="Zoom in"
        onAction={() =>
          center([
            (viewport.west + viewport.east) / 2,
            (viewport.south + viewport.north) / 2,
          ])
        }
      />
    ) : browseState === 'location-off' ? (
      <StateCard
        icon="location-off"
        title="Location is off"
        body="Turn it on to see parking near you, or search for a place."
        action="Open settings"
        onAction={() => {
          if (Platform.OS === 'web') setLocationSettingsOpen(true)
          else
            void Linking.openSettings().catch(() =>
              setLocationSettingsOpen(true),
            )
        }}
      />
    ) : browseState === 'filtered' ? (
      <StateCard
        icon="filter-brand"
        title={
          feeFilter === 'free'
            ? 'No free spots in view'
            : `No ${filter === 'garage' ? 'garages' : 'street spots'} in view`
        }
        body={`The ${feeFilter === 'free' ? 'Free' : filter === 'garage' ? 'Garage' : 'Street'} filter is hiding other mapped spots nearby.`}
        action="Show all spots"
        onAction={() => updateNavigation({ filter: 'all', fees: 'all' })}
      />
    ) : browseState === 'empty' ? (
      <StateCard
        title="No parking mapped here yet"
        body="Know a parking spot in this area? Save a private draft."
        action="Add a spot"
        onAction={() => startContribution()}
      />
    ) : null
  const resultsTitle = destination
    ? `Parking near ${destination.name}`
    : 'Parking in this area'
  const parkingError =
    'Couldn’t update parking information. Saved map data may still be shown. Check the source dates and try again.'

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    function refresh() {
      clearTimeout(timer)
      setNow(new Date())
      timer = setTimeout(refresh, millisecondsToNextMinute(Date.now()))
    }
    timer = setTimeout(refresh, millisecondsToNextMinute(Date.now()))
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh()
      else clearTimeout(timer)
    })
    return () => {
      clearTimeout(timer)
      listener.remove()
    }
  }, [])

  useEffect(() => {
    let active = true
    void readContributions()
      .then((saved) => {
        if (active) {
          setDrafts(saved)
          setStorage('ready')
        }
      })
      .catch(() => {
        if (active) setStorage('error')
      })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    if (mapStatus !== 'loading') return
    const timeout = setTimeout(() => setMapStatus('error'), 20000)
    return () => clearTimeout(timeout)
  }, [mapStatus, mapRevision])
  function dismissTopmost() {
    Keyboard.dismiss()
    if (nav.consent) closeNavigation({ consent: false })
    else if (nav.searching)
      closeNavigation({
        searching: false,
        query: nav.query,
        searchPoint: nav.searchPoint,
      })
    else if (nav.panel) {
      setDrawing(false)
      closeNavigation({ panel: null })
    } else if (nav.route) endNavigation()
    else if (nav.selectedId) setSelected(null)
    else if (nav.position !== 'compact')
      closeNavigation({ position: stepSheet(nav.position, -1) })
    else return false
    return true
  }
  useEffect(() => {
    if (Platform.OS === 'web') {
      const escape = (event: KeyboardEvent) => {
        // Let the active modal handle Escape before dismissing its parent page.
        if (document.querySelector('[role="dialog"]')) return
        if (
          event.key === 'Escape' &&
          !event.defaultPrevented &&
          dismissTopmost()
        ) {
          event.preventDefault()
          event.stopImmediatePropagation()
        }
      }
      window.addEventListener('keydown', escape, true)
      return () => window.removeEventListener('keydown', escape, true)
    }
    const listener = BackHandler.addEventListener(
      'hardwareBackPress',
      dismissTopmost,
    )
    return () => listener.remove()
  })
  useEffect(() => {
    const index = ranked.findIndex((record) => record.id === nav.selectedId)
    if (index < 0) return
    const frame = requestAnimationFrame(() =>
      list.current?.scrollToIndex({ index, animated: false }),
    )
    return () => cancelAnimationFrame(frame)
  }, [nav.selectedId, ranked])
  const updateViewport = useCallback(
    (next: Viewport) => {
      if (panned.current) {
        const point: Coordinate = [
          (next.west + next.east) / 2,
          (next.south + next.north) / 2,
        ]
        setAreaRefresh(distanceMeters(point, searchedCenter.current) > 600)
        panned.current = false
      }
      setViewport((current) =>
        current.west === next.west &&
        current.south === next.south &&
        current.east === next.east &&
        current.north === next.north &&
        current.zoom === next.zoom
          ? current
          : next,
      )
    },
    [setAreaRefresh],
  )

  function center(coordinate: Coordinate) {
    updateNavigation({ center: coordinate }, 'replace')
  }
  function startDirections(record: DiscoveryParking) {
    if (!parkingDestination(record, currentLocation)) return
    const generation = ++navigationActionGeneration.current
    const context = getNavigationState()
    const isCurrent = () =>
      generation === navigationActionGeneration.current &&
      sameNavigationContext(context, getNavigationState())
    void consent.request((confirmed) => {
      if (!isCurrent() || (confirmed && !getNavigationState().consent)) return
      void beginDirections(record, confirmed)
    }, isCurrent)
  }
  async function beginDirections(
    candidate: DiscoveryParking,
    confirmed: boolean,
  ) {
    navigationActionGeneration.current++
    drive.stop(false)
    clearRoute()
    directNavigation.cancel()
    entranceRequest.current?.abort()
    const request = new AbortController()
    entranceRequest.current = request
    const context = getNavigationState()
    setEntranceCheck(true)
    setEntranceError(null)
    let record: DiscoveryParking
    try {
      record = await refreshReviewedParking(
        candidate,
        { url: config.supabaseUrl, publicKey: config.supabaseKey },
        request.signal,
      )
      if (
        request.signal.aborted ||
        !sameNavigationContext(context, getNavigationState())
      )
        return
    } catch (error) {
      if (
        !request.signal.aborted &&
        sameNavigationContext(context, getNavigationState())
      ) {
        const message =
          error instanceof Error
            ? error.message
            : 'Current entrance approval could not be checked. No route was started.'
        setEntranceError(message)
        setNavigationMessage(message)
        updateNavigation({ consent: false }, 'replace')
      }
      return
    } finally {
      if (entranceRequest.current === request) setEntranceCheck(false)
    }
    const approvedEntrance = parkingDestination(record, currentLocation)
    if (!approvedEntrance) return
    track({
      name: 'directions_tapped',
      target_type: 'parking',
      navigation_provider: 'in_app',
    })
    setRouteTarget({
      name: parkingTitle(record),
      coordinate: approvedEntrance,
      parking: record,
    })
    updateNavigation(
      {
        route: true,
        consent: false,
        searching: false,
        panel: null,
        selectedId: record.id,
      },
      confirmed ? 'replace' : 'push',
    )
    setRejected(new Set())
    setParkedHere(false)
    setNavigationMessage(null)
    void loadRoute(
      (origin) => {
        const coordinate = parkingDestination(record, origin)
        if (!coordinate) {
          setRouteTarget(null)
          throw new Error(
            'Parking entrance authorization expired. Refresh the parking record before requesting directions.',
          )
        }
        setRouteTarget({
          name: parkingTitle(record),
          coordinate,
          parking: record,
        })
        return coordinate
      },
      async (signal) => {
        const origin = await location.locate()
        if (!signal.aborted) directNavigation.request(origin !== null)
        return origin
      },
    )
  }
  async function externalRoute(provider: 'google' | 'apple' | 'waze') {
    if (!routeTarget) return
    entranceRequest.current?.abort()
    const request = new AbortController()
    entranceRequest.current = request
    const context = getNavigationState()
    setEntranceCheck(true)
    setEntranceError(null)
    try {
      const current = routeTarget.parking
        ? await refreshReviewedParking(
            routeTarget.parking,
            { url: config.supabaseUrl, publicKey: config.supabaseKey },
            request.signal,
          )
        : null
      if (
        request.signal.aborted ||
        !sameNavigationContext(context, getNavigationState())
      )
        return
      const coordinate = current
        ? parkingDestination(current, null)
        : routeTarget.coordinate
      if (!coordinate)
        throw new Error(
          'Current entrance approval is unavailable. No Maps handoff was made.',
        )
      await Linking.openURL(directionsUrl(coordinate, provider))
    } catch (error) {
      if (
        !request.signal.aborted &&
        sameNavigationContext(context, getNavigationState())
      )
        setEntranceError(
          error instanceof Error
            ? error.message
            : 'Maps could not be opened. Try again.',
        )
    } finally {
      if (entranceRequest.current === request) setEntranceCheck(false)
    }
  }
  function viewed(record: DiscoveryParking) {
    void local.viewed(record)
    if (record.sourceKind !== 'sample')
      track({
        name: 'parking_viewed',
        parking_kind: record.kind,
        source_kind: record.sourceKind,
        verification: record.verification,
      })
  }
  function favorite(record: DiscoveryParking) {
    if (savingFavorite.current) return
    savingFavorite.current = true
    const adding = !local.state.favorites.some(
      (item) => item.key === recordKey(record),
    )
    void local
      .favorite(record)
      .then((saved) => {
        if (saved)
          setToast({
            message: adding ? 'Parking saved' : 'Parking removed',
            undo: () => {
              void local.favorite(record)
              setToast(null)
            },
          })
        if (saved && adding && record.sourceKind !== 'sample')
          track({
            name: 'favorite_added',
            parking_kind: record.kind,
            source_kind: record.sourceKind,
          })
      })
      .finally(() => {
        savingFavorite.current = false
      })
  }
  function select(id: string) {
    setAreaRefresh(false)
    if (searchActive) {
      navigation.close({
        searching: false,
        query: nav.query,
        searchPoint: nav.searchPoint,
      })
      return
    }
    const record = visible.find((item) => item.id === id)
    if (!record) return
    clearRoute()
    setRouteTarget(null)
    if (selected?.id === id) {
      setSelected(null)
      return
    }
    setSelected(record)
    viewed(record)
  }
  function changeFilter(next: DiscoveryFilter) {
    track({ name: 'filter_used', filter: 'kind', value: next })
    clearRoute()
    setRouteTarget(null)
    updateNavigation({
      filter: next === filter ? 'all' : next,
      fees: 'all',
      selectedId: null,
      route: false,
    })
  }
  function startContribution(record?: DiscoveryParking, restrictions = '') {
    if (nav.route) drive.stop(false)
    clearRoute()
    setRouteTarget(null)
    if (record) {
      setForm({
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        intent: 'correction',
        targetId: record.id,
        kind: record.kind,
        geometry: record.geometry,
        side: record.side,
        name: record.name,
        restrictions,
        hours: record.hours ?? '',
        fees: record.fees ?? '',
        photoUri: null,
        createdAt: new Date().toISOString(),
        status: 'local_pending_review',
      })
    } else {
      const point: Coordinate = [
        (viewport.west + viewport.east) / 2,
        (viewport.south + viewport.north) / 2,
      ]
      setForm({
        id: `local-${now.getTime()}`,
        intent: 'add',
        targetId: null,
        kind: 'lot',
        geometry: { type: 'Point', coordinates: point },
        side: 'unknown',
        name: '',
        restrictions: '',
        hours: '',
        fees: '',
        photoUri: null,
        createdAt: new Date().toISOString(),
        status: 'local_pending_review',
      })
      setDrawing(false)
      setPoints([point])
      setAdjusted(null)
    }
    updateNavigation({ panel: 'add', route: false, selectedId: null })
  }
  function continueContribution() {
    const point = points[0]
    if (!point || (kind === 'street' && points.length < 2)) return
    const geometry =
      kind === 'street'
        ? { type: 'LineString' as const, coordinates: points }
        : { type: 'Point' as const, coordinates: point }
    setForm(
      adjusted
        ? {
            ...adjusted,
            kind,
            geometry,
            side: kind === 'street' ? adjusted.side : 'unknown',
          }
        : {
            id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            intent: 'add',
            targetId: null,
            kind,
            geometry,
            side: 'unknown',
            name: '',
            restrictions: '',
            hours: '',
            fees: '',
            photoUri: null,
            createdAt: new Date().toISOString(),
            status: 'local_pending_review',
          },
    )
    setDrawing(false)
  }
  async function save(draft: ParkingContribution) {
    if (storage !== 'ready')
      return 'Your draft could not be saved. Open Map information to try loading or clear drafts on this device.'
    if (saving.current) return 'A draft is already being saved.'
    const normalized = {
      ...draft,
      name: draft.name.trim(),
      restrictions: draft.restrictions.trim(),
      hours: draft.hours.trim(),
      fees: draft.fees.trim(),
      createdAt: new Date().toISOString(),
    }
    const issue = validateContribution(normalized, drafts, Date.now())
    if (issue) return issue
    saving.current = true
    try {
      const next = [normalized, ...drafts]
      await writeContributions(next)
      setDrafts(next)
      setForm(null)
      const preview = draftParking(normalized)
      updateNavigation(
        {
          panel: null,
          selectedId:
            normalized.intent === 'add' ? preview.id : normalized.targetId,
          ...(normalized.intent === 'add'
            ? { filter: 'all' as const, fees: 'all' as const }
            : {}),
          center: anchor(preview.geometry),
          position: 'compact',
        },
        'replace',
      )
      setToast({
        message:
          normalized.intent === 'add'
            ? 'Private parking draft saved'
            : 'Correction draft saved',
        undo: () => {
          const remaining = next.filter((item) => item.id !== normalized.id)
          void writeContributions(remaining)
            .then(() => {
              setDrafts(remaining)
              updateNavigation({
                selectedId:
                  normalized.intent === 'add' ? null : normalized.targetId,
              })
              setToast(null)
            })
            .catch(() =>
              setToast((current) =>
                current
                  ? { ...current, message: 'Couldn’t undo. Try again.' }
                  : null,
              ),
            )
        },
      })
      track({
        name: 'contribution_saved',
        intent: normalized.intent,
        parking_kind: normalized.kind,
        storage: 'local',
      })
      return null
    } catch {
      return 'This draft could not be saved on your device. Free some storage and try again.'
    } finally {
      saving.current = false
    }
  }
  const locationMessage =
    location.status === 'denied'
      ? 'Location is off. Search or explore manually, or enable Parkey in device settings.'
      : location.status === 'error'
        ? 'Couldn’t get your location. Check location services and try again.'
        : null

  const discoveryVisible = !drawing && !nav.route && panel === null
  const controlsVisible = screenHeight - sheetHeight > topOverlayHeight + 122
  const cameraBottom =
    routeTarget && nav.route
      ? routeHeight
      : drawing
        ? drawingPanelHeight
        : discoveryVisible
          ? sheetHeight
          : 0
  const cameraPadding = discoveryCameraPadding(
    screenHeight,
    topOverlayHeight,
    cameraBottom,
  )
  function centerOnMyLocation() {
    void location.locate().then((point) => {
      if (point) {
        clearDestination()
        navigation.update(
          {
            selectedId: null,
            center: point,
            searching: false,
            panel: null,
            route: false,
          },
          'replace',
        )
      }
    })
  }

  const searchHeader = (
    <View
      style={{
        paddingHorizontal: 16,
        paddingBottom: 14,
        flex: searchActive ? 1 : undefined,
      }}
    >
      <DestinationSearch
        layout="sheet"
        fillSheet
        placeholder="Where to park today?"
        onSaved={() => setPanel('saved')}
        query={nav.query}
        active={searchActive}
        onQuery={(query) =>
          updateNavigation({ query, searchPoint: null }, 'replace')
        }
        onLocate={() => {
          updateNavigation({
            searching: false,
            query: '',
            searchPoint: null,
            selectedId: null,
            position: 'medium',
          })
          void location.locate().then((point) => {
            if (point) {
              clearDestination()
              updateNavigation({ center: point })
            }
          })
        }}
        center={target.coordinate}
        onActive={(active) => {
          if (active)
            updateNavigation({
              searching: true,
              position: 'expanded',
            })
          else
            closeNavigation({
              searching: false,
              query: nav.query,
              searchPoint: nav.searchPoint,
            })
        }}
        onSelect={(found) => {
          const matches = partitionParking(
            [...parking.knownRecords, ...previews],
            filter,
            feeFilter,
          ).matched
          const closest = rankParking(matches, found.coordinate)[0]
          const focus =
            closest &&
            distanceMeters(anchor(closest.geometry), found.coordinate) <= 1500
              ? anchor(closest.geometry)
              : found.coordinate
          updateNavigation({
            searching: false,
            query: found.name,
            searchPoint: found.coordinate,
            selectedId: null,
            center: [focus[0], focus[1]],
            position: 'medium',
          })
        }}
      />
    </View>
  )
  const filterStrip = (
    <ScrollView
      horizontal
      style={styles.filterStrip}
      testID="parking-filters"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filters}
    >
      <Choice
        selected={filter === 'all' && feeFilter === 'all'}
        onPress={() => {
          changeFilter('all')
          setFeeFilter('all')
        }}
      >
        All
      </Choice>
      <Choice
        selected={feeFilter === 'free'}
        onPress={() => {
          changeFilter('all')
          setFeeFilter('free')
        }}
      >
        Free
      </Choice>
      <Choice
        selected={filter === 'street'}
        onPress={() => changeFilter('street')}
      >
        Street
      </Choice>
      <Choice
        selected={filter === 'garage'}
        onPress={() => changeFilter('garage')}
      >
        Garage
      </Choice>
    </ScrollView>
  )
  return (
    <View
      testID={mapStatus === 'ready' ? 'discovery-map-ready' : 'discovery-map'}
      style={styles.screen}
    >
      <StatusBar style="dark" />
      {entranceCheck || entranceError ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute',
            top: insets.top + 8,
            left: 12,
            right: 12,
            zIndex: 30,
            padding: 12,
            borderRadius: 12,
            backgroundColor: colors.surface,
          }}
        >
          <Text
            accessibilityRole={entranceError ? 'alert' : 'text'}
            testID="parking-entrance-check"
            style={ui.body}
          >
            {entranceError || 'Checking current entrance and visitor access…'}
          </Text>
          {entranceError ? (
            <Button secondary onPress={() => setEntranceError(null)}>
              Dismiss entrance notice
            </Button>
          ) : null}
        </View>
      ) : null}
      <View
        ref={mapInterface}
        testID="map-interface"
        style={StyleSheet.absoluteFill}
        aria-hidden={fullPageActive}
        importantForAccessibility={
          fullPageActive ? 'no-hide-descendants' : 'auto'
        }
        pointerEvents={fullPageActive ? 'none' : 'box-none'}
      >
        {topOverlayHeight > 0 ? (
          <ParkingMap
            key={mapRevision}
            records={parking.canQuery ? visible : []}
            featuredId={
              parking.canQuery && currentLocation
                ? (ranked[0]?.id ?? null)
                : null
            }
            selectedId={
              (nav.route ? routeTarget?.parking?.id : null) ??
              selected?.id ??
              null
            }
            route={routeState.route}
            target={target}
            cameraPadding={cameraPadding}
            parkedLocation={local.state.parked?.coordinate ?? null}
            navigation={mapNavigation}
            userLocation={
              nav.route ? (drive.position ?? currentLocation) : currentLocation
            }
            destination={
              routeTarget && nav.route
                ? routeTarget.coordinate
                : (destination?.coordinate ?? null)
            }
            draftPoints={drawing ? points : EMPTY_POINTS}
            drawing={drawing}
            searching={searchActive}
            onSelect={(id) => {
              if (!nav.route) select(id)
            }}
            onMapPress={(point) => {
              if (nav.route) return
              if (searchActive) {
                closeNavigation({
                  searching: false,
                  query: nav.query,
                  searchPoint: nav.searchPoint,
                })
                Keyboard.dismiss()
                return
              }
              if (drawing && isCoordinate(point))
                setPoints((current) =>
                  kind === 'street'
                    ? [...current, point].slice(0, 12)
                    : [point],
                )
              else if (nav.selectedId) setSelected(null)
              else if (nav.route) endNavigation()
            }}
            onPan={() => {
              if (!nav.route) navigationViewportPrivate.current = false
            }}
            onViewport={(next) => {
              if (!nav.route && !navigationViewportPrivate.current)
                updateViewport(next)
            }}
            onStatus={setMapStatus}
          />
        ) : null}

        <View
          pointerEvents="box-none"
          onLayout={(event) =>
            setTopOverlayHeight(event.nativeEvent.layout.height)
          }
          style={[styles.top, { paddingTop: insets.top + 10 }]}
        >
          <View pointerEvents="box-none" style={styles.searchOverlay}>
            {navigating ? (
              <NavigationBanner
                step={drive.progress?.next}
                then={
                  drive.progress?.next
                    ? routeState.route?.steps[
                        (routeState.route?.steps.indexOf(drive.progress.next) ??
                          -2) + 1
                      ]
                    : undefined
                }
                distance={drive.progress?.maneuverDistance ?? 0}
                rerouting={drive.rerouting}
              />
            ) : nav.route || selected || panel !== null ? null : drawing ? (
              <View style={[styles.drawHeader, ui.shadow]}>
                <View style={ui.flex}>
                  <Text style={ui.heading}>Mark the parking location</Text>
                  <Text style={ui.small}>
                    {kind === 'street'
                      ? 'Tap along the street, in order. Up to 12 points.'
                      : 'Tap the map to place a pin.'}
                  </Text>
                </View>
                <IconButton
                  icon="close"
                  label="Cancel adding parking"
                  onPress={() => {
                    setDrawing(false)
                    setPoints([])
                    setAdjusted(null)
                  }}
                />
              </View>
            ) : null}
          </View>
          {connectivity.offline &&
          discoveryVisible &&
          !selected &&
          !searchActive ? (
            <View
              accessibilityLiveRegion="polite"
              style={[styles.offlineBanner, ui.shadow]}
            >
              <View style={styles.offlineBadge}>
                <FigmaAsset name="offline" size={20} />
              </View>
              <View style={ui.flex}>
                <Text style={ui.heading}>You’re offline</Text>
                <Text style={ui.small}>
                  Saved places and your car are still available.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void connectivity.recheck().then((online) => {
                    if (online) {
                      setRevision((value) => value + 1)
                      setMapRevision((value) => value + 1)
                    }
                  })
                }}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={[ui.small, ui.link]}>Try again</Text>
              </Pressable>
            </View>
          ) : browseState === 'loading' &&
            discoveryVisible &&
            !selected &&
            !searchActive ? (
            <View
              accessibilityLiveRegion="polite"
              style={[styles.loadingToast, ui.shadow]}
            >
              <View style={styles.loadingDot} />
              <Text style={ui.small}>Finding spots near you…</Text>
            </View>
          ) : null}
          {samples ? (
            <View style={styles.warning}>
              <Text style={styles.warningText}>
                SAMPLE PARKING · Not real parking locations
              </Text>
            </View>
          ) : null}
          {discoveryVisible && !selected && sheet.position !== 'expanded' ? (
            <View pointerEvents="box-none" style={styles.mapNotices}>
              {drive.resumable && resumeTarget ? (
                <View
                  accessibilityLiveRegion="polite"
                  style={[styles.resume, ui.shadow]}
                >
                  <Text style={[ui.body, { flexShrink: 1 }]}>
                    Navigation ended
                  </Text>
                  <Button
                    secondary
                    onPress={() => {
                      if (resumeTarget.parking) {
                        void beginDirections(resumeTarget.parking, false)
                        return
                      }
                      setRouteTarget(resumeTarget)
                      updateNavigation({
                        route: true,
                        selectedId: null,
                      })
                      void loadRoute(
                        resumeTarget.coordinate,
                        location.locate,
                      ).then((route) => {
                        if (route) drive.start()
                      })
                    }}
                  >
                    Resume
                  </Button>
                </View>
              ) : null}
              {discoveryVisible && local.state.parked ? (
                <View style={styles.carChip}>
                  <Button
                    secondary
                    onPress={() => {
                      const parked = local.state.parked
                      if (parked)
                        void Linking.openURL(
                          `https://www.google.com/maps/dir/?api=1&destination=${parked.coordinate[1]},${parked.coordinate[0]}&travelmode=walking`,
                        )
                    }}
                  >
                    Your car ·{' '}
                    {Math.floor(
                      (now.getTime() - Date.parse(local.state.parked.savedAt)) /
                        3600000,
                    ) > 0
                      ? `${Math.floor((now.getTime() - Date.parse(local.state.parked.savedAt)) / 3600000)} h ago`
                      : Math.floor(
                            (now.getTime() -
                              Date.parse(local.state.parked.savedAt)) /
                              60000,
                          ) > 0
                        ? `${Math.floor((now.getTime() - Date.parse(local.state.parked.savedAt)) / 60000)} min ago`
                        : 'Just now'}{' '}
                    · Directions
                  </Button>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {discoveryVisible &&
        !selected &&
        !searchActive &&
        sheet.position !== 'expanded' ? (
          <View style={[styles.filterOverlay, { bottom: sheetHeight + 12 }]}>
            {filterStrip}
          </View>
        ) : null}
        {discoveryVisible && !searchActive && sheet.position !== 'expanded' ? (
          <>
            {controlsVisible ? (
              <View
                style={[
                  styles.controls,
                  { bottom: sheetHeight + (selected ? 12 : 72) },
                ]}
              >
                <IconButton
                  style={[
                    ui.shadow,
                    {
                      backgroundColor: colors.surface,
                      width: 56,
                      height: 56,
                      borderWidth: 2,
                      borderColor: colors.border,
                    },
                  ]}
                  icon="locate"
                  color={colors.ink}
                  label="Center on my location"
                  disabled={location.status === 'locating'}
                  onPress={centerOnMyLocation}
                />
              </View>
            ) : null}
            {!selected && sheet.position === 'compact' ? (
              <View
                style={[
                  styles.bottom,
                  {
                    bottom: sheetHeight + 140,
                    right: 16,
                  },
                ]}
              >
                {mapStatus === 'error' && !connectivity.offline ? (
                  <StatusMessage
                    message="The map couldn’t load. Check your connection."
                    onRetry={() => {
                      setMapStatus('loading')
                      setMapRevision((current) => current + 1)
                    }}
                  />
                ) : null}
                {parking.status === 'error' &&
                !samples &&
                !connectivity.offline ? (
                  <StatusMessage
                    message={parkingError}
                    onRetry={() => setRevision((current) => current + 1)}
                  />
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}

        {drawing ? (
          <View
            onLayout={(event) =>
              setDrawingPanelHeight(event.nativeEvent.layout.height)
            }
            style={[
              styles.drawingPanel,
              ui.shadow,
              { paddingBottom: Math.max(insets.bottom, 18) },
            ]}
          >
            <Text style={ui.eyebrow}>WHAT KIND OF PARKING?</Text>
            <View style={[ui.row, { flexWrap: 'wrap', gap: 6 }]}>
              {(['street', 'lot', 'garage'] as const).map((value) => (
                <Choice
                  key={value}
                  selected={kind === value}
                  onPress={() => {
                    setKind(value)
                    setPoints([])
                  }}
                >
                  {kindLabels[value]}
                </Choice>
              ))}
            </View>
            <View style={ui.row}>
              <Text style={[ui.small, ui.flex]}>
                {kind === 'street'
                  ? `${points.length} points · minimum 2`
                  : points.length
                    ? 'Pin placed. Tap again to move it.'
                    : 'Tap the location on the map.'}
              </Text>
              <IconButton
                icon="undo"
                label="Undo last map point"
                disabled={!points.length}
                onPress={() => setPoints((current) => current.slice(0, -1))}
              />
            </View>
            <Button
              disabled={points.length < (kind === 'street' ? 2 : 1)}
              onPress={continueContribution}
            >
              Add information
            </Button>
          </View>
        ) : null}
        {nav.route && drive.phase === 'arrived' ? <ArrivalCelebration /> : null}
        {navigating && !drive.following ? (
          <View style={[styles.controls, { bottom: routeHeight + 40 }]}>
            <IconButton
              icon="locate"
              label="Re-center map"
              onPress={drive.recenter}
              style={ui.shadow}
            />
          </View>
        ) : null}
        {routeTarget && nav.route ? (
          <RouteDetails
            key={routeTarget.parking?.id ?? 'car'}
            destinationName={routeTarget.name}
            onExternal={(provider) => {
              void externalRoute(provider)
            }}
            checkingEntrance={entranceCheck}
            state={routeState}
            phase={drive.phase}
            starting={drive.starting}
            denied={drive.denied}
            message={
              navigationMessage ??
              drive.message ??
              (drive.phase === 'arrived' ? local.error : null)
            }
            remainingDistance={drive.progress?.remainingDistance}
            remainingDuration={drive.progress?.remainingDuration}
            saving={local.busy || location.status === 'locating'}
            parked={parkedHere}
            onAnswer={
              routeTarget.parking
                ? (answer) => {
                    const record = routeTarget.parking
                    if (record)
                      startContribution(
                        record,
                        `Maximum stay: ${answer === 'No limit' ? 'No time limit' : answer}`,
                      )
                  }
                : null
            }
            onStart={() => {
              setNavigationMessage(null)
              navigationViewportPrivate.current = true
              if (routeTarget.parking)
                void beginDirections(routeTarget.parking, false)
              else drive.start()
            }}
            onPark={() => {
              if (saving.current || parkedHere) return
              saving.current = true
              setNavigationMessage(null)
              void location
                .locate()
                .then(async (point) => {
                  if (!point) {
                    setNavigationMessage(
                      'Your car location could not be saved. Check location access and try again.',
                    )
                    return
                  }
                  const previous = local.state.parked
                  if (await local.park(point)) {
                    setParkedHere(true)
                    track({ name: 'parked_spot_saved' })
                    setToast({
                      message: 'Saved where you parked',
                      undo: () => {
                        void local.restoreParked(previous).then((saved) => {
                          if (saved) {
                            setParkedHere(false)
                            setToast(null)
                          }
                        })
                      },
                    })
                  }
                })
                .finally(() => {
                  saving.current = false
                })
            }}
            onNext={
              routeTarget.parking &&
              nextParking(
                parking.knownRecords,
                routeTarget.parking,
                drive.position ?? routeTarget.coordinate,
                rejected,
              )
                ? () => {
                    const current = routeTarget.parking
                    if (!current) return
                    setParkedHere(false)
                    setRejected(new Set([...rejected, current.id]))
                    const next = nextParking(
                      parking.knownRecords,
                      current,
                      drive.position ?? routeTarget.coordinate,
                      rejected,
                    )
                    if (!next) {
                      setNavigationMessage(
                        'No other mapped parking of this type nearby.',
                      )
                      return
                    }
                    drive.stop(false)
                    void beginDirections(next, false)
                  }
                : null
            }
            onHeightChange={setRouteHeight}
            onClose={endNavigation}
            onRetry={() =>
              routeTarget.parking
                ? void beginDirections(routeTarget.parking, false)
                : void loadRoute(routeTarget.coordinate, location.locate)
            }
          />
        ) : null}
        {panel === 'add' && !drawing ? (
          <ContributionForm
            draft={
              form ?? {
                id: `local-${now.getTime()}`,
                intent: 'add',
                targetId: null,
                kind: 'lot',
                geometry: { type: 'Point', coordinates: nav.center },
                side: 'unknown',
                name: '',
                restrictions: '',
                hours: '',
                fees: '',
                photoUri: null,
                createdAt: new Date().toISOString(),
                status: 'local_pending_review',
              }
            }
            onSave={save}
            onClose={() => {
              setPoints([])
              setAdjusted(null)
              closeNavigation({ panel: null })
            }}
            onAdjust={(current) => {
              setAdjusted(current)
              setKind(current.kind)
              setPoints(
                current.geometry.type === 'Point'
                  ? [current.geometry.coordinates]
                  : current.geometry.coordinates,
              )
              setForm(null)
              setDrawing(true)
            }}
          />
        ) : null}
        {discoveryVisible ? (
          <DiscoverySheet
            position={sheet.position}
            getScrollOffset={
              selected ? getParkingScrollOffset : getBrowseScrollOffset
            }
            contentHeight={
              selected && sheetContent?.id === selected.id
                ? sheetContent.height
                : 0
            }
            keyboardAware={searchActive}
            bottom={!selected && !searchActive ? TAB_BAR_HEIGHT + 12 : 0}
            previewHeight={
              !selected && !searchActive ? (stateCard ? 180 : 124) : 0
            }
            header={!selected ? searchHeader : undefined}
            overlayHeight={topOverlayHeight}
            selected={!!selected}
            title={selected ? parkingTitle(selected) : resultsTitle}
            summary={`${visible.length} mapped ${visible.length === 1 ? 'location' : 'locations'} · ${filter === 'all' ? 'all parking' : filter === 'facilities' ? 'lots & garages' : filter === 'lot' ? 'lots' : filter === 'garage' ? 'garages' : 'street parking'}`}
            onPositionChange={changeSheetPosition}
            onHeightChange={setSheetHeight}
            onClose={() =>
              selected ? setSelected(null) : changeSheetPosition('compact')
            }
          >
            {selected ? (
              <ParkingDetails
                key={selected.id}
                parking={selected}
                onContentHeightChange={(height) =>
                  setSheetContent((current) =>
                    current?.id === selected.id && current.height === height
                      ? current
                      : { id: selected.id, height },
                  )
                }
                onScrollOffsetChange={(offset) => {
                  parkingScrollOffset.current = offset
                }}
                now={now}
                onAddDetails={() => startContribution(selected)}
                location={currentLocation}
                favorite={local.state.favorites.some(
                  (item) => item.key === recordKey(selected),
                )}
                onFavorite={() => favorite(selected)}
                favoriteDisabled={local.status !== 'ready'}
                storageError={local.error}
                expanded={sheet.position === 'expanded'}
                onDirections={() => startDirections(selected)}
              />
            ) : null}
            {!selected && !searchActive && sheet.position !== 'expanded' ? (
              browseState === 'loading' ? (
                <NearbyLoading />
              ) : stateCard ? (
                <ScrollView
                  style={ui.sheetScroll}
                  contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingBottom: 8,
                  }}
                >
                  {stateCard}
                </ScrollView>
              ) : (
                <FlatList
                  horizontal
                  data={ranked}
                  keyExtractor={(record) => record.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.nearbyStrip}
                  renderItem={({ item: record }) => (
                    <NearbyCard
                      parking={record}
                      reference={reference}
                      now={now}
                      onPress={() => select(record.id)}
                      onGo={() => startDirections(record)}
                    />
                  )}
                />
              )
            ) : null}
            <View
              style={[
                ui.flex,
                (selected || searchActive || sheet.position !== 'expanded') && {
                  display: 'none',
                },
              ]}
              onFocus={(event) => {
                if (
                  Platform.OS !== 'web' ||
                  nav.position === 'expanded' ||
                  !(event.target instanceof HTMLElement) ||
                  !(event.currentTarget instanceof HTMLElement)
                )
                  return
                if (
                  event.target.getBoundingClientRect().bottom >
                  event.currentTarget.getBoundingClientRect().bottom
                )
                  changeSheetPosition('expanded')
              }}
            >
              <FlatList
                ref={list}
                onScroll={({ nativeEvent }) => {
                  browseScrollOffset.current = nativeEvent.contentOffset.y
                }}
                scrollEventThrottle={16}
                nestedScrollEnabled
                data={ranked}
                keyExtractor={(record) => record.id}
                onScrollToIndexFailed={({ averageItemLength, index }) =>
                  list.current?.scrollToOffset({
                    offset: averageItemLength * index,
                    animated: false,
                  })
                }
                style={[ui.sheetScroll, ui.flex]}
                scrollEnabled={sheet.position !== 'compact'}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 16 }}
                ListHeaderComponent={
                  <View style={styles.sheetContent}>
                    <View style={styles.resultsHeading}>
                      <Text accessibilityRole="header" style={ui.sectionTitle}>
                        {resultsTitle}
                      </Text>
                      <Text style={ui.small}>
                        {visible.length} mapped{' '}
                        {visible.length === 1 ? 'location' : 'locations'}
                      </Text>
                    </View>
                    {browseState === 'location-off' && ranked.length > 0
                      ? stateCard
                      : null}
                    {location.status === 'error' ||
                    (!connectivity.offline &&
                      (mapStatus === 'error' ||
                        (parking.status === 'error' && !samples))) ? (
                      <StatusMessage
                        message={
                          location.status === 'error'
                            ? (locationMessage ?? 'Couldn’t get your location.')
                            : mapStatus === 'error'
                              ? 'The map couldn’t load.'
                              : parkingError
                        }
                        onRetry={() => {
                          if (locationMessage) {
                            centerOnMyLocation()
                            return
                          }
                          setRevision((current) => current + 1)
                          setMapRevision((current) => current + 1)
                        }}
                      />
                    ) : undefined}
                  </View>
                }
                renderItem={({ item: record }) => (
                  <View style={styles.resultRow}>
                    <ParkingRow
                      parking={record}
                      reference={reference}
                      onPress={() => select(record.id)}
                      onDirections={() => startDirections(record)}
                      onFavorite={() => favorite(record)}
                      favorite={local.state.favorites.some(
                        (item) => item.key === recordKey(record),
                      )}
                      disabled={local.status !== 'ready'}
                      selected={selected?.id === record.id}
                      testID={`parking-row-${record.id}`}
                    />
                  </View>
                )}
                ListEmptyComponent={
                  browseState === 'loading' ? (
                    <LoadingRows />
                  ) : (
                    <View style={{ padding: 16 }}>{stateCard}</View>
                  )
                }
              />
            </View>
          </DiscoverySheet>
        ) : null}
        {toast ? (
          <View
            style={{
              position: 'absolute',
              top: insets.top + 12,
              left: 16,
              right: 16,
              zIndex: 20,
            }}
          >
            <UndoToast message={toast.message} onUndo={toast.undo} />
          </View>
        ) : null}
        {areaRefresh &&
        farFromCenter &&
        discoveryVisible &&
        !selected &&
        sheet.position !== 'expanded' ? (
          <View
            style={{
              position: 'absolute',
              bottom: sheetHeight + 76,
              alignSelf: 'center',
            }}
          >
            <Button
              secondary
              onPress={() => {
                searchedCenter.current = [
                  (viewport.west + viewport.east) / 2,
                  (viewport.south + viewport.north) / 2,
                ]
                setAreaRefresh(false)
                setRevision((current) => current + 1)
              }}
            >
              Search this area
            </Button>
          </View>
        ) : null}
        {consent.confirmation}
        {(!discoveryVisible ||
          selected ||
          (controlsVisible && sheet.position !== 'expanded')) &&
        !searchActive ? (
          <View
            style={[
              styles.mapInfo,
              {
                bottom:
                  Math.max(cameraBottom, insets.bottom) +
                  (discoveryVisible && !selected ? 72 : 12),
              },
            ]}
          >
            <MapAttribution onPress={() => setPanel('info')} />
          </View>
        ) : null}
      </View>
      {locationSettingsOpen ? (
        <ModalSheet
          title="Location settings"
          onClose={() => setLocationSettingsOpen(false)}
        >
          <View style={{ padding: 24, gap: 16 }}>
            <Text style={ui.body}>
              {Platform.OS === 'web'
                ? 'Open your browser’s site settings, allow location for Parkey, then try again.'
                : 'Enable location access for Parkey in your device settings, then try again.'}
            </Text>
            <Button
              onPress={() => {
                setLocationSettingsOpen(false)
                centerOnMyLocation()
              }}
            >
              Try location again
            </Button>
          </View>
        </ModalSheet>
      ) : null}
      {panel === 'saved' ? (
        <SavedPlaces
          local={local}
          onLocateAddress={location.locate}
          onClose={() => setPanel(null)}
          onAddPlace={() =>
            updateNavigation({
              panel: null,
              selectedId: null,
              searching: true,
              position: 'expanded',
            })
          }
          records={[...parking.knownRecords, ...previews]}
          locating={location.status === 'locating'}
          locationError={saveLocationError ?? locationMessage}
          onSaveParked={() => {
            setSaveLocationError(null)
            void location.locate().then(async (point) => {
              if (!point) {
                setSaveLocationError(
                  'Your location could not be saved. Check location access and try again.',
                )
                return
              }
              if (await local.park(point)) {
                center(point)
                track({ name: 'parked_spot_saved' })
              }
            })
          }}
          onCenter={(point) => {
            updateNavigation(
              { panel: null, selectedId: null, center: point, route: false },
              'replace',
            )
          }}
          onDirections={() => {
            const parked = local.state.parked
            if (parked)
              void Linking.openURL(
                `https://www.google.com/maps/dir/?api=1&destination=${parked.coordinate[1]},${parked.coordinate[0]}&travelmode=walking`,
              )
          }}
          onSelect={(record) => {
            clearRoute()
            setRouteTarget(null)
            updateNavigation(
              {
                panel: null,
                selectedId: record.id,
                center: anchor(record.geometry),
                route: false,
              },
              'replace',
            )
            viewed(record)
          }}
        />
      ) : null}
      {panel === 'you' ? (
        <ParkingProfile
          onClose={() => setPanel(null)}
          local={local}
          drafts={drafts}
          storage={storage}
          onInfo={() => setPanel('info')}
          onDeleteDraft={async (id) => {
            if (saving.current || storage !== 'ready') return false
            saving.current = true
            try {
              const next = drafts.filter((draft) => draft.id !== id)
              await writeContributions(next)
              setDrafts(next)
              return true
            } catch {
              return false
            } finally {
              saving.current = false
            }
          }}
        />
      ) : null}
      {menuOpen ? (
        <ModalSheet title="parkey" onClose={() => setMenuOpen(false)}>
          <View style={styles.menu}>
            {(
              [
                { label: 'Saved places', action: () => setPanel('saved') },
                { label: 'Add parking', action: () => startContribution() },
                { label: 'Your parking', action: () => setPanel('you') },
                { label: 'Map information', action: () => setPanel('info') },
              ] as const
            ).map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                onPress={() => {
                  setMenuOpen(false)
                  item.action()
                }}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && ui.pressed,
                ]}
              >
                <Text style={ui.heading}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </ModalSheet>
      ) : null}
      {panel === 'info' ? (
        <MapInformation
          samples={samples}
          onSamples={(enabled) => {
            clearRoute()
            setRouteTarget(null)
            setSamples(developmentSamplesEnabled(enabled, process.env.NODE_ENV))
            setSelected(null)
            if (enabled) center(PILOT_CENTER)
          }}
          drafts={drafts}
          setDrafts={setDrafts}
          storage={storage}
          onStorageReady={() => setStorage('ready')}
          onClose={() => setPanel(null)}
        />
      ) : null}
      {(discoveryVisible && !selected && !searchActive) || fullPageActive ? (
        <BottomNavigation
          selected={
            panel === 'saved' ? 'saved' : panel === 'you' ? 'you' : 'map'
          }
          bottom={insets.bottom}
          onAdd={() => startContribution()}
          onSelect={(tab) => setPanel(tab === 'map' ? null : tab)}
        />
      ) : null}
    </View>
  )
}

function StatusMessage({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <View style={styles.status}>
      <Text style={[ui.small, ui.flex]}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.retry, pressed && ui.pressed]}
      >
        <Text style={[ui.heading, ui.link]}>Retry</Text>
      </Pressable>
    </View>
  )
}
const styles = StyleSheet.create({
  offlineBanner: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  offlineBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.warningSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingToast: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderRadius: 999,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
  screen: { flex: 1, backgroundColor: colors.canvas },
  mapNotices: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  resume: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  carChip: { alignSelf: 'flex-start', maxWidth: '100%' },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    gap: 12,
  },
  searchOverlay: {
    width: '100%',
    paddingHorizontal: 16,
    maxWidth: 620,
    alignSelf: 'center',
  },
  mapHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  sheetContent: { gap: 24, paddingTop: 8, paddingBottom: 16 },
  resultsHeading: { gap: 6, paddingHorizontal: 24 },
  resultRow: { paddingHorizontal: 24 },
  menu: { paddingHorizontal: 24, paddingBottom: 16 },
  menuItem: { minHeight: 56, justifyContent: 'center' },
  filterOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    maxWidth: 620,
    marginHorizontal: 'auto',
  },
  nearbyStrip: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
    alignItems: 'flex-start',
  },
  nearbyEmpty: {
    width: 300,
    minHeight: 110,
    padding: 16,
    gap: 6,
    borderRadius: 24,
    backgroundColor: colors.soft,
  },
  filterStrip: { flexGrow: 0, flexShrink: 0 },
  filters: { gap: 8, paddingHorizontal: 16 },
  addParking: {
    minWidth: 96,
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: colors.positiveSurface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addParkingText: { color: colors.action, fontSize: 14, lineHeight: 20 },
  peek: { flex: 1, paddingHorizontal: 24, overflow: 'hidden' },
  unknownFees: { paddingTop: 16, fontFamily: fonts.semibold },
  mapInfo: { position: 'absolute', left: 16 },
  controls: {
    position: 'absolute',
    right: 16,
    gap: 12,
    alignItems: 'flex-end',
  },
  bottom: {
    position: 'absolute',
    left: 16,
    right: 16,
    gap: 8,
    maxWidth: 584,
    marginHorizontal: 'auto',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
    boxShadow: `inset 0px 0px 0px 1px ${colors.border}`,
  },
  retry: {
    borderRadius: 12,
    minWidth: 54,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warning: {
    backgroundColor: colors.warningSurface,
    padding: 10,
    borderRadius: 12,
  },
  warningText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 18,
    color: colors.amber,
  },
  drawHeader: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: 16,
  },
  drawingPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    gap: 16,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  panelContent: { paddingHorizontal: 24, paddingBottom: 24 },
})
