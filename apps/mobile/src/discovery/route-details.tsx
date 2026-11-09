import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'

import { FigmaAsset } from './figma-assets'
import { arrivalTime } from './drive-math'
import { routeDistance, routeDuration } from './routing'
import type { DrivingStep } from './routing'
import { createSheetDragGuard } from './sheet-state'
import { fonts } from './typography'
import { Button, Choice, colors, ui } from './ui'
import type { DrivePhase } from './use-drive-navigation'
import type { RouteState } from './use-route'

export function NavigationBanner({
  step,
  distance,
  rerouting,
  then,
  night = false,
}: {
  then?: DrivingStep | undefined
  step: DrivingStep | undefined
  distance: number
  rerouting: boolean
  night?: boolean
}) {
  const path =
    step?.maneuver.includes('roundabout') || step?.maneuver === 'rotary'
      ? 'M12 21v-5a5 5 0 1 1 5-5M17 11V4m-4 4 4-4 4 4'
      : step?.modifier === 'uturn'
        ? 'M7 21V8a5 5 0 0 1 10 0v8m-4-4 4 4 4-4'
        : step?.modifier.includes('left')
          ? 'M18 21V10H4m5-5-5 5 5 5'
          : step?.modifier.includes('right')
            ? 'M6 21V10h14m-5-5 5 5-5 5'
            : step?.maneuver === 'arrive'
              ? 'M6 22V3h13v10H6'
              : 'M12 22V3m-7 7 7-7 7 7'
  return (
    <View
      testID="navigation-banner"
      style={[styles.banner, night && styles.nightSurface, ui.shadow]}
    >
      <View style={ui.row}>
        <View style={styles.turnBadge}>
          {step?.modifier.includes('right') ? (
            <FigmaAsset name="nav-right" size={33.6} />
          ) : (
            <Svg
              width={34}
              height={34}
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.surface}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d={path} />
            </Svg>
          )}
        </View>
        <View style={ui.flex} accessibilityLiveRegion="polite">
          <Text style={styles.maneuverDistance}>
            {rerouting ? 'Rerouting…' : routeDistance(distance)}
          </Text>
          <Text style={styles.maneuver}>
            {step?.instruction ?? 'Follow the route'}
          </Text>
        </View>
      </View>
      {then ? (
        <View style={[styles.then, night && { backgroundColor: colors.dark }]}>
          <Text style={styles.thenLabel}>Then</Text>
          {then.modifier.includes('left') ? (
            <FigmaAsset name="nav-left" size={24} />
          ) : null}
          <Text style={[ui.small, { color: colors.surface, flex: 1 }]}>
            {then.instruction}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

export function RouteDetails({
  destinationName,
  onExternal,
  checkingEntrance,
  state,
  phase,
  starting,
  denied,
  message,
  remainingDistance,
  remainingDuration,
  onStart,
  onPark,
  onNext,
  saving,
  parked,
  onAnswer,
  onClose,
  onRetry,
  onHeightChange,
  night = false,
}: {
  destinationName: string
  onExternal: (provider: 'google' | 'apple' | 'waze') => void
  checkingEntrance: boolean
  state: RouteState
  phase: DrivePhase
  starting: boolean
  denied: boolean
  message: string | null
  remainingDistance: number | undefined
  remainingDuration: number | undefined
  onStart: () => void
  onPark: () => void
  onNext: (() => void) | null
  saving: boolean
  parked: boolean
  onAnswer: ((answer: 'No limit' | '2 hours') => void) | null
  onClose: () => void
  onRetry: () => void
  onHeightChange: (height: number) => void
  night?: boolean
}) {
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [unsure, setUnsure] = useState(false)
  const [dragGuard] = useState(createSheetDragGuard)
  const gesture = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => {
          dragGuard.reset()
          return false
        },
        onPanResponderGrant: dragGuard.start,
        onMoveShouldSetPanResponder: (_, event) =>
          Math.abs(event.dy) > 12 && Math.abs(event.dy) > Math.abs(event.dx),
        onPanResponderRelease: (_, event) => {
          if (event.dy > 25 || event.vy > 0.5) onClose()
        },
      }),
    [onClose, dragGuard],
  )
  const busy = state.status === 'locating' || state.status === 'loading'
  const duration = remainingDuration ?? state.route?.duration
  const distance = remainingDistance ?? state.route?.distance
  const floating = phase === 'navigating'
  const floatingBottom = floating ? Math.max(insets.bottom, 24) : 0
  return (
    <View
      testID="route-panel"
      onLayout={(event) =>
        onHeightChange(event.nativeEvent.layout.height + floatingBottom)
      }
      style={[
        styles.sheet,
        floating && styles.tripBar,
        floating && night && styles.nightSurface,
        ui.shadow,
        {
          maxHeight: height * 0.8,
          bottom: floatingBottom,
          paddingBottom: floating ? 16 : Math.max(insets.bottom, 24),
        },
      ]}
    >
      {floating ? (
        <>
          <View style={[ui.row, { gap: 12 }]}>
            <View style={ui.flex}>
              {duration !== undefined && distance !== undefined ? (
                <>
                  <Text
                    style={[styles.eta, night && { color: colors.surface }]}
                  >
                    {routeDuration(duration)}
                  </Text>
                  <Text
                    style={[ui.small, night && { color: colors.onDarkMuted }]}
                  >
                    {routeDistance(distance)} · Arrive {arrivalTime(duration)}
                  </Text>
                </>
              ) : (
                <Text style={[ui.body, night && { color: colors.surface }]}>
                  Calculating route…
                </Text>
              )}
            </View>
            {onNext ? (
              <Pressable
                accessibilityRole="button"
                onPress={onNext}
                style={({ pressed }) => [
                  styles.next,
                  night && { backgroundColor: colors.dark },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text
                  style={[styles.nextText, night && { color: colors.surface }]}
                >
                  Next spot
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.end,
                night && { backgroundColor: colors.dark },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={[styles.endText, night && { color: '#FF8F85' }]}>
                End
              </Text>
            </Pressable>
          </View>
          {message || state.error ? (
            <Text accessibilityRole="alert" style={[ui.small, ui.error]}>
              {message ?? state.error}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          <View {...gesture.panHandlers}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss directions. Swipe down or activate to return to the map"
              onPress={({ nativeEvent }) => {
                const keyboard =
                  'detail' in nativeEvent && nativeEvent.detail === 0
                if (dragGuard.allowPress(keyboard)) onClose()
              }}
              style={styles.handleTouch}
            >
              <View style={styles.handle} />
            </Pressable>
          </View>
          <ScrollView
            style={ui.sheetScroll}
            contentContainerStyle={{ gap: 14 }}
          >
            {phase === 'arrived' ? (
              <>
                <View style={{ gap: 2 }}>
                  <Text accessibilityRole="header" style={ui.title}>
                    You made it!
                  </Text>
                  <Text style={[ui.body, { color: colors.muted }]}>
                    {destinationName}
                  </Text>
                </View>
                <Button
                  icon="check"
                  disabled={saving}
                  onPress={parked ? () => undefined : onPark}
                >
                  {saving
                    ? 'Saving…'
                    : parked
                      ? 'Parked here'
                      : 'I parked here'}
                </Button>
                <View style={styles.warning}>
                  <FigmaAsset name="arrival-info" size={24} />
                  <Text style={[ui.small, { color: colors.ink, flex: 1 }]}>
                    Check the signs before you leave your car.
                  </Text>
                </View>
                {onAnswer ? (
                  <View style={styles.help}>
                    <View style={ui.row}>
                      <FigmaAsset name="mascot" size={56} />
                      <View style={ui.flex}>
                        <Text style={[ui.heading, ui.link]}>
                          Help other drivers
                        </Text>
                        <Text style={ui.body}>Is there a time limit here?</Text>
                      </View>
                    </View>
                    <View style={[ui.row, { gap: 8, flexWrap: 'wrap' }]}>
                      <Choice
                        selected={false}
                        onPress={() => onAnswer('No limit')}
                      >
                        No limit
                      </Choice>
                      <Choice
                        selected={false}
                        onPress={() => onAnswer('2 hours')}
                      >
                        2 hours
                      </Choice>
                      <Choice selected={unsure} onPress={() => setUnsure(true)}>
                        Not sure
                      </Choice>
                    </View>
                    {unsure ? (
                      <Text accessibilityLiveRegion="polite" style={ui.small}>
                        That’s okay — check the posted signs.
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {onNext ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving}
                    onPress={onNext}
                    style={styles.nextLink}
                  >
                    <Text style={[ui.small, ui.link]}>
                      Not here? Find the next nearest spot
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={ui.small}>
                    No other mapped parking of this type nearby.
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text accessibilityRole="header" style={ui.sectionTitle}>
                  {destinationName}
                </Text>
                {busy || starting ? (
                  <View style={ui.row}>
                    <ActivityIndicator color={colors.brand} />
                    <Text style={ui.body}>
                      {starting ? 'Starting navigation…' : 'Calculating route…'}
                    </Text>
                  </View>
                ) : null}
                {state.route && !starting ? (
                  <Button icon="arrow" onPress={onStart}>
                    Go
                  </Button>
                ) : null}
                {!state.route && !busy ? (
                  <Button secondary onPress={onRetry}>
                    Try again
                  </Button>
                ) : null}
              </>
            )}
            {message || state.error ? (
              <Text accessibilityRole="alert" style={[ui.small, ui.error]}>
                {message ?? state.error}
              </Text>
            ) : null}
            {denied || state.error ? (
              <View style={{ gap: 8 }}>
                {(['google', 'apple', 'waze'] as const).map((provider) => (
                  <Button
                    key={provider}
                    secondary
                    disabled={checkingEntrance}
                    onPress={() => onExternal(provider)}
                  >
                    Open in{' '}
                    {provider === 'google'
                      ? 'Google Maps'
                      : provider === 'apple'
                        ? 'Apple Maps'
                        : 'Waze'}
                  </Button>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </>
      )}
    </View>
  )
}
const styles = StyleSheet.create({
  nightSurface: {
    backgroundColor: colors.darkRaised,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxWidth: 620,
    marginHorizontal: 'auto',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingTop: 0,
    gap: 0,
  },
  handleTouch: { height: 32, alignItems: 'center', justifyContent: 'center' },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  banner: {
    backgroundColor: colors.dark,
    borderRadius: 28,
    padding: 16,
    gap: 14,
  },
  tripBar: {
    left: 16,
    right: 16,
    borderRadius: 28,
    paddingLeft: 24,
    paddingRight: 16,
    paddingTop: 16,
    gap: 12,
  },
  turnBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maneuverDistance: {
    fontFamily: fonts.black,
    fontSize: 40,
    lineHeight: 40,
    letterSpacing: -1.2,
    color: colors.surface,
  },
  then: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.darkRaised,
    borderRadius: 999,
    paddingLeft: 14,
    paddingRight: 16,
    paddingVertical: 10,
  },
  thenLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.onDarkMuted,
  },
  next: {
    backgroundColor: colors.soft,
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 49,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  end: {
    backgroundColor: colors.dangerSurface,
    borderRadius: 999,
    paddingHorizontal: 24,
    minHeight: 49,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endText: { fontFamily: fonts.semibold, fontSize: 17, color: colors.error },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.warningSurface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  help: {
    padding: 16,
    borderRadius: 28,
    backgroundColor: colors.selected,
    gap: 14,
  },
  nextLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  eta: {
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 31,
    letterSpacing: -0.56,
    color: colors.ink,
  },
  maneuver: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.onDarkMuted,
    flexShrink: 1,
  },
})
