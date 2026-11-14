import type { ComponentRef, ReactNode } from 'react'
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { usePathname } from 'expo-router'
import {
  AccessibilityInfo,
  findNodeHandle,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useReducedMotion } from '../onboarding/use-reduced-motion'
import { colors, typography } from '../theme'

import { BrandButton } from './brand-button'
import { BrandIcon } from './brand-icon'
import { createPopupGate } from './popup-policy'
import type { PopupIdentity } from './popup-policy'

type PopupAction = {
  title: string
  onPress?: () => void
  restoreFocus?: boolean
}
export type PopupRequest = PopupIdentity & {
  primary?: PopupAction
  secondary?: PopupAction
  returnFocus?: () => void
}
type QueuedPopup = PopupRequest & {
  origin: string
  input: ReturnType<typeof TextInput.State.currentlyFocusedInput>
}
type PopupApi = {
  show: (request: PopupRequest) => void
  allowAgain: (key: string) => void
}
const PopupContext = createContext<PopupApi | null>(null)
const palettes = {
  error: { icon: 'error', surface: colors.errorSurface, ink: colors.plum },
  warning: {
    icon: 'warning',
    surface: colors.warningSurface,
    ink: colors.warningInk,
  },
  success: {
    icon: 'check',
    surface: colors.successSurface,
    ink: colors.fieldIcon,
  },
  info: { icon: 'info', surface: colors.successSurface, ink: colors.fieldIcon },
} as const

export function PopupProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const path = useRef(pathname)
  const queue = useRef<QueuedPopup[]>([])
  const gate = useRef(createPopupGate())
  const [current, setCurrent] = useState<QueuedPopup | null>(null)
  const title = useRef<ComponentRef<typeof Text>>(null)
  const reduced = useReducedMotion()
  useLayoutEffect(() => {
    if (path.current === pathname) return
    path.current = pathname
    // Deep links must not inherit messages or actions from a previous route.
    for (const item of queue.current) gate.current.finish(item)
    queue.current = []
    setCurrent(null)
  }, [pathname])
  useEffect(() => {
    if (!current) return
    const timer = setTimeout(() => focusTitle(), reduced ? 0 : 250)
    return () => clearTimeout(timer)
  }, [current, reduced])

  function dismiss(action?: PopupAction) {
    const previous = queue.current.shift()
    if (!previous) return
    gate.current.finish(previous)
    const next = queue.current[0] ?? null
    setCurrent(next)
    action?.onPress?.()
    if (!next && action?.restoreFocus !== false) {
      setTimeout(
        () => {
          if (path.current !== previous.origin || queue.current.length) return
          try {
            if (previous.returnFocus) previous.returnFocus()
            else previous.input?.focus()
          } catch {
            /* The originating input may have unmounted. */
          }
        },
        reduced ? 0 : 250,
      )
    }
  }
  function focusTitle() {
    const target = findNodeHandle(title.current)
    if (target) AccessibilityInfo.setAccessibilityFocus(target)
  }
  const api: PopupApi = {
    show(request) {
      if (!gate.current.accept(request)) return
      const input = TextInput.State.currentlyFocusedInput()
      Keyboard.dismiss()
      const item = { ...request, origin: path.current, input }
      queue.current.push(item)
      if (queue.current.length === 1) setCurrent(item)
    },
    allowAgain: (key) => gate.current.allowAgain(key),
  }
  const palette = current ? palettes[current.tone] : palettes.info
  return (
    <PopupContext.Provider value={api}>
      {children}
      <Modal
        transparent
        visible={current !== null}
        animationType={reduced ? 'none' : 'fade'}
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => dismiss()}
        onShow={focusTitle}
      >
        <SafeAreaView style={styles.backdrop}>
          {current ? (
            <View
              style={styles.card}
              accessibilityViewIsModal
              importantForAccessibility="yes"
            >
              <ScrollView
                contentContainerStyle={styles.content}
                bounces={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.top}>
                  <View
                    style={[
                      styles.symbol,
                      { backgroundColor: palette.surface },
                    ]}
                  >
                    <BrandIcon
                      name={palette.icon}
                      color={palette.ink}
                      size={30}
                    />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close message"
                    onPress={() => dismiss()}
                    style={styles.close}
                  >
                    <BrandIcon name="close" color={colors.dark} />
                  </Pressable>
                </View>
                <Text
                  ref={title}
                  accessibilityRole="header"
                  style={styles.title}
                >
                  {current.title}
                </Text>
                <Text style={styles.message}>{current.message}</Text>
                <BrandButton
                  title={current.primary?.title ?? 'Got it'}
                  variant="plum"
                  onPress={() => dismiss(current.primary)}
                />
                {current.secondary ? (
                  <BrandButton
                    title={current.secondary.title}
                    variant="plain"
                    onPress={() => dismiss(current.secondary)}
                  />
                ) : null}
              </ScrollView>
            </View>
          ) : null}
        </SafeAreaView>
      </Modal>
    </PopupContext.Provider>
  )
}

export function usePopup() {
  const popup = useContext(PopupContext)
  if (!popup) throw new Error('PopupProvider is required.')
  return popup
}
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '100%',
    alignSelf: 'center',
    backgroundColor: colors.white,
    borderRadius: 24,
    overflow: 'hidden',
  },
  content: { padding: 24, gap: 16 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  symbol: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.subtitle, color: colors.dark },
  message: { ...typography.body, color: colors.fieldInk, marginBottom: 4 },
})
