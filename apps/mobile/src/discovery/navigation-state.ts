import type { Coordinate } from '@parkey/shared-types'

import type { DiscoveryFilter, FeeFilter } from './filters.ts'
import { isCoordinate, PILOT_CENTER } from './model.ts'
import type { SheetPosition } from './sheet-state.ts'

export type NavigationState = {
  selectedId: string | null
  filter: DiscoveryFilter
  fees: FeeFilter
  position: SheetPosition
  query: string
  searchPoint: Coordinate | null
  searchCredit: { label: string; url: string } | null
  searching: boolean
  panel: 'saved' | 'info' | 'add' | 'you' | null
  route: boolean
  consent: boolean
  center: Coordinate
}
export const navigationDefaults: NavigationState = {
  selectedId: null,
  filter: 'all',
  fees: 'all',
  position: 'compact',
  query: '',
  searchPoint: null,
  searchCredit: null,
  searching: false,
  panel: null,
  route: false,
  consent: false,
  center: PILOT_CENTER,
}
const filters: readonly string[] = [
  'all',
  'street',
  'facilities',
  'lot',
  'garage',
]
const positions: readonly string[] = ['compact', 'medium', 'expanded']

export function parseNavigation(
  search: string,
  preferences: Partial<NavigationState> = {},
): NavigationState {
  const params = new URLSearchParams(search)
  const state = { ...navigationDefaults, ...preferences }
  const filter = params.get('filter')
  if (filter && filters.includes(filter)) {
    if (
      filter === 'all' ||
      filter === 'street' ||
      filter === 'facilities' ||
      filter === 'lot' ||
      filter === 'garage'
    )
      state.filter = filter
  }
  const position = params.get('sheet')
  if (
    position === 'compact' ||
    position === 'medium' ||
    position === 'expanded'
  )
    state.position = position
  if (params.has('fees'))
    state.fees =
      params.get('fees') === 'free'
        ? 'free'
        : params.get('fees') === 'applies'
          ? 'applies'
          : 'all'
  state.selectedId = params.get('spot')?.slice(0, 200) || null
  state.query = (params.get('q') ?? '').slice(0, 180)
  state.searchPoint = null
  if (state.query && params.has('searchLng') && params.has('searchLat')) {
    const point = [
      Number(params.get('searchLng')),
      Number(params.get('searchLat')),
    ]
    if (isCoordinate(point)) state.searchPoint = point
  }
  state.searchCredit = null
  const creditLabel = params.get('credit'),
    creditUrl = params.get('creditUrl')
  if (
    state.searchPoint &&
    creditLabel &&
    creditLabel.length <= 100 &&
    creditUrl &&
    creditUrl.length <= 500
  ) {
    try {
      const link = new URL(creditUrl)
      if (link.protocol === 'https:' && !link.username && !link.password)
        state.searchCredit = { label: creditLabel, url: creditUrl }
    } catch {
      /* Invalid shared-link credits never become actionable links. */
    }
  }
  state.searching = params.get('search') === '1'
  const panel = params.get('panel')
  state.panel =
    panel === 'saved' || panel === 'info' || panel === 'add' || panel === 'you'
      ? panel
      : null
  state.route = params.get('route') === '1'
  state.consent = params.get('consent') === '1'
  if (params.has('lng') && params.has('lat')) {
    const point = [Number(params.get('lng')), Number(params.get('lat'))]
    if (isCoordinate(point)) state.center = point
  }
  return state
}
export function navigationSearch(state: NavigationState): string {
  const params = new URLSearchParams({
    filter: state.filter,
    sheet: state.position,
  })
  if (state.fees !== 'all') params.set('fees', state.fees)
  if (state.selectedId) params.set('spot', state.selectedId)
  if (state.query) params.set('q', state.query)
  if (state.query && state.searchPoint) {
    params.set('searchLng', String(state.searchPoint[0]))
    params.set('searchLat', String(state.searchPoint[1]))
    if (state.searchCredit) {
      params.set('credit', state.searchCredit.label)
      params.set('creditUrl', state.searchCredit.url)
    }
  }
  if (state.searching) params.set('search', '1')
  if (state.panel) params.set('panel', state.panel)
  if (state.route) params.set('route', '1')
  if (state.consent) params.set('consent', '1')
  params.set('lng', String(state.center[0]))
  params.set('lat', String(state.center[1]))
  return `?${params}`
}
export function parsePreferences(
  value: string | null,
): Partial<NavigationState> {
  try {
    const raw: unknown = JSON.parse(value ?? '{}')
    if (!raw || typeof raw !== 'object') return {}
    const result: Partial<NavigationState> = {}
    if (
      'filter' in raw &&
      typeof raw.filter === 'string' &&
      filters.includes(raw.filter)
    ) {
      const parsed = parseNavigation(`?filter=${raw.filter}`)
      result.filter = parsed.filter
    }
    if (
      'position' in raw &&
      typeof raw.position === 'string' &&
      positions.includes(raw.position)
    ) {
      const parsed = parseNavigation(`?sheet=${raw.position}`)
      result.position = parsed.position
    }
    if (
      'fees' in raw &&
      (raw.fees === 'all' || raw.fees === 'applies' || raw.fees === 'free')
    )
      result.fees = raw.fees
    return result
  } catch {
    return {}
  }
}

/** A shared link gets the same Back path as reaching those layers in the app. */
export function navigationLayers(state: NavigationState): NavigationState[] {
  let current: NavigationState = {
    ...state,
    selectedId: null,
    searching: false,
    panel: null,
    route: false,
    consent: false,
    position: 'compact',
  }
  const layers = [current]
  const add = (patch: Partial<NavigationState>) => {
    current = { ...current, ...patch }
    layers.push(current)
  }
  if (state.position !== 'compact') add({ position: 'medium' })
  if (state.position === 'expanded') add({ position: 'expanded' })
  if (state.selectedId) add({ selectedId: state.selectedId })
  if (state.searching) add({ searching: true })
  if (state.panel) add({ panel: state.panel })
  if (state.route) add({ route: true })
  if (state.consent) add({ consent: true })
  return layers
}
