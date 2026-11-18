import 'react-native-url-polyfill/auto'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

import { config } from '../discovery/config'
import { publicSupabaseProblem } from '../discovery/pilot-config'

import { chunkedSecretStorage, createSessionStorage } from './secure-storage'
import { ensurePkceCrypto } from './pkce-crypto'
import { createAuthClient } from './auth-api'
import { boundedAuthFetch } from './network'

export const authConfigurationProblem = publicSupabaseProblem(
  config.supabaseUrl,
  config.supabaseKey,
  true,
)
export const secrets = chunkedSecretStorage({
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
})

export async function createAuthRuntime() {
  if (
    authConfigurationProblem ||
    Platform.OS === 'web' ||
    !(await SecureStore.isAvailableAsync())
  )
    return null
  ensurePkceCrypto()
  const storage = createSessionStorage(secrets)
  const client = createAuthClient(
    config.supabaseUrl,
    config.supabaseKey,
    storage,
    boundedAuthFetch,
  )
  return { client, storage }
}
export type AuthRuntime = NonNullable<
  Awaited<ReturnType<typeof createAuthRuntime>>
>
