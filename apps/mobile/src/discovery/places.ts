import type { SymbolLayerSpecification } from 'maplibre-gl'

import type { Destination } from './data.ts'
import { mapTextFont } from './map-font.ts'
import { isCoordinate } from './model.ts'
import type { NavigationState } from './navigation-state.ts'

// OpenFreeMap's OpenMapTiles poi layer contains OSM places, independently of
// Parkey's reviewed parking records. Keep collision detection and tile culling.
export const placeLayer = {
  id: 'parkey-places',
  type: 'symbol',
  source: 'openmaptiles',
  'source-layer': 'poi',
  minzoom: 14,
  filter: [
    'all',
    ['has', 'name'],
    ['!=', ['get', 'class'], 'parking'],
  ] satisfies ['all', ['has', string], ['!=', ['get', string], string]],
  layout: {
    'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']] satisfies [
      'coalesce',
      ['get', string],
      ['get', string],
    ],
    'text-font': mapTextFont,
    'text-size': [
      'interpolate',
      ['linear'],
      ['zoom'],
      14,
      11,
      18,
      14,
    ] satisfies [
      'interpolate',
      ['linear'],
      ['zoom'],
      number,
      number,
      number,
      number,
    ],
    'text-max-width': 9,
    'text-padding': 5,
    'symbol-sort-key': ['coalesce', ['get', 'rank'], 100] satisfies [
      'coalesce',
      ['get', string],
      number,
    ],
  },
  paint: {
    'text-color': '#526474',
    'text-halo-color': '#FFFFFF',
    'text-halo-width': 1.5,
  },
} satisfies SymbolLayerSpecification

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
function text(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 180) : ''
}

// Called only with features queried from our POI layer, never parking sources.
export function placeFromFeature(feature: unknown): Destination | null {
  if (
    !object(feature) ||
    !object(feature.geometry) ||
    !object(feature.properties)
  )
    return null
  const { geometry, properties: p } = feature
  const name = text(p['name:en']) || text(p.name)
  if (
    geometry.type !== 'Point' ||
    !isCoordinate(geometry.coordinates) ||
    !name ||
    p.class === 'parking'
  )
    return null
  return {
    id: `poi:${String(feature.id ?? geometry.coordinates.join(','))}`,
    name,
    coordinate: geometry.coordinates,
    address: [
      text(p['addr:housenumber']),
      text(p['addr:street']),
      text(p['addr:city']),
    ]
      .filter(Boolean)
      .join(', '),
  }
}

export function parkingNearDestination(
  place: Destination,
): Partial<NavigationState> {
  return {
    searching: false,
    query: place.name,
    searchPoint: place.coordinate,
    searchCredit: place.attribution ?? null,
    selectedId: null,
    center: place.coordinate,
    position: 'medium',
    route: false,
    panel: null,
  }
}
