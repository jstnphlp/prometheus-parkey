import { useEffect, useMemo, useReducer } from 'react'
import type { DiscoveryParking } from '@parkey/shared-types'

import { config, hasDiscoveryBackend } from './config'
import { fetchApprovedParking, fetchParking, isParking } from './data'
import { queryableViewport } from './model'
import type { Viewport } from './model'
import snapshot from './osm-pilot.json'
import { sampleParking } from './sample-data'
import {
  mergeParking,
  parkingLoadReducer,
  scheduleParkingRefresh,
} from './parking-results'

const rawSnapshot: unknown = snapshot
const legacyRecords: DiscoveryParking[] = Array.isArray(rawSnapshot)
  ? rawSnapshot.filter(isParking)
  : []
const pilotRecords =
  config.discoveryMode === 'legacy'
    ? legacyRecords
    : config.discoveryMode === 'synthetic'
      ? sampleParking
      : []

export function useParking(viewport: Viewport, revision: number) {
  const [remote, dispatch] = useReducer(parkingLoadReducer, {
    records: [],
    truncated: false,
    status: 'idle',
  })
  const canQuery = queryableViewport(viewport)

  useEffect(() => {
    if (
      !['legacy', 'hosted'].includes(config.discoveryMode) ||
      !hasDiscoveryBackend ||
      !queryableViewport(viewport)
    )
      return
    return scheduleParkingRefresh(
      (signal) =>
        (config.discoveryMode === 'hosted'
          ? fetchApprovedParking
          : fetchParking)(
          config.supabaseUrl,
          config.supabaseKey,
          viewport,
          signal,
        ),
      dispatch,
    )
  }, [viewport, revision])

  const records = useMemo(
    () => mergeParking(pilotRecords, remote.records, viewport),
    [remote.records, viewport],
  )
  const knownRecords = useMemo(
    () => [
      ...remote.records,
      ...pilotRecords.filter(
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
    snapshotCount: pilotRecords.length,
  }
}
