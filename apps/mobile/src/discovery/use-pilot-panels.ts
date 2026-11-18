import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

const panels = [
  'results',
  'filters',
  'profile',
  'preview',
  'search',
  'access',
  'detail',
  'entrance',
  'sources',
  'saved',
] as const
export type PilotPanel = (typeof panels)[number] | null

function validPanel(value: unknown): PilotPanel {
  return panels.find((panel) => panel === value) ?? null
}

/** Pilot pages retain their data owner while Back represents each page. */
export function usePilotPanels() {
  const [panel, setPanel] = useState<PilotPanel>(null)
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const current = useRef<PilotPanel>(null)
  const appearance = useRef(false)
  const trail = useRef<{ panel: PilotPanel; appearance: boolean }[]>([])
  const set = useCallback((next: PilotPanel) => {
    if (next === current.current && !appearance.current) return
    if (next)
      trail.current.push({
        panel: current.current,
        appearance: appearance.current,
      })
    else trail.current = []
    current.current = next
    appearance.current = false
    setAppearanceOpen(false)
    if (Platform.OS === 'web') {
      window.history[next ? 'pushState' : 'replaceState'](
        {
          ...window.history.state,
          parkeyPilotPanel: next,
          parkeyPilotAppearance: false,
        },
        '',
      )
    }
    setPanel(next)
  }, [])
  const back = useCallback(() => {
    if (
      Platform.OS === 'web' &&
      (current.current || appearance.current) &&
      window.history.state?.parkeyPilotPanel === current.current
    ) {
      window.history.back()
      return
    }
    const previous = trail.current.pop() ?? { panel: null, appearance: false }
    current.current = previous.panel
    appearance.current = previous.appearance
    setPanel(previous.panel)
    setAppearanceOpen(previous.appearance)
  }, [])
  const openAppearance = useCallback(() => {
    if (appearance.current) return
    trail.current.push({ panel: current.current, appearance: false })
    appearance.current = true
    if (Platform.OS === 'web') {
      window.history.pushState(
        {
          ...window.history.state,
          parkeyPilotPanel: current.current,
          parkeyPilotAppearance: true,
        },
        '',
      )
    }
    setAppearanceOpen(true)
  }, [])
  useEffect(() => {
    if (Platform.OS !== 'web') return
    // Refresh cannot revive a transient record/reviewer page without its data.
    window.history.replaceState(
      {
        ...window.history.state,
        parkeyPilotPanel: null,
        parkeyPilotAppearance: false,
      },
      '',
    )
    const pop = () => {
      if (window.location.pathname !== '/') return
      const next = validPanel(window.history.state?.parkeyPilotPanel)
      current.current = next
      appearance.current = window.history.state?.parkeyPilotAppearance === true
      setPanel(next)
      setAppearanceOpen(appearance.current)
    }
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])
  return { panel, set, back, appearanceOpen, openAppearance }
}
