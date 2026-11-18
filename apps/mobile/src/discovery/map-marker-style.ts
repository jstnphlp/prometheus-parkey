import type { SymbolLayerSpecification } from 'maplibre-gl'

import { mapTextFont } from './map-font.ts'
import type { ParkeyTheme } from '../theme-colors.ts'

/** Native images use physical pixels; web registers the same 3× files at pixelRatio 3. */
export function parkingMarkerLayout(scale: number) {
  return {
    'icon-image': 'parking-pin',
    'icon-size': scale,
    'icon-anchor': 'bottom',
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
    'text-field': '',
    'text-font': mapTextFont,
    'text-size': 17,
    'text-offset': [0, -1.7],
    'text-allow-overlap': true,
    'text-ignore-placement': true,
    'text-optional': true,
    'symbol-z-order': 'source',
    'symbol-sort-key': ['get', 'sortKey'],
  } satisfies NonNullable<SymbolLayerSpecification['layout']>
}

export function parkingLabelLayout() {
  return {
    'text-field': ['get', 'name'],
    'text-font': mapTextFont,
    'text-size': 12,
    'text-offset': [0, -4.8],
    'text-max-width': 16,
    'text-allow-overlap': true,
  } satisfies NonNullable<SymbolLayerSpecification['layout']>
}

export const parkingLabelPaint = (colors: ParkeyTheme['colors']) =>
  ({
    'text-color': colors.ink,
    'text-halo-color': colors.surface,
    'text-halo-width': 2,
    'text-halo-blur': 0.5,
  }) satisfies NonNullable<SymbolLayerSpecification['paint']>

export function mainParkingMarkerLayout(scale: number) {
  return {
    'icon-image': 'main-parking-pin',
    'icon-size': scale,
    'icon-anchor': 'center',
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  } satisfies NonNullable<SymbolLayerSpecification['layout']>
}
