import type { DiscoveryParking } from '@parkey/shared-types'

import { parkingFeeFacts } from './parking-fee.ts'

export type DiscoveryFilter = 'all' | 'street' | 'facilities' | 'lot' | 'garage'
export type FeeFilter = 'all' | 'applies' | 'free'
export const parkingFeatures = ['covered', '24h', 'ev', 'accessible'] as const
export type ParkingFeature = (typeof parkingFeatures)[number]

/** Only explicit source tags satisfy a feature. Missing facts never imply yes. */
export function hasParkingFeature(
  record: DiscoveryParking,
  feature: ParkingFeature,
): boolean {
  const tags = record.osmTags ?? {}
  switch (feature) {
    case 'covered':
      return tags.covered === 'yes'
    case '24h':
      return tags.opening_hours === '24/7'
        ? !record.hours || record.hours === '24/7'
        : !tags.opening_hours && record.hours === '24/7'
    case 'ev':
      return (
        /^\d+$/.test(tags['capacity:charging'] ?? '') &&
        Number.isSafeInteger(Number(tags['capacity:charging'])) &&
        Number(tags['capacity:charging']) > 0
      )
    case 'accessible':
      return tags.wheelchair === 'yes' || tags.wheelchair === 'designated'
  }
}
export type FilterPartition = {
  matched: DiscoveryParking[]
  nonmatched: DiscoveryParking[]
  unknown: DiscoveryParking[]
}

/** Free-form source fees cannot establish a price or a free-parking claim. */
export function partitionParking(
  records: DiscoveryParking[],
  kind: DiscoveryFilter,
  fees: FeeFilter = 'all',
  features: readonly ParkingFeature[] = [],
): FilterPartition {
  const result: FilterPartition = { matched: [], nonmatched: [], unknown: [] }
  for (const record of records) {
    const kindMatches =
      kind === 'all' ||
      (kind === 'facilities' ? record.kind !== 'street' : record.kind === kind)
    if (
      !kindMatches ||
      !features.every((feature) => hasParkingFeature(record, feature))
    )
      result.nonmatched.push(record)
    else if (
      fees === 'all' ||
      parkingFeeFacts(record).status === (fees === 'free' ? 'free' : 'paid')
    )
      result.matched.push(record)
    else result.unknown.push(record)
  }
  return result
}
