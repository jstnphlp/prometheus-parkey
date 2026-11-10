import { config } from './config.ts'

export const pilotCities = ['Manila', 'Mandaluyong'] as const
export type PilotCity = (typeof pilotCities)[number]

export const pilotDiscoveryEnabled =
  process.env.EXPO_PUBLIC_PILOT_DISCOVERY_ENABLED === 'true'

// This only limits developer UI. Server authorization remains mandatory.
export const candidateResearchEnabled =
  process.env.NODE_ENV === 'development' &&
  process.env.PARKEY_RELEASE_BUILD !== 'true'

function localAddress(hostname: string) {
  if (
    ['localhost', '127.0.0.1', '[::1]', '::1', '10.0.2.2'].includes(hostname) ||
    hostname.endsWith('.localhost')
  )
    return true
  const parts = hostname.split('.')
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part)))
    return false
  const first = Number(parts[0])
  const second = Number(parts[1])
  return (
    first === 10 ||
    first === 127 ||
    (first === 192 && second === 168) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 169 && second === 254)
  )
}

export function publicEndpointProblem(
  value: string,
  release: boolean,
  originOnly = false,
): string | null {
  try {
    const url = new URL(value)
    const hostname = url.hostname.replace(/\.+$/, '')
    if (url.username || url.password || url.search || url.hash)
      return 'Endpoint URLs must not contain credentials, query values or fragments.'
    if (originOnly && url.pathname !== '/')
      return 'The Supabase URL must be its base origin, without an API path.'
    if (!release) {
      return url.protocol === 'https:' ||
        (url.protocol === 'http:' && localAddress(hostname))
        ? null
        : 'Development endpoints require HTTPS or an explicit local HTTP address.'
    }
    if (
      url.protocol !== 'https:' ||
      localAddress(hostname) ||
      /^[\d.]+$/.test(hostname) ||
      hostname.includes(':') ||
      !hostname.includes('.') ||
      /\.(localhost|local|internal|test|invalid|example|lan|home|corp)$/.test(
        hostname,
      ) ||
      ['home.arpa', 'nip.io', 'sslip.io', 'localtest.me'].some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      ) ||
      ['example.com', 'example.net', 'example.org'].some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      )
    )
      return 'Release endpoints require a public HTTPS DNS hostname; local, private and example addresses are prohibited.'
    return null
  } catch {
    return 'Endpoint URL is invalid.'
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function jwtPart(value: string): unknown {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  return JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')))
}

/** Syntax/role screening only; Supabase verifies key signatures server-side. */
export function isPublicSupabaseKey(value: string): boolean {
  if (value.length > 10000) return false
  if (/^sb_publishable_[A-Za-z0-9_-]{8,}$/.test(value)) return true
  const [headerPart, payloadPart, signature, extra] = value.split('.')
  if (
    !headerPart ||
    !payloadPart ||
    !signature ||
    extra !== undefined ||
    !/^[A-Za-z0-9_-]{32,}$/.test(signature)
  )
    return false
  try {
    const header = jwtPart(headerPart)
    const payload = jwtPart(payloadPart)
    return (
      object(header) &&
      header.alg === 'HS256' &&
      object(payload) &&
      payload.role === 'anon'
    )
  } catch {
    return false
  }
}

export function publicSupabaseProblem(
  url: string,
  key: string,
  release: boolean,
): string | null {
  if (!url || !key) return 'Configure both public Supabase values.'
  const urlProblem = publicEndpointProblem(url, release, true)
  if (urlProblem) return urlProblem
  return isPublicSupabaseKey(key)
    ? null
    : 'Use a Supabase publishable key or an anon-role legacy JWT; secret, service-role and user-session keys are prohibited.'
}

const configurationError = publicSupabaseProblem(
  config.supabaseUrl,
  config.supabaseKey,
  process.env.NODE_ENV === 'production',
)

export const pilotConfig = {
  supabaseUrl: config.supabaseUrl,
  publicKey: config.supabaseKey,
  ready: configurationError === null,
  configurationError,
}
