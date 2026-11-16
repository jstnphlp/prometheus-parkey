import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import * as SystemUI from 'expo-system-ui'

import { parseThemeMode, themes } from './theme-colors'
import type { ParkeyTheme, ThemeMode } from './theme-colors'

export const THEME_STORAGE_KEY = 'parkey.appearance.v1'
type ThemeContextValue = ParkeyTheme & {
  ready: boolean
  saving: boolean
  error: string | null
  setMode: (mode: ThemeMode) => Promise<void>
}
const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setCurrentMode] = useState<ThemeMode>('light-magenta')
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef(false)
  useEffect(() => {
    let active = true
    void AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((value) => {
        if (active) setCurrentMode(parseThemeMode(value))
      })
      .catch(() => {
        if (active)
          setError(
            'Appearance could not be restored. Choose a theme to try saving again.',
          )
      })
      .finally(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
  }, [])
  const theme = themes[mode]
  useEffect(() => {
    if (!ready) return
    void SystemUI.setBackgroundColorAsync(theme.tokens.canvas).catch(() => {})
    if (Platform.OS === 'web') {
      document.documentElement.style.colorScheme = theme.dark ? 'dark' : 'light'
      document.documentElement.style.backgroundColor = theme.tokens.canvas
    }
  }, [ready, theme])

  async function setMode(next: ThemeMode) {
    if (pending.current) return
    pending.current = true
    setSaving(true)
    setError(null)
    // Update in place: never key/remount the router, map, forms or local stores.
    setCurrentMode(next)
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      setError(
        'Theme changed for this session. Could not save it; choose the theme again to retry.',
      )
    } finally {
      pending.current = false
      setSaving(false)
    }
  }
  return (
    <ThemeContext.Provider value={{ ...theme, ready, saving, error, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const theme = useContext(ThemeContext)
  if (!theme) throw new Error('ThemeProvider is required.')
  return theme
}

// Style objects are immutable and shared per mode; each consumer subscribes to
// context so memoized children and native modal roots update without remounting.
export function createThemedStyles<T>(factory: (theme: ParkeyTheme) => T) {
  const cache = new Map<ThemeMode, T>()
  return function useThemedStyles() {
    const theme = useTheme()
    let styles = cache.get(theme.mode)
    if (styles === undefined) {
      styles = factory(theme)
      cache.set(theme.mode, styles)
    }
    return styles
  }
}
