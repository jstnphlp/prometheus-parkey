import { useEffect, useRef, useState } from 'react'
import type { ComponentRef, ReactNode, Ref } from 'react'
import { Animated, Easing, Platform, Pressable } from 'react-native'
import type { PressableProps, View, ViewProps } from 'react-native'

import { useReducedMotion } from './use-reduced-motion'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)
const useNativeDriver = Platform.OS !== 'web'

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
      damping: 24,
      mass: 0.6,
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
            duration: 85,
            easing: Easing.out(Easing.quad),
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

/** A short, one-time reveal for newly opened content and confirmations. */
export function MotionView({
  style,
  transitionKey,
  ...props
}: ViewProps & { transitionKey?: string | number }) {
  const reduced = useReducedMotion()
  const [progress] = useState(() => new Animated.Value(reduced ? 1 : 0))
  const previousKey = useRef(transitionKey)
  useEffect(() => {
    const changed = previousKey.current !== transitionKey
    previousKey.current = transitionKey
    if (reduced) {
      progress.setValue(1)
      return
    }
    if (changed) progress.setValue(0)
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      isInteraction: false,
      useNativeDriver,
    })
    animation.start()
    return () => animation.stop()
  }, [progress, reduced, transitionKey])
  return (
    <Animated.View
      {...props}
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
      ]}
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
    if (reduced || !changed) {
      scale.setValue(1)
      return
    }
    scale.setValue(selected ? 0.7 : 0.9)
    const animation = Animated.spring(scale, {
      toValue: 1,
      stiffness: 480,
      damping: 18,
      mass: 0.5,
      isInteraction: false,
      useNativeDriver,
    })
    animation.start()
    return () => animation.stop()
  }, [reduced, scale, selected])
  return (
    <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
  )
}
