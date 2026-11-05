import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
} from '@maplibre/maplibre-react-native'
import { useEffect, useMemo, useRef } from 'react'
import type { CameraRef } from '@maplibre/maplibre-react-native'
import { StyleSheet } from 'react-native'

import { config } from './config'
import { ncrMapSources } from './ncr-map-data'
import type { NcrMapProps } from './ncr-map-data'

export default function NcrMap(props: NcrMapProps) {
  const camera = useRef<CameraRef>(null)
  const sources = useMemo(
    () => ncrMapSources(props.data, props.selectedId),
    [props.data, props.selectedId],
  )
  useEffect(() => {
    camera.current?.jumpTo({
      center: props.target.coordinate,
      zoom: props.target.zoom,
    })
  }, [props.target])
  return (
    <Map
      style={styles.map}
      mapStyle={config.mapStyle}
      onDidFailLoadingMap={props.onError}
      onRegionDidChange={(event) => {
        const {
          bounds: [west, south, east, north],
          zoom,
        } = event.nativeEvent
        props.onViewport({ west, south, east, north, zoom })
      }}
    >
      <Camera
        ref={camera}
        initialViewState={{
          center: props.target.coordinate,
          zoom: props.target.zoom,
        }}
      />
      <GeoJSONSource
        id="ncr-shapes"
        data={sources.shapes}
        onPress={(event) => {
          const id: unknown = event.nativeEvent.features[0]?.properties?.id
          if (typeof id === 'string') props.onSelect(id)
        }}
      >
        <Layer
          id="ncr-areas"
          type="fill"
          filter={['==', ['geometry-type'], 'Polygon']}
          paint={{ 'fill-color': '#8A1060', 'fill-opacity': 0.2 }}
        />
        <Layer
          id="ncr-streets"
          type="line"
          filter={['==', ['geometry-type'], 'LineString']}
          paint={{ 'line-color': '#2E7F88', 'line-width': 4 }}
        />
      </GeoJSONSource>
      <GeoJSONSource
        id="ncr-anchors"
        data={sources.anchors}
        onPress={(event) => {
          const id: unknown = event.nativeEvent.features[0]?.properties?.id
          if (typeof id === 'string') props.onSelect(id)
        }}
      >
        <Layer
          id="ncr-points"
          type="circle"
          paint={{
            'circle-color': [
              'case',
              ['get', 'restricted'],
              '#C23B3B',
              [
                'match',
                ['get', 'featureType'],
                'entrance',
                '#A85A06',
                'space',
                '#24666E',
                '#8A1060',
              ],
            ],
            'circle-radius': [
              'match',
              ['get', 'featureType'],
              'entrance',
              4,
              'space',
              4,
              7,
            ],
          }}
        />
      </GeoJSONSource>
      <GeoJSONSource
        id="ncr-clusters"
        data={sources.clusters}
        onPress={(event) => {
          const geometry = event.nativeEvent.features[0]?.geometry
          if (geometry?.type === 'Point') {
            const [x, y] = geometry.coordinates
            if (x !== undefined && y !== undefined) props.onCluster([x, y])
          }
        }}
      >
        <Layer
          id="ncr-cluster-circles"
          type="circle"
          paint={{ 'circle-color': '#8A1060', 'circle-radius': 18 }}
        />
        <Layer
          id="ncr-cluster-count"
          type="symbol"
          layout={{
            'text-field': ['to-string', ['get', 'observations']],
            'text-size': 12,
          }}
          paint={{ 'text-color': '#FFFFFF' }}
        />
      </GeoJSONSource>
    </Map>
  )
}
const styles = StyleSheet.create({ map: { flex: 1, minHeight: 280 } })
