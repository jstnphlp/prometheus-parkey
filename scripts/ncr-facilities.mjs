import { createHash } from 'node:crypto'
import { distanceMeters } from './parking-open-data.mjs'

// Only explicit shared provider IDs merge observations. Names/proximity remain
// review suggestions: nearby garage floors and adjacent lots may be distinct.
function identities(candidate) {
  const keys = [
    candidate.id.replace(
      /:(Point|LineString|MultiLineString|Polygon|MultiPolygon)$/,
      '',
    ),
  ]
  for (const source of candidate.sourceProviders || []) {
    const dataset = String(source.dataset || '')
      .trim()
      .toLowerCase()
    const record = String(source.record_id || '').trim()
    if (!dataset || !record) continue
    if (['openstreetmap', 'osm'].includes(dataset)) {
      const match = record.match(
        /^(?:https?:\/\/(?:www\.)?openstreetmap\.org\/)?(node|way|relation)\/([1-9]\d*)$/,
      )
      if (match) keys.push(`osm:${match[1]}/${match[2]}`)
    } else keys.push(`provider:${dataset}:${record}`)
  }
  return keys
}

export function groupFacilityIdentities(candidates) {
  const facilities = candidates.filter((c) =>
    ['lot', 'garage', 'facility_unspecified'].includes(c.type),
  )
  const parent = facilities.map((_, i) => i)
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  const owner = new Map()
  facilities.forEach((candidate, i) => {
    for (const key of identities(candidate)) {
      if (owner.has(key)) parent[find(i)] = find(owner.get(key))
      else owner.set(key, i)
    }
  })
  const groups = new Map()
  facilities.forEach((c, i) => {
    const root = find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(c)
  })
  return [...groups.values()]
    .map((members) => {
      const sourceCandidateIds = members.map((c) => c.id).sort()
      const located = members.filter((c) =>
        Array.isArray(c.representativePoint),
      )
      let maximumLocationSpreadMeters = located.length ? 0 : null
      for (let i = 0; i < located.length; i++)
        for (let j = i + 1; j < located.length; j++)
          maximumLocationSpreadMeters = Math.max(
            maximumLocationSpreadMeters,
            distanceMeters(
              located[i].representativePoint,
              located[j].representativePoint,
            ),
          )
      return {
        id:
          'facility:' +
          createHash('sha256')
            .update(sourceCandidateIds.join('\n'))
            .digest('hex')
            .slice(0, 20),
        sourceCandidateIds,
        lgus: [...new Set(members.flatMap((c) => c.lgus))].sort(),
        types: [...new Set(members.map((c) => c.type))].sort(),
        identityBasis:
          members.length > 1
            ? 'explicit_shared_source_identity'
            : 'single_source_observation',
        maximumLocationSpreadMeters,
        identityReviewRequired: members.length > 1,
        flags:
          maximumLocationSpreadMeters > 100
            ? ['shared_identity_location_conflict']
            : [],
        publicationApproved: false,
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}
