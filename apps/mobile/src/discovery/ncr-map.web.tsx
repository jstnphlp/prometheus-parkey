import { Asset } from 'expo-asset'
import { Map, setWorkerUrl } from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import {
  memo,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'

import mainParkingPin from '../../assets/figma/main-ui/parking-marker.png'
import { useTheme } from '../theme-provider'
import { config } from './config'
import { mapTextFont } from './map-font'
import { draftGeoJSON } from './map-data'
import { mainParkingMarkerLayout } from './map-marker-style'
import { ncrMapSources } from './ncr-map-data'
import type { NcrMapProps } from './ncr-map-data'

function NcrMap(props: NcrMapProps) {
  const theme = useTheme()
  const initialTheme = useRef(theme)
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (container.current)
      container.current.inert = props.accessibilityHidden ?? false
  }, [props.accessibilityHidden])
  const map = useRef<Map | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [simplifiedMarkers] = useState(props.simplifiedMarkers ?? false)
  const [initialNight] = useState(props.night)
  const night = useRef(initialNight)
  const draft = useMemo(
    () => draftGeoJSON(props.draftPoints ?? []),
    [props.draftPoints],
  )
  const editing = useEffectEvent(() => Boolean(props.draftPoints))
  const mapPressed = useEffectEvent((point: [number, number]) =>
    props.onMapPress?.(point),
  )
  const sources = useMemo(() => ncrMapSources(props.data, null), [props.data])
  const viewport = useEffectEvent(() => {
    const instance = map.current,
      bounds = instance?.getBounds()
    if (instance && bounds)
      props.onViewport({
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
        zoom: instance.getZoom(),
      })
  })
  const failed = useEffectEvent(() => props.onError())
  const selected = useEffectEvent((id: string) => props.onSelect(id))
  const cluster = useEffectEvent((point: [number, number]) =>
    props.onCluster(point),
  )
  const [initialTarget] = useState(props.target)
  const renderedTarget = useRef(initialTarget)
  useEffect(() => {
    const { colors, mapColors } = initialTheme.current
    if (!container.current) return
    setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')
    let instance: Map
    try {
      instance = new Map({
        container: container.current,
        style: initialNight ? config.nightMapStyle : config.mapStyle,
        center: initialTarget.coordinate,
        zoom: initialTarget.zoom,
        minZoom: 8.5,
        maxZoom: 20,
        attributionControl: {},
        fadeDuration: 0,
      })
    } catch {
      failed()
      return
    }
    map.current = instance
    if (simplifiedMarkers)
      instance.setMissingStyleImageResolver(async (name) => {
        if (name !== 'main-parking-pin') return
        try {
          const marker = await instance.loadImage(
            Asset.fromModule(mainParkingPin).uri,
          )
          if (map.current === instance && !instance.hasImage(name))
            instance.addImage(name, marker.data, { pixelRatio: 3 })
        } catch {
          if (map.current === instance) failed()
        }
      })
    instance.on('style.load', () => {
      instance.addSource('shapes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      instance.addSource('anchors', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterRadius: 48,
        clusterMaxZoom: 14,
      })
      instance.addLayer({
        id: 'ncr-areas',
        type: 'fill',
        source: 'shapes',
        minzoom: 14,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-color': [
            'case',
            ['get', 'restricted'],
            colors.error,
            colors.brand,
          ],
          'fill-opacity': 0.2,
        },
      })
      instance.addLayer({
        id: 'ncr-streets',
        type: 'line',
        source: 'shapes',
        minzoom: 14,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          'line-color': [
            'case',
            ['get', 'restricted'],
            colors.error,
            mapColors.street,
          ],
          'line-width': 4,
          'line-dasharray': [2, 1],
        },
      })
      if (!simplifiedMarkers)
        instance.addLayer({
          id: 'ncr-anchors',
          type: 'circle',
          source: 'anchors',
          filter: ['!', ['has', 'point_count']],
          paint: {
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
              ['get', 'selected'],
              10,
              ['match', ['get', 'featureType'], 'entrance', 4, 'space', 4, 7],
            ],
            'circle-stroke-color': mapColors.casing,
            'circle-stroke-width': 2,
          },
        })
      if (simplifiedMarkers) {
        instance.addLayer({
          id: 'ncr-selected-ring',
          type: 'circle',
          source: 'anchors',
          filter: ['==', ['get', 'id'], ''],
          paint: { 'circle-radius': 29, 'circle-color': colors.surface },
        })
        instance.addLayer({
          id: 'ncr-parking-markers',
          type: 'symbol',
          source: 'anchors',
          filter: ['!', ['has', 'point_count']],
          layout: mainParkingMarkerLayout(1),
        })
      }
      instance.addLayer({
        id: 'ncr-destination-labels',
        type: 'symbol',
        source: 'anchors',
        minzoom: 16,
        filter: [
          'all',
          ['!', ['has', 'point_count']],
          ['==', ['get', 'hasDestinationLabel'], true],
        ],
        layout: {
          'text-field': ['get', 'label'],
          'text-font': mapTextFont,
          'text-size': 12,
          'text-anchor': 'top',
          'text-offset': [0, 1],
          'text-max-width': 16,
        },
        paint: {
          'text-color': mapColors.label,
          'text-halo-color': mapColors.labelHalo,
          'text-halo-width': 2,
        },
      })
      instance.addLayer({
        id: 'ncr-clusters',
        type: 'circle',
        source: 'anchors',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': colors.brand,
          'circle-radius': 18,
          'circle-opacity': 0.8,
        },
      })
      instance.addLayer({
        id: 'ncr-cluster-label',
        type: 'symbol',
        source: 'anchors',
        filter: ['has', 'point_count'],
        layout: {
          // Every anchor is one source observation, never a capacity claim.
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': mapTextFont,
          'text-size': 12,
        },
        paint: { 'text-color': mapColors.casing },
      })
      if (simplifiedMarkers) {
        instance.addSource('pilot-draft', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        instance.addLayer({
          id: 'pilot-draft-line',
          type: 'line',
          source: 'pilot-draft',
          paint: { 'line-color': colors.amber, 'line-width': 5 },
        })
        instance.addLayer({
          id: 'pilot-draft-points',
          type: 'circle',
          source: 'pilot-draft',
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-radius': 8,
            'circle-color': colors.amber,
            'circle-stroke-color': colors.surface,
            'circle-stroke-width': 2,
          },
        })
      }
      setLoaded(true)
      viewport()
    })
    instance.on('moveend', viewport)
    instance.on('error', failed)
    instance.on('click', (event) => {
      const point: [number, number] = [event.lngLat.lng, event.lngLat.lat]
      if (editing()) {
        mapPressed(point)
        return
      }
      if (!instance.getSource('anchors')) return
      const features = instance.queryRenderedFeatures(event.point, {
        layers: [
          simplifiedMarkers ? 'ncr-parking-markers' : 'ncr-anchors',
          'ncr-destination-labels',
          'ncr-clusters',
          'ncr-streets',
          'ncr-areas',
        ],
      })
      const feature = features[0]
      if (
        feature?.properties.cluster === true &&
        feature.geometry.type === 'Point'
      ) {
        const [x, y] = feature.geometry.coordinates
        if (x !== undefined && y !== undefined) cluster([x, y])
      } else if (typeof feature?.properties.id === 'string')
        selected(feature.properties.id)
      else mapPressed(point)
    })
    // Container size changes do not always emit a browser window resize.
    // Keep the same map/camera when overlays or device orientation change.
    let resizeFrame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(() => instance.resize())
    })
    observer.observe(container.current)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(resizeFrame)
      instance.remove()
      map.current = null
    }
  }, [initialTarget, initialNight, simplifiedMarkers])

  useEffect(() => {
    if (night.current === props.night || !map.current) return
    night.current = props.night
    setLoaded(false)
    map.current.setStyle(props.night ? config.nightMapStyle : config.mapStyle, {
      diff: false,
    })
  }, [props.night])

  useEffect(() => {
    if (loaded)
      map.current?.getSource<GeoJSONSource>('pilot-draft')?.setData(draft)
  }, [draft, loaded])
  useEffect(() => {
    if (!loaded) return
    const instance = map.current
    if (!instance?.getSource('anchors')) return
    // Hide immediately when the parent clears private data on a mode switch,
    // while the GeoJSON worker applies the empty source in the background.
    const visibility = sources.anchors.features.length ? 'visible' : 'none'
    for (const layer of [
      'ncr-areas',
      'ncr-streets',
      ...(simplifiedMarkers
        ? ['ncr-parking-markers', 'ncr-selected-ring']
        : ['ncr-anchors']),
      'ncr-destination-labels',
      'ncr-clusters',
      'ncr-cluster-label',
    ])
      instance.setLayoutProperty(layer, 'visibility', visibility)
    for (const id of ['shapes', 'anchors'] as const)
      instance.getSource<GeoJSONSource>(id)?.setData(sources[id])
  }, [loaded, sources, simplifiedMarkers])
  useEffect(() => {
    if (!loaded || !map.current?.getSource('anchors')) return
    // A selection changes paint only, without reparsing/reclustering the full
    // snapshot or recreating the map when a detail modal opens.
    if (simplifiedMarkers) {
      map.current?.setFilter('ncr-selected-ring', [
        '==',
        ['get', 'id'],
        props.selectedId || '',
      ])
      return
    }
    map.current?.setPaintProperty('ncr-anchors', 'circle-radius', [
      'case',
      ['==', ['get', 'id'], props.selectedId || ''],
      10,
      ['match', ['get', 'featureType'], 'entrance', 4, 'space', 4, 7],
    ])
  }, [loaded, props.selectedId, simplifiedMarkers])
  useEffect(() => {
    if (!loaded || props.target === renderedTarget.current) return
    renderedTarget.current = props.target
    map.current?.jumpTo({
      center: props.target.coordinate,
      zoom: props.target.zoom,
    })
  }, [loaded, props.target])
  useEffect(() => {
    const instance = map.current
    if (!loaded || !instance?.getLayer('ncr-areas')) return
    const { colors, mapColors } = theme
    instance.setPaintProperty('ncr-areas', 'fill-color', [
      'case',
      ['get', 'restricted'],
      colors.error,
      colors.brand,
    ])
    instance.setPaintProperty('ncr-streets', 'line-color', [
      'case',
      ['get', 'restricted'],
      colors.error,
      mapColors.street,
    ])
    if (simplifiedMarkers)
      instance.setPaintProperty(
        'ncr-selected-ring',
        'circle-color',
        colors.surface,
      )
    else
      instance.setPaintProperty('ncr-anchors', 'circle-color', [
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
      ])
    instance.setPaintProperty(
      'ncr-destination-labels',
      'text-color',
      mapColors.label,
    )
  }, [loaded, theme, simplifiedMarkers])
  return (
    <div
      ref={container}
      aria-hidden={props.accessibilityHidden}
      data-testid={loaded ? 'ncr-map-ready' : 'ncr-map-loading'}
      aria-label={
        props.data?.mode === 'research_preview'
          ? 'Private research map. Source points are not driving entrances.'
          : 'Parking discovery map. Parking markers do not guarantee visitor access or availability.'
      }
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        minHeight: 0,
      }}
    />
  )
}

const MemoizedNcrMap = memo(NcrMap)
MemoizedNcrMap.displayName = 'NcrMap'
export default MemoizedNcrMap
