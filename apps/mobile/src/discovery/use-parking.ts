import { useEffect, useMemo, useReducer } from 'react'
import type { DiscoveryParking } from '@parkey/shared-types'

import { config, hasDiscoveryBackend } from './config'
import { fetchParking, isParking } from './data'
import { queryableViewport } from './model'
import type { Viewport } from './model'
import snapshot from './osm-pilot.json'
import {
  mergeParking,
  parkingLoadReducer,
  scheduleParkingRefresh,
} from './parking-results'

const rawSnapshot: unknown = snapshot
const pilotRecords: DiscoveryParking[] = Array.isArray(rawSnapshot)
  ? rawSnapshot.filter(isParking)
  : []

export function useParking(viewport: Viewport, revision: number) {
  const [remote, dispatch] = useReducer(parkingLoadReducer, {
    records: [],
    truncated: false,
    status: 'idle',
  })
  const canQuery = queryableViewport(viewport)

  useEffect(() => {
    if (!hasDiscoveryBackend || !queryableViewport(viewport)) return
    return scheduleParkingRefresh(
      (signal) =>
        fetchParking(config.supabaseUrl, config.supabaseKey, viewport, signal),
      dispatch,
    )
  }, [viewport, revision])

  const records = useMemo(
    () =>
      mergeParking(
        hasDiscoveryBackend ? [] : pilotRecords,
        remote.records,
        viewport,
      ),
    [remote.records, viewport],
  )
  const knownRecords = useMemo(
    () => [
      ...remote.records,
      ...(hasDiscoveryBackend ? [] : pilotRecords).filter(
        (item) =>
          !remote.records.some(
            (record) =>
              record.id === item.id ||
              (record.sourceUrl && record.sourceUrl === item.sourceUrl),
          ),
      ),
    ],
    [remote.records],
  )
  return {
    records,
    knownRecords,
    status: canQuery ? remote.status : 'idle',
    truncated: canQuery && remote.truncated,
    canQuery,
    snapshotCount: hasDiscoveryBackend ? 0 : pilotRecords.length,
  }
}
