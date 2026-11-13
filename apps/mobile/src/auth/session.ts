import type { Session, User } from '@supabase/supabase-js'

export type AuthSnapshot =
  | { status: 'checking' | 'signed-out' | 'unavailable' | 'error'; user: null }
  | { status: 'signed-in' | 'recovery'; user: User; expiresAt: number }

type SessionReader = {
  getSession: () => Promise<{
    data: { session: Session | null }
    error: unknown
  }>
  getUser: () => Promise<{ data: { user: User | null }; error: unknown }>
}

// A late verification must not reauthenticate someone who has just signed out.
// Persisted session.user is never sufficient evidence of an authenticated user.
export function createSessionVerifier(
  auth: SessionReader,
  emit: (state: AuthSnapshot) => void,
  recovering: () => boolean,
) {
  let revision = 0
  let active = true
  let inFlight: Promise<AuthSnapshot> | null = null
  return {
    cancel() {
      active = false
      revision++
      inFlight = null
    },
    clear() {
      revision++
      inFlight = null
      if (active) emit({ status: 'signed-out', user: null })
    },
    async verify(): Promise<AuthSnapshot> {
      if (!active) return { status: 'checking', user: null }
      if (inFlight) return inFlight
      const current = ++revision
      if (active) emit({ status: 'checking', user: null })
      const work = async (): Promise<AuthSnapshot> => {
        let next: AuthSnapshot
        try {
          const session = await auth.getSession()
          if (session.error) throw session.error
          if (!session.data.session) next = { status: 'signed-out', user: null }
          else {
            const verified = await auth.getUser()
            if (verified.error) throw verified.error
            const user = verified.data.user
            const expiresAt = (session.data.session.expires_at ?? 0) * 1000
            next =
              user?.email_confirmed_at &&
              Number.isFinite(expiresAt) &&
              expiresAt > Date.now()
                ? {
                    status: recovering() ? 'recovery' : 'signed-in',
                    user,
                    expiresAt,
                  }
                : { status: 'signed-out', user: null }
          }
        } catch {
          next = { status: 'error', user: null }
        }
        if (active && current === revision) emit(next)
        return active && current === revision
          ? next
          : { status: 'checking', user: null }
      }
      const pending = work()
      inFlight = pending
      try {
        return await pending
      } finally {
        if (inFlight === pending) inFlight = null
      }
    },
  }
}
