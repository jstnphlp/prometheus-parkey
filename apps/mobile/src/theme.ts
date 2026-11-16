import type { TextStyle } from 'react-native'

import regular from '../assets/fonts/Outfit_400Regular.ttf'
import medium from '../assets/fonts/Outfit_500Medium.ttf'
import semibold from '../assets/fonts/Outfit_600SemiBold.ttf'
import bold from '../assets/fonts/Outfit_700Bold.ttf'
import extraBold from '../assets/fonts/Outfit_800ExtraBold.ttf'
import black from '../assets/fonts/Outfit_900Black.ttf'

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  screen: 26,
} as const

export const radius = {
  button: 14,
  compactButton: 13,
  rasterArtwork: 17,
  artwork: 20,
} as const
export const layout = {
  maxWidth: 440,
  buttonHeight: 52,
  touchTarget: 44,
} as const

export const fonts = {
  regular: 'OutfitRegular',
  medium: 'OutfitMedium',
  semibold: 'OutfitSemiBold',
  bold: 'OutfitBold',
  extraBold: 'OutfitExtraBold',
  black: 'OutfitBlack',
  wordmark: 'OutfitBlack',
} as const

export const fontSources = {
  [fonts.regular]: regular,
  [fonts.medium]: medium,
  [fonts.semibold]: semibold,
  [fonts.bold]: bold,
  [fonts.extraBold]: extraBold,
  [fonts.black]: black,
}

export const typography = {
  title: {
    fontFamily: fonts.black,
    fontSize: 37,
    lineHeight: 47,
    letterSpacing: -0.75,
  },
  subtitle: {
    fontFamily: fonts.extraBold,
    fontSize: 26,
    lineHeight: 33,
    letterSpacing: -0.75,
  },
  accountTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 31,
    lineHeight: 38,
    letterSpacing: -0.75,
  },
  loginTitle: {
    fontFamily: fonts.black,
    fontSize: 34,
    lineHeight: 39,
    letterSpacing: -0.75,
  },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 21 },
  welcomeBody: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 19 },
  accountBody: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 18 },
  button: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22 },
  link: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18 },
  wordmark: {
    fontFamily: fonts.wordmark,
    fontSize: 72,
    lineHeight: 98,
    letterSpacing: -1.9,
  },
} as const satisfies Record<string, TextStyle>
