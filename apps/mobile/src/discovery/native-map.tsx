import {
  Camera,
  GeoJSONSource,
  Images,
  Layer,
  Map,
} from '@maplibre/maplibre-react-native'
import type {
  CameraRef,
  GeoJSONSourceRef,
} from '@maplibre/maplibre-react-native'
import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet } from 'react-native'

import parkingPinImage from '../../assets/figma/playful/mascot.png'
import freePin from '../../assets/figma/playful/pin-free.png'
import paidPin from '../../assets/figma/playful/pin-paid.png'
import unknownPin from '../../assets/figma/playful/pin-unknown.png'
import mapLabel from '../../assets/figma/playful/map-label.png'
import navUp from '../../assets/figma/playful/nav-up.png'
import selectedParkingPinImage from '../../assets/figma/playful/mascot.png'

import { config } from './config'
import { createLocalMapBenchmark } from './local-map-benchmark'
import { mapTextFont } from './map-font'
import { routeBearing, splitRoute } from './drive-math'
import { draftGeoJSON, parkingMapSources } from './map-data'
import type { ParkingMapProps } from './map-types'
import { mapColors, colors } from './palette'
import { parkingLabelLayout, parkingMarkerLayout } from './map-marker-style'
import { routeBounds } from './routing'
import { useReducedMotion } from './use-reduced-motion'

const parkingImages = {
  'parking-pin': parkingPinImage,
  'pin-free': freePin,
  'pin-paid': paidPin,
  'pin-unknown': unknownPin,
  'map-label': mapLabel,
  'nav-up': navUp,
  'parking-pin-selected': selectedParkingPinImage,
}

