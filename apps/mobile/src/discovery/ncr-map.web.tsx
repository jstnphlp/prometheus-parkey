import { Map, setWorkerUrl } from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'

import { config } from './config'
import { ncrMapSources } from './ncr-map-data'
import type { NcrMapProps } from './ncr-map-data'

export default function NcrMap(props: NcrMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<Map | null>(null)
  const [loaded, setLoaded] = useState(false)
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
  useEffect(() => {
    if (!container.current) return
    setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')
    let instance: Map
    try {
      instance = new Map({
        container: container.current,
        style: config.mapStyle,
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
    instance.on('load', () => {
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
          'fill-color': ['case', ['get', 'restricted'], '#C23B3B', '#8A1060'],
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
          'line-color': ['case', ['get', 'restricted'], '#C23B3B', '#2E7F88'],
          'line-width': 4,
          'line-dasharray': [2, 1],
        },
      })
      instance.addLayer({
        id: 'ncr-anchors',
        type: 'circle',
        source: 'anchors',
        filter: ['!', ['has', 'point_count']],
        paint: {
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
            ['get', 'selected'],
            10,
            ['match', ['get', 'featureType'], 'entrance', 4, 'space', 4, 7],
          ],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
        },
      })
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
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
          'text-anchor': 'top',
          'text-offset': [0, 1],
          'text-max-width': 16,
        },
        paint: {
          'text-color': '#5A1643',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 2,
        },
      })
      instance.addLayer({
        id: 'ncr-clusters',
        type: 'circle',
        source: 'anchors',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#8A1060',
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
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
        },
        paint: { 'text-color': '#FFFFFF' },
      })
      setLoaded(true)
      viewport()
    })
    instance.on('moveend', viewport)
    instance.on('error', failed)
    instance.on('click', (event) => {
      const features = instance.queryRenderedFeatures(event.point, {
        layers: [
          'ncr-anchors',
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
  }, [initialTarget])
  useEffect(() => {
    if (!loaded) return
    const instance = map.current
    if (!instance) return
    // Hide immediately when the parent clears private data on a mode switch,
    // while the GeoJSON worker applies the empty source in the background.
    const visibility = sources.anchors.features.length ? 'visible' : 'none'
    for (const layer of [
      'ncr-areas',
      'ncr-streets',
      'ncr-anchors',
      'ncr-destination-labels',
      'ncr-clusters',
      'ncr-cluster-label',
    ])
      instance.setLayoutProperty(layer, 'visibility', visibility)
    for (const id of ['shapes', 'anchors'] as const)
      instance.getSource<GeoJSONSource>(id)?.setData(sources[id])
  }, [loaded, sources])
  useEffect(() => {
    if (!loaded) return
    // A selection changes paint only, without reparsing/reclustering the full
    // snapshot or recreating the map when a detail modal opens.
    map.current?.setPaintProperty('ncr-anchors', 'circle-radius', [
      'case',
      ['==', ['get', 'id'], props.selectedId || ''],
      10,
      ['match', ['get', 'featureType'], 'entrance', 4, 'space', 4, 7],
    ])
  }, [loaded, props.selectedId])
  useEffect(() => {
    if (loaded)
      map.current?.jumpTo({
        center: props.target.coordinate,
        zoom: props.target.zoom,
      })
  }, [loaded, props.target])
  return (
    <div
      ref={container}
      data-testid={loaded ? 'ncr-map-ready' : 'ncr-map-loading'}
      aria-label="Private NCR research map. Points are research anchors, not driving entrances."
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
