import type { SymbolLayerSpecification } from 'maplibre-gl'

import { mapTextFont } from './map-font.ts'
import { colors } from './palette.ts'

/** Native images use physical pixels; web registers the same 3× files at pixelRatio 3. */
export function parkingMarkerLayout(scale: number) {
  return {
    'icon-image': [
      'case',
      ['get', 'featured'],
      'parking-pin',
      ['get', 'free'],
      'pin-free',
      ['get', 'knownFee'],
      'pin-paid',
      'pin-unknown',
    ],
    'icon-size': scale,
    'icon-anchor': 'bottom',
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
    'text-field': ['case', ['get', 'featured'], '', ['get', 'label']],
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
    'text-offset': [0, -7.5],
    'text-max-width': 16,
    'text-allow-overlap': true,
  } satisfies NonNullable<SymbolLayerSpecification['layout']>
}

export const parkingLabelPaint = {
  'text-color': colors.ink,
  'text-halo-color': colors.surface,
  'text-halo-width': 2,
  'text-halo-blur': 0.5,
} satisfies NonNullable<SymbolLayerSpecification['paint']>
