import type { createAuthClient } from './auth-api.ts'
import {
  oauthCallbackCode,
  oauthRedirectUrl,
  readOAuthFlow,
  trustedOAuthUrl,
} from './oauth-policy.ts'
import type { SocialProvider } from './oauth-policy.ts'
import { pendingFlowKey, sessionStorageKey } from './secure-storage.ts'
import type { SecretStorage } from './secure-storage.ts'

type OAuthContext = {
  client: ReturnType<typeof createAuthClient>
  storage: SecretStorage
  secrets: SecretStorage
  verify: () => Promise<boolean>
}
export const invalidOAuth = () =>
  Object.assign(new Error('Social sign-in could not be verified.'), {
    code: 'oauth_not_verified',
  })

export async function completeOAuth(
  context: OAuthContext,
  code: string,
): Promise<void> {
  const flow = readOAuthFlow(await context.secrets.getItem(pendingFlowKey))
  const proof = flow
    ? await context.storage.getItem(
        `${sessionStorageKey}-flow-${flow.flowId}-code-verifier`,
      )
    : null
  if (!flow || !proof || proof.includes('/')) throw invalidOAuth()
  const { data, error } = await context.client.auth.exchangeCodeForSession(
    code,
    { flowId: flow.flowId },
  )
  if (error) throw error
  if (
    !data.session ||
    ('redirectType' in data && data.redirectType === 'recovery') ||
    !(await context.verify())
  )
    throw invalidOAuth()
  await context.secrets.removeItem(pendingFlowKey)
}

export async function openOAuth(
  context: OAuthContext & {
    provider: SocialProvider
    projectUrl: string
    browser: (
      url: string,
      redirect: string,
    ) => Promise<{ type: string; url?: string }>
  },
): Promise<boolean> {
  let flow = JSON.stringify({
    kind: 'oauth',
    provider: context.provider,
    createdAt: Date.now(),
  })
  await context.secrets.setItem(pendingFlowKey, flow)
  let flowId: string | null = null
  try {
    const { data, error } = await context.client.auth.signInWithOAuth({
      provider: context.provider,
      options: {
        redirectTo: oauthRedirectUrl,
        skipBrowserRedirect: true,
        ...(context.provider === 'facebook' ? { scopes: 'email' } : {}),
      },
    })
    flowId = data.flowId ?? null
    if (error) throw error
    if (
      !data.url ||
      !trustedOAuthUrl(data.url, context.projectUrl, context.provider)
    )
      throw invalidOAuth()
    if (!flowId || !/^[a-f0-9]{32}$/.test(flowId)) throw invalidOAuth()
    flow = JSON.stringify({
      kind: 'oauth',
      provider: context.provider,
      createdAt: Date.now(),
      flowId,
    })
    await context.secrets.setItem(pendingFlowKey, flow)
    const response = await context.browser(data.url, oauthRedirectUrl)
    if (response.type !== 'success') return false
    const code = response.url ? oauthCallbackCode(response.url) : null
    if (!code) throw invalidOAuth()
    await completeOAuth(context, code)
    return true
  } finally {
    // Only this request may delete its proof; do not erase a later flow.
    if ((await context.secrets.getItem(pendingFlowKey)) === flow) {
      await context.secrets.removeItem(pendingFlowKey)
      if (flowId) {
        const key = `${sessionStorageKey}-flow-${flowId}-code-verifier`
        const ownProof = await context.storage.getItem(key)
        const canonicalKey = `${sessionStorageKey}-code-verifier`
        if (
          ownProof &&
          ownProof === (await context.storage.getItem(canonicalKey))
        )
          await context.storage.removeItem(canonicalKey)
        await context.storage.removeItem(key)
        const indexKey = `${sessionStorageKey}-flows-code-verifier`
        const raw = await context.storage.getItem(indexKey)
        let index: unknown
        try {
          index = JSON.parse(raw ?? '[]')
        } catch {
          index = []
        }
        const remaining = Array.isArray(index)
          ? index.filter(
              (id): id is string =>
                typeof id === 'string' &&
                /^[a-f0-9]{32}$/.test(id) &&
                id !== flowId,
            )
          : []
        if (remaining.length)
          await context.storage.setItem(indexKey, JSON.stringify(remaining))
        else await context.storage.removeItem(indexKey)
      }
    }
  }
}
