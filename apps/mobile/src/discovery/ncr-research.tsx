import type {
  Coordinate,
  NcrDiscoveryItem,
  NcrDiscoveryResponse,
  NcrFeatureType,
} from '@parkey/shared-types'
import { Link, Stack } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { Viewport } from './model'
import {
  fetchNcrPage,
  ncrCategories,
  ncrPreviewEnabled,
  ncrResponseCanDisplay,
} from './ncr-client'
import NcrMap from './ncr-map'
import { colors } from './palette'

const apiUrl =
  process.env.EXPO_PUBLIC_NCR_RESEARCH_URL || 'http://127.0.0.1:8090'
const initialViewport: Viewport = {
  west: 120.85,
  south: 14.3,
  east: 121.27,
  north: 14.86,
  zoom: 11.5,
}
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
  onPress,
  selected = false,
  disabled = false,
}: {
  title: string
  onPress: () => void
  selected?: boolean
  disabled?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
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
  const [viewport, setViewport] = useState(initialViewport)
  const [target, setTarget] = useState<{
    coordinate: Coordinate
    zoom: number
  }>({ coordinate: [121.035, 14.6], zoom: 11.5 })
  const [category, setCategory] = useState<'all' | NcrFeatureType>('all')
  const [names, setNames] = useState<'corroborated' | 'named' | 'all'>('corroborated')
  const [mode, setMode] = useState<'public' | 'research_preview'>('public')
  const [storedData, setData] = useState<NcrDiscoveryResponse | null>(null)
  const [dataQuery, setDataQuery] = useState('')
  const queryKey = JSON.stringify([viewport, category, mode, names])
  const data =
    dataQuery === queryKey && ncrResponseCanDisplay(storedData, mode)
      ? storedData
      : null
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mapError, setMapError] = useState(false)
  const [revision, setRevision] = useState(0)
  const moreRequest = useRef<AbortController | null>(null)
  const latestQuery = useRef(0)
  const invalidate = useCallback(() => {
    latestQuery.current++
    moreRequest.current?.abort()
    setData(null)
    setSelectedId(null)
  }, [])
  const updateViewport = useCallback(
    (next: Viewport) =>
      setViewport((current) =>
        current.west === next.west &&
        current.south === next.south &&
        current.east === next.east &&
        current.north === next.north &&
        current.zoom === next.zoom
          ? current
          : next,
      ),
    [],
  )
  const onMapError = useCallback(() => setMapError(true), [])
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController(),
      query = ++latestQuery.current
    moreRequest.current?.abort()
    let deadline: ReturnType<typeof setTimeout> | undefined
    const timer = setTimeout(() => {
      if (mode === 'public') setData(null)
      setLoading(true)
      deadline = setTimeout(() => {
        if (query !== latestQuery.current || controller.signal.aborted) return
        if (mode === 'public') setData(null)
        setError(
          'Research service timed out. Retry or return to the offline Poblacion pilot.',
        )
        setLoading(false)
        controller.abort()
      }, 12000)
      void fetchNcrPage(apiUrl, viewport, category, mode, controller.signal, null, names)
        .then((result) => {
          if (query === latestQuery.current && !controller.signal.aborted) {
            setData(result)
            setDataQuery(queryKey)
            setError(null)
          }
        })
        .catch((failure: unknown) => {
          if (!controller.signal.aborted && query === latestQuery.current) {
            if (mode === 'public') setData(null)
            setError(
              failure instanceof Error
                ? failure.message
                : 'Research service unavailable. Retry or return to the offline pilot.',
            )
          }
        })
        .finally(() => {
          clearTimeout(deadline)
          if (!controller.signal.aborted && query === latestQuery.current)
            setLoading(false)
        })
    }, 350)
    return () => {
      clearTimeout(timer)
      clearTimeout(deadline)
      controller.abort()
    }
  }, [enabled, viewport, category, mode, names, revision, queryKey])
  useEffect(() => {
    if (mode !== 'public' || !data?.totalMatched) return
    const dueAt = Date.parse(data.reviewDueAt || '')
    const timer = setTimeout(
      () => {
        invalidate()
        setRevision((v) => v + 1)
      },
      Math.max(0, Math.min(30000, dueAt - Date.now())),
    )
    return () => clearTimeout(timer)
  }, [data, mode, invalidate])
  useEffect(() => () => moreRequest.current?.abort(), [])
  async function loadMore() {
    if (!data?.nextCursor || loading) return
    const controller = new AbortController(),
      query = latestQuery.current,
      version = data.dataVersion
    moreRequest.current = controller
    setLoading(true)
    try {
      const result = await fetchNcrPage(
        apiUrl,
        viewport,
        category,
        mode,
        controller.signal,
        data.nextCursor,
        names,
      )
      if (query !== latestQuery.current || controller.signal.aborted) return
      if (result.dataVersion !== version) {
        setRevision((v) => v + 1)
        return
      }
      setData((current) =>
        current
          ? {
              ...result,
              items: [
                ...current.items,
                ...result.items.filter(
                  (item) =>
                    !current.items.some((previous) => previous.id === item.id),
                ),
              ],
            }
          : result,
      )
    } catch (failure) {
      if (!controller.signal.aborted) {
        if (mode === 'public') setData(null)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Could not load the next page.',
        )
      }
    } finally {
      if (query === latestQuery.current && !controller.signal.aborted)
        setLoading(false)
    }
  }
  function changeMode(next: typeof mode) {
    invalidate()
    setMode(next)
  }
  const selected = data?.items.find((item) => item.id === selectedId)
  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <Stack.Screen
        options={{ title: 'NCR research preview', headerShown: true }}
      />
      <FlatList
        data={enabled && !selected ? data?.items || [] : []}
        keyExtractor={(item) => item.id}
        style={styles.list}
        initialNumToRender={12}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Link href="/">
                Return to Poblacion pilot and offline fallback
              </Link>
              <Text selectable style={styles.warning}>
                Private development preview. Unapproved records are not public
                listings. Coverage is incomplete.
              </Text>
            </View>
            {!enabled ? (
              <View style={styles.detail}>
                <Text accessibilityRole="header" style={styles.title}>
                  Research preview unavailable
                </Text>
                <Text selectable>
                  This screen requires a development build and a loopback
                  research service. The Poblacion pilot remains available.
                </Text>
              </View>
            ) : (
              <>
                <ScrollView
                  horizontal
                  style={styles.strip}
                  contentContainerStyle={styles.stripContent}
                >
                  <Action
                    title="Approved projection"
                    selected={mode === 'public'}
                    onPress={() => changeMode('public')}
                  />
                  <Action
                    title="Open private research"
                    selected={mode === 'research_preview'}
                    onPress={() => changeMode('research_preview')}
                  />
                  <Action
                    title="Retry / refresh"
                    onPress={() => setRevision((v) => v + 1)}
                  />
                </ScrollView>
                <ScrollView
                  horizontal
                  style={styles.strip}
                  contentContainerStyle={styles.stripContent}
                >
                  {areas.map((area, i) => (
                    <Action
                      key={area.name}
                      title={area.name}
                      onPress={() => {
                        setSelectedId(null)
                        setTarget({
                          coordinate: area.point,
                          zoom: i === 0 ? 11.5 : 15,
                        })
                      }}
                    />
                  ))}
                </ScrollView>
                <ScrollView
                  horizontal
                  style={styles.strip}
                  contentContainerStyle={styles.stripContent}
                >
                  {ncrCategories.map((c) => (
                    <Action
                      key={c.value}
                      title={c.label}
                      selected={category === c.value}
                      onPress={() => {
                        invalidate()
                        setCategory(c.value)
                      }}
                    />
                  ))}
                </ScrollView>
                <ScrollView
                  horizontal
                  style={styles.strip}
                  contentContainerStyle={styles.stripContent}
                >
                  <Action
                    title="Cross-source name matches"
                    selected={names === 'corroborated'}
                    onPress={() => {
                      invalidate()
                      setNames('corroborated')
                    }}
                  />
                  <Action
                    title="Source-named facilities"
                    selected={names === 'named'}
                    onPress={() => {
                      invalidate()
                      setNames('named')
                    }}
                  />
                  <Action
                    title="All source research (including unnamed)"
                    selected={names === 'all'}
                    onPress={() => {
                      invalidate()
                      setNames('all')
                    }}
                  />
                </ScrollView>
                <Text selectable style={styles.warning}>
                  Cross-source names are unverified research matches, not
                  confirmed businesses. Google Maps and Waze remain external
                  reviewer references; their content is not imported. Unmatched
                  locations remain in the private research archive.
                </Text>
                <View style={styles.map}>
                  <NcrMap
                    data={data}
                    selectedId={selectedId}
                    target={target}
                    onViewport={updateViewport}
                    onSelect={setSelectedId}
                    onCluster={(coordinate) =>
                      setTarget({
                        coordinate,
                        zoom: Math.min(18, viewport.zoom + 2),
                      })
                    }
                    onError={onMapError}
                  />
                </View>
                <Text style={styles.legend} selectable>
                  Facilities: purple · Entrances: amber · Bays: teal · Streets:
                  lines · Restricted: red. All markers are research anchors.
                </Text>
                {loading ? (
                  <View style={styles.status}>
                    <ActivityIndicator />
                    <Text selectable>
                      Loading viewport; prior results may remain visible.
                    </Text>
                  </View>
                ) : null}
                {error ? (
                  <Text
                    accessibilityRole="alert"
                    selectable
                    style={styles.error}
                  >
                    {error}
                  </Text>
                ) : null}
                {mapError ? (
                  <Text selectable style={styles.warning}>
                    Basemap or graphics unavailable. Research results remain
                    accessible below.
                  </Text>
                ) : null}
                {data ? (
                  <View style={styles.summary} testID="ncr-result-summary">
                    <Text selectable>{data.notice}</Text>
                    <Text selectable>
                      {data.totalMatched}{' '}
                      {mode === 'public' ? 'approved' : 'research'} observations
                      match this viewport.{' '}
                      {data.truncated
                        ? 'More results exist; load the next page or zoom in.'
                        : ''}
                    </Text>
                    <Text selectable>
                      Source snapshot: {data.coverage.sourceAsOf}.
                      Municipalities are community-mapped, not a legal boundary
                      determination.
                    </Text>
                    {data.attribution.map((a) => (
                      <Text selectable key={a.label}>
                        {a.label} · {a.url}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {data &&
                !loading &&
                !data.items.length &&
                !data.clusters.length ? (
                  <Text selectable style={styles.summary} testID="ncr-empty">
                    {mode === 'public'
                      ? 'No NCR records are approved for public display. This does not mean no parking exists.'
                      : 'No source observations match this viewport/filter. Coverage is incomplete.'}
                  </Text>
                ) : null}

                {selected ? (
                  <View>
                    <ItemFacts item={selected} />
                    <Action
                      title="Close research details"
                      onPress={() => setSelectedId(null)}
                    />
                  </View>
                ) : (
                  data?.clusters.map((c) => (
                    <View key={c.id} style={styles.row}>
                      <Text selectable>
                        {c.sourceObservationCount} source observations ?{' '}
                        {c.facilityCandidateCount} facility candidates. No space
                        availability inferred.
                      </Text>
                      <Action
                        title={`Inspect cluster ${c.id}`}
                        onPress={() =>
                          setTarget({
                            coordinate: c.coordinate,
                            zoom: Math.min(18, viewport.zoom + 2),
                          })
                        }
                      />
                    </View>
                  ))
                )}
              </>
            )}
          </>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Research details for ${item.name}`}
            testID={`ncr-row-${item.id}`}
            onPress={() => setSelectedId(item.id)}
            style={styles.row}
          >
            <Text selectable style={styles.rowName}>
              {item.name} ? {item.featureType}
            </Text>
            <Text selectable>
              {item.restrictedAccess
                ? 'Restricted ? research only'
                : `Access: ${item.accessClass}, unconfirmed`}{' '}
              ?{' '}
              {item.evidence.physicallyVerified
                ? 'Physical evidence recorded'
                : 'Not field verified'}
            </Text>
          </Pressable>
        )}
        ListFooterComponent={
          !selected && data?.nextCursor ? (
            <Action
              title="Load more research results"
              disabled={loading}
              onPress={() => {
                void loadMore()
              }}
            />
          ) : undefined
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { padding: 12, gap: 8 },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  warning: { color: colors.amber },
  strip: { flexGrow: 0, maxHeight: 52 },
  stripContent: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
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
  map: { height: 320, flexShrink: 0 },
  legend: { padding: 8, fontSize: 12, color: colors.muted },
  status: { flexDirection: 'row', gap: 8, padding: 8 },
  error: { padding: 8, color: colors.error },
  summary: { paddingHorizontal: 12, gap: 4, fontSize: 12 },
  list: { flex: 1 },
  detail: { padding: 16, gap: 10 },
  row: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  rowName: { fontWeight: '600', color: colors.ink },
})
