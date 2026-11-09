import type { DiscoveryParking } from '@parkey/shared-types'

import { fetchParking } from './data.ts'
import { anchor } from './model.ts'
import { reviewedParkingEntrance } from './parking-navigation.ts'

function sourceIdentity(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    if (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      ['openstreetmap.org', 'www.openstreetmap.org'].includes(url.hostname) &&
      /^\/(node|way|relation)\/\d+\/?$/.test(url.pathname)
    )
      return url.pathname.replace(/\/$/, '')
  } catch {
    /* A generic URL/name cannot establish record identity. */
  }
  return null
}

/** Always a fresh read; cached permissions/source anchors never grant navigation. */
export async function refreshReviewedParking(
  record: DiscoveryParking,
  connection: { url: string; publicKey: string },
  signal: AbortSignal,
): Promise<DiscoveryParking> {
  signal.throwIfAborted()
  if (
    !connection.url ||
    !connection.publicKey ||
    !reviewedParkingEntrance(record)
  )
    throw new Error(
      'Current entrance authorization is unavailable. Refresh parking details before requesting directions.',
    )
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(abort, 12000)
  try {
    const [longitude, latitude] = anchor(record.geometry)
    const page = await fetchParking(
      connection.url,
      connection.publicKey,
      {
        west: Math.max(-180, longitude - 0.0001),
        south: Math.max(-90, latitude - 0.0001),
        east: Math.min(180, longitude + 0.0001),
        north: Math.min(90, latitude + 0.0001),
        zoom: 19,
      },
      controller.signal,
    )
    signal.throwIfAborted()
    controller.signal.throwIfAborted()
    const exact = page.records.filter((item) => item.id === record.id)
    const originalSource = sourceIdentity(record.sourceUrl)
    const candidates = exact.length
      ? exact
      : originalSource
        ? page.records.filter(
            (item) => sourceIdentity(item.sourceUrl) === originalSource,
          )
        : []
    const fresh = candidates.length === 1 ? candidates[0] : undefined
    if (!fresh || !reviewedParkingEntrance(fresh))
      throw new Error(
        'Parking entrance approval was revoked, expired or could not be confirmed. No route was started.',
      )
    return fresh
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', abort)
  }
}
