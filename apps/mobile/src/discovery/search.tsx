import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import type { ComponentRef } from 'react'
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import type { Coordinate } from '@parkey/shared-types'

import { config } from './config'
import {
  searchPlaces,
  SearchRateLimit,
  SEARCH_DEBOUNCE_MS,
} from './place-search'
import { useConnectivity } from './use-connectivity'
import type { Destination } from './data'
import { FigmaAsset } from './figma-assets'
import { MotionPressable } from './motion'
import { fonts } from './typography'
import { StateCard } from './state-card'
import { colors, IconButton, UndoToast, ui } from './ui'
import { useSearchHistory } from './use-search-history'

const hasSearchProvider = Boolean(
  config.placeSearchEnabled || config.geocoder.trim(),
)

export function DestinationSearch({
  query,
  onQuery,
  center,
  active,
  onSelect,
  onLocate,
  onActive,
  onSaved,
  layout = 'overlay',
  fillSheet = false,
  placeholder = layout === 'sheet'
    ? 'Search for an address'
    : 'Where do you need parking?',
}: {
  query: string
  onQuery: (query: string) => void
  center: Coordinate
  active: boolean
  onSelect: (destination: Destination) => void
  onLocate: () => void
  onActive: (active: boolean) => void
  onSaved: () => void
  layout?: 'overlay' | 'sheet'
  fillSheet?: boolean
  placeholder?: string
}) {
  const { height } = useWindowDimensions()
  const { offline } = useConnectivity()
  const [retryAt, setRetryAt] = useState(0)
  const [limitSeconds, setLimitSeconds] = useState(60)
  const compact = height < 700
  const [focused, setFocused] = useState(false)
  const [cleared, setCleared] = useState<Destination[] | null>(null)
  useEffect(() => {
    if (!cleared) return
    const timer = setTimeout(() => setCleared(null), 5000)
    return () => clearTimeout(timer)
  }, [cleared])
  const [results, setResults] = useState<Destination[]>([])
  const [status, setStatus] = useState<
    | 'idle'
    | 'loading'
    | 'empty'
    | 'error'
    | 'unavailable'
    | 'offline'
    | 'limited'
  >('idle')
  const [notice, setNotice] = useState(false)
  const [cardTop, setCardTop] = useState(10)
  const [visibleBottom, setVisibleBottom] = useState<number | null>(null)
  const history = useSearchHistory()
  const { noteSearch } = history
  const container = useRef<ComponentRef<typeof View>>(null)
  const input = useRef<ComponentRef<typeof TextInput>>(null)
  const request = useRef<AbortController | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function cancel() {
    clearTimeout(debounce.current)
    request.current?.abort()
    request.current = null
  }

  function clearSearch() {
    cancel()
    onQuery('')
    setResults([])
    setStatus('idle')
    input.current?.focus()
    onActive(true)
  }

  function close() {
    cancel()
    onActive(false)
    input.current?.blur()
    Keyboard.dismiss()
  }

  const deactivate = useEffectEvent(() => {
    cancel()
    input.current?.blur()
    Keyboard.dismiss()
  })
  const escape = useEffectEvent((event: KeyboardEvent) => {
    if (active && event.key === 'Escape') close()
  })
  useEffect(() => {
    if (!active) {
      deactivate()
      return
    }
    // The map page becomes interactive after Saved places closes.
    const frame = requestAnimationFrame(() => input.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [active])
  useEffect(() => {
    if (Platform.OS !== 'web') return
    const listener = (event: KeyboardEvent) => escape(event)
    if (input.current instanceof HTMLElement)
      input.current.style.outlineStyle = 'none'
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [])

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Mobile browsers shrink the visual viewport when the keyboard opens.
      const viewport = window.visualViewport
      const resize = () =>
        setVisibleBottom(
          viewport ? viewport.height + viewport.offsetTop : window.innerHeight,
        )
      const frame = requestAnimationFrame(resize)
      viewport?.addEventListener('resize', resize)
      viewport?.addEventListener('scroll', resize)
      return () => {
        cancelAnimationFrame(frame)
        viewport?.removeEventListener('resize', resize)
        viewport?.removeEventListener('scroll', resize)
      }
    }
    const show = Keyboard.addListener('keyboardDidShow', (event) =>
      setVisibleBottom(event.endCoordinates.screenY),
    )
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setVisibleBottom(height),
    )
    return () => {
      show.remove()
      hide.remove()
    }
  }, [height])

  const search = useCallback(async () => {
    cancel()
    if (!active || query.trim().length < 3) return
    if (offline) {
      setResults([])
      setStatus('offline')
      return
    }
    if (Date.now() < retryAt) {
      setResults([])
      setStatus('limited')
      return
    }
    if (!hasSearchProvider) {
      setResults([])
      setNotice(false)
      setStatus('unavailable')
      return
    }
    const controller = new AbortController()
    request.current = controller
    const timeout = setTimeout(() => controller.abort(), 12000)
    setStatus('loading')
    setResults([])
    void noteSearch().then((firstSearch) => {
      if (firstSearch && request.current === controller) setNotice(true)
    })
    try {
      const found = await searchPlaces(
        {
          enabled: config.placeSearchEnabled,
          backend: config.supabaseUrl,
          publicKey: config.supabaseKey,
          legacyEndpoint: config.geocoder,
        },
        query,
        center,
        controller.signal,
      )
      if (request.current !== controller || controller.signal.aborted) return
      setResults(found.results.slice(0, 6))
      setStatus(found.results.length ? 'idle' : 'empty')
    } catch (error) {
      if (request.current !== controller) return
      if (error instanceof SearchRateLimit) {
        setRetryAt(Date.now() + error.retryAfter * 1000)
        setLimitSeconds(error.retryAfter)
        setStatus('limited')
      } else setStatus('error')
    } finally {
      clearTimeout(timeout)
    }
  }, [active, query, center, noteSearch, offline, retryAt])

  useEffect(() => {
    if (active && query.trim().length >= 3)
      debounce.current = setTimeout(() => void search(), SEARCH_DEBOUNCE_MS)
    return cancel
  }, [active, query, center, search])

  function select(destination: Destination) {
    cancel()
    input.current?.blur()
    Keyboard.dismiss()
    onSelect(destination)
    if (!destination.attribution) void history.remember(destination)
  }

  return (
    <View
      ref={container}
      testID="destination-search-card"
      onLayout={() =>
        layout === 'overlay' &&
        container.current?.measureInWindow((_x, y) => setCardTop(y))
      }
      style={[
        styles.container,
        compact && layout === 'overlay' && styles.compactContainer,
        layout === 'sheet'
          ? [
              styles.sheetContainer,
              fillSheet
                ? active && { flex: 1 }
                : { maxHeight: (visibleBottom ?? height) * 0.55 },
            ]
          : {
              maxHeight: Math.max(0, (visibleBottom ?? height) - cardTop - 64),
            },
        layout === 'overlay' && ui.shadow,
        !active &&
          layout === 'sheet' && { padding: 0, backgroundColor: 'transparent' },
      ]}
    >
      {layout === 'overlay' ? (
        <View style={[styles.header, compact && styles.compactHeader]}>
          <Text style={[styles.brand, compact && styles.compactBrand]}>
            parkey
          </Text>
          <MotionPressable
            accessibilityRole="button"
            onPress={onSaved}
            accessibilityLabel="Open saved places"
            style={({ pressed }) => [styles.savedAction, pressed && ui.pressed]}
          >
            <Text style={ui.small}>Makati</Text>
          </MotionPressable>
        </View>
      ) : null}
      <View
        style={[
          styles.bar,
          layout === 'sheet' && styles.sheetBar,
          focused && styles.focusedBar,
        ]}
      >
        {active && fillSheet ? (
          <IconButton
            icon="back"
            label="Close destination search"
            onPress={close}
          />
        ) : null}
        <FigmaAsset name="search-muted" size={24} />
        <TextInput
          ref={input}
          testID="destination-query"
          accessibilityLabel={placeholder}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          selectionColor={colors.action}
          maxLength={180}
          value={query}
          onFocus={() => {
            setFocused(true)
            if (!active) {
              setStatus('idle')
              setResults([])
              setNotice(false)
            }
            onActive(true)
          }}
          onBlur={() => setFocused(false)}
          onChangeText={(text) => {
            cancel()
            onQuery(text)
            setResults([])
            setStatus('idle')
            onActive(true)
          }}
          onSubmitEditing={() => void search()}
          submitBehavior="submit"
          returnKeyType="search"
          style={[styles.input, layout === 'sheet' && styles.sheetInput]}
        />
        {query ? (
          <IconButton
            icon="close"
            label="Clear destination search"
            onPress={clearSearch}
          />
        ) : null}
      </View>
      {active ? (
        <ScrollView
          testID="destination-results"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          style={[
            ui.sheetScroll,
            styles.results,
            fillSheet && { flex: 1, maxHeight: undefined },
          ]}
          contentContainerStyle={styles.resultsContent}
        >
          {query.trim().length < 3 ? (
            <MotionPressable
              accessibilityRole="button"
              onPress={() => {
                cancel()
                input.current?.blur()
                Keyboard.dismiss()
                onLocate()
              }}
              style={({ pressed }) => [styles.result, pressed && ui.pressed]}
            >
              <View style={[styles.resultIcon, styles.locationBadge]}>
                <FigmaAsset name="locate" size={20} />
              </View>
              <Text style={[ui.heading, ui.flex]}>Current location</Text>
              <FigmaAsset name="chevron-right" size={20} />
            </MotionPressable>
          ) : null}

          {cleared ? (
            <UndoToast
              message="Recent searches cleared"
              onUndo={() => {
                void history.restore(cleared)
                setCleared(null)
              }}
            />
          ) : null}
          {query.trim().length < 3 ? (
            <>
              {history.recents.length ? (
                <View style={ui.row}>
                  <Text style={[ui.small, ui.flex]}>Recent searches</Text>
                  <MotionPressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear recent searches"
                    onPress={() => {
                      setCleared(history.recents)
                      void history.clear()
                    }}
                    style={styles.clearAction}
                  >
                    <Text style={[ui.small, ui.link]}>Clear</Text>
                  </MotionPressable>
                </View>
              ) : null}
              {history.recents.map((destination, index) => (
                <DestinationRow
                  key={`${destination.name}-${destination.coordinate.join(',')}`}
                  destination={destination}
                  testID={`destination-recent-${index}`}
                  recent
                  onPress={() => select(destination)}
                />
              ))}
            </>
          ) : (
            <>
              {status === 'loading' ? (
                <View
                  accessibilityLabel="Searching places"
                  accessibilityState={{ busy: true }}
                >
                  {[0, 1, 2].map((index) => (
                    <View key={index} style={styles.result}>
                      <View style={[styles.resultIcon, styles.skeleton]} />
                      <View style={[ui.flex, styles.skeletonText]}>
                        <View style={[styles.skeleton, styles.skeletonName]} />
                        <View style={[styles.skeleton, styles.skeletonArea]} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
              {status === 'unavailable' ? (
                <StateCard
                  title="Destination search is unavailable"
                  body="Browse the map or open Saved places."
                  action="Back to map"
                  onAction={close}
                />
              ) : null}
              {status === 'offline' ? (
                <StateCard
                  title="You are offline"
                  body="Reconnect to search places. You can still browse the map."
                  action="Back to map"
                  onAction={close}
                />
              ) : null}
              {status === 'limited' ? (
                <StateCard
                  title="Search is busy"
                  body={`Please wait ${limitSeconds} seconds before trying again.`}
                  action="Retry search"
                  onAction={() => void search()}
                />
              ) : null}
              {status === 'error' ? (
                <StateCard
                  title="Search couldn’t connect"
                  body="Check your connection and try again."
                  action="Retry search"
                  onAction={() => {
                    cancel()
                    debounce.current = setTimeout(() => void search(), 0)
                  }}
                />
              ) : null}
              {status === 'empty' ? (
                <StateCard
                  icon="no-results"
                  title="No places found"
                  body="Try a street, landmark or neighbourhood name."
                  action="Clear search"
                  onAction={clearSearch}
                />
              ) : null}
              {results.map((destination, index) => (
                <DestinationRow
                  key={`${destination.id}-${index}`}
                  testID={`destination-result-${index}`}
                  destination={destination}
                  onPress={() => select(destination)}
                />
              ))}
              {hasSearchProvider && (notice || layout === 'sheet') ? (
                <Text style={[ui.small, styles.message]}>
                  Searching shares your text with Parkey and its search
                  provider. Map-area bias is sent only when using the legacy
                  provider. Details in You → Privacy.
                </Text>
              ) : null}
            </>
          )}
          {history.error ? <Text style={ui.small}>{history.error}</Text> : null}
        </ScrollView>
      ) : null}
    </View>
  )
}

function DestinationRow({
  destination,
  testID,
  recent = false,
  onPress,
}: {
  destination: Destination
  testID: string
  recent?: boolean
  onPress: () => void
}) {
  return (
    <MotionPressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.result, pressed && ui.pressed]}
    >
      <View style={styles.resultIcon}>
        <FigmaAsset name={recent ? 'viewed-brand' : 'pin'} size={24} />
      </View>
      <View style={ui.flex}>
        <Text numberOfLines={1} style={styles.resultName}>
          {destination.name}
        </Text>
        <Text numberOfLines={1} style={ui.small}>
          {destination.address}
        </Text>
      </View>
      <FigmaAsset name="chevron-right" size={20} />
    </MotionPressable>
  )
}

const styles = StyleSheet.create({
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  container: {
    borderRadius: 32,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    padding: 16,
  },
  compactContainer: { padding: 12 },
  sheetContainer: {
    paddingTop: 0,
    paddingBottom: 12,
    borderRadius: 0,
    flexShrink: 1,
    minHeight: 0,
  },
  sheetBar: {
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: colors.soft,
    borderColor: 'transparent',
  },
  sheetInput: { fontSize: 15, lineHeight: 22, paddingVertical: 12 },
  compactHeader: { paddingBottom: 8 },
  compactBrand: { fontSize: 26, lineHeight: 30 },
  header: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  bar: {
    flexShrink: 0,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 2,
    gap: 12,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.soft,
  },
  focusedBar: { borderColor: colors.accent },
  brand: {
    fontFamily: fonts.black,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1,
    color: colors.brand,
  },
  savedAction: {
    minHeight: 44,
    backgroundColor: colors.soft,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 24,
  },
  input: {
    fontFamily: fonts.regular,
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
    fontSize: 17,
    lineHeight: 24,
    color: colors.ink,
  },
  results: { flexShrink: 1, minHeight: 0, maxHeight: 360, marginTop: 8 },
  resultsContent: { paddingBottom: 4 },
  result: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  resultName: { ...ui.heading, fontFamily: fonts.bold },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.selected,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationBadge: { backgroundColor: colors.positiveSurface },
  clearAction: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  message: { paddingVertical: 12 },
  skeleton: { backgroundColor: colors.border, borderRadius: 8 },
  skeletonText: { gap: 8 },
  skeletonName: { width: '65%', height: 16 },
  skeletonArea: { width: '90%', height: 12 },
})
