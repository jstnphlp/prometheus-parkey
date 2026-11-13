export const DISCLOSURE_VERSION = '2026-11-10-email-text-v1'
export const MAX_BODY_BYTES = 65536
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: string[]) => {
  if (
    Object.keys(value).some((key) => !keys.includes(key)) ||
    keys.some((key) => !(key in value))
  )
    throw new TypeError('Unsupported fields')
}
const text = (value: unknown, min: number, max: number) => {
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.trim().length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  )
    throw new TypeError('Invalid text')
  return value.trim()
}
export const isReportId = (value: unknown): value is string =>
  typeof value === 'string' && uuid.test(value)
export type ReportPayload = {
  intent: 'add' | 'correction'
  target: string | null
  name: string
  kind: 'street' | 'lot' | 'garage'
  geometry:
    | { type: 'Point'; coordinates: [number, number] }
    | { type: 'LineString'; coordinates: [number, number][] }
  side: 'left' | 'right' | 'both' | 'unknown'
  restrictions: string | null
  hours: string | null
  fees: string | null
  observed_at: string
}
function coordinate(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    typeof value[0] === 'number' &&
    value[0] >= -180 &&
    value[0] <= 180 &&
    typeof value[1] === 'number' &&
    value[1] >= -90 &&
    value[1] <= 90
  )
}
export function reportPayload(value: unknown, now = Date.now()): ReportPayload {
  if (!object(value)) throw new TypeError('Report required')
  exact(value, [
    'intent',
    'target',
    'name',
    'kind',
    'geometry',
    'side',
    'restrictions',
    'hours',
    'fees',
    'observed_at',
  ])
  const { intent, kind, side, geometry, target } = value
  if (
    (intent !== 'add' && intent !== 'correction') ||
    !['street', 'lot', 'garage'].includes(String(kind)) ||
    !['left', 'right', 'both', 'unknown'].includes(String(side))
  )
    throw new TypeError('Invalid classification')
  if (!object(geometry)) throw new TypeError('Geometry required')
  exact(geometry, ['type', 'coordinates'])
  let shape: ReportPayload['geometry']
  if (kind === 'street') {
    if (
      geometry.type !== 'LineString' ||
      !Array.isArray(geometry.coordinates) ||
      geometry.coordinates.length < 2 ||
      geometry.coordinates.length > (intent === 'correction' ? 500 : 12) ||
      !geometry.coordinates.every(coordinate)
    )
      throw new TypeError('Invalid street')
    shape = { type: 'LineString', coordinates: geometry.coordinates }
  } else {
    if (
      geometry.type !== 'Point' ||
      !coordinate(geometry.coordinates) ||
      side !== 'unknown'
    )
      throw new TypeError('Invalid facility')
    shape = { type: 'Point', coordinates: geometry.coordinates }
  }
  if (
    intent === 'add'
      ? target !== null
      : typeof target !== 'string' ||
        !(
          uuid.test(target) ||
          /^osm:(node|way|relation)\/[1-9][0-9]*$/.test(target)
        )
  )
    throw new TypeError('Invalid target')
  const name = text(value.name, 3, 100)
  if (/[\r\n\t]/.test(name)) throw new TypeError('Invalid name')
  const optional = (v: unknown) => (v === null ? null : text(v, 1, 500))
  const restrictions = optional(value.restrictions)
  if (intent === 'correction' && !restrictions)
    throw new TypeError('Correction required')
  const observed = text(value.observed_at, 20, 35)
  const observedTime = Date.parse(observed)
  if (
    !Number.isFinite(observedTime) ||
    observedTime > now ||
    observedTime < now - 90 * 86400000
  )
    throw new TypeError('Observation must be within the last 90 days')
  return {
    intent,
    target: typeof target === 'string' ? target : null,
    name,
    kind: kind === 'street' ? 'street' : kind === 'lot' ? 'lot' : 'garage',
    side:
      side === 'left'
        ? 'left'
        : side === 'right'
          ? 'right'
          : side === 'both'
            ? 'both'
            : 'unknown',
    geometry: shape,
    restrictions,
    hours: optional(value.hours),
    fees: optional(value.fees),
    observed_at: new Date(observedTime).toISOString(),
  }
}
export function reportRequest(value: unknown, now = Date.now()) {
  if (!object(value)) throw new TypeError('Object required')
  const submit = value.action === 'submit'
  exact(
    value,
    submit
      ? [
          'schema_version',
          'action',
          'client_key',
          'disclosure_version',
          'report',
        ]
      : ['schema_version', 'action', 'client_key'],
  )
  if (
    value.schema_version !== 1 ||
    !['submit', 'status', 'withdraw'].includes(String(value.action))
  )
    throw new TypeError('Unsupported operation')
  const key = text(value.client_key, 1, 100)
  if (!/^[A-Za-z0-9:_-]+$/.test(key)) throw new TypeError('Invalid key')
  if (submit && value.disclosure_version !== DISCLOSURE_VERSION)
    throw new TypeError('Disclosure required')
  return {
    operation: submit
      ? 'submit'
      : value.action === 'status'
        ? 'status'
        : 'withdraw',
    client_key: key,
    payload: submit ? reportPayload(value.report, now) : null,
  }
}
export async function readReportBody(request: Request): Promise<unknown> {
  if (
    request.headers.get('content-type')?.split(';')[0]?.trim() !==
    'application/json'
  )
    throw new TypeError('JSON required')
  const length = request.headers.get('content-length')
  if (length && Number(length) > MAX_BODY_BYTES)
    throw new RangeError('Body limit')
  const reader = request.body?.getReader()
  if (!reader) throw new TypeError('Body required')
  let bytes = 0
  const chunks: Uint8Array[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      void reader.cancel()
      reject(new RangeError('Body timeout'))
    }, 5000)
  })
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline])
      if (done) break
      bytes += value.byteLength
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel()
        throw new RangeError('Body limit')
      }
      chunks.push(value)
    }
    const combined = new Uint8Array(bytes)
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.byteLength
    }
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(combined),
    )
  } finally {
    clearTimeout(timer)
    reader.releaseLock()
  }
}
