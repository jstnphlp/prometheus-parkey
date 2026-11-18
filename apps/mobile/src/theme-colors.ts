export type ThemeMode = 'light-magenta' | 'dark-magenta'

// Exact Parkey / Semantic Colors values. Brand artwork is deliberately separate.
export const semanticColors = {
  'light-magenta': {
    canvas: '#FFFFFF',
    surface: '#FBF7FA',
    card: '#FFFFFF',
    text: '#20162E',
    secondary: '#655A6D',
    border: '#EDE1EA',
    primary: '#840561',
    brand: '#840561',
    onAction: '#FFFFFF',
    mapCanvas: '#F9F0F6',
    mapBlock: '#ECDDE8',
    mapRoad: '#FFFFFF',
    pending: '#840561',
    verified: '#007F80',
    accentSoft: '#F7E6F0',
    marker: '#840561',
    navigationActive: '#840561',
    navigationInactive: '#716A77',
    back: '#00A6A7',
  },
  'dark-magenta': {
    canvas: '#20162E',
    surface: '#291D35',
    card: '#30243D',
    text: '#FFFFFF',
    secondary: '#D9CFDE',
    border: '#58405A',
    primary: '#840561',
    brand: '#840561',
    onAction: '#FFFFFF',
    mapCanvas: '#271D30',
    mapBlock: '#382D41',
    mapRoad: '#554A5E',
    pending: '#E460AA',
    verified: '#00A6A7',
    accentSoft: '#41243A',
    marker: '#840561',
    navigationActive: '#FFFFFF',
    navigationInactive: '#D9CFDE',
    back: '#00A6A7',
  },
} as const

export function parseThemeMode(value: unknown): ThemeMode {
  return value === 'dark-magenta' ? value : 'light-magenta'
}

function makeTheme(mode: ThemeMode) {
  const tokens = semanticColors[mode]
  const dark = mode === 'dark-magenta'
  const colors = {
    brand: tokens.primary,
    brandDeep: tokens.pending,
    accent: tokens.verified,
    action: tokens.primary,
    actionPressed: '#65034A',
    ink: tokens.text,
    muted: tokens.secondary,
    disabled: tokens.secondary,
    surface: tokens.card,
    canvas: tokens.canvas,
    soft: tokens.surface,
    selected: tokens.accentSoft,
    selectedPressed: dark ? '#563049' : '#EDD0E1',
    positiveSurface: dark ? '#193C3C' : '#E0F3F1',
    disabledSurface: tokens.surface,
    border: tokens.border,
    line: tokens.border,
    amber: dark ? '#FFCC80' : '#875000',
    warningSurface: dark ? '#413320' : '#FFF2D8',
    error: dark ? '#FFABBE' : '#B32143',
    dark: '#20162E',
    darkRaised: '#30243D',
    onDarkMuted: '#D9CFDE',
    success: tokens.verified,
    successSurface: dark ? '#193C3C' : '#E0F3F1',
    dangerSurface: dark ? '#482438' : '#FBE4EC',
    backdrop: 'rgba(32,22,46,0.64)',
    shadow: 'rgba(32,22,46,0.14)',
    onAction: tokens.onAction,
    navigationActive: tokens.navigationActive,
    navigationInactive: tokens.navigationInactive,
    back: tokens.back,
    link: tokens.pending,
  }
  const entryColors = {
    ...tokens,
    plum: tokens.primary,
    teal: tokens.primary,
    cyan: tokens.pending,
    dark: tokens.text,
    white: '#FFFFFF',
    onPlumMuted: tokens.secondary,
    onDarkMuted: tokens.secondary,
    onTealMuted: tokens.secondary,
    progressMuted: tokens.border,
    fieldInk: tokens.text,
    fieldIcon: tokens.pending,
    controlBorder: tokens.border,
    successSurface: colors.successSurface,
    warningSurface: colors.warningSurface,
    warningInk: colors.amber,
    errorSurface: colors.dangerSurface,
    error: colors.error,
    backdrop: colors.backdrop,
    link: tokens.pending,
  }
  const mapColors = {
    casing: '#FFFFFF',
    label: '#20162E',
    labelHalo: '#FFFFFF',
    facility: tokens.marker,
    facilityOutline: '#FFFFFF',
    facilityLabel: '#FFFFFF',
    facilitySelected: tokens.primary,
    facilitySelectedOutline: '#FFFFFF',
    facilitySelectedLabel: '#FFFFFF',
    street: tokens.verified,
    streetSelected: tokens.marker,
    route: tokens.primary,
    user: '#007F80',
    userHalo: '#00A6A7',
    destination: tokens.marker,
    draft: colors.amber,
    parked: tokens.text,
  }
  return { mode, dark, tokens, colors, entryColors, mapColors }
}

export const themes = {
  'light-magenta': makeTheme('light-magenta'),
  'dark-magenta': makeTheme('dark-magenta'),
}
export type ParkeyTheme = ReturnType<typeof makeTheme>

export const discoveryNightMapColors = {
  land: '#292331',
  building: '#393142',
  buildingOutline: '#4D4358',
  water: '#2A3A4B',
  park: '#34473F',
  road: '#52495D',
  majorRoad: '#6B6076',
  roadOutline: '#403747',
  label: '#EEE8F3',
  secondaryLabel: '#D1C8DC',
} as const
