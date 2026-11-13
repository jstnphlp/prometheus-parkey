import { createClient } from '@supabase/supabase-js'

import type { SecretStorage } from './secure-storage.ts'
import { sessionStorageKey } from './secure-storage.ts'

export function createAuthClient(
  url: string,
  key: string,
  storage: SecretStorage,
  requestFetch: typeof fetch,
) {
  return createClient(url, key, {
    auth: {
      storage,
      storageKey: sessionStorageKey,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
    global: { fetch: requestFetch },
  })
}