export default function NativeMap(props: ParkingMapProps) {
  const [markMapReady] = useState(() => createLocalMapBenchmark())
  const camera = useRef<CameraRef>(null)
  const facilities = useRef<GeoJSONSourceRef>(null)
  const previousTarget = useRef(props.target)
  const focusUntil = useRef(0)
  const [initialViewState] = useState(() => ({
    center: props.target.coordinate,
    zoom: 16,
    padding: { ...props.cameraPadding, left: 0, right: 0 },
  }))
  const reduced = useReducedMotion()
  const [loaded, setLoaded] = useState(false)
  const records = useMemo(
    () => parkingMapSources(props.records, props.selectedId, props.featuredId),
    [props.records, props.selectedId, props.featuredId],
  )
  const draft = useMemo(
    () => draftGeoJSON(props.draftPoints),
    [props.draftPoints],
  )
  const { target, route, onStatus } = props
  const { top, bottom } = props.cameraPadding
  useEffect(() => {
    if (!loaded) return
    if (route && !props.navigation) {
      const [[west, south], [east, north]] = routeBounds(route)
      camera.current?.fitBounds([west, south, east, north], {
        duration: reduced ? 0 : 400,
        padding: { top: top + 20, bottom: bottom + 20, left: 28, right: 28 },
      })
      return
    }
    const focusTarget = previousTarget.current !== target
    previousTarget.current = target
    if (focusTarget) focusUntil.current = Date.now() + 1000
    if (!focusTarget) {
      void camera.current
        ?.setStop({
          ...(props.selectedId || Date.now() < focusUntil.current
            ? { center: target.coordinate }
            : {}),
          padding: { top, bottom, left: 0, right: 0 },
          duration: reduced ? 0 : 400,
          easing: 'ease',
        })
        .catch(() => onStatus('error'))
      return
    }
    camera.current?.easeTo({
      center: target.coordinate,
      zoom: 16,
      duration: reduced ? 0 : 400,
      padding: { top, bottom, left: 0, right: 0 },
    })
  }, [
    target,
    route,
    top,
    bottom,
    loaded,
    props.selectedId,
    props.navigation,
    onStatus,
    reduced,
  ])

  useEffect(() => {
    if (!loaded || !props.navigation?.following || !props.userLocation) return
    camera.current?.easeTo({
      center: props.userLocation,
      zoom: 17,
      duration: reduced ? 0 : 650,
      padding: { top, bottom, left: 0, right: 0 },
    })
  }, [
    loaded,
    props.navigation?.following,
    props.userLocation,
    top,
    bottom,
    reduced,
  ])
  const split = useMemo(
    () =>
      route && props.navigation
        ? splitRoute(route, props.navigation.along)
        : null,
    [route, props.navigation],
  )

  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={props.night ? config.nightMapStyle : config.mapStyle}
      attribution={false}
      logo={false}
      compass={false}
      onWillStartLoadingMap={() => props.onStatus('loading')}
      onDidFinishLoadingMap={() => {
        setLoaded(true)
        props.onStatus('ready')
      }}
      onDidFailLoadingMap={() => props.onStatus('error')}
      onDidFinishRenderingMapFully={markMapReady}
      onRegionWillChange={(event) => {
        if (event.nativeEvent.userInteraction) {
          props.navigation?.onPan()
          props.onPan?.()
        }
      }}
      onPress={(event) => props.onMapPress(event.nativeEvent.lngLat)}
      onRegionDidChange={(event) => {
        const {
          bounds: [west, south, east, north],
          zoom,
        } = event.nativeEvent
        props.onViewport({ west, south, east, north, zoom })
      }}
    >
      <Images images={parkingImages} />
      <Camera
        ref={camera}
        initialViewState={initialViewState}
        minZoom={3}
        maxZoom={20}
      />
      <GeoJSONSource
        id="route"
        data={
          split
            ? { type: 'LineString', coordinates: split.remaining }
            : (route?.geometry ?? { type: 'FeatureCollection', features: [] })
        }
      >
        <Layer
          id="route-casing"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{
            'line-color': props.night ? '#17141A' : mapColors.casing,
            'line-width': 10,
          }}
        />
        <Layer
          id="route-line"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{
            'line-color': props.night ? '#25CAD3' : mapColors.route,
            'line-width': 6,
          }}
        />
      </GeoJSONSource>
      <GeoJSONSource
        id="traveled-route"
        data={
          split && split.traveled.length > 1
            ? { type: 'LineString', coordinates: split.traveled }
            : { type: 'FeatureCollection', features: [] }
        }
      >
        <Layer
          id="traveled-route"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': '#929A9D', 'line-width': 6 }}
        />
      </GeoJSONSource>
      <GeoJSONSource
        id="parking"
        data={records.streets}
        onPress={(event) => {
          if (props.drawing) return
          event.stopPropagation()
          const id: unknown = event.nativeEvent.features[0]?.properties?.id
          if (typeof id === 'string') props.onSelect(id)
        }}
      >
        <Layer
          id="street-casing"
          type="line"
          filter={['==', ['geometry-type'], 'LineString']}
          paint={{
            'line-color': mapColors.casing,
            'line-width': 10,
            'line-opacity': ['case', ['get', 'muted'], 0.75, 1],
          }}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        />
        <Layer
          id="streets"
          type="line"
          filter={['==', ['geometry-type'], 'LineString']}
          paint={{
            'line-color': [
              'case',
              ['get', 'selected'],
              mapColors.streetSelected,
              mapColors.street,
            ],
            'line-width': 6,
            'line-opacity': ['case', ['get', 'muted'], 0.75, 1],
          }}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        />
      </GeoJSONSource>
      <GeoJSONSource
        ref={facilities}
        id="facilities"
        data={records.facilities}
        cluster
        clusterRadius={50}
        clusterMaxZoom={15}
        onPress={(event) => {
          if (props.drawing) return
          event.stopPropagation()
          const feature = event.nativeEvent.features[0]
          if (props.searching && feature?.geometry.type === 'Point') {
            const [lng, lat] = feature.geometry.coordinates
            if (lng !== undefined && lat !== undefined)
              props.onMapPress([lng, lat])
            return
          }
          const clusterId: unknown = feature?.properties?.cluster_id
          if (
            typeof clusterId === 'number' &&
            feature?.geometry.type === 'Point'
          ) {
            const [lng, lat] = feature.geometry.coordinates
            if (lng !== undefined && lat !== undefined) {
              void facilities.current
                ?.getClusterExpansionZoom(clusterId)
                .then((zoom) => {
                  camera.current?.easeTo({
                    center: [lng, lat],
                    zoom,
                    duration: reduced ? 0 : 450,
                  })
                })
                .catch(() => props.onStatus('error'))
            }
          } else {
            const id: unknown = feature?.properties?.id
            if (typeof id === 'string') props.onSelect(id)
          }
        }}
      >
        <Layer
          id="cluster-shadow"
          type="circle"
          filter={['has', 'point_count']}
          paint={{
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              19,
              10,
              23,
              50,
              27,
            ],
            'circle-color': colors.brandDeep,
            'circle-blur': 0.5,
            'circle-opacity': 0.25,
            'circle-translate': [0, 2],
          }}
        />
        <Layer
          id="clusters"
          type="circle"
          filter={['has', 'point_count']}
          paint={{
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              16,
              10,
              20,
              50,
              24,
            ],
            'circle-color': colors.brandDeep,
            'circle-stroke-color': mapColors.casing,
            'circle-stroke-width': 3,
            'circle-opacity': 1,
          }}
        />
        <Layer
          id="cluster-count"
          type="symbol"
          filter={['has', 'point_count']}
          layout={{
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': mapTextFont,
            'text-size': 14,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          }}
          paint={{ 'text-color': mapColors.facilityLabel, 'text-opacity': 1 }}
        />
        <Layer
          id="facilities"
          type="symbol"
          filter={['!', ['has', 'point_count']]}
          layout={parkingMarkerLayout(1 / 3)}
          paint={{
            'icon-opacity': ['case', ['get', 'muted'], 0.65, 1],
            'text-opacity': ['case', ['get', 'muted'], 0.65, 1],
            'text-color': colors.surface,
          }}
        />
      </GeoJSONSource>
      <GeoJSONSource
        id="selected-facility"
        data={records.selected}
        onPress={(event) => {
          if (props.drawing) return
          event.stopPropagation()
          const id: unknown = event.nativeEvent.features[0]?.properties?.id
          if (typeof id === 'string') props.onSelect(id)
        }}
      >
        <Layer
          id="selected-halo"
          type="circle"
          paint={{
            'circle-radius': 46,
            'circle-color': colors.brand,
            'circle-opacity': 0.18,
          }}
        />
        <Layer
          id="selected-facility"
          type="symbol"
          layout={{
            'icon-image': 'parking-pin-selected',
            'icon-size': 1 / 3,
            'icon-anchor': 'bottom',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'symbol-z-order': 'source',
            'symbol-sort-key': ['get', 'sortKey'],
          }}
          paint={{
            'icon-opacity': 1,
            'icon-opacity-transition': { duration: 0 },
          }}
        />
        <Layer
          id="selected-name"
          type="symbol"
          layout={parkingLabelLayout(1 / 3)}
          paint={{ 'text-color': colors.surface }}
        />
      </GeoJSONSource>
      {props.userLocation ? (
        <GeoJSONSource
          id="user"
          data={{ type: 'Point', coordinates: props.userLocation }}
        >
          <Layer
            id="user-halo"
            type="circle"
            paint={{
              'circle-radius': props.navigation ? 50 : 32,
              'circle-color': mapColors.userHalo,
              'circle-opacity': 0.15,
            }}
          />
          <Layer
            id="user-dot"
            type="circle"
            paint={{
              'circle-radius': props.navigation ? 26 : 10,
              'circle-color': mapColors.user,
              'circle-stroke-color': mapColors.casing,
              'circle-stroke-width': 3,
            }}
          />
          {props.navigation ? (
            <Layer
              id="user-heading"
              type="symbol"
              layout={{
                'icon-image': 'nav-up',
                'icon-size': 1 / 3,
                'icon-rotate': routeBearing(split?.remaining ?? []),
                'icon-rotation-alignment': 'map',
                'icon-allow-overlap': true,
              }}
            />
          ) : null}
        </GeoJSONSource>
      ) : null}
      {props.parkedLocation ? (
        <GeoJSONSource
          id="parked"
          data={{ type: 'Point', coordinates: props.parkedLocation }}
        >
          <Layer
            id="parked-dot"
            type="circle"
            paint={{
              'circle-radius': 10,
              'circle-color': mapColors.parked,
              'circle-stroke-color': mapColors.casing,
              'circle-stroke-width': 3,
            }}
          />
          <Layer
            id="parked-label"
            type="symbol"
            layout={{
              'text-font': mapTextFont,
              'text-field': 'Your car',
              'text-size': 10,
              'text-allow-overlap': true,
            }}
            paint={{ 'text-color': mapColors.casing }}
          />
        </GeoJSONSource>
      ) : null}
      {props.destination ? (
        <GeoJSONSource
          id="destination"
          data={{ type: 'Point', coordinates: props.destination }}
        >
          <Layer
            id="destination-dot"
            type="circle"
            paint={{
              'circle-radius': 8,
              'circle-color': mapColors.destination,
              'circle-stroke-color': mapColors.casing,
              'circle-stroke-width': 3,
            }}
          />
        </GeoJSONSource>
      ) : null}
      <GeoJSONSource id="draft" data={draft}>
        <Layer
          id="draft-line"
          type="line"
          paint={{
            'line-color': mapColors.draft,
            'line-width': 5,
            'line-dasharray': [2, 1],
          }}
        />
        <Layer
          id="draft-points"
          type="circle"
          filter={['==', ['geometry-type'], 'Point']}
          paint={{
            'circle-radius': 7,
            'circle-color': mapColors.draft,
            'circle-stroke-color': mapColors.casing,
            'circle-stroke-width': 3,
          }}
        />
      </GeoJSONSource>
    </Map>
  )
}
