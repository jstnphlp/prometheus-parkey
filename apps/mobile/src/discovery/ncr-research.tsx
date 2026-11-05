import type {
  Coordinate,
  NcrDiscoveryItem,
  NcrDiscoveryResponse,
  NcrFeatureType,
} from '@parkey/shared-types'
import { Link, Stack } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
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
import {
  fetchNcrDataset,
  ncrCategories,
  ncrPreviewEnabled,
  ncrResponseCanDisplay,
} from './ncr-client'
import NcrMap from './ncr-map'
import { colors } from './palette'
import { ModalSheet } from './sheets'
import { IconButton } from './ui'

const apiUrl =
  process.env.EXPO_PUBLIC_NCR_RESEARCH_URL || 'http://127.0.0.1:8090'
const areas: { name: string; point: Coordinate }[] = [
  { name: 'NCR overview', point: [121.035, 14.6] },
  { name: 'Poblacion', point: [121.0325, 14.565] },
  { name: 'BGC', point: [121.05, 14.5485] },
  { name: 'Binondo', point: [120.976, 14.601] },
  { name: 'Makati CBD', point: [121.022, 14.557] },
  { name: 'Ortigas', point: [121.0585, 14.585] },
  { name: 'MOA', point: [120.9825, 14.534] },
  { name: 'Cubao', point: [121.055, 14.6235] },
  { name: 'Tomas Morato', point: [121.0345, 14.638] },
  { name: 'North EDSA', point: [121.028, 14.6565] },
  { name: 'Alabang', point: [121.04, 14.4225] },
  { name: 'Maginhawa', point: [121.059, 14.6485] },
]
function Action({
  title,
  label,
  onPress,
  selected = false,
  disabled = false,
}: {
  title: string
  label?: string
  onPress: () => void
  selected?: boolean
  disabled?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.action,
        selected && styles.selected,
        disabled && styles.disabled,
      ]}
    >
      <Text style={{ color: selected ? colors.surface : colors.ink }}>
        {title}
      </Text>
    </Pressable>
  )
}
function ItemFacts({ item }: { item: NcrDiscoveryItem }) {
  const e = item.evidence
  return (
    <View style={styles.detail} testID="ncr-selected-details">
      <Text accessibilityRole="header" selectable style={styles.title}>
        {item.name}
      </Text>
      <Text selectable>
        {item.id} · {item.featureType}
      </Text>
      <Text selectable style={styles.warning}>
        Research only. This is not an available parking offer.
      </Text>
      <Text selectable>
        {e.physicallyVerified
          ? 'Physical evidence recorded; review scope and date'
          : 'No physical verification'}{' '}
        ·{' '}
        {e.onlineCorroborated
          ? 'Prior online corroboration'
          : 'Research source only'}{' '}
        ·{' '}
        {e.operatorConfirmed
          ? 'Operator evidence recorded'
          : 'No operator confirmation'}
      </Text>
      <Text selectable>
        Publication:{' '}
        {e.publicationApproved ? 'approved facts only' : 'not approved'} ·
        Access: {item.accessClass}
        {item.restrictedAccess
          ? ' — restricted; not publicly usable'
          : ' — current visitor rights unconfirmed'}
      </Text>
      <Text selectable>
        Fees: unknown · Hours: unknown · Capacity: unknown · Availability:
        unknown
      </Text>
      <Text selectable>
        Original {item.geometry.type} retained. Anchor:{' '}
        {item.representativePoint[1]}, {item.representativePoint[0]}. This is
        not a confirmed driving entrance.
      </Text>
      <Text selectable>
        Driving navigation is unavailable until a usable entrance is
        independently confirmed and approved.
      </Text>
      {item.warnings.map((warning) => (
        <Text selectable key={warning} style={styles.warning}>
          {warning.replaceAll('_', ' ')}
        </Text>
      ))}
      <Text selectable>
        Source: {item.source.attribution} · {item.source.license}
      </Text>
      <Text selectable>
        Source observed: {item.source.observedAt || 'unknown'}; this is not a
        visit date.
      </Text>
      <Action
        title="Open original source record"
        onPress={() => {
          void Linking.openURL(item.source.url).catch(() => undefined)
        }}
      />
      <Text selectable style={styles.warning}>
        Google Maps and Waze references use the existing source coordinate. They
        do not confirm a vehicle entrance, legal parking, or a business name. Do
        not import provider place content into Parkey.
      </Text>
      <Action
        title="Inspect coordinate on Google Maps"
        onPress={() => {
          const [lon, lat] = item.representativePoint
          void Linking.openURL(
            'https://www.google.com/maps/search/?api=1&query=' +
              encodeURIComponent(lat + ',' + lon),
          ).catch(() => undefined)
        }}
      />
      <Action
        title="Inspect coordinate on Waze"
        onPress={() => {
          const [lon, lat] = item.representativePoint
          void Linking.openURL(
            'https://www.waze.com/ul?ll=' +
              encodeURIComponent(lat + ',' + lon) +
              '&z=18',
          ).catch(() => undefined)
        }}
      />
      <Text selectable>
        {item.reviewIssueIds.length} unresolved review issue references. Human
        evidence and approval are required.
      </Text>
    </View>
  )
}
export default function NcrResearch() {
  const insets = useSafeAreaInsets()
  const enabled = ncrPreviewEnabled(
    process.env.NODE_ENV,
    apiUrl,
    Platform.OS === 'web'
      ? typeof globalThis.location === 'object'
        ? globalThis.location.hostname
        : ''
      : 'localhost',
  )
  const [target, setTarget] = useState<{
    coordinate: Coordinate
    zoom: number
  }>({ coordinate: [121.035, 14.58], zoom: 9.4 })
  const camera = useRef<Viewport | null>(null)
  const updateViewport = useCallback((next: Viewport) => {
    camera.current = next
  }, [])
  const [category, setCategory] = useState<'all' | NcrFeatureType>('all')
  const [nameFilter, setNameFilter] = useState<
    'cross_source' | 'source_named' | 'all'
  >('cross_source')
  const [mode, setMode] = useState<'public' | 'research_preview'>('public')
  const [storedData, setData] = useState<NcrDiscoveryResponse | null>(null)
  const privateCache = useRef<NcrDiscoveryResponse | null>(null)
  const dataset = ncrResponseCanDisplay(storedData, mode) ? storedData : null
  const data = useMemo(
    () =>
      dataset
        ? {
            ...dataset,
            items: dataset.items.filter(
              (item) =>
                (category === 'all' || item.featureType === category) &&
                (mode === 'public' ||
                  nameFilter === 'all' ||
                  (item.nameReview?.sourceNameIsDistinctive === true &&
                    (nameFilter === 'source_named' ||
                      item.nameReview?.crossSourceCandidate === true))),
            ),
            clusters: [],
          }
        : null,
    [dataset, category, nameFilter, mode],
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = data?.items.find((item) => item.id === selectedId) || null
  const [panel, setPanel] = useState<
    'info' | 'filters' | 'areas' | 'results' | null
  >(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ loaded: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [mapError, setMapError] = useState(false)
  const [revision, setRevision] = useState(0)
  const latestRequest = useRef(0)
  const onMapError = useCallback(() => setMapError(true), [])
  const onSelect = useCallback((id: string) => {
    setPanel(null)
    setSelectedId(id)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController(),
      generation = ++latestRequest.current
    let deadline: ReturnType<typeof setTimeout> | undefined
    const start = setTimeout(() => {
      setData(null)
      setError(null)
      if (mode === 'research_preview' && privateCache.current) {
        setData(privateCache.current)
        setLoading(false)
        return
      }
      setLoading(true)
      setProgress({ loaded: 0, total: 0 })
      deadline = setTimeout(() => {
        if (generation !== latestRequest.current || controller.signal.aborted)
          return
        controller.abort()
        setData(null)
        setLoading(false)
        setError(
          'Loading Metro Manila timed out. Retry to load the complete dataset.',
        )
      }, 90000)
      void fetchNcrDataset(apiUrl, mode, controller.signal, (loaded, total) => {
        if (generation === latestRequest.current && !controller.signal.aborted)
          setProgress({ loaded, total })
      })
        .then((result) => {
          if (generation !== latestRequest.current || controller.signal.aborted)
            return
          if (mode === 'research_preview') privateCache.current = result
          setData(result)
        })
        .catch((failure: unknown) => {
          if (generation !== latestRequest.current || controller.signal.aborted)
            return
          setData(null)
          setError(
            failure instanceof Error
              ? failure.message
              : 'Research service unavailable. Retry or return to the pilot.',
          )
        })
        .finally(() => {
          clearTimeout(deadline)
          if (
            generation === latestRequest.current &&
            !controller.signal.aborted
          )
            setLoading(false)
        })
    }, 0)
    return () => {
      clearTimeout(start)
      clearTimeout(deadline)
      controller.abort()
    }
  }, [enabled, mode, revision])
  useEffect(() => {
    if (mode !== 'public' || !dataset?.totalMatched) return
    const dueAt = Date.parse(dataset.reviewDueAt || '')
    const timer = setTimeout(
      () => {
        setData(null)
        setSelectedId(null)
        setRevision((value) => value + 1)
      },
      Math.max(0, Math.min(30000, dueAt - Date.now())),
    )
    return () => clearTimeout(timer)
  }, [dataset, mode])
  function changeMode(next: typeof mode) {
    if (next === mode) return
    latestRequest.current++
    setData(null)
    setSelectedId(null)
    setPanel(null)
    setMode(next)
  }
  function retry() {
    latestRequest.current++
    privateCache.current = null
    setData(null)
    setSelectedId(null)
    setRevision((value) => value + 1)
  }
  function zoomBy(amount: number) {
    const view = camera.current
    setTarget({
      coordinate: view
        ? [(view.west + view.east) / 2, (view.south + view.north) / 2]
        : target.coordinate,
      zoom: Math.max(8.5, Math.min(20, (view?.zoom ?? target.zoom) + amount)),
    })
  }
  const results = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    return (data?.items || []).filter(
      (item) =>
        !term ||
        item.name.toLocaleLowerCase().includes(term) ||
        item.id.toLocaleLowerCase().includes(term),
    )
  }, [data, search])
  const categoryLabel =
    ncrCategories.find((c) => c.value === category)?.label || 'All features'
  return (
    <View style={styles.screen} testID="ncr-screen">
      <Stack.Screen
        options={{ title: 'Metro Manila parking map', headerShown: false }}
      />
      <View style={StyleSheet.absoluteFill} testID="ncr-map-surface">
        {enabled ? (
          <NcrMap
            data={data}
            selectedId={selectedId}
            target={target}
            onViewport={updateViewport}
            onSelect={onSelect}
            onCluster={(coordinate) =>
              setTarget({
                coordinate,
                zoom: Math.min(20, (camera.current?.zoom ?? target.zoom) + 2),
              })
            }
            onError={onMapError}
          />
        ) : null}
      </View>
      <View
        style={[styles.topOverlay, { top: insets.top + 12 }]}
        pointerEvents="box-none"
      >
        <View style={styles.toolbar}>
          <View style={styles.titleRow}>
            <Link
              href="/"
              accessibilityLabel="Return to Poblacion pilot and offline fallback"
              style={styles.backLink}
            >
              ← Pilot
            </Link>
            <View style={styles.heading}>
              <Text style={styles.title}>Metro Manila</Text>
              <Text style={styles.caption}>Parking research</Text>
            </View>
            <IconButton
              icon="info"
              label="NCR map information"
              onPress={() => setPanel('info')}
            />
          </View>
          <View style={styles.controls}>
            <Action
              title="Public"
              label="Approved projection"
              selected={mode === 'public'}
              onPress={() => changeMode('public')}
            />
            <Action
              title="Private research"
              label="Open private research"
              selected={mode === 'research_preview'}
              onPress={() => changeMode('research_preview')}
            />
          </View>
          <View style={styles.controls}>
            <Action title={categoryLabel} onPress={() => setPanel('filters')} />
            <Action title="Jump to area" onPress={() => setPanel('areas')} />
            <Action
              title="Locations"
              onPress={() => setPanel('results')}
              disabled={!dataset}
            />
          </View>
        </View>
      </View>
      <View style={[styles.zoomControls, { bottom: insets.bottom + 132 }]}>
        <IconButton icon="plus" label="Zoom in" onPress={() => zoomBy(1)} />
        <Action title="−" label="Zoom out" onPress={() => zoomBy(-1)} />
      </View>
      <View
        style={[styles.bottomOverlay, { bottom: insets.bottom + 12 }]}
        pointerEvents="box-none"
      >
        <View style={styles.statusCard} testID="ncr-result-summary">
          {!enabled ? (
            <Text style={styles.warning}>
              Research preview unavailable. Open a development build with the
              local research service.
            </Text>
          ) : loading ? (
            <View style={styles.statusRow}>
              <ActivityIndicator />
              <Text style={styles.statusText}>
                Loading all NCR records
                {progress.total
                  ? `: ${progress.loaded.toLocaleString()} / ${progress.total.toLocaleString()}`
                  : '…'}
              </Text>
            </View>
          ) : error ? (
            <View style={styles.statusRow}>
              <Text
                accessibilityRole="alert"
                style={[styles.statusText, styles.error]}
              >
                {error}
              </Text>
              <Action title="Retry / refresh" onPress={retry} />
            </View>
          ) : dataset ? (
            <>
              <Text style={styles.count}>
                {dataset.items.length.toLocaleString()}{' '}
                {mode === 'public' ? 'approved' : 'research'} records loaded ·{' '}
                {(data?.items.length || 0).toLocaleString()} shown
              </Text>
              {mode === 'public' && !dataset.items.length ? (
                <Text testID="ncr-empty" style={styles.caption}>
                  No NCR records are approved for public display. This does not
                  mean no parking exists.
                </Text>
              ) : (
                <Text style={styles.warning}>
                  Unverified research ·{' '}
                  {mode === 'research_preview'
                    ? nameFilter === 'cross_source'
                      ? 'Cross-source name agreement only; identity not verified'
                      : nameFilter === 'source_named'
                        ? 'Source names only; not independently confirmed'
                        : 'All original research including unnamed locations'
                    : 'Check access and posted restrictions'}
                </Text>
              )}
            </>
          ) : null}
          {mapError ? (
            <Text style={styles.warning}>
              Basemap unavailable. Open Locations to inspect loaded research.
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sources and map credits"
            onPress={() => setPanel('info')}
          >
            <Text style={styles.caption}>
              © OpenStreetMap contributors · Overture · Credits
            </Text>
          </Pressable>
        </View>
      </View>
      {panel === 'info' ? (
        <ModalSheet title="NCR map information" onClose={() => setPanel(null)}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.warning}>
              Private development preview. All new NCR candidates remain
              unpublished. Mapped records are not parking offers.
            </Text>
            <Text>
              The complete NCR snapshot loads once when private research is
              opened. Moving the map, zooming and filtering use the loaded
              records; they do not fetch another viewport.
            </Text>
            <Text>
              Facilities: purple. Entrances: amber. Individual bays: teal.
              Streets: lines. Restricted: red. Cluster numbers count source
              observations, not facilities or available spaces.
            </Text>
            <Text>
              No live availability is provided. Fees, hours and capacity remain
              unknown unless separately established. A source anchor or polygon
              center is not a confirmed vehicle entrance.
            </Text>
            <Text>
              Research, online corroboration, operator confirmation, physical
              verification and publication approval are separate states.
              Private/restricted records appear only in explicit research mode.
            </Text>
            <Text>
              Source snapshot: {dataset?.coverage.sourceAsOf || 'not loaded'}.
              Community-mapped LGU boundaries are not a legal boundary
              determination.
            </Text>
            {(dataset?.attribution || []).map((a) => (
              <Text selectable key={a.label}>
                {a.label} · {a.url}
              </Text>
            ))}
            <Text selectable>
              Basemap: OpenFreeMap / OpenMapTiles. © OpenStreetMap contributors.
              Renderer: MapLibre.
            </Text>
            <Action
              title="Retry / refresh"
              onPress={() => {
                setPanel(null)
                retry()
              }}
            />
          </ScrollView>
        </ModalSheet>
      ) : null}
      {panel === 'areas' ? (
        <ModalSheet title="Jump to area" onClose={() => setPanel(null)}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {areas.map((area, index) => (
              <Action
                key={area.name}
                title={area.name}
                onPress={() => {
                  setTarget({
                    coordinate: area.point,
                    zoom: index === 0 ? 9.4 : 15,
                  })
                  setPanel(null)
                }}
              />
            ))}
          </ScrollView>
        </ModalSheet>
      ) : null}
      {panel === 'filters' ? (
        <ModalSheet title="Parking categories" onClose={() => setPanel(null)}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text selectable style={styles.warning}>
              Parking names are source evidence, not verified business
              identities. Google Maps and Waze are external coordinate
              references only. Missing-name records remain preserved in private
              research.
            </Text>
            <Action
              title="Cross-source name matches"
              selected={nameFilter === 'cross_source'}
              onPress={() => {
                setNameFilter('cross_source')
                setSelectedId(null)
                setPanel(null)
              }}
            />
            <Action
              title="Distinctive source names (unconfirmed)"
              selected={nameFilter === 'source_named'}
              onPress={() => {
                setNameFilter('source_named')
                setSelectedId(null)
                setPanel(null)
              }}
            />
            <Action
              title="All research (including unnamed)"
              selected={nameFilter === 'all'}
              onPress={() => {
                setNameFilter('all')
                setSelectedId(null)
                setPanel(null)
              }}
            />
            {ncrCategories.map((c) => (
              <View key={c.value} style={styles.filterRow}>
                <View style={styles.flex}>
                  <Action
                    title={c.label}
                    selected={category === c.value}
                    onPress={() => {
                      setCategory(c.value)
                      setSelectedId(null)
                      setPanel(null)
                    }}
                  />
                </View>
                <Text style={styles.caption}>
                  {(
                    dataset?.items.filter(
                      (item) =>
                        c.value === 'all' || item.featureType === c.value,
                    ).length || 0
                  ).toLocaleString()}
                </Text>
              </View>
            ))}
          </ScrollView>
        </ModalSheet>
      ) : null}
      {panel === 'results' ? (
        <ModalSheet title="Loaded locations" onClose={() => setPanel(null)}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            accessibilityLabel="Search loaded locations"
            placeholder="Search a name or source ID"
            style={styles.search}
          />
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            initialNumToRender={12}
            keyboardShouldPersistTaps="handled"
            style={styles.resultList}
            ListEmptyComponent={
              <Text style={styles.modalContent}>
                No loaded locations match this search or category.
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Research details for ${item.name}`}
                onPress={() => {
                  setPanel(null)
                  setSelectedId(item.id)
                  setTarget({ coordinate: item.representativePoint, zoom: 16 })
                }}
                style={styles.row}
              >
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.caption}>
                  {item.featureType} ·{' '}
                  {item.restrictedAccess
                    ? 'Restricted access'
                    : `Access: ${item.accessClass}`}{' '}
                  · Not field verified
                </Text>
              </Pressable>
            )}
          />
        </ModalSheet>
      ) : null}
      {selected ? (
        <ModalSheet
          title="Research details"
          onClose={() => setSelectedId(null)}
        >
          <ScrollView>
            <ItemFacts item={selected} />
          </ScrollView>
        </ModalSheet>
      ) : null}
    </View>
  )
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas, overflow: 'hidden' },
  topOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    alignItems: 'flex-start',
  },
  toolbar: {
    width: '100%',
    maxWidth: 510,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0 4px 20px rgba(30,27,56,0.12)',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heading: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  caption: { fontSize: 12, color: colors.muted },
  backLink: { color: colors.brand, fontWeight: '600', paddingVertical: 10 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.brand },
  disabled: { opacity: 0.5 },
  bottomOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    alignItems: 'center',
  },
  statusCard: {
    width: '100%',
    maxWidth: 680,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0 4px 20px rgba(30,27,56,0.12)',
  },
  count: { fontSize: 14, fontWeight: '600', color: colors.ink },
  warning: { fontSize: 12, color: colors.amber },
  error: { color: colors.error },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusText: { flex: 1, fontSize: 13, color: colors.ink },
  zoomControls: {
    position: 'absolute',
    right: 12,
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalContent: { paddingHorizontal: 24, paddingBottom: 24, gap: 16 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  search: {
    marginHorizontal: 24,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.ink,
  },
  resultList: { maxHeight: 440 },
  row: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  rowName: { fontWeight: '600', color: colors.ink },
  detail: { padding: 24, gap: 12 },
})
