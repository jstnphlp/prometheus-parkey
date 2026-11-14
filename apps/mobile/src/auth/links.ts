export const authRedirectUrl = 'parkey://auth/callback'
export type EmailFlow = {
  kind: 'signup' | 'recovery'
  createdAt: number
  email?: string
}
export function readEmailFlow(
  value: string | null,
  now = Date.now(),
): EmailFlow | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (
      parsed &&
      typeof parsed === 'object' &&
      'kind' in parsed &&
      'createdAt' in parsed &&
      (parsed.kind === 'signup' || parsed.kind === 'recovery') &&
      typeof parsed.createdAt === 'number' &&
      parsed.createdAt <= now &&
      now - parsed.createdAt <= 60 * 60 * 1000
    )
      return {
        kind: parsed.kind,
        createdAt: parsed.createdAt,
        ...('email' in parsed && typeof parsed.email === 'string'
          ? { email: parsed.email }
          : {}),
      }
  } catch {
    /* A corrupt or expired flow cannot authorize a recovery. */
  }
  return null
}

// Only resend against the signup and PKCE proof created on this device.
// Legacy Phase 2 requests can still complete a callback, but must restart to resend.
export function canResendSignup(
  flow: EmailFlow | null,
  email: string,
  proof: string | null,
): boolean {
  return Boolean(
    flow?.kind === 'signup' &&
    flow.email === email.trim().toLowerCase() &&
    proof,
  )
}

export function callbackCode(params: Record<string, unknown>): string | null {
  if (
    params.error ||
    params.error_code ||
    params.access_token ||
    params.refresh_token ||
    params.token_hash ||
    params.type
  )
    return null
  return typeof params.code === 'string' &&
    /^[A-Za-z0-9_-]{8,2048}$/.test(params.code)
    ? params.code
    : null
}

export function normalizeAuthLink(path: string): string {
  try {
    const url = new URL(path, 'parkey://local')
    const callback =
      (url.hostname === 'auth' && url.pathname === '/callback') ||
      url.pathname === '/auth/callback'
    if (!callback) return path
    const params = Object.fromEntries(url.searchParams)
    const code = callbackCode(params)
    if (
      url.hash ||
      !code ||
      url.searchParams.getAll('code').length !== 1 ||
      (!path.startsWith('/') &&
        (url.protocol !== 'parkey:' ||
          !(
            (url.hostname === 'auth' && url.pathname === '/callback') ||
            (url.hostname === '' && url.pathname === '/auth/callback')
          )))
    )
      return '/auth/callback?error=invalid_link'
    return `/auth/callback?code=${encodeURIComponent(code)}`
  } catch {
    return '/auth/callback?error=invalid_link'
  }
}
