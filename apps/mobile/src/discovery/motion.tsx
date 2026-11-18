import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ComponentRef, ReactNode, Ref } from 'react'
import { Animated, Easing, Platform, Pressable } from 'react-native'
import type { PressableProps, View, ViewProps } from 'react-native'

import { useReducedMotion } from './use-reduced-motion'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)
const useNativeDriver = Platform.OS !== 'web'
export const motionEaseOut = Easing.bezier(0.1, 0.7, 0.1, 1)
export const motionEaseStandard = Easing.bezier(0.2, 0, 0, 1)

/** Keep feedback on the touch target itself so its layout and hit area stay put. */
export function MotionPressable({
  ref,
  style,
  disabled,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  onBlur,
  ...props
}: PressableProps & { ref?: Ref<ComponentRef<typeof View>> }) {
  const reduced = useReducedMotion()
  const [scale] = useState(() => new Animated.Value(1))
  const [pressed, setPressed] = useState(false)
  const [hovered, setHovered] = useState(false)
  useEffect(() => {
    if (reduced || disabled) {
      scale.stopAnimation()
      scale.setValue(1)
    }
    return () => scale.stopAnimation()
  }, [disabled, reduced, scale])

  function release() {
    setPressed(false)
    if (reduced || disabled) return
    Animated.spring(scale, {
      toValue: 1,
      stiffness: 420,
      damping: 32,
      mass: 0.6,
      overshootClamping: true,
      isInteraction: false,
      useNativeDriver,
    }).start()
  }

  const interactionState = { pressed: pressed && !disabled, hovered }

  return (
    <AnimatedPressable
      {...props}
      ref={ref}
      disabled={disabled}
      onPressIn={(event) => {
        setPressed(true)
        if (!reduced && !disabled)
          Animated.timing(scale, {
            toValue: 0.97,
            duration: 90,
            easing: motionEaseOut,
            isInteraction: false,
            useNativeDriver,
          }).start()
        onPressIn?.(event)
      }}
      onPressOut={(event) => {
        release()
        onPressOut?.(event)
      }}
      onHoverIn={(event) => {
        setHovered(true)
        onHoverIn?.(event)
      }}
      onHoverOut={(event) => {
        setHovered(false)
        onHoverOut?.(event)
      }}
      onBlur={(event) => {
        release()
        onBlur?.(event)
      }}
      style={[
        typeof style === 'function' ? style(interactionState) : style,
        { transform: [{ scale }] },
      ]}
    />
  )
}

export function useEntranceProgress(
  duration = 220,
  transitionKey?: string | number,
  enabled = true,
) {
  const reduced = useReducedMotion()
  const [progress] = useState(
    () => new Animated.Value(reduced || !enabled ? 1 : 0),
  )
  const previousKey = useRef(transitionKey)
  useLayoutEffect(() => {
    const changed = previousKey.current !== transitionKey
    previousKey.current = transitionKey
    if (reduced || !enabled) {
      progress.setValue(1)
      return
    }
    if (changed) progress.setValue(0)
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: motionEaseOut,
      isInteraction: false,
      useNativeDriver,
    })
    animation.start()
    return () => animation.stop()
  }, [duration, enabled, progress, reduced, transitionKey])
  return progress
}

export function revealStyle(
  progress: Animated.Value,
  { distance = 8, fromOpacity = 0, start = 0, end = 1 } = {},
) {
  return {
    opacity: progress.interpolate({
      inputRange: [start, end],
      outputRange: [fromOpacity, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [start, end],
          outputRange: [distance, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  }
}

/** A short reveal on an existing surface, with no layout changes. */
export function MotionView({
  style,
  transitionKey,
  distance,
  fromOpacity,
  duration,
  ...props
}: ViewProps & {
  transitionKey?: string | number
  distance?: number
  fromOpacity?: number
  duration?: number
}) {
  const progress = useEntranceProgress(duration, transitionKey)
  return (
    <Animated.View
      {...props}
      style={[style, revealStyle(progress, { distance, fromOpacity })]}
    />
  )
}

/**
 * Retain a closing presentation only for its exit frames. Logical visibility
 * still owns touch and accessibility, and a reversal uses the current value.
 */
export function MotionLayer({
  visible,
  style,
  ...props
}: ViewProps & { visible: boolean }) {
  const reduced = useReducedMotion()
  const [present, setPresent] = useState(visible)
  if (visible && !present) setPresent(true)
  // Browsers remove the closing form immediately to retire keyboard focus.
  const keepClosing = !reduced && Platform.OS !== 'web'
  if (!visible && present && !keepClosing) setPresent(false)
  const [progress] = useState(() => new Animated.Value(reduced ? 1 : 0))
  useLayoutEffect(() => {
    if (!visible && !present) {
      progress.setValue(0)
      return
    }
    if (reduced) {
      progress.setValue(visible ? 1 : 0)
      return
    }
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 150,
      easing: visible ? motionEaseOut : motionEaseStandard,
      isInteraction: false,
      useNativeDriver,
    })
    animation.start(({ finished }) => {
      if (finished && !visible) setPresent(false)
    })
    return () => animation.stop()
  }, [present, progress, reduced, visible])

  if (!visible && (!present || !keepClosing)) return null
  return (
    <Animated.View
      {...props}
      aria-hidden={!visible}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      pointerEvents={visible ? 'auto' : 'none'}
      style={[style, revealStyle(progress, { distance: 6 })]}
    />
  )
}

export function SelectionPop({
  selected,
  children,
}: {
  selected: boolean
  children: ReactNode
}) {
  const reduced = useReducedMotion()
  const previous = useRef(selected)
  const [scale] = useState(() => new Animated.Value(1))
  useEffect(() => {
    const changed = previous.current !== selected
    previous.current = selected
    if (reduced) {
      scale.setValue(1)
      return
    }
    if (!changed) return
    const settle = Animated.timing(scale, {
      toValue: 1,
      duration: 130,
      easing: motionEaseStandard,
      isInteraction: false,
      useNativeDriver,
    })
    const animation = selected
      ? Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.06,
            duration: 70,
            easing: motionEaseOut,
            isInteraction: false,
            useNativeDriver,
          }),
          settle,
        ])
      : settle
    animation.start()
    return () => animation.stop()
  }, [reduced, scale, selected])
  return (
    <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
  )
}
