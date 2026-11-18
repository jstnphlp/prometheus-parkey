import { useWindowDimensions } from 'react-native'

import { useArchitectureInsets } from './architecture-page'

/** Keep Figma's 430 × 932 geometry, contracting space before making text smaller. */
export function useFormLayout() {
  const { width, height, fontScale } = useWindowDimensions()
  const safe = useArchitectureInsets()
  const insets = {
    ...safe,
    top: Math.max(44, safe.top),
    bottom: Math.max(34, safe.bottom),
  }
  const verticalScale = Math.min(
    1,
    Math.max(0.55, (height - insets.top - insets.bottom - 126) / 728),
  )
  return {
    insets,
    height,
    width,
    fontScale,
    compact: height - insets.top - insets.bottom < 800,
    horizontalScale: Math.min(width / 430, 1),
    horizontalPadding: Math.min(30, (width * 30) / 430),
    space: (value: number) => value * verticalScale,
  }
}
