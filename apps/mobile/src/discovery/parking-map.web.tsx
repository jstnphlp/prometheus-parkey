import { Asset } from 'expo-asset'
import { Map, setWorkerUrl } from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'

import selectedSpot from '../../assets/figma/playful/mascot.png'
import freePin from '../../assets/figma/playful/pin-free.png'
import paidPin from '../../assets/figma/playful/pin-paid.png'
import unknownPin from '../../assets/figma/playful/pin-unknown.png'
import mapLabel from '../../assets/figma/playful/map-label.png'
import navUp from '../../assets/figma/playful/nav-up.png'

import { config } from './config'
import { mapTextFont } from './map-font'
import { routeBearing, splitRoute } from './drive-math'
import { draftGeoJSON, parkingMapSources } from './map-data'
import type { ParkingMapProps } from './map-types'
import { mapColors, colors } from './palette'
import { parkingLabelLayout, parkingMarkerLayout } from './map-marker-style'
import { routeBounds } from './routing'
import { useReducedMotion } from './use-reduced-motion'

export default function ParkingMap(props: ParkingMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<Map | null>(null)
  const previousTarget = useRef(props.target)
  const focusUntil = useRef(0)
  const [initialCamera] = useState(() => ({
    center: props.target.coordinate,
    zoom: 16,
    padding: { ...props.cameraPadding, left: 0, right: 0 },
  }))
  const reduced = useReducedMotion()
  const [loaded, setLoaded] = useState(false)
  // Explore remounts the renderer when the navigation theme changes.
  const [mapStyle] = useState(() =>
    props.night ? config.nightMapStyle : config.mapStyle,
  )
  const [night] = useState(props.night ?? false)
  const parking = useMemo(
    () => parkingMapSources(props.records, props.selectedId, props.featuredId),
    [props.records, props.selectedId, props.featuredId],
  )
  const draft = useMemo(
    () => draftGeoJSON(props.draftPoints),
    [props.draftPoints],
  )
  const { top, bottom } = props.cameraPadding
  const status = useEffectEvent(props.onStatus)
  const pressed = useEffectEvent(
    (event: {
      point: { x: number; y: number }
      lngLat: { lng: number; lat: number }
    }) => {
      if (!map.current?.getLayer('facilities')) return
      if (props.searching) {
        props.onMapPress([event.lngLat.lng, event.lngLat.lat])
        return
      }
      const features = map.current?.queryRenderedFeatures(
        [
          [event.point.x - 14, event.point.y - 14],
          [event.point.x + 14, event.point.y + 14],
        ],
        {
          layers: [
            'selected-facility',
            'facilities',
            'facility-dots',
            'cluster-count',
            'clusters',
            'streets',
          ],
        },
      )
      const feature = features?.[0]
      const clusterId: unknown = feature?.properties.cluster_id
      if (
        !props.drawing &&
        typeof clusterId === 'number' &&
        feature?.geometry.type === 'Point'
      ) {
        const [lng, lat] = feature.geometry.coordinates
        const source = map.current?.getSource<GeoJSONSource>('facilities')
        if (lng !== undefined && lat !== undefined) {
          void source
            ?.getClusterExpansionZoom(clusterId)
            .then((zoom) => {
              map.current?.easeTo({
                center: [lng, lat],
                zoom,
                duration: reduced ? 0 : 450,
              })
            })
            .catch(() => status('error'))
        }
        return
      }
      const id: unknown = feature?.properties.id
      if (!props.drawing && typeof id === 'string') props.onSelect(id)
      else props.onMapPress([event.lngLat.lng, event.lngLat.lat])
    },
  )
  const panned = useEffectEvent(() => {
    props.navigation?.onPan()
    props.onPan?.()
  })
  const moved = useEffectEvent((event?: unknown) => {
    // Expanding the results sheet changes camera padding, not the user's search
    // area. Requerying here made nearby results disappear while opening the list.
    if (
      typeof event === 'object' &&
      event !== null &&
      'parkeyLayoutOnly' in event &&
      event.parkeyLayoutOnly === true
    )
      return
    const instance = map.current
    const bounds = instance?.getBounds()
    if (instance && bounds)
      props.onViewport({
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
        zoom: instance.getZoom(),
      })
  })

  useEffect(() => {
    if (!container.current) return
    setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')
    status('loading')
    let instance: Map
    try {
      instance = new Map({
        container: container.current,
        style: mapStyle,
        center: initialCamera.center,
        zoom: initialCamera.zoom,
        minZoom: 3,
        maxZoom: 20,
        attributionControl: false,
        fadeDuration: 0,
      })
    } catch {
      status('error')
      return
    }
    instance.jumpTo(initialCamera)
    map.current = instance
    const markerAssets = new globalThis.Map<string, number>([
      ['parking-pin', selectedSpot],
      ['parking-pin-selected', selectedSpot],
      ['pin-free', freePin],
      ['pin-paid', paidPin],
      ['pin-unknown', unknownPin],
      ['map-label', mapLabel],
      ['nav-up', navUp],
    ])
    // MapLibre awaits this resolver before treating an image as missing.
    // Parking, route, and location sources can still initialize immediately.
    instance.setMissingStyleImageResolver(async (name) => {
      const asset = markerAssets.get(name)
      if (asset === undefined) return
      try {
        const marker = await instance.loadImage(Asset.fromModule(asset).uri)
        if (map.current === instance && !instance.hasImage(name))
          instance.addImage(name, marker.data, { pixelRatio: 3 })
      } catch {
        if (map.current === instance) status('error')
      }
    })
    instance.on('load', () => {
      instance.addSource('route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      for (const [id, color, width] of [
        ['route-casing', night ? '#17141A' : mapColors.casing, 10],
        ['route-line', night ? '#25CAD3' : mapColors.route, 6],
      ] as const) {
        instance.addLayer({
          id,
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': color, 'line-width': width },
        })
      }
      instance.addSource('traveled-route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      instance.addLayer({
        id: 'traveled-route',
        type: 'line',
        source: 'traveled-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#929A9D', 'line-width': 6 },
      })
      instance.addSource('parking', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      instance.addLayer({
        id: 'street-casing',
        type: 'line',
        source: 'parking',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          'line-color': mapColors.casing,
          'line-width': 10,
          'line-opacity': ['case', ['get', 'muted'], 0.75, 1],
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
      instance.addLayer({
        id: 'streets',
        type: 'line',
        source: 'parking',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          'line-color': [
            'case',
            ['get', 'selected'],
            mapColors.streetSelected,
            mapColors.street,
          ],
          'line-width': 6,
          'line-opacity': ['case', ['get', 'muted'], 0.75, 1],
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
      instance.addSource('facilities', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 15,
      })
      instance.addLayer({
        id: 'cluster-shadow',
        type: 'circle',
        source: 'facilities',
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': ['step', ['get', 'point_count'], 19, 10, 23, 50, 27],
          'circle-color': colors.brandDeep,
          'circle-blur': 0.5,
          'circle-opacity': 0.25,
          'circle-translate': [0, 2],
        },
      })
      instance.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'facilities',
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 24],
          'circle-color': colors.brandDeep,
          'circle-stroke-color': mapColors.casing,
          'circle-stroke-width': 3,
          'circle-opacity': 1,
        },
      })
      instance.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'facilities',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': mapTextFont,
          'text-size': 14,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: { 'text-color': mapColors.facilityLabel, 'text-opacity': 1 },
      })
      instance.addSource('selected-facility', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      instance.addLayer({
        id: 'selected-halo',
        type: 'circle',
        source: 'selected-facility',
        paint: {
          'circle-radius': 46,
          'circle-color': colors.brand,
          'circle-opacity': 0.18,
        },
      })
      instance.addLayer({
        id: 'facility-dots',
        type: 'circle',
        source: 'facilities',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 8,
          'circle-color': mapColors.facility,
          'circle-stroke-color': mapColors.casing,
          'circle-stroke-width': 2,
        },
      })
      for (const selected of [false, true]) {
        instance.addLayer({
          id: selected ? 'selected-facility' : 'facilities',
          type: 'symbol',
          source: selected ? 'selected-facility' : 'facilities',
          filter: ['!', ['has', 'point_count']],
          layout: selected
            ? {
                'icon-image': 'parking-pin-selected',
                'icon-size': 1,
                'icon-anchor': 'bottom',
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
              }
            : parkingMarkerLayout(1),
          paint: {
            'icon-opacity': ['case', ['get', 'muted'], 0.65, 1],
            'text-opacity': ['case', ['get', 'muted'], 0.65, 1],
            'text-color': colors.surface,
          },
        })
      }
      instance.addLayer({
        id: 'selected-name',
        type: 'symbol',
        source: 'selected-facility',
        layout: parkingLabelLayout(1),
        paint: { 'text-color': colors.surface },
      })
      for (const [id, color, radius] of [
        ['user', mapColors.user, 10],
        ['destination', mapColors.destination, 8],
        ['parked', mapColors.parked, 10],
      ] as const) {
        instance.addSource(id, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        if (id === 'user')
          instance.addLayer({
            id: 'user-halo',
            type: 'circle',
            source: id,
            paint: {
              'circle-radius': 32,
              'circle-color': colors.positiveSurface,
            },
          })
        instance.addLayer({
          id: `${id}-dot`,
          type: 'circle',
          source: id,
          paint: {
            'circle-radius': radius,
            'circle-color': color,
            'circle-stroke-color': mapColors.casing,
            'circle-stroke-width': 3,
          },
        })
      }
      instance.addLayer({
        id: 'user-heading',
        type: 'symbol',
        source: 'user',
        layout: {
          'icon-image': 'nav-up',
          'icon-size': 1,
          'icon-rotate': ['get', 'bearing'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          visibility: 'none',
        },
      })
      instance.addLayer({
        id: 'parked-label',
        type: 'symbol',
        source: 'parked',
        layout: {
          'text-font': mapTextFont,
          'text-field': 'Your car',
          'text-size': 12,
          'text-offset': [0, 1.8],
          'text-allow-overlap': true,
        },
        paint: { 'text-color': mapColors.casing },
      })
      instance.addSource('draft', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      instance.addLayer({
        id: 'draft-line',
        type: 'line',
        source: 'draft',
        paint: {
          'line-color': mapColors.draft,
          'line-width': 5,
          'line-dasharray': [2, 1],
        },
      })
      instance.addLayer({
        id: 'draft-points',
        type: 'circle',
        source: 'draft',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 7,
          'circle-color': mapColors.draft,
          'circle-stroke-color': mapColors.casing,
          'circle-stroke-width': 3,
        },
      })
      setLoaded(true)
      status('ready')
      moved()
    })
    instance.on('click', pressed)
    instance.on('moveend', moved)
    instance.on('dragstart', panned)
    instance.on('zoomstart', (event) => {
      if (event.originalEvent) panned()
    })
    instance.on('error', () => status('error'))
    instance.on('idle', () => status('ready'))
    return () => {
      instance.remove()
      map.current = null
    }
  }, [initialCamera, mapStyle, night])

  useEffect(() => {
    if (!loaded) return
    if (props.route && !props.navigation) {
      map.current?.fitBounds(routeBounds(props.route), {
        padding: { top: top + 20, bottom: bottom + 20, left: 28, right: 28 },
        duration: reduced ? 0 : 400,
        maxZoom: 17,
      })
      return
    }
    const focusTarget = previousTarget.current !== props.target
    previousTarget.current = props.target
    if (focusTarget) focusUntil.current = Date.now() + 1000
    map.current?.easeTo(
      {
        ...(focusTarget || props.selectedId || Date.now() < focusUntil.current
          ? { center: props.target.coordinate }
          : {}),
        ...(focusTarget ? { zoom: 16 } : {}),
        duration: reduced ? 0 : 400,
        padding: { top, bottom, left: 0, right: 0 },
      },
      { parkeyLayoutOnly: !focusTarget && !props.selectedId },
    )
  }, [
    props.target,
    props.route,
    loaded,
    top,
    bottom,
    props.selectedId,
    props.navigation,
    reduced,
  ])
  useEffect(() => {
    if (!loaded) return
    map.current?.getSource<GeoJSONSource>('parking')?.setData(parking.streets)
    map.current
      ?.getSource<GeoJSONSource>('facilities')
      ?.setData(parking.facilities)
    map.current
      ?.getSource<GeoJSONSource>('selected-facility')
      ?.setData(parking.selected)
  }, [loaded, parking])
  useEffect(() => {
    if (!loaded) return
    const split =
      props.route && props.navigation
        ? splitRoute(props.route, props.navigation.along)
        : null
    map.current?.getSource<GeoJSONSource>('route')?.setData(
      split
        ? { type: 'LineString', coordinates: split.remaining }
        : (props.route?.geometry ?? {
            type: 'FeatureCollection',
            features: [],
          }),
    )
    map.current
      ?.getSource<GeoJSONSource>('traveled-route')
      ?.setData(
        split && split.traveled.length > 1
          ? { type: 'LineString', coordinates: split.traveled }
          : { type: 'FeatureCollection', features: [] },
      )
  }, [loaded, props.route, props.navigation])
  useEffect(() => {
    if (!loaded || !props.navigation?.following || !props.userLocation) return
    map.current?.easeTo({
      center: props.userLocation,
      zoom: 17,
      padding: { top, bottom, left: 0, right: 0 },
      duration: reduced ? 0 : 650,
    })
  }, [
    loaded,
    props.userLocation,
    props.navigation?.following,
    top,
    bottom,
    reduced,
  ])
  useEffect(() => {
    if (!loaded) return
    map.current?.getSource<GeoJSONSource>('draft')?.setData(draft)
  }, [loaded, draft])
  useEffect(() => {
    if (!loaded) return
    const remaining =
      props.route && props.navigation
        ? splitRoute(props.route, props.navigation.along).remaining
        : []
    map.current?.getSource<GeoJSONSource>('user')?.setData(
      props.userLocation
        ? {
            type: 'Feature',
            properties: { bearing: routeBearing(remaining) },
            geometry: { type: 'Point', coordinates: props.userLocation },
          }
        : { type: 'FeatureCollection', features: [] },
    )
    map.current?.setPaintProperty(
      'user-dot',
      'circle-radius',
      props.navigation ? 26 : 10,
    )
    map.current?.setPaintProperty(
      'user-halo',
      'circle-radius',
      props.navigation ? 50 : 32,
    )
    map.current?.setLayoutProperty(
      'user-heading',
      'visibility',
      props.navigation ? 'visible' : 'none',
    )
  }, [loaded, props.userLocation, props.route, props.navigation])
  useEffect(() => {
    if (!loaded) return
    map.current
      ?.getSource<GeoJSONSource>('destination')
      ?.setData(
        props.destination
          ? { type: 'Point', coordinates: props.destination }
          : { type: 'FeatureCollection', features: [] },
      )
  }, [loaded, props.destination])

  useEffect(() => {
    if (!loaded) return
    map.current
      ?.getSource<GeoJSONSource>('parked')
      ?.setData(
        props.parkedLocation
          ? { type: 'Point', coordinates: props.parkedLocation }
          : { type: 'FeatureCollection', features: [] },
      )
  }, [loaded, props.parkedLocation])

  return (
    <div
      ref={container}
      aria-label="Interactive parking map. Use the parking list for accessible location selection."
      style={{ position: 'absolute', inset: 0 }}
    />
  )
}
