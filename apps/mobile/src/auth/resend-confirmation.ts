import { canResendSignup, readEmailFlow } from './links.ts'
import { pendingFlowKey, sessionStorageKey } from './secure-storage.ts'
import type { SecretStorage } from './secure-storage.ts'

export async function resendConfirmation(
  secrets: SecretStorage,
  sessionStorage: SecretStorage,
  email: string,
  send: () => Promise<{ error: unknown }>,
  now = Date.now,
): Promise<void> {
  const pending = readEmailFlow(await secrets.getItem(pendingFlowKey), now())
  const proof = await sessionStorage.getItem(
    `${sessionStorageKey}-code-verifier`,
  )
  if (!canResendSignup(pending, email, proof) || !pending)
    throw Object.assign(new Error('Start registration on this device.'), {
      code: 'verification_request_missing',
    })
  const { error } = await send()
  if (error) throw error
  // Renew only after acceptance. Failed sends preserve the earlier valid link.
  await secrets.setItem(
    pendingFlowKey,
    JSON.stringify({ ...pending, createdAt: now() }),
  )
}
