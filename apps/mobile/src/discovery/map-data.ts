import type { Coordinate, DiscoveryParking } from '@parkey/shared-types'
import type { FeatureCollection, LineString, Point } from 'geojson'

import { hasParkingFeature } from './filters.ts'
import { parkingFee } from './parking-fee.ts'

export function parkingGeoJSON(
  records: DiscoveryParking[],
  selectedId: string | null,
  featuredId: string | null = null,
): FeatureCollection<Point | LineString> {
  return {
    type: 'FeatureCollection',
    features: records.map((record) => {
      const fee = parkingFee(record)
      return {
        type: 'Feature',
        id: record.id,
        geometry: record.geometry,
        properties: {
          id: record.id,
          kind: record.kind,
          hasEVCharging: hasParkingFeature(record, 'ev'),
          sample: record.sourceKind === 'sample',
          selected: record.id === selectedId,
          muted: selectedId !== null && record.id !== selectedId,
          label: fee ? (fee.length <= 8 ? fee : 'Paid') : 'Fee ?',
          free: fee === 'Free',
          knownFee: fee !== undefined,
          featured: record.id === featuredId,
          name: record.name,
          // Symbol sort keys draw larger values last: southern pins sit on top.
          sortKey:
            record.geometry.type === 'Point'
              ? -(record.geometry.coordinates[1] ?? 0)
              : 0,
        },
      }
    }),
  }
}

export function parkingMapSources(
  records: DiscoveryParking[],
  selectedId: string | null,
  featuredId: string | null = null,
) {
  const streets: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features: [],
  }
  const facilities: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: [],
  }
  const selected: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: [],
  }
  // Stable input order also breaks ties between pins at the same latitude.
  for (const feature of [
    ...parkingGeoJSON(records, selectedId, featuredId).features,
  ].sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    if (feature.geometry.type === 'LineString') {
      streets.features.push({ ...feature, geometry: feature.geometry })
      const center =
        feature.geometry.coordinates[
          Math.floor(feature.geometry.coordinates.length / 2)
        ]
      if (center)
        (feature.id === selectedId ? selected : facilities).features.push({
          ...feature,
          geometry: { type: 'Point', coordinates: center },
        })
    } else {
      const source = feature.id === selectedId ? selected : facilities
      source.features.push({ ...feature, geometry: feature.geometry })
    }
  }
  return { streets, facilities, selected }
}

export function draftGeoJSON(
  points: Coordinate[],
): FeatureCollection<Point | LineString> {
  return {
    type: 'FeatureCollection',
    features: [
      ...(points.length >= 2
        ? [
            {
              type: 'Feature' as const,
              properties: {},
              geometry: { type: 'LineString' as const, coordinates: points },
            },
          ]
        : []),
      ...points.map((point) => ({
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'Point' as const, coordinates: point },
      })),
    ],
  }
}
