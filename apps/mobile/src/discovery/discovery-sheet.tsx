import type { ComponentRef, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type {
  PanResponderCallbacks,
  PanResponderGestureState,
} from 'react-native'

import { useTheme, createThemedStyles } from '../theme-provider'
import {
  createSheetDragGuard,
  sheetHeights,
  snapSheet,
  stepSheet,
} from './sheet-state'
import type { SheetPosition } from './sheet-state'
import {
  advanceSheetWheel,
  initialSheetWheel,
  wheelPixels,
} from './sheet-wheel'
import { IconButton, useUI } from './ui'
import { useReducedMotion } from './use-reduced-motion'

function createSheetPans({
  position,
  selected,
  expandable,
  targetHeight,
  heights,
  motion,
  settle,
  onPositionChange,
  onClose,
  getScrollOffset,
  dragGuard,
}: {
  position: SheetPosition
  selected: boolean
  expandable: boolean
  targetHeight: number
  heights: ReturnType<typeof sheetHeights>
  motion: Animated.Value
  settle: (next: SheetPosition) => void
  onPositionChange: (next: SheetPosition) => void
  onClose: () => void
  getScrollOffset: (() => number) | undefined
  dragGuard: ReturnType<typeof createSheetDragGuard>
}) {
  let dragHeight = targetHeight
  let contentStartedAtTop = false
  function verticalGesture(gesture: PanResponderGestureState) {
    return (
      Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx)
    )
  }
  function shouldMoveContent(gesture: PanResponderGestureState) {
    return (
      verticalGesture(gesture) &&
      (gesture.dy > 0
        ? contentStartedAtTop &&
          (getScrollOffset?.() ?? 0) <= 1 &&
          (selected || position !== 'compact')
        : position !== 'expanded' && (!selected || expandable))
    )
  }
  const callbacks: PanResponderCallbacks = {
    onPanResponderGrant: () => {
      dragGuard.start()
      dragHeight = targetHeight
      motion.stopAnimation((value) => {
        dragHeight = value
      })
    },
    onPanResponderMove: (_, gesture) => {
      motion.setValue(
        Math.max(
          selected ? Math.min(140, targetHeight) : heights.compact,
          Math.min(heights.expanded, dragHeight - gesture.dy),
        ),
      )
    },
    onPanResponderRelease: (_, gesture) => {
      if (!selected)
        settle(snapSheet(heights, dragHeight - gesture.dy, gesture.vy, false))
      else if (gesture.dy > 25 || gesture.vy > 0.5) {
        if (position === 'expanded') onPositionChange('medium')
        else onClose()
      } else if (expandable && (gesture.dy < -25 || gesture.vy < -0.5))
        settle('expanded')
      else settle(position)
    },
    onPanResponderTerminate: () => settle(position),
  }
  return {
    handlePan: PanResponder.create({
      ...callbacks,
      onStartShouldSetPanResponderCapture: () => {
        dragGuard.reset()
        return false
      },
      onMoveShouldSetPanResponder: (_, gesture) => verticalGesture(gesture),
    }),
    contentPan: PanResponder.create({
      ...callbacks,
      onStartShouldSetPanResponderCapture: () => {
        dragGuard.reset()
        contentStartedAtTop = (getScrollOffset?.() ?? 0) <= 1
        return false
      },
      onMoveShouldSetPanResponder: (_, gesture) => shouldMoveContent(gesture),
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        shouldMoveContent(gesture),
    }),
  }
}

