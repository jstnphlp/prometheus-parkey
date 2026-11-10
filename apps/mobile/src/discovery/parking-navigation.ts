import type {
  Coordinate,
  DiscoveryParking,
  ParkingNavigationApproval,
} from '@parkey/shared-types'

import { isCoordinate, isObject } from './model.ts'

/** Explicit unsupported/restricted access fails closed despite another approval. */
export function publicParkingAccess(value: unknown): boolean {
  return (
    value == null ||
    (typeof value === 'string' &&
      [
        '',
        'unknown',
        'yes',
        'public',
        'permissive',
        'public_visitors',
      ].includes(value.trim().toLowerCase()))
  )
}

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
    !publicParkingAccess(tags.access) ||
    !publicParkingAccess(tags['parking:access']) ||
    parking.regulations.some((rule) => {
      const match = /^Access(?: recorded by OpenStreetMap)?\s*:\s*(.*)$/i.exec(
        rule.description,
      )
      return !!match && !publicParkingAccess(match[1])
    }) ||
    Object.entries(tags).some(
      ([key, value]) =>
        /^(disused|abandoned|construction|proposed)(:|$)/.test(key) &&
        !['no', 'false', '0', ''].includes(value.trim().toLowerCase()),
    )
  )
    return null
  return approval.entrance
}
