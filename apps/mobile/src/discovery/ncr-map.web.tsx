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
  const sources = useMemo(
    () => ncrMapSources(props.data, props.selectedId),
    [props.data, props.selectedId],
  )
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
        minZoom: 10,
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
      for (const id of ['shapes', 'anchors', 'clusters'])
        instance.addSource(id, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
      instance.addLayer({
        id: 'ncr-areas',
        type: 'fill',
        source: 'shapes',
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
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          'line-color': '#2E7F88',
          'line-width': 4,
          'line-dasharray': [2, 1],
        },
      })
      instance.addLayer({
        id: 'ncr-anchors',
        type: 'circle',
        source: 'anchors',
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
        id: 'ncr-clusters',
        type: 'circle',
        source: 'clusters',
        paint: {
          'circle-color': '#8A1060',
          'circle-radius': 18,
          'circle-opacity': 0.8,
        },
      })
      instance.addLayer({
        id: 'ncr-cluster-label',
        type: 'symbol',
        source: 'clusters',
        layout: {
          'text-field': ['to-string', ['get', 'observations']],
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
        layers: ['ncr-anchors', 'ncr-clusters', 'ncr-streets', 'ncr-areas'],
      })
      const feature = features[0]
      if (feature?.source === 'clusters' && feature.geometry.type === 'Point') {
        const [x, y] = feature.geometry.coordinates
        if (x !== undefined && y !== undefined) cluster([x, y])
      } else if (typeof feature?.properties.id === 'string')
        selected(feature.properties.id)
    })
    return () => {
      instance.remove()
      map.current = null
    }
  }, [initialTarget])
  useEffect(() => {
    if (!loaded) return
    for (const id of ['shapes', 'anchors', 'clusters'] as const)
      map.current?.getSource<GeoJSONSource>(id)?.setData(sources[id])
  }, [loaded, sources])
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
      style={{ width: '100%', height: '100%', minHeight: 280 }}
    />
  )
}