export function DiscoverySheet({
  position,
  bottom = 0,
  overlayHeight = 0,
  previewHeight = 0,
  contentHeight = 0,
  getScrollOffset,
  header,
  keyboardAware = false,
  accessory,
  selected,
  expandable = true,
  title,
  summary,
  onPositionChange,
  onHeightChange,
  onClose,
  children,
}: {
  position: SheetPosition
  bottom?: number
  overlayHeight?: number
  previewHeight?: number
  contentHeight?: number
  getScrollOffset?: () => number
  header?: ReactNode
  keyboardAware?: boolean
  accessory?: ReactNode
  expandable?: boolean
  selected: boolean
  title: string
  summary: string
  onPositionChange: (position: SheetPosition) => void
  onHeightChange: (height: number) => void
  onClose: () => void
  children: ReactNode
}) {
  const ui = useUI()
  const styles = useStyles()

  const { height, fontScale } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [headerHeight, setHeaderHeight] = useState(112)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  useEffect(() => {
    if (!keyboardAware) return
    if (Platform.OS === 'web') {
      const viewport = window.visualViewport
      const resize = () =>
        setKeyboardHeight(
          Math.max(
            0,
            height - (viewport ? viewport.height + viewport.offsetTop : height),
          ),
        )
      resize()
      viewport?.addEventListener('resize', resize)
      viewport?.addEventListener('scroll', resize)
      return () => {
        viewport?.removeEventListener('resize', resize)
        viewport?.removeEventListener('scroll', resize)
      }
    }
    const show = Keyboard.addListener('keyboardDidShow', (event) =>
      setKeyboardHeight(Math.max(0, height - event.endCoordinates.screenY)),
    )
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardHeight(0),
    )
    return () => {
      show.remove()
      hide.remove()
    }
  }, [height, keyboardAware])
  const keyboardInset = keyboardAware ? keyboardHeight : 0
  const safeBottom = keyboardInset > 0 ? 0 : insets.bottom
  const heights = useMemo(
    () =>
      sheetHeights(
        height - bottom - keyboardInset,
        insets.top,
        safeBottom,
        selected,
        fontScale,
        headerHeight + previewHeight,
        overlayHeight,
      ),
    [
      height,
      bottom,
      keyboardInset,
      insets.top,
      safeBottom,
      selected,
      fontScale,
      headerHeight,
      previewHeight,
      overlayHeight,
    ],
  )
  const selectedHeight = Math.min(
    heights.expanded,
    contentHeight + 32 + Math.max(safeBottom, 16),
  )
  const targetHeight =
    selected && contentHeight > 0 ? selectedHeight : heights[position]
  const [motion] = useState(() => new Animated.Value(heights[position]))
  const animatedHeight = useMemo(
    () => Animated.add(motion, bottom),
    [motion, bottom],
  )
  const [dragGuard] = useState(createSheetDragGuard)
  const reduced = useReducedMotion()
  const root = useRef<ComponentRef<typeof View>>(null)
  const wheelGesture = useRef(initialSheetWheel)
  useEffect(() => {
    const element = root.current
    if (Platform.OS !== 'web' || !(element instanceof HTMLElement)) return
    const handle = element.querySelector<HTMLElement>(
      '[data-testid=parking-sheet-handle]',
    )
    if (handle) handle.title = 'Drag to resize; click to change sheet size'
    const pointerDown = () => dragGuard.reset()
    const click = (event: MouseEvent) => {
      if (dragGuard.allowPress(event.detail === 0)) return
      event.preventDefault()
      event.stopPropagation()
    }
    const wheel = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        event.shiftKey ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      )
        return
      const delta = wheelPixels(
        event.deltaY,
        event.deltaMode,
        element.clientHeight,
      )
      if (delta === 0) return
      let target = event.target instanceof HTMLElement ? event.target : null
      while (target && target !== element) {
        const overflow = window.getComputedStyle(target).overflowY
        const canScroll =
          (overflow === 'auto' || overflow === 'scroll') &&
          (delta < 0
            ? target.scrollTop > 1
            : target.scrollTop + target.clientHeight < target.scrollHeight - 1)
        if (canScroll) {
          // Finishing a list's momentum at its edge must not dismiss the sheet.
          wheelGesture.current = advanceSheetWheel(
            wheelGesture.current,
            delta,
            event.timeStamp,
            true,
          ).gesture
          return
        }
        target = target.parentElement
      }
      const result = advanceSheetWheel(
        wheelGesture.current,
        delta,
        event.timeStamp,
      )
      wheelGesture.current = result.gesture
      const canResize =
        delta > 0
          ? position !== 'expanded' && (!selected || expandable)
          : selected || position !== 'compact'
      if (!canResize) return
      event.preventDefault()
      if (!result.step) return
      if (selected && position !== 'expanded' && result.step < 0) onClose()
      else
        onPositionChange(
          selected
            ? result.step > 0
              ? 'expanded'
              : 'medium'
            : stepSheet(position, result.step),
        )
    }
    element.addEventListener('wheel', wheel, { passive: false })
    element.addEventListener('pointerdown', pointerDown, true)
    element.addEventListener('click', click, true)
    return () => {
      element.removeEventListener('wheel', wheel)
      element.removeEventListener('pointerdown', pointerDown, true)
      element.removeEventListener('click', click, true)
    }
  }, [position, onPositionChange, onClose, selected, expandable, dragGuard])
  const animateHeight = useCallback(
    () =>
      reduced
        ? Animated.timing(motion, {
            toValue: targetHeight,
            duration: 0,
            useNativeDriver: false,
          })
        : Animated.spring(motion, {
            toValue: targetHeight,
            stiffness: 300,
            damping: 32,
            mass: 0.9,
            overshootClamping: true,
            isInteraction: false,
            useNativeDriver: false,
          }),
    [motion, reduced, targetHeight],
  )
  useEffect(() => {
    onHeightChange(targetHeight + bottom)
    const animation = animateHeight()
    animation.start()
    return () => animation.stop()
  }, [targetHeight, bottom, animateHeight, onHeightChange, position])
  const settle = useCallback(
    (next: SheetPosition) => {
      if (next === position) animateHeight().start()
      else onPositionChange(next)
    },
    [position, animateHeight, onPositionChange],
  )
  const { handlePan, contentPan } = useMemo(
    () =>
      createSheetPans({
        position,
        selected,
        expandable,
        targetHeight,
        heights,
        motion,
        settle,
        onPositionChange,
        onClose,
        getScrollOffset,
        dragGuard,
      }),
    [
      position,
      selected,
      expandable,
      targetHeight,
      heights,
      motion,
      settle,
      onPositionChange,
      onClose,
      getScrollOffset,
      dragGuard,
    ],
  )
  return (
    <Animated.View
      ref={root}
      testID="discovery-sheet"
      style={[
        styles.sheet,
        ui.shadow,
        {
          bottom: keyboardInset,
          height: animatedHeight,
          maxHeight: height - insets.top - keyboardInset,
          paddingBottom: bottom + Math.max(safeBottom, 16),
        },
      ]}
    >
      <View
        onLayout={(event) => {
          if (!selected && !keyboardAware)
            setHeaderHeight(event.nativeEvent.layout.height)
        }}
        style={keyboardAware ? { flex: 1, minHeight: 0 } : undefined}
      >
        <View style={styles.top} {...handlePan.panHandlers}>
          <Pressable
            testID="parking-sheet-handle"
            disabled={selected && !expandable}
            accessibilityRole="button"
            accessibilityLabel={`Parking sheet: ${position === 'compact' ? 'peek' : position === 'medium' ? 'half' : 'full'}. Swipe down to dismiss. Activate to ${position === 'expanded' ? 'collapse' : 'expand'}`}
            accessibilityActions={[
              { name: 'escape', label: 'Dismiss parking sheet' },
              { name: 'increment', label: 'Expand parking sheet' },
              { name: 'decrement', label: 'Collapse parking sheet' },
            ]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'escape') onClose()
              else if (event.nativeEvent.actionName === 'increment')
                onPositionChange('expanded')
              else if (selected && position !== 'expanded') onClose()
              else onPositionChange(selected ? 'medium' : 'compact')
            }}
            accessibilityState={{ expanded: position !== 'compact' }}
            onPress={({ nativeEvent }) => {
              // Browsers can synthesize a click after the drag has already snapped.
              const keyboard =
                'detail' in nativeEvent && nativeEvent.detail === 0
              if (!dragGuard.allowPress(keyboard)) return
              onPositionChange(
                selected
                  ? expandable && position !== 'expanded'
                    ? 'expanded'
                    : 'medium'
                  : position === 'expanded'
                    ? 'compact'
                    : stepSheet(position, 1),
              )
            }}
            style={styles.gripTouch}
          >
            {!selected || expandable ? <View style={styles.grip} /> : null}
          </Pressable>
        </View>
        {header ??
          (!selected ? (
            <Pressable
              testID="parking-results-toggle"
              accessibilityRole="button"
              accessibilityLabel={`${title}. ${summary}. Show parking results`}
              onPress={() =>
                onPositionChange(
                  selected
                    ? expandable && position !== 'expanded'
                      ? 'expanded'
                      : 'medium'
                    : position === 'compact'
                      ? 'medium'
                      : 'compact',
                )
              }
              style={[styles.header, !!accessory && { paddingRight: 72 }]}
            >
              <Text
                accessibilityRole="header"
                style={ui.sectionTitle}
                numberOfLines={1}
              >
                {title}
              </Text>
              <Text style={ui.small} numberOfLines={1}>
                {summary}
              </Text>
            </Pressable>
          ) : null)}
      </View>
      {accessory ? (
        <View style={{ position: 'absolute', top: 36, right: 16 }}>
          {accessory}
        </View>
      ) : null}
      <View
        style={keyboardAware ? { display: 'none' } : ui.flex}
        {...contentPan.panHandlers}
      >
        {children}
      </View>
    </Animated.View>
  )
}
const useStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      maxWidth: 620,
      marginHorizontal: 'auto',
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      overflow: 'hidden',
    },
    top: { height: 32, alignItems: 'center', justifyContent: 'center' },
    gripTouch: {
      minHeight: 44,
      width: 120,
      alignItems: 'center',
      justifyContent: 'center',
    },
    grip: {
      width: 40,
      height: 5,
      borderRadius: 2,
      backgroundColor: colors.disabledSurface,
    },
    header: { paddingHorizontal: 24, gap: 6, paddingBottom: 20, minHeight: 64 },
  }),
)
export function MapAttribution({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme()
  const ui = useUI()
  const attributionStyles = useAttributionStyles()

  return (
    <IconButton
      icon="info"
      color={colors.disabled}
      label="Map data sources and attribution"
      onPress={onPress}
      style={[attributionStyles.touch, ui.shadow]}
    />
  )
}
const useAttributionStyles = createThemedStyles(({ colors }) =>
  StyleSheet.create({
    touch: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
  }),
)
