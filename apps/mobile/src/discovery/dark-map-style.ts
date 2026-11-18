import type { StyleSpecification } from 'maplibre-gl'

import { discoveryNightMapColors as palette } from '../theme-colors.ts'

export function softenDarkMapStyle(
  style: StyleSpecification,
): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((layer) => {
      if (layer.type === 'background')
        return {
          ...layer,
          paint: { ...layer.paint, 'background-color': palette.land },
        }
      if (layer.type === 'fill') {
        if (layer.id === 'water')
          return {
            ...layer,
            paint: { ...layer.paint, 'fill-color': palette.water },
          }
        if (layer.id === 'building')
          return {
            ...layer,
            paint: {
              ...layer.paint,
              'fill-color': palette.building,
              'fill-outline-color': palette.buildingOutline,
            },
          }
        if (layer.id === 'landuse_park' || layer.id === 'landcover_wood')
          return {
            ...layer,
            paint: { ...layer.paint, 'fill-color': palette.park },
          }
      }
      if (layer.type === 'line') {
        if (layer.id === 'waterway')
          return {
            ...layer,
            paint: { ...layer.paint, 'line-color': palette.water },
          }
        if (layer.id.startsWith('highway_')) {
          const color = layer.id.endsWith('casing')
            ? palette.roadOutline
            : /major|motorway/.test(layer.id)
              ? palette.majorRoad
              : palette.road
          return { ...layer, paint: { ...layer.paint, 'line-color': color } }
        }
      }
      if (
        layer.type === 'symbol' &&
        layer.paint?.['text-color'] !== undefined
      ) {
        const color = layer.id.startsWith('place_')
          ? palette.label
          : palette.secondaryLabel
        return {
          ...layer,
          paint: {
            ...layer.paint,
            'text-color': color,
            'text-halo-color': palette.land,
            'text-halo-width': 1,
          },
        }
      }
      return layer
    }),
  }
}
