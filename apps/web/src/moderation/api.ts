export function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

const url = import.meta.env?.VITE_SUPABASE_URL?.replace(/\/$/, '') ?? ''
const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
export const configured = Boolean(url && key)

export async function auth(
  path: string,
  token: string,
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${token || key}`,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok)
    throw new Error(
      'Authentication failed. Check your credentials or code and try again.',
    )
  if (response.status === 204) return null
  return response.json()
}

export function accessToken(value: unknown): string {
  if (!object(value) || typeof value.access_token !== 'string')
    throw new Error('Invalid authentication response.')
  return value.access_token
}

export type Report = {
  id: string
  target_id: string | null
  external_target_url: string | null
  side: string | null
  name: string
  kind: string
  intent: string
  status: string
  restrictions: string | null
  fees: string | null
  hours: string | null
  observed_at: string | null
  geometry: Record<string, unknown>
}
export type Queue = { canPublish: boolean; hasMore: boolean; reports: Report[] }

export function parseQueue(value: unknown): Queue {
  if (
    !object(value) ||
    typeof value.canPublish !== 'boolean' ||
    typeof value.hasMore !== 'boolean' ||
    !Array.isArray(value.reports)
  )
    throw new Error('Unsupported queue response.')
  const reports: Report[] = []
  for (const item of value.reports) {
    if (
      !object(item) ||
      typeof item.id !== 'string' ||
      typeof item.name !== 'string' ||
      typeof item.kind !== 'string' ||
      typeof item.intent !== 'string' ||
      typeof item.status !== 'string' ||
      !object(item.geometry)
    )
      throw new Error('Unsupported report.')
    const nullable = (name: string) => {
      const field = item[name]
      if (field === null || typeof field === 'string') return field
      throw new Error('Unsupported report detail.')
    }
    reports.push({
      id: item.id,
      target_id: nullable('target_id'),
      external_target_url: nullable('external_target_url'),
      side: nullable('side'),
      name: item.name,
      kind: item.kind,
      intent: item.intent,
      status: item.status,
      geometry: item.geometry,
      fees: nullable('fees'),
      hours: nullable('hours'),
      restrictions: nullable('restrictions'),
      observed_at: nullable('observed_at'),
    })
  }
  return { canPublish: value.canPublish, hasMore: value.hasMore, reports }
}

export async function moderate(token: string, body: unknown): Promise<unknown> {
  const response = await fetch(`${url}/functions/v1/discovery-moderation`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) {
    if (response.status === 401)
      throw new Error('Your session expired. Sign out and sign in again.')
    if (response.status === 403)
      throw new Error(
        'Reviewer access and multi-factor authentication are required.',
      )
    throw new Error(
      'Action unavailable. Refresh and check the report and public provenance before retrying.',
    )
  }
  return response.json()
}
