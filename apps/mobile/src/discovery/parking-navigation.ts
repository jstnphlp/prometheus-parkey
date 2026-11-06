import type {
  Coordinate,
  DiscoveryParking,
  ParkingNavigationApproval,
} from '@parkey/shared-types'

import { isCoordinate, isObject } from './model.ts'

export function isParkingNavigationApproval(
  value: unknown,
): value is ParkingNavigationApproval {
  return (
    isObject(value) &&
    isCoordinate(value.entrance) &&
    value.entranceConfirmed === true &&
    value.visitorAccessConfirmed === true &&
    value.operatorAuthorized === true &&
    typeof value.expiresAt === 'string' &&
    Number.isFinite(Date.parse(value.expiresAt))
  )
}

/** Source geometry and raw mapped entrances never authorize driving navigation. */
export function reviewedParkingEntrance(
  parking: DiscoveryParking,
  now = Date.now(),
): Coordinate | null {
  const approval = parking.navigationApproval
  const tags = parking.osmTags || {}
  if (
    parking.sourceKind === 'sample' ||
    !isParkingNavigationApproval(approval) ||
    !Number.isFinite(now) ||
    Date.parse(approval.expiresAt) <= now ||
    !parking.entrances?.some(
      (point) =>
        isCoordinate(point) &&
        point[0] === approval.entrance[0] &&
        point[1] === approval.entrance[1],
    ) ||
    /^(private|no|permit|residents|members|military|emergency|delivery|destination|psv|designated)$/i.test(
      tags.access || '',
    ) ||
    Object.entries(tags).some(
      ([key, value]) =>
        /^(disused|abandoned|construction|proposed)(:|$)/.test(key) &&
        !['no', 'false', '0', ''].includes(value.toLowerCase()),
    )
  )
    return null
  return approval.entrance
}
