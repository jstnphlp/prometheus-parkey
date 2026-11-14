import { callbackCode } from './links.ts'

export const oauthRedirectUrl = 'parkey://auth/oauth'
export type SocialProvider = 'google' | 'facebook'
export type OAuthFlow = {
  kind: 'oauth'
  provider: SocialProvider
  createdAt: number
  flowId: string
}

export function readOAuthFlow(
  value: string | null,
  now = Date.now(),
): OAuthFlow | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (
      parsed &&
      typeof parsed === 'object' &&
      'kind' in parsed &&
      parsed.kind === 'oauth' &&
      'provider' in parsed &&
      (parsed.provider === 'google' || parsed.provider === 'facebook') &&
      'flowId' in parsed &&
      typeof parsed.flowId === 'string' &&
      /^[a-f0-9]{32}$/.test(parsed.flowId) &&
      'createdAt' in parsed &&
      typeof parsed.createdAt === 'number' &&
      Number.isFinite(parsed.createdAt) &&
      parsed.createdAt <= now &&
      now - parsed.createdAt <= 15 * 60 * 1000
    )
      return {
        kind: 'oauth',
        provider: parsed.provider,
        createdAt: parsed.createdAt,
        flowId: parsed.flowId,
      }
  } catch {
    /* Corrupt or expired requests cannot authorize a sign-in. */
  }
  return null
}

export function oauthCallbackCode(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (
      parsed.protocol !== 'parkey:' ||
      parsed.hostname !== 'auth' ||
      parsed.pathname !== '/oauth' ||
      parsed.hash ||
      parsed.searchParams.getAll('code').length !== 1
    )
      return null
    return callbackCode(Object.fromEntries(parsed.searchParams))
  } catch {
    return null
  }
}

export function trustedOAuthUrl(
  value: string,
  projectUrl: string,
  provider: SocialProvider,
): boolean {
  try {
    const url = new URL(value)
    const origin = new URL(projectUrl)
    return (
      url.protocol === 'https:' &&
      origin.protocol === 'https:' &&
      url.origin === origin.origin &&
      !url.username &&
      !url.password &&
      !url.hash &&
      url.pathname === '/auth/v1/authorize' &&
      url.searchParams.getAll('provider').length === 1 &&
      url.searchParams.getAll('redirect_to').length === 1 &&
      url.searchParams.getAll('code_challenge_method').length === 1 &&
      url.searchParams.getAll('code_challenge').length === 1 &&
      url.searchParams.get('provider') === provider &&
      url.searchParams.get('redirect_to') === oauthRedirectUrl &&
      url.searchParams.get('code_challenge_method')?.toLowerCase() === 's256' &&
      /^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get('code_challenge') ?? '')
    )
  } catch {
    return false
  }
}

export function enabledSocialProviders(
  value: unknown,
): Record<SocialProvider, boolean> {
  if (
    !value ||
    typeof value !== 'object' ||
    !('external' in value) ||
    !value.external ||
    typeof value.external !== 'object'
  )
    return { google: false, facebook: false }
  return {
    google: 'google' in value.external && value.external.google === true,
    facebook: 'facebook' in value.external && value.external.facebook === true,
  }
}
