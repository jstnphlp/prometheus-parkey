import type { NcrDiscoveryResponse, Coordinate } from '@parkey/shared-types'
import type { FeatureCollection, Geometry } from 'geojson'

import type { Viewport } from './model'

export type NcrMapProps = {
  data: NcrDiscoveryResponse | null
  selectedId: string | null
  target: { coordinate: Coordinate; zoom: number }
  onViewport: (viewport: Viewport) => void
  onSelect: (id: string) => void
  onCluster: (coordinate: Coordinate) => void
  onError: () => void
}
export function ncrMapSources(
  data: NcrDiscoveryResponse | null,
  selectedId: string | null,
) {
  const shapes: FeatureCollection<Geometry> = {
    type: 'FeatureCollection',
    features: [],
  }
  const anchors: FeatureCollection<Geometry> = {
    type: 'FeatureCollection',
    features: [],
  }
  for (const item of data?.items || []) {
    const properties = {
      id: item.id,
      featureType: item.featureType,
      selected: item.id === selectedId,
      restricted: item.restrictedAccess,
      hasDestinationLabel:
        data?.mode === 'research_preview' &&
        item.nameReview?.destinationLabel !== undefined,
      label:
        data?.mode === 'research_preview'
          ? item.nameReview?.destinationLabel?.label || item.name
          : item.name,
    }
    shapes.features.push({
      type: 'Feature',
      id: item.id,
      properties,
      geometry: item.geometry,
    })
    anchors.features.push({
      type: 'Feature',
      id: item.id,
      properties,
      geometry: { type: 'Point', coordinates: item.representativePoint },
    })
  }
  const clusters: FeatureCollection<Geometry> = {
    type: 'FeatureCollection',
    features: (data?.clusters || []).map((c) => ({
      type: 'Feature',
      id: c.id,
      properties: {
        id: c.id,
        observations: c.sourceObservationCount,
        facilities: c.facilityCandidateCount,
      },
      geometry: { type: 'Point', coordinates: c.coordinate },
    })),
  }
  return { shapes, anchors, clusters }
}
