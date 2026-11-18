export type ConfirmationResult =
  'confirmed' | 'expired' | 'invalid' | 'network' | 'unavailable'

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function confirmationToken(fragment: string): string | null {
  if (!fragment.startsWith('#') || fragment.length > 512) return null
  const params = new URLSearchParams(fragment.slice(1))
  const values = params.getAll('token_hash')
  if (
    values.length !== 1 ||
    [...params.keys()].some((key) => key !== 'token_hash')
  )
    return null
  const value = values[0]
  return value && /^[A-Za-z0-9_-]{32,256}$/.test(value) ? value : null
}

function publicKey(key: string): boolean {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true
  try {
    const payload = key.split('.')[1]
    if (!payload) return false
    const claims: unknown = JSON.parse(
      atob(payload.replaceAll('-', '+').replaceAll('_', '/')),
    )
    return record(claims) && claims.role === 'anon'
  } catch {
    return false
  }
}

export function confirmationConfiguration(config: {
  url: string
  key: string
}): string | null {
  try {
    const url = new URL(config.url)
    if (
      url.protocol !== 'https:' ||
      url.pathname !== '/' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !publicKey(config.key)
    )
      return null
    return url.origin
  } catch {
    return null
  }
}

// No SDK session, cookie or localStorage is created. The verification response
// may contain credentials; only its verified-email result leaves this function.
export async function confirmEmail(
  tokenHash: string,
  config: { url: string; key: string },
  request: typeof fetch = fetch,
): Promise<ConfirmationResult> {
  if (!confirmationToken(`#token_hash=${tokenHash}`)) return 'invalid'
  const origin = confirmationConfiguration(config)
  if (!origin) return 'unavailable'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
    const response = await request(`${origin}/auth/v1/verify`, {
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: { apikey: config.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token_hash: tokenHash, type: 'email' }),
      signal: controller.signal,
    })
    let body: unknown
    try {
      body = await response.json()
    } catch {
      return 'unavailable'
    }
    if (!response.ok) {
      if (record(body) && body.code === 'otp_expired') return 'expired'
      return response.status >= 500 || response.status === 429
        ? 'unavailable'
        : 'invalid'
    }
    if (
      !record(body) ||
      !record(body.user) ||
      typeof body.user.id !== 'string' ||
      typeof body.user.email_confirmed_at !== 'string' ||
      !Number.isFinite(Date.parse(body.user.email_confirmed_at))
    )
      return 'unavailable'
    return 'confirmed'
  } catch {
    return 'network'
  } finally {
    clearTimeout(timer)
  }
}
