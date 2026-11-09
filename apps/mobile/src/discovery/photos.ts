import type { DiscoveryParking, ParkingPhoto } from '@parkey/shared-types'

export type PhotoCatalog = Readonly<Record<string, readonly ParkingPhoto[]>>
export type ParkingPhotoIdentity = Pick<DiscoveryParking, 'id' | 'sourceUrl'>

// Add only approved, location-matched photographs with reuse rights and credits.
// Prefer sourceUrl keys (stable across OSM snapshots and server UUIDs); put the
// entrance photograph first. Never copy local contribution photo URIs here.
export const curatedParkingPhotos: PhotoCatalog = {}

function hasControlCharacters(value: string, allowSpace = true): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0)
    return code < (allowSpace ? 32 : 33) || code === 127
  })
}

function isHttpsUrl(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length > 2048 ||
    value !== value.trim() ||
    hasControlCharacters(value, false)
  )
    return false
  try {
    const url = new URL(value)
    // Catalog assets must be public reusable URLs, never signed/session URLs.
    return (
      url.protocol === 'https:' &&
      !!url.hostname &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    )
  } catch {
    return false
  }
}

function text(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.length <= maximum &&
    !!value.trim() &&
    !hasControlCharacters(value) &&
    !/^(?:unknown|unavailable|not recorded|not provided|n\/a|none|-)$/i.test(
      value.trim(),
    )
  )
}

export function isParkingPhoto(value: unknown): value is ParkingPhoto {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false
  return (
    [
      'id',
      'thumbnailUrl',
      'imageUrl',
      'sourceUrl',
      'caption',
      'credit',
      'license',
    ].every((key) => Object.hasOwn(value, key)) &&
    'id' in value &&
    text(value.id, 128) &&
    value.id === value.id.trim() &&
    'thumbnailUrl' in value &&
    isHttpsUrl(value.thumbnailUrl) &&
    'imageUrl' in value &&
    isHttpsUrl(value.imageUrl) &&
    'sourceUrl' in value &&
    isHttpsUrl(value.sourceUrl) &&
    'caption' in value &&
    text(value.caption, 300) &&
    'credit' in value &&
    text(value.credit, 300) &&
    'license' in value &&
    text(value.license, 200)
  )
}

/** The catalog key is explicit location matching, not a proximity/photo lookup. */
export function parkingPhotoIdentityKey(parking: ParkingPhotoIdentity): string {
  if (!text(parking.id, 200) || parking.id !== parking.id.trim()) return ''
  if (parking.sourceUrl !== null)
    return isHttpsUrl(parking.sourceUrl) ? `source:${parking.sourceUrl}` : ''
  return `record:${parking.id}`
}

export function validParkingPhotos(value: unknown): ParkingPhoto[] {
  if (!Array.isArray(value)) return []
  const ids = new Set<string>()
  return value.filter((photo): photo is ParkingPhoto => {
    if (!isParkingPhoto(photo) || ids.has(photo.id)) return false
    ids.add(photo.id)
    return true
  })
}

export function parkingPhotos(
  parking: ParkingPhotoIdentity,
  catalog: PhotoCatalog = curatedParkingPhotos,
): ParkingPhoto[] {
  if (!parkingPhotoIdentityKey(parking)) return []
  // A known source is authoritative. A reused record ID must not inherit photos
  // catalogued for a different source. ID-only entries require no source URL.
  const key = parking.sourceUrl ?? parking.id
  return validParkingPhotos(Object.hasOwn(catalog, key) ? catalog[key] : [])
}

export function photoPage(offset: number, width: number, count: number) {
  if (width <= 0 || count <= 0 || !Number.isFinite(offset)) return 0
  return Math.max(0, Math.min(count - 1, Math.round(offset / width)))
}
