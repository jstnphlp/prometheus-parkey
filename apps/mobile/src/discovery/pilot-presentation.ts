import type {
  Coordinate,
  NcrFeatureType,
  PilotMode,
  PilotParking,
} from '@parkey/shared-types'

import { distanceMeters, isCoordinate } from './model.ts'

export type PilotFeeFilter = 'all' | 'free' | 'paid'
export type PilotFeeStatus = 'free' | 'paid' | 'unknown'

/** Classify only explicit, unconditional source assertions; retain the raw fee. */
export function pilotFeeStatus(fees: unknown): PilotFeeStatus {
  if (typeof fees !== 'string') return 'unknown'
  const value = fees.trim()
  if (
    /^(?:free(?: parking)?|no (?:fee|charge)|OSM records no fee; check posted signs)$/i.test(
      value,
    )
  )
    return 'free'
  if (
    /^(?:paid(?: parking)?|fee applies(?:; amount unavailable)?)$/i.test(value)
  )
    return 'paid'
  const price =
    /^(?:PHP|₱)\s*(\d+(?:\.\d{1,2})?)(?:\s*(?:\/\s*|per\s+)(?:h|hr|hour|day))?$/i.exec(
      value,
    )
  const amount = price ? Number(price[1]) : NaN
  return Number.isFinite(amount) && amount > 0 ? 'paid' : 'unknown'
}

/** Labels describe the original classification, never a guessed facility type. */
export function pilotTypeLabel(
  featureType: unknown,
  mode: PilotMode = 'public',
): string {
  switch (featureType) {
    case 'lot':
      return 'Parking lot'
    case 'garage':
      return 'Parking garage'
    case 'facility_unspecified':
      return 'Unclassified parking'
    case 'street_segment':
      return mode === 'candidate_research'
        ? 'Street research'
        : 'Street parking'
    case 'space':
      return 'Mapped parking space'
    case 'entrance':
      return 'Mapped entrance'
    default:
      return 'Parking type unknown'
  }
}

export type PilotParkingPartition = {
  matched: PilotParking[]
  nonmatched: PilotParking[]
  unknown: PilotParking[]
}

/** Unknown fees are separate from both known matches and known mismatches. */
export function partitionPilotParking(
  records: readonly PilotParking[],
  type: 'all' | NcrFeatureType = 'all',
  fees: PilotFeeFilter = 'all',
): PilotParkingPartition {
  const partition: PilotParkingPartition = {
    matched: [],
    nonmatched: [],
    unknown: [],
  }
  for (const record of records) {
    if (type !== 'all' && record.featureType !== type)
      partition.nonmatched.push(record)
    else if (fees === 'all') partition.matched.push(record)
    else {
      const fee = pilotFeeStatus(record.fees)
      if (fee === 'unknown') partition.unknown.push(record)
      else if (fee === fees) partition.matched.push(record)
      else partition.nonmatched.push(record)
    }
  }
  return partition
}

export type RankedPilotParking = {
  record: PilotParking
  straightLineMeters: number | null
}

/** Source anchors provide straight-line estimates, not walking routes/entrances. */
export function rankPilotParking(
  records: readonly PilotParking[],
  reference: Coordinate,
): RankedPilotParking[] {
  const referenceValid = isCoordinate(reference)
  return records
    .map((record) => ({
      record,
      straightLineMeters:
        referenceValid && isCoordinate(record.representativePoint)
          ? distanceMeters(reference, record.representativePoint)
          : null,
    }))
    .sort((a, b) => {
      if (a.straightLineMeters !== b.straightLineMeters) {
        if (a.straightLineMeters === null) return 1
        if (b.straightLineMeters === null) return -1
        return a.straightLineMeters - b.straightLineMeters
      }
      return a.record.id < b.record.id ? -1 : a.record.id > b.record.id ? 1 : 0
    })
}
