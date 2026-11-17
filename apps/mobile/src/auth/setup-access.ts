import type { AuthSnapshot } from './session'

/** Only the server-verified, confirmed, unexpired session can enter account setup. */
export function setupAccess(state: AuthSnapshot, now = Date.now()) {
  if (state.status === 'checking') return 'checking'
  if (state.status === 'recovery') return 'recovery'
  return state.status === 'signed-in' &&
    state.user.email_confirmed_at &&
    Number.isFinite(state.expiresAt) &&
    state.expiresAt > now
    ? 'allowed'
    : 'login'
}
