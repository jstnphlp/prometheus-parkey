import type { ReactNode } from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { AppState } from 'react-native'

import { createAuthRuntime, secrets } from './client'
import type { AuthRuntime } from './client'
import { authRedirectUrl, readEmailFlow } from './links'
import { pendingFlowKey, sessionStorageKey } from './secure-storage'
import { createSessionVerifier } from './session'
import type { AuthSnapshot } from './session'

type AuthContextValue = {
  state: AuthSnapshot
  busy: boolean
  retry: () => Promise<void>
  signIn: (email: string, password: string, remember: boolean) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<boolean>
  sendEmail: (email: string, kind: 'signup' | 'recovery') => Promise<void>
  callback: (code: string) => Promise<'signup' | 'recovery'>
  updatePassword: (password: string) => Promise<void>
  signOut: () => Promise<boolean>
}
const AuthContext = createContext<AuthContextValue | null>(null)
const invalidLink = () =>
  Object.assign(new Error('Email link cannot be verified.'), {
    code: 'flow_state_expired',
  })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [runtime, setRuntime] = useState<AuthRuntime | null>(null)
  const [state, setState] = useState<AuthSnapshot>({
    status: 'checking',
    user: null,
  })
  const [busy, setBusy] = useState(false)
  const operation = useRef(false)
  const recovery = useRef(false)
  const verifier = useRef<ReturnType<typeof createSessionVerifier> | null>(null)

  const boot = useCallback(async () => {
    try {
      const next = await createAuthRuntime()
      setRuntime(next)
      if (!next) setState({ status: 'unavailable', user: null })
    } catch {
      setState({ status: 'error', user: null })
    }
  }, [])
  useEffect(() => {
    let mounted = true
    void createAuthRuntime()
      .then((next) => {
        if (!mounted) {
          next?.storage.deactivate()
          return
        }
        setRuntime(next)
        if (!next) setState({ status: 'unavailable', user: null })
      })
      .catch(() => {
        if (mounted) setState({ status: 'error', user: null })
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!runtime) return
    const check = createSessionVerifier(
      runtime.client.auth,
      setState,
      () => recovery.current,
    )
    verifier.current = check
    const {
      data: { subscription },
    } = runtime.client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        recovery.current = false
        check.clear()
      } else {
        if (event === 'PASSWORD_RECOVERY') recovery.current = true
        // Do not await Supabase methods while its auth-event lock is held.
        setTimeout(() => {
          void check.verify()
        }, 0)
      }
    })
    function foreground(next: string | null | undefined) {
      if (next === 'active') {
        void runtime?.client.auth.startAutoRefresh()
        void check.verify()
      } else void runtime?.client.auth.stopAutoRefresh()
    }
    foreground(AppState.currentState)
    const listener = AppState.addEventListener('change', foreground)
    return () => {
      check.cancel()
      subscription.unsubscribe()
      listener.remove()
      void runtime.client.auth.stopAutoRefresh()
      if (verifier.current === check) verifier.current = null
    }
  }, [runtime])

  useEffect(() => {
    if (state.status !== 'signed-in' && state.status !== 'recovery') return
    const timer = setTimeout(
      () => {
        void verifier.current?.verify()
      },
      Math.max(0, state.expiresAt - Date.now()),
    )
    return () => clearTimeout(timer)
  }, [state])

  async function action<T>(
    work: (current: AuthRuntime) => Promise<T>,
  ): Promise<T> {
    if (!runtime || operation.current)
      throw new Error('Authentication is not ready.')
    operation.current = true
    setBusy(true)
    try {
      return await work(runtime)
    } finally {
      operation.current = false
      setBusy(false)
    }
  }

  async function emailFlow(
    kind: 'signup' | 'recovery',
    work: () => Promise<{ error: unknown }>,
  ) {
    await secrets.setItem(
      pendingFlowKey,
      JSON.stringify({ kind, createdAt: Date.now() }),
    )
    const result = await work()
    if (result.error) {
      await secrets.removeItem(pendingFlowKey)
      throw result.error
    }
  }

  const value: AuthContextValue = {
    state,
    busy,
    async retry() {
      if (runtime) await verifier.current?.verify()
      else await boot()
    },
    signIn: (email, password, remember) =>
      action(async (current) => {
        await current.storage.setRemember(remember)
        recovery.current = false
        const { error } = await current.client.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error
        const verified = await verifier.current?.verify()
        if (verified?.status !== 'signed-in')
          throw new Error('Session could not be verified.')
      }),
    signUp: (name, email, password) =>
      action(async (current) => {
        await current.storage.setRemember(false)
        let hasSession = false
        await emailFlow('signup', async () => {
          const result = await current.client.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: { full_name: name.trim() },
              emailRedirectTo: authRedirectUrl,
            },
          })
          hasSession = Boolean(result.data.session)
          return result
        })
        if (hasSession) {
          const verified = await verifier.current?.verify()
          return verified?.status === 'signed-in'
        }
        return false
      }),
    sendEmail: (email, kind) =>
      action(async (current) => {
        if (
          kind === 'signup' &&
          !(await current.storage.getItem(`${sessionStorageKey}-code-verifier`))
        )
          throw invalidLink()
        await emailFlow(kind, () =>
          kind === 'recovery'
            ? current.client.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: authRedirectUrl,
              })
            : current.client.auth.resend({
                type: 'signup',
                email: email.trim(),
                options: { emailRedirectTo: authRedirectUrl },
              }),
        )
      }),
    callback: (code) =>
      action(async (current) => {
        const pending = readEmailFlow(await secrets.getItem(pendingFlowKey))
        if (!pending) throw invalidLink()
        if (pending.kind === 'recovery')
          await current.storage.setRemember(false)
        const { data, error } =
          await current.client.auth.exchangeCodeForSession(code)
        if (error) throw error
        const isRecovery =
          'redirectType' in data && data.redirectType === 'recovery'
        if (!data.session || (pending.kind === 'recovery') !== isRecovery)
          throw invalidLink()
        recovery.current = pending.kind === 'recovery'
        const verified = await verifier.current?.verify()
        if (verified?.status !== (recovery.current ? 'recovery' : 'signed-in'))
          throw invalidLink()
        await secrets.removeItem(pendingFlowKey)
        return pending.kind
      }),
    updatePassword: (password) =>
      action(async (current) => {
        if (!recovery.current || state.status !== 'recovery')
          throw invalidLink()
        const verified = await current.client.auth.getUser()
        if (verified.error || verified.data.user?.id !== state.user.id)
          throw invalidLink()
        const { error } = await current.client.auth.updateUser({ password })
        if (error) throw error
        // Recovery sessions are discarded after use; the user signs in afresh.
      }),
    async signOut() {
      if (operation.current)
        throw new Error('Wait for the current request to finish.')
      operation.current = true
      setBusy(true)
      verifier.current?.cancel()
      recovery.current = false
      setState({ status: 'signed-out', user: null })
      try {
        if (!runtime) {
          await boot()
          return true
        }
        let cached: unknown = null
        try {
          cached = JSON.parse(
            (await runtime.storage.getItem(sessionStorageKey)) ?? 'null',
          )
        } catch {
          /* Cleanup still runs when cached session data is unreadable. */
        }
        const token =
          cached &&
          typeof cached === 'object' &&
          'access_token' in cached &&
          typeof cached.access_token === 'string'
            ? cached.access_token
            : null
        runtime.storage.deactivate()
        await runtime.client.auth.stopAutoRefresh()
        await runtime.storage.forget()
        // The old storage adapter is disabled before server revocation, so a
        // late refresh cannot write credentials back or clear a newer session.
        // This SDK method calls the same user-token /logout endpoint used by
        // signOut; it does not require or receive an administrator/service key.
        const error = token
          ? (
              await runtime.client.auth.admin
                .signOut(token, 'local')
                .catch(() => ({ error: true }))
            ).error
          : null
        await boot()
        return !error
      } catch {
        setState({ status: 'error', user: null })
        throw new Error(
          'Could not clear secure session storage. Please retry signing out.',
        )
      } finally {
        operation.current = false
        setBusy(false)
      }
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider is required.')
  return value
}
