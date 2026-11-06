import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
} from '@maplibre/maplibre-react-native'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CameraRef } from '@maplibre/maplibre-react-native'
import { StyleSheet } from 'react-native'

import { config } from './config'
import { ncrMapSources } from './ncr-map-data'
import type { NcrMapProps } from './ncr-map-data'

export default function NcrMap(props: NcrMapProps) {
  const camera = useRef<CameraRef>(null)
  const [loaded, setLoaded] = useState(false)
  const visibility = props.data?.items.length ? 'visible' : 'none'
  const sources = useMemo(() => ncrMapSources(props.data, null), [props.data])
  useEffect(() => {
    camera.current?.jumpTo({
      center: props.target.coordinate,
      zoom: props.target.zoom,
    })
  }, [props.target])
  return (
    <Map
      style={styles.map}
      testID={loaded ? 'ncr-map-ready' : 'ncr-map-loading'}
      onDidFinishLoadingMap={() => setLoaded(true)}
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
        minZoom={8.5}
        maxZoom={20}
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
          minzoom={14}
          layout={{ visibility }}
          paint={{
            'fill-color': ['case', ['get', 'restricted'], '#C23B3B', '#8A1060'],
            'fill-opacity': 0.2,
          }}
        />
        <Layer
          id="ncr-streets"
          type="line"
          minzoom={14}
          filter={['==', ['geometry-type'], 'LineString']}
          layout={{ visibility }}
          paint={{
            'line-color': ['case', ['get', 'restricted'], '#C23B3B', '#2E7F88'],
            'line-width': 4,
          }}
        />
      </GeoJSONSource>
      <GeoJSONSource
        id="ncr-anchors"
        data={sources.anchors}
        cluster
        clusterRadius={48}
        clusterMaxZoom={14}
        onPress={(event) => {
          const feature = event.nativeEvent.features[0]
          if (
            feature?.properties?.cluster === true &&
            feature.geometry.type === 'Point'
          ) {
            const [x, y] = feature.geometry.coordinates
            if (x !== undefined && y !== undefined) props.onCluster([x, y])
          } else {
            const id: unknown = feature?.properties?.id
            if (typeof id === 'string') props.onSelect(id)
          }
        }}
      >
        <Layer
          id="ncr-points"
          type="circle"
          filter={['!', ['has', 'point_count']]}
          layout={{ visibility }}
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
              'case',
              ['==', ['get', 'id'], props.selectedId || ''],
              10,
              ['match', ['get', 'featureType'], 'entrance', 4, 'space', 4, 7],
            ],
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-width': 2,
          }}
        />
        <Layer
          id="ncr-destination-labels"
          type="symbol"
          minzoom={16}
          filter={[
            'all',
            ['!', ['has', 'point_count']],
            ['==', ['get', 'hasDestinationLabel'], true],
          ]}
          layout={{
            visibility,
            'text-field': ['get', 'label'],
            'text-font': ['Noto Sans Bold'],
            'text-size': 12,
            'text-anchor': 'top',
            'text-offset': [0, 1],
            'text-max-width': 16,
          }}
          paint={{
            'text-color': '#5A1643',
            'text-halo-color': '#FFFFFF',
            'text-halo-width': 2,
          }}
        />
        <Layer
          id="ncr-cluster-circles"
          type="circle"
          filter={['has', 'point_count']}
          layout={{ visibility }}
          paint={{ 'circle-color': '#8A1060', 'circle-radius': 18 }}
        />
        <Layer
          id="ncr-cluster-count"
          type="symbol"
          filter={['has', 'point_count']}
          layout={{
            visibility,
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['Noto Sans Bold'],
            'text-size': 12,
          }}
          paint={{ 'text-color': '#FFFFFF' }}
        />
      </GeoJSONSource>
    </Map>
  )
}
const styles = StyleSheet.create({ map: { flex: 1, minHeight: 0 } })
