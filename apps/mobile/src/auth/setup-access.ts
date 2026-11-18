import type { User } from '@supabase/supabase-js'

import { profileComplete } from '../onboarding/profile.ts'
import type { AuthSnapshot } from './session.ts'

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

export function postAuthDestination(user: User) {
  return profileComplete(user) ? '/' : '/account-setup'
}

export function discoveryDestination(
  state: AuthSnapshot,
  introduced: boolean,
  now = Date.now(),
) {
  if (state.status === 'checking') return null
  if (state.status === 'error') return '/account'
  if (state.status === 'recovery') return '/reset-password'
  if (state.status === 'signed-in')
    return setupAccess(state, now) === 'allowed'
      ? postAuthDestination(state.user)
      : '/login'
  return introduced ? '/' : '/welcome'
}
