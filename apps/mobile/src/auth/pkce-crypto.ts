import * as Crypto from 'expo-crypto'

// Supabase PKCE requires secure random values and Web Crypto's SHA-256 digest.
// Supply only missing primitives; never replace a platform implementation and
// never allow the SDK's Math.random / plain-challenge fallbacks on native.
export function ensurePkceCrypto() {
  if (typeof globalThis.crypto === 'undefined')
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues: Crypto.getRandomValues,
        randomUUID: Crypto.randomUUID,
      },
    })
  if (!globalThis.crypto.getRandomValues)
    Object.defineProperty(globalThis.crypto, 'getRandomValues', {
      value: Crypto.getRandomValues,
    })
  if (!globalThis.crypto.subtle)
    Object.defineProperty(globalThis.crypto, 'subtle', {
      value: {
        digest(
          algorithm: string | { name: string },
          data: Parameters<typeof Crypto.digest>[1],
        ) {
          const name =
            typeof algorithm === 'string' ? algorithm : algorithm.name
          if (name.toUpperCase() !== 'SHA-256')
            throw new Error('Unsupported PKCE digest.')
          return Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data)
        },
      },
    })
  if (!globalThis.crypto.getRandomValues || !globalThis.crypto.subtle.digest)
    throw new Error('Secure PKCE cryptography is unavailable.')
}
