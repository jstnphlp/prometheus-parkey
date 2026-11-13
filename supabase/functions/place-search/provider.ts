type Place = {
  id: string
  name: string
  address: string
  coordinate: [number, number]
}
export const attribution = {
  label: 'Search by LocationIQ.com',
  url: 'https://locationiq.com/',
}
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown) =>
  typeof v === 'string' ? v.trim().slice(0, 500) : ''

export function parseQuery(value: unknown): string {
  if (
    !object(value) ||
    Object.keys(value).some((key) => key !== 'query') ||
    typeof value.query !== 'string'
  )
    throw new TypeError('query required')
  const query = value.query.trim()
  if (
    query.length < 3 ||
    query.length > 180 ||
    /[\u0000-\u001f\u007f]/.test(query)
  )
    throw new TypeError('Invalid query')
  return query
}

export function parseLocationIQ(value: unknown): Place[] {
  if (!Array.isArray(value)) throw new TypeError('Invalid provider response')
  const results: Place[] = []
  const seen = new Set<string>()
  for (const row of value.slice(0, 6)) {
    if (
      !object(row) ||
      !object(row.address) ||
      text(row.address.country_code).toLowerCase() !== 'ph'
    )
      continue
    if (
      typeof row.lon !== 'string' ||
      typeof row.lat !== 'string' ||
      !row.lon.trim() ||
      !row.lat.trim()
    )
      continue
    const lon = Number(row.lon),
      lat = Number(row.lat)
    if (
      !Number.isFinite(lon) ||
      !Number.isFinite(lat) ||
      lon < -180 ||
      lon > 180 ||
      lat < -90 ||
      lat > 90
    )
      continue
    const display = text(row.display_name)
    const name = text(row.display_place) || display.split(',')[0]?.trim()
    if (!name || !display) continue
    const id = `locationiq:${text(row.place_id) || `${lon},${lat},${name}`}`
    if (seen.has(id)) continue
    seen.add(id)
    results.push({
      id,
      name,
      address: text(row.display_address) || display,
      coordinate: [lon, lat],
    })
  }
  return results
}

export async function autocomplete(
  token: string,
  query: string,
  signal: AbortSignal,
  requestFetch: typeof fetch,
) {
  const url = new URL('https://api.locationiq.com/v1/autocomplete')
  url.search = new URLSearchParams({
    key: token,
    q: query,
    countrycodes: 'ph',
    limit: '6',
    'accept-language': 'en',
    format: 'json',
  }).toString()
  const response = await requestFetch(url, { signal, redirect: 'error' })
  if (response.status === 429) return { status: 429, results: [] }
  if (response.status === 404) return { status: 200, results: [] }
  if (!response.ok) throw new Error('Provider unavailable')
  return { status: 200, results: parseLocationIQ(await response.json()) }
}
