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
import type { FlatList } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useIsFocused } from 'expo-router/react-navigation'
import { AppearanceNavigation } from '../components/appearance-navigation'
import {
  ArchitecturePage,
  useArchitectureInsets,
} from '../components/architecture-page'
import { AppearanceScreen } from '../settings/settings-screen'
import { ParkingListPage } from './architecture-discovery'
import { MainDrawer } from './main-drawer'
import { useMainDrawer } from './main-drawer-state'
import { MainMapControls, MapParkingPanel } from './main-map-ui'
import type { MapParkingSummary } from './main-map-ui'

import { useTheme, createThemedStyles } from '../theme-provider'
import { discoveryState } from './discovery-state'
import { StateCard } from './state-card'
import { useConnectivity } from './use-connectivity'
import { ArrivalCelebration } from './arrival-celebration'
import { ParkingProfile } from './parking-profile'
import { ReportSubmission } from './report-submission'
import { createLocalDraftId } from './local-draft-id'
import { ContributionForm } from './contribution-form'
import { readContributions, writeContributions } from './contributions'
import type { Destination } from './data'
import { parkingNearDestination } from './places'
import { draftParking } from './draft-parking'
import { useNavigation } from './use-navigation'
import { useDirectionsConsent } from './use-directions-consent'
import { MapAttribution } from './discovery-sheet'
import { SearchAttribution } from './search-credit'
import { partitionParking } from './filters'
import { MapInformation } from './information'
import { recordKey } from './local-state'
import { SavedPlaces } from './saved-places'
import { useLocalState } from './use-local-state'
import { track } from './telemetry'
import { config } from './config'
import { refreshReviewedParking } from './parking-navigation-refresh'
import {
  anchor,
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
import ParkingMap from './parking-map'
import type { CameraTarget } from './map-types'
import { useMapCallback, useSettledViewport } from './use-map-events'
import { viewportChanged } from './viewport-changes'
import {
  parkingDestination,
  parkingDetailData,
  parkingHoursFacts,
} from './parking-detail-data'
import { ParkingDetails } from './parking-details'
import { FavoriteFeedback } from './favorite-feedback'
import { EmptyResultsPage } from './empty-pages'
import { DirectionsChoice } from './directions-choice'
import { LocationPage } from './location-page'
import { ParkingFiltersPage } from './parking-filters-page'
import {
  developmentSamplesEnabled,
  displaySourceLabel,
  millisecondsToNextMinute,
  parkingTitle,
} from './presentation'
import { MotionLayer, MotionView } from './motion'
import { NavigationBanner, RouteDetails } from './route-details'
import { nextParking } from './drive-math'
import { useDriveNavigation } from './use-drive-navigation'
import { sampleParking } from './sample-data'
import { DestinationSearch } from './search'
import { FigmaAsset } from './figma-assets'
import { ModalSheet } from './sheets'
import { discoveryCameraPadding } from './sheet-state'
import { fonts } from './typography'
import {
  Button,
  Choice,
  detailsPeekHeight,
  IconButton,
  LoadingRows,
  UndoToast,
  useUI,
} from './ui'
import { useGrantedLocation } from './use-granted-location'
import { useDirectDirections } from './use-direct-directions'
import { useLocation } from './use-location'
import { useParking } from './use-parking'
import { useRoute } from './use-route'

const EMPTY_POINTS: Coordinate[] = []
const EMPTY_RECORDS: DiscoveryParking[] = []
function sameNavigationContext(
  before: ReturnType<typeof useNavigation>['state'],
  after: ReturnType<typeof useNavigation>['state'],
) {
  return (
    before.selectedId === after.selectedId &&
    before.panel === after.panel &&
    before.searching === after.searching &&
    before.route === after.route &&
    before.directions === after.directions
  )
}

export default function Explore() {
  const { colors, dark } = useTheme()
  const ui = useUI()
  const styles = useStyles()

  const [reviewDraft, setReviewDraft] = useState<ParkingContribution | null>(
    null,
  )
  const [selectedPlace, setSelectedPlace] = useState<Destination | null>(null)
  useEffect(() => {
    if (Platform.OS !== 'web' || !selectedPlace) return
    const dismiss = () => setSelectedPlace(null)
    window.addEventListener('popstate', dismiss)
    return () => window.removeEventListener('popstate', dismiss)
  }, [selectedPlace])
  const insets = useArchitectureInsets()
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
  const [longitude, latitude] = nav.center
  const cameraRevision = navigation.cameraRevision
  const target = useMemo<CameraTarget>(
    () => ({ coordinate: [longitude, latitude], revision: cameraRevision }),
    [longitude, latitude, cameraRevision],
  )
  const filter = nav.filter
  const feeFilter = nav.fees
  const [now, setNow] = useState(() => new Date())

  const setSelected = useCallback(
    (record: DiscoveryParking | null) => {
      if (record)
        updateNavigation({
          selectedId: record.id,
          details: false,
          view: 'map',
          center: anchor(record.geometry),
        })
      else if (nav.selectedId)
        closeNavigation({
          selectedId: null,
          details: false,
          center: nav.center,
        })
    },
    [updateNavigation, closeNavigation, nav.center, nav.selectedId],
  )
  const list = useRef<FlatList<DiscoveryParking>>(null)
  const browseScrollOffset = useRef(0)
  const parkingScrollOffset = useRef(0)
  const [, setSheetContent] = useState<{
    id: string
    height: number
  } | null>(null)
  useEffect(() => {
    parkingScrollOffset.current = 0
  }, [nav.selectedId])
  const [toast, setToast] = useState<{
    favoriteAdded?: boolean
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
  const focused = useIsFocused()
  const { open: drawerOpen, setOpen: setDrawerOpen } = useMainDrawer()
  const [legendExpanded, setLegendExpanded] = useState(false)
  const [dismissedParking, setDismissedParking] =
    useState<MapParkingSummary | null>(null)
  const [previewHeight, setPreviewHeight] = useState(352)
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
  const appearanceReturn = useRef(nav.panel)
  const contributionReturn = useRef<'you' | null>(null)
  const directionsReturn = useRef(nav.panel)
  const openAppearance = () => {
    appearanceReturn.current = nav.panel
    updateNavigation({ panel: 'appearance' })
  }
  const fullPageActive =
    drawerOpen ||
    panel === 'saved' ||
    panel === 'you' ||
    panel === 'appearance' ||
    panel === 'filters' ||
    panel === 'location' ||
    panel === 'empty'
  const mapInterface = useRef<ComponentRef<typeof View>>(null)
  useEffect(() => {
    const element = mapInterface.current
    if (Platform.OS === 'web' && element instanceof HTMLElement)
      element.inert = fullPageActive
  }, [fullPageActive])
  const setPanel = (
    value:
      | 'info'
      | 'saved'
      | 'you'
      | 'appearance'
      | 'filters'
      | 'location'
      | 'empty'
      | null,
  ) =>
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
    () => partitionParking(records, filter, feeFilter, nav.features),
    [records, filter, feeFilter, nav.features],
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
  const filteredOut = parking.canQuery && records.length > 0 && !visible.length
  const browseState = discoveryState({
    canQuery: parking.canQuery,
    locationDenied: location.status === 'denied',
    filteredOut,
    loading:
      !samples &&
      (parking.status === 'loading' ||
        (!parking.settled && parking.status !== 'error') ||
        (mapStatus === 'loading' && !records.length)),
    count: visible.length,
  })
  const emptyContext = JSON.stringify([
    nav.query,
    nav.searchPoint,
    filter,
    feeFilter,
    nav.features,
  ])
  const lastEmptyContext = useRef<string | null>(null)
  const hasFilters =
    filter !== 'all' || feeFilter !== 'all' || nav.features.length > 0
  useEffect(() => {
    if (browseState !== 'empty' && browseState !== 'filtered') {
      lastEmptyContext.current = null
      return
    }
    if (
      !parking.settled ||
      parking.status !== 'idle' ||
      nav.panel ||
      nav.searching ||
      nav.selectedId ||
      nav.route ||
      nav.directions ||
      !hasFilters ||
      nav.searchPoint ||
      lastEmptyContext.current === emptyContext
    )
      return
    lastEmptyContext.current = emptyContext
    updateNavigation({ panel: 'empty' })
  }, [
    browseState,
    parking.status,
    parking.settled,
    nav.panel,
    nav.searching,
    nav.selectedId,
    nav.route,
    nav.directions,
    nav.searchPoint,
    hasFilters,
    emptyContext,
    updateNavigation,
  ])
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
        title="No parking matches these filters"
        body="Your filters are hiding other mapped parking in this area."
        action="Show all spots"
        onAction={() =>
          updateNavigation({ filter: 'all', fees: 'all', features: [] })
        }
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
    if (!focused) return false
    Keyboard.dismiss()
    if (drawerOpen) {
      setDrawerOpen(false)
      return true
    }
    if (
      legendExpanded &&
      !nav.searching &&
      !nav.panel &&
      !nav.directions &&
      !nav.details &&
      !nav.route
    ) {
      setLegendExpanded(false)
      return true
    }
    if (selectedPlace) setSelectedPlace(null)
    else if (nav.consent) closeNavigation({ consent: false })
    else if (nav.searching)
      closeNavigation({
        searching: false,
        query: nav.query,
        searchPoint: nav.searchPoint,
      })
    else if (nav.panel) {
      setDrawing(false)
      closeNavigation({
        panel:
          nav.panel === 'appearance' &&
          appearanceReturn.current !== 'appearance'
            ? appearanceReturn.current
            : nav.panel === 'add'
              ? contributionReturn.current
              : null,
      })
    } else if (nav.route) endNavigation()
    else if (nav.directions)
      closeNavigation({ directions: false, panel: directionsReturn.current })
    else if (nav.details && nav.detailTab === 'Entrance')
      closeNavigation({ detailTab: 'Info' })
    else if (nav.details) closeNavigation({ details: false })
    else if (nav.selectedId) closeMapParking()
    else if (nav.view === 'list') closeNavigation({ view: 'map' })
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
  const viewportUpdate = useSettledViewport(
    focused &&
      !nav.route &&
      !fullPageActive &&
      nav.view === 'map' &&
      !nav.details &&
      !searchActive,
    (next) => {
      if (!navigationViewportPrivate.current)
        setViewport((current) =>
          viewportChanged(current, next) ? next : current,
        )
    },
  )

  function center(coordinate: Coordinate) {
    updateNavigation({ center: coordinate }, 'replace')
  }
  function startDirections(record: DiscoveryParking) {
    const coordinate = parkingDestination(record, currentLocation)
    if (!coordinate) return
    directionsReturn.current = nav.panel
    setRouteTarget({ name: parkingTitle(record), coordinate, parking: record })
    updateNavigation({
      directions: true,
      selectedId: record.id,
      panel: null,
      view: 'map',
      center: anchor(record.geometry),
    })
  }
  function startInAppDirections(record: DiscoveryParking) {
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
        directions: false,
        details: false,
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
    const externalTarget =
      routeTarget ??
      (nav.directions && selected
        ? {
            name: parkingTitle(selected),
            coordinate: anchor(selected.geometry),
            parking: selected,
          }
        : null)
    if (!externalTarget) return
    entranceRequest.current?.abort()
    const request = new AbortController()
    entranceRequest.current = request
    const context = getNavigationState()
    setEntranceCheck(true)
    setEntranceError(null)
    try {
      const current = externalTarget.parking
        ? await refreshReviewedParking(
            externalTarget.parking,
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
        : externalTarget.coordinate
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
            favoriteAdded: adding,
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
    if (selected?.id === id && nav.view === 'map') {
      closeMapParking()
      return
    }
    setDismissedParking(null)
    setSelected(record)
    viewed(record)
  }

  function startContribution(record?: DiscoveryParking, restrictions = '') {
    contributionReturn.current = nav.panel === 'you' ? 'you' : null
    if (nav.route) drive.stop(false)
    clearRoute()
    setRouteTarget(null)
    if (record) {
      setForm({
        id: createLocalDraftId(),
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
        id: createLocalDraftId(),
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
            id: createLocalDraftId(),
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
  async function updateReportDraft(
    id: string,
    patch: Pick<ParkingContribution, 'submission' | 'submissionAttemptedAt'>,
  ) {
    if (saving.current || storage !== 'ready')
      throw new Error('Local storage is busy.')
    saving.current = true
    try {
      const current = await readContributions()
      if (!current.some((draft) => draft.id === id))
        throw new Error('Local draft was removed.')
      const next = current.map((draft) =>
        draft.id === id ? { ...draft, ...patch } : draft,
      )
      await writeContributions(next)
      setDrafts(next)
    } catch {
      throw new Error(
        'The local sending status could not be saved. No new send request was made.',
      )
    } finally {
      saving.current = false
    }
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

  const discoveryVisible =
    !drawing && !nav.route && !nav.directions && panel === null
  const cameraBottom =
    routeTarget && nav.route
      ? routeHeight
      : drawing
        ? drawingPanelHeight
        : discoveryVisible
          ? selected
            ? previewHeight
            : insets.bottom
          : 0
  const cameraPadding = discoveryCameraPadding(
    screenHeight,
    topOverlayHeight,
    cameraBottom,
  )
  const mapTop = nav.route || drawing ? cameraPadding.top : 20
  const mapBottom =
    nav.route || drawing
      ? cameraPadding.bottom
      : selected && !nav.directions
        ? previewHeight + 42
        : 20
  const mapPadding = useMemo(
    () => ({ top: mapTop, bottom: mapBottom }),
    [mapTop, mapBottom],
  )
  const selectMapRecord = useMapCallback((id: string) => {
    if (!nav.route) select(id)
  })
  const pressMap = useMapCallback((point: Coordinate) => {
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
        kind === 'street' ? [...current, point].slice(0, 12) : [point],
      )
    else if (nav.details) closeNavigation({ details: false })
    else if (nav.selectedId) closeMapParking()
  })
  const panMap = useMapCallback(() => {
    if (!nav.route) navigationViewportPrivate.current = false
  })
  const mapHidden =
    fullPageActive || nav.view === 'list' || nav.details || searchActive
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

  const details = selected
    ? parkingDetailData(selected, currentLocation, now)
    : null
  const parkingSummary =
    selected && details
      ? {
          id: selected.id,
          title: details.title,
          subtitle: [details.meta, displaySourceLabel(selected.sourceLabel)]
            .filter(Boolean)
            .join(' · '),
          rates:
            details.rows.find((fact) => fact.label === 'Fee')?.value ??
            details.fee,
          hours: parkingHoursFacts(selected, now).parsed.summary,
          access: details.access?.replaceAll('_', ' '),
          directionsAvailable: Boolean(
            parkingDestination(selected, currentLocation),
          ),
        }
      : null
  const displayedParking = parkingSummary ?? dismissedParking
  function closeMapParking() {
    setDismissedParking(parkingSummary)
    setSelected(null)
  }

  function searchMapArea() {
    setRevision((current) => current + 1)
  }

  const searchHeader = (
    <DestinationSearch
      layout="map"
      onSaved={() => setPanel('saved')}
      query={nav.query}
      active={searchActive}
      onQuery={(query) =>
        updateNavigation(
          { query, searchPoint: null, searchCredit: null },
          'replace',
        )
      }
      onLocate={centerOnMyLocation}
      onSearchArea={searchMapArea}
      center={target.coordinate}
      onActive={(active) => {
        if (active) updateNavigation({ searching: true })
        else
          closeNavigation({
            searching: false,
            query: nav.query,
            searchPoint: nav.searchPoint,
            searchCredit: nav.searchCredit,
          })
      }}
      onSelect={(found) => {
        clearRoute()
        setRouteTarget(null)
        setDismissedParking(null)
        navigationViewportPrivate.current = false
        updateNavigation(parkingNearDestination(found), 'replace')

        setRevision((current) => current + 1)
      }}
    />
  )
  return (
    <AppearanceNavigation value={openAppearance}>
      <View
        testID={mapStatus === 'ready' ? 'discovery-map-ready' : 'discovery-map'}
        style={styles.screen}
      >
        <StatusBar style={dark ? 'light' : 'dark'} />
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
          {...(Platform.OS === 'web'
            ? {}
            : {
                importantForAccessibility: fullPageActive
                  ? ('no-hide-descendants' as const)
                  : ('auto' as const),
              })}
          pointerEvents={fullPageActive ? 'none' : 'box-none'}
        >
          <View
            style={StyleSheet.absoluteFill}
            accessibilityElementsHidden={mapHidden}
            importantForAccessibility={
              mapHidden ? 'no-hide-descendants' : 'auto'
            }
          >
            <ParkingMap
              accessibilityHidden={Platform.OS === 'web' && mapHidden}
              key={mapRevision}
              night={dark}
              simplifiedMarkers
              records={parking.canQuery ? visible : EMPTY_RECORDS}
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
              cameraPadding={mapPadding}
              parkedLocation={local.state.parked?.coordinate ?? null}
              navigation={mapNavigation}
              userLocation={
                nav.route
                  ? (drive.position ?? currentLocation)
                  : currentLocation
              }
              destination={
                routeTarget && nav.route
                  ? routeTarget.coordinate
                  : (destination?.coordinate ?? null)
              }
              draftPoints={drawing ? points : EMPTY_POINTS}
              drawing={drawing}
              searching={searchActive}
              onSelect={selectMapRecord}
              onPlaceSelect={
                nav.route || drawing || panel !== null
                  ? undefined
                  : setSelectedPlace
              }
              onMapPress={pressMap}
              onPan={panMap}
              onMoveStart={viewportUpdate.cancel}
              onViewport={viewportUpdate.settle}
              onStatus={setMapStatus}
            />
          </View>

          <View
            pointerEvents="box-none"
            onLayout={(event) =>
              setTopOverlayHeight(event.nativeEvent.layout.height)
            }
            style={[
              styles.top,
              {
                paddingTop: insets.top + (nav.route || drawing ? 10 : 104),
              },
            ]}
          >
            <View pointerEvents="box-none" style={styles.searchOverlay}>
              {navigating ? (
                <NavigationBanner
                  step={drive.progress?.next}
                  then={
                    drive.progress?.next
                      ? routeState.route?.steps[
                          (routeState.route?.steps.indexOf(
                            drive.progress.next,
                          ) ?? -2) + 1
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
            {discoveryVisible && !selected && nav.view === 'map' ? (
              <View pointerEvents="box-none" style={styles.mapNotices}>
                {destination &&
                !searchActive &&
                (browseState === 'empty' || browseState === 'filtered') ? (
                  <View
                    style={[
                      styles.loadingToast,
                      styles.destinationNotice,
                      ui.shadow,
                    ]}
                    accessibilityLiveRegion="polite"
                  >
                    <Text style={ui.small}>
                      {browseState === 'filtered'
                        ? 'No mapped parking matches these filters.'
                        : 'No mapped parking found in this area.'}
                    </Text>
                  </View>
                ) : null}
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
              </View>
            ) : null}
          </View>

          {discoveryVisible &&
          nav.view === 'map' &&
          !selected &&
          !searchActive &&
          !connectivity.offline &&
          (mapStatus === 'error' || parking.status === 'error') ? (
            <View
              style={{
                position: 'absolute',
                top: insets.top + 120,
                left: 16,
                right: 16,
                zIndex: 5,
              }}
            >
              <StatusMessage
                message={
                  mapStatus === 'error'
                    ? 'The map could not load. You can still open the parking list.'
                    : parkingError
                }
                onRetry={() => {
                  if (mapStatus === 'error') {
                    setMapStatus('loading')
                    setMapRevision((value) => value + 1)
                  }
                  setRevision((value) => value + 1)
                }}
              />
            </View>
          ) : null}
          {discoveryVisible && nav.view === 'map' && !nav.details ? (
            <>
              <MainMapControls
                searching={searchActive}
                obscured={drawerOpen}
                search={searchHeader}
                legendExpanded={legendExpanded}
                onLegend={() => setLegendExpanded((expanded) => !expanded)}
                onMenu={() => {
                  Keyboard.dismiss()
                  if (searchActive)
                    closeNavigation({ searching: false, query: nav.query })
                  setDrawerOpen(true)
                }}
              />
              {displayedParking ? (
                <MapParkingPanel
                  record={displayedParking}
                  open={Boolean(parkingSummary && !searchActive && !drawerOpen)}
                  onClose={closeMapParking}
                  onMore={() =>
                    updateNavigation({ details: true, detailTab: 'Info' })
                  }
                  onDirections={() => {
                    if (selected) startDirections(selected)
                  }}
                  onHeight={setPreviewHeight}
                />
              ) : null}
            </>
          ) : null}
          {discoveryVisible && nav.view === 'list' && !searchActive ? (
            <ParkingListPage
              top={insets.top}
              bottom={insets.bottom}
              records={ranked}
              reference={reference}
              listRef={list}
              scrollOffset={browseScrollOffset.current}
              title={resultsTitle}
              notice={
                parking.status === 'error' ? (
                  <StatusMessage
                    message={parkingError}
                    onRetry={() => setRevision((value) => value + 1)}
                  />
                ) : browseState === 'location-off' ? (
                  stateCard
                ) : null
              }
              empty={browseState === 'loading' ? <LoadingRows /> : stateCard}
              onSelect={select}
              onMap={() => updateNavigation({ view: 'map' })}
              onOffset={(offset) => {
                browseScrollOffset.current = offset
              }}
            />
          ) : null}

          {nav.directions && selected && panel === null ? (
            <DirectionsChoice
              top={insets.top}
              bottom={insets.bottom}
              busy={
                entranceCheck || !parkingDestination(selected, currentLocation)
              }
              onBack={() =>
                closeNavigation({
                  directions: false,
                  panel: directionsReturn.current,
                })
              }
              onChoose={(provider) => {
                if (provider === 'parkey') {
                  startInAppDirections(selected)
                  return
                }
                const generation = ++navigationActionGeneration.current
                const context = getNavigationState()
                const isCurrent = () =>
                  generation === navigationActionGeneration.current &&
                  sameNavigationContext(context, getNavigationState())
                void consent.request(() => {
                  if (!isCurrent()) return
                  updateNavigation({ consent: false }, 'replace')
                  void externalRoute(provider)
                }, isCurrent)
              }}
            />
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
          {nav.route && drive.phase === 'arrived' ? (
            <ArrivalCelebration />
          ) : null}
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
                  id: createLocalDraftId(),
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
                closeNavigation({ panel: contributionReturn.current })
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
          {(discoveryVisible || panel === 'appearance') &&
          selected &&
          nav.details ? (
            <MotionView
              duration={240}
              distance={5}
              fromOpacity={0.8}
              testID="parking-details-page"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: colors.canvas,
                  paddingTop: insets.top,
                  paddingBottom: insets.bottom,
                },
              ]}
            >
              <ParkingDetails
                onViewSaved={() => setPanel('saved')}
                detailTab={nav.detailTab}
                onTabChange={(detailTab) =>
                  nav.detailTab === 'Entrance'
                    ? closeNavigation({ detailTab })
                    : updateNavigation(
                        { detailTab },
                        detailTab === 'Entrance' ? 'push' : 'replace',
                      )
                }
                onBack={() => closeNavigation({ details: false })}
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
                expanded
                onDirections={() => startDirections(selected)}
              />
            </MotionView>
          ) : null}
          {toast ? (
            <View
              style={{
                position: 'absolute',
                top: insets.top + (toast.favoriteAdded !== undefined ? 86 : 12),
                left: 16,
                right: 16,
                zIndex: 20,
              }}
            >
              {toast.favoriteAdded !== undefined ? (
                <FavoriteFeedback
                  added={toast.favoriteAdded}
                  onUndo={toast.undo}
                />
              ) : (
                <UndoToast message={toast.message} onUndo={toast.undo} />
              )}
            </View>
          ) : null}
          {consent.confirmation}
          {(nav.route ||
            drawing ||
            (discoveryVisible && nav.view === 'map' && !selected)) &&
          !searchActive ? (
            <View
              pointerEvents="box-none"
              style={[
                styles.mapInfo,
                {
                  bottom: Math.max(cameraBottom, insets.bottom) + 12,
                },
              ]}
            >
              {nav.route || drawing ? (
                <MapAttribution onPress={() => setPanel('info')} />
              ) : (
                <View style={styles.mapCredit}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Map data sources and attribution"
                    onPress={() => setPanel('info')}
                    style={styles.attribution}
                  >
                    <Text style={ui.small}>© OpenStreetMap · OpenFreeMap</Text>
                  </Pressable>
                  <SearchAttribution credit={nav.searchCredit} />
                </View>
              )}
            </View>
          ) : null}
        </View>
        {selectedPlace ? (
          <ModalSheet
            title={selectedPlace.name}
            onClose={() => setSelectedPlace(null)}
          >
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingBottom: 24,
                gap: 16,
              }}
            >
              <Text style={ui.body}>
                {selectedPlace.address || 'Address unavailable'}
              </Text>
              <Text style={ui.small}>
                Mapped place; this does not confirm parking or visitor access.
              </Text>
              <Button
                onPress={() => {
                  clearRoute()
                  setRouteTarget(null)
                  navigationViewportPrivate.current = false
                  updateNavigation(parkingNearDestination(selectedPlace))

                  setRevision((current) => current + 1)
                  setSelectedPlace(null)
                }}
              >
                Find Parking Nearby
              </Button>
            </ScrollView>
          </ModalSheet>
        ) : null}
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
        {nav.selectedId &&
        !selected &&
        parking.settled &&
        storage === 'ready' &&
        !panel ? (
          <View style={StyleSheet.absoluteFill}>
            <ArchitecturePage
              title="Parking unavailable"
              subtitle="This record is not in the current published map data. It may have changed or been removed."
              onBack={() => updateNavigation({ selectedId: null }, 'replace')}
            >
              <Button
                onPress={() =>
                  updateNavigation({ selectedId: null }, 'replace')
                }
              >
                Explore Parking
              </Button>
            </ArchitecturePage>
          </View>
        ) : null}
        {panel === 'empty' ? (
          <View style={StyleSheet.absoluteFill}>
            <EmptyResultsPage
              summary={[
                nav.query || 'Current map area',
                hasFilters ? 'Selected filters' : 'All parking',
              ].join(' - ')}
              filtered={hasFilters}
              onBack={() => closeNavigation({ panel: null })}
              onClear={() =>
                updateNavigation(
                  { panel: null, filter: 'all', fees: 'all', features: [] },
                  'replace',
                )
              }
              onSearch={() =>
                updateNavigation({ panel: null, searching: true }, 'replace')
              }
            />
          </View>
        ) : null}
        {panel === 'location' ? (
          <View style={StyleSheet.absoluteFill}>
            <LocationPage
              status={location.status}
              onBack={() => closeNavigation({ panel: null })}
              onLocate={centerOnMyLocation}
              onSearch={() =>
                updateNavigation({ panel: null, searching: true }, 'replace')
              }
              onWebSettings={() => setLocationSettingsOpen(true)}
            />
          </View>
        ) : null}
        <MotionLayer
          visible={panel === 'filters'}
          style={StyleSheet.absoluteFill}
        >
          <ParkingFiltersPage
            kind={filter}
            fees={feeFilter}
            selectedFeatures={nav.features}
            onBack={() => closeNavigation({ panel: null })}
            onApply={(filter, fees, features) => {
              updateNavigation(
                { filter, fees, features, panel: null },
                'replace',
              )
            }}
          />
        </MotionLayer>
        {panel === 'appearance' ? (
          <View style={StyleSheet.absoluteFill}>
            <AppearanceScreen
              onBack={() =>
                closeNavigation({
                  panel:
                    appearanceReturn.current === 'appearance'
                      ? null
                      : appearanceReturn.current,
                })
              }
            />
          </View>
        ) : null}
        {panel === 'saved' ? (
          <MotionView
            style={StyleSheet.absoluteFill}
            pointerEvents="box-none"
            duration={160}
            distance={0}
            fromOpacity={0.86}
          >
            <SavedPlaces
              local={local}
              onParkingDirections={startDirections}
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
                  {
                    panel: null,
                    selectedId: null,
                    center: point,
                    route: false,
                  },
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
                    view: 'map',
                    details: true,
                    center: anchor(record.geometry),
                    route: false,
                  },
                  'replace',
                )
                viewed(record)
              }}
            />
          </MotionView>
        ) : null}
        {panel === 'you' ? (
          <ParkingProfile
            reportOnly
            onAdd={() => startContribution()}
            onSaved={() => updateNavigation({ panel: 'saved' })}
            onPreferences={() => updateNavigation({ panel: 'filters' })}
            onClose={() => setPanel(null)}
            local={local}
            drafts={drafts}
            storage={storage}
            onReviewDraft={setReviewDraft}
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
        {reviewDraft ? (
          <ReportSubmission
            key={reviewDraft.id}
            draft={reviewDraft}
            onClose={() => setReviewDraft(null)}
            onAttempt={() =>
              updateReportDraft(reviewDraft.id, {
                submissionAttemptedAt: new Date().toISOString(),
              })
            }
            onReceipt={(receipt) =>
              updateReportDraft(reviewDraft.id, { submission: receipt })
            }
          />
        ) : null}
        {panel === 'info' ? (
          <MapInformation
            samples={samples}
            onSamples={(enabled) => {
              clearRoute()
              setRouteTarget(null)
              setSamples(
                developmentSamplesEnabled(enabled, process.env.NODE_ENV),
              )
              setSelected(null)
              if (enabled) center(PILOT_CENTER)
            }}
            drafts={drafts}
            setDrafts={setDrafts}
            storage={storage}
            onStorageReady={() => setStorage('ready')}
            onBrowse={() =>
              updateNavigation({ panel: null, view: 'list' }, 'replace')
            }
            onFilters={() => setPanel('filters')}
            onLocation={() => setPanel('location')}
            onClose={() => setPanel(null)}
          />
        ) : null}
        <MainDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onSaved={() => setPanel('saved')}
          onReport={() => setPanel('you')}
          onAppearance={openAppearance}
          onHelp={() => setPanel('info')}
        />
      </View>
    </AppearanceNavigation>
  )
}

function StatusMessage({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  const ui = useUI()
  const styles = useStyles()

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
const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
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
    destinationNotice: { marginTop: 34 },
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
    mapInfo: {
      position: 'absolute',
      left: 18,
      right: 18,
      alignItems: 'flex-start',
    },
    mapCredit: {
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      borderRadius: 14,
    },
    attribution: { minHeight: 28, justifyContent: 'center' },
    controls: {
      position: 'absolute',
      right: 16,
      gap: 12,
      alignItems: 'flex-end',
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
  }),
)
