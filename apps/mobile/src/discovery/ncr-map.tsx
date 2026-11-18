import {
  Camera,
  GeoJSONSource,
  Images,
  Layer,
  Map,
} from '@maplibre/maplibre-react-native'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { CameraRef } from '@maplibre/maplibre-react-native'
import { StyleSheet } from 'react-native'

import mainParkingPin from '../../assets/figma/main-ui/parking-marker.png'
import { useTheme } from '../theme-provider'
import { config } from './config'
import { createLocalMapBenchmark } from './local-map-benchmark'
import { mapTextFont } from './map-font'
import { draftGeoJSON } from './map-data'
import { mainParkingMarkerLayout } from './map-marker-style'

import { ncrMapSources } from './ncr-map-data'
import type { NcrMapProps } from './ncr-map-data'

const pilotImages = { 'main-parking-pin': mainParkingPin }

function NcrMap(props: NcrMapProps) {
  const { colors, mapColors } = useTheme()
  const [markMapReady] = useState(() => createLocalMapBenchmark())
  const draft = useMemo(
    () => draftGeoJSON(props.draftPoints ?? []),
    [props.draftPoints],
  )
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
      accessible={!props.accessibilityHidden}
      accessibilityElementsHidden={props.accessibilityHidden}
      importantForAccessibility={
        props.accessibilityHidden ? 'no-hide-descendants' : 'auto'
      }
      style={styles.map}
      accessibilityLabel={
        props.data?.mode === 'research_preview'
          ? 'Private research map. Source points are not driving entrances.'
          : 'Parking discovery map. Parking markers do not guarantee visitor access or availability.'
      }
      testID={loaded ? 'ncr-map-ready' : 'ncr-map-loading'}
      onDidFinishLoadingMap={() => setLoaded(true)}
      onDidFinishRenderingMapFully={markMapReady}
      mapStyle={props.night ? config.nightMapStyle : config.mapStyle}
      onPress={(event) => props.onMapPress?.(event.nativeEvent.lngLat)}
      onDidFailLoadingMap={props.onError}
      onRegionDidChange={(event) => {
        const {
          bounds: [west, south, east, north],
          zoom,
        } = event.nativeEvent
        props.onViewport({ west, south, east, north, zoom })
      }}
    >
      {props.simplifiedMarkers ? <Images images={pilotImages} /> : null}
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
          if (props.draftPoints) return
          event.stopPropagation()
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
            'fill-color': [
              'case',
              ['get', 'restricted'],
              colors.error,
              colors.brand,
            ],
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
            'line-color': [
              'case',
              ['get', 'restricted'],
              colors.error,
              mapColors.street,
            ],
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
          if (props.draftPoints) return
          event.stopPropagation()
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
        {props.simplifiedMarkers ? (
          <>
            <Layer
              id="ncr-selected-ring"
              type="circle"
              filter={['==', ['get', 'id'], props.selectedId || '']}
              layout={{ visibility }}
              paint={{ 'circle-radius': 29, 'circle-color': colors.surface }}
            />
            <Layer
              id="ncr-parking-markers"
              type="symbol"
              filter={['!', ['has', 'point_count']]}
              layout={{ ...mainParkingMarkerLayout(1 / 3), visibility }}
            />
          </>
        ) : (
          <Layer
            id="ncr-points"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            layout={{ visibility }}
            paint={{
              'circle-color': [
                'case',
                ['get', 'restricted'],
                colors.error,
                [
                  'match',
                  ['get', 'featureType'],
                  'entrance',
                  colors.amber,
                  'space',
                  mapColors.street,
                  colors.brand,
                ],
              ],
              'circle-radius': [
                'case',
                ['==', ['get', 'id'], props.selectedId || ''],
                10,
                ['match', ['get', 'featureType'], 'entrance', 4, 'space', 4, 7],
              ],
              'circle-stroke-color': mapColors.casing,
              'circle-stroke-width': 2,
            }}
          />
        )}
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
            'text-font': mapTextFont,
            'text-size': 12,
            'text-anchor': 'top',
            'text-offset': [0, 1],
            'text-max-width': 16,
          }}
          paint={{
            'text-color': mapColors.label,
            'text-halo-color': mapColors.labelHalo,
            'text-halo-width': 2,
          }}
        />
        <Layer
          id="ncr-cluster-circles"
          type="circle"
          filter={['has', 'point_count']}
          layout={{ visibility }}
          paint={{ 'circle-color': colors.brand, 'circle-radius': 18 }}
        />
        <Layer
          id="ncr-cluster-count"
          type="symbol"
          filter={['has', 'point_count']}
          layout={{
            visibility,
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': mapTextFont,
            'text-size': 12,
          }}
          paint={{ 'text-color': mapColors.casing }}
        />
      </GeoJSONSource>
      {props.draftPoints ? (
        <GeoJSONSource id="pilot-draft" data={draft}>
          <Layer
            id="pilot-draft-line"
            type="line"
            paint={{ 'line-color': colors.amber, 'line-width': 5 }}
          />
          <Layer
            id="pilot-draft-points"
            type="circle"
            filter={['==', ['geometry-type'], 'Point']}
            paint={{
              'circle-radius': 8,
              'circle-color': colors.amber,
              'circle-stroke-color': colors.surface,
              'circle-stroke-width': 2,
            }}
          />
        </GeoJSONSource>
      ) : null}
    </Map>
  )
}
const styles = StyleSheet.create({ map: { flex: 1, minHeight: 0 } })

const MemoizedNcrMap = memo(NcrMap)
MemoizedNcrMap.displayName = 'NcrMap'
export default MemoizedNcrMap
