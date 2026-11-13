export type SecretStorage = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}

type Manifest = { generation: string; count: number }
let generationCounter = 0
function manifest(value: string | null): Manifest | null {
  if (value === null) return null
  const parsed: unknown = JSON.parse(value)
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('generation' in parsed) ||
    !('count' in parsed) ||
    typeof parsed.generation !== 'string' ||
    !/^\d+-\d+$/.test(parsed.generation) ||
    typeof parsed.count !== 'number' ||
    !Number.isInteger(parsed.count) ||
    parsed.count < 1 ||
    parsed.count > 256
  )
    throw new Error('Secure session storage is invalid.')
  return { generation: parsed.generation, count: parsed.count }
}

// Small UTF-8 chunks avoid platform keychain size limits. The manifest is the
// commit point: a partial write never replaces a previously complete session.
export function chunkedSecretStorage(backend: SecretStorage): SecretStorage {
  let tail = Promise.resolve()
  function ordered<T>(work: () => Promise<T>): Promise<T> {
    const operation = tail.then(work)
    tail = operation.then(
      () => undefined,
      () => undefined,
    )
    return operation
  }
  const root = (key: string) => `parkey.auth.v1.${key}`
  const part = (key: string, state: Manifest, index: number) =>
    `${root(key)}.${state.generation}.${index}`
  async function inventory(key: string): Promise<Manifest[]> {
    try {
      const parsed: unknown = JSON.parse(
        (await backend.getItem(`${root(key)}.inventory`)) ?? '[]',
      )
      if (!Array.isArray(parsed)) return []
      return parsed.flatMap((value) => {
        try {
          const item = manifest(JSON.stringify(value))
          return item ? [item] : []
        } catch {
          return []
        }
      })
    } catch {
      return []
    }
  }
  async function removeParts(key: string, state: Manifest | null) {
    if (state)
      await Promise.all(
        Array.from({ length: state.count }, (_, index) =>
          backend.removeItem(part(key, state, index)),
        ),
      )
  }
  const storage: SecretStorage = {
    async getItem(key) {
      const state = manifest(await backend.getItem(root(key)))
      if (!state) return null
      const chunks = await Promise.all(
        Array.from({ length: state.count }, (_, index) =>
          backend.getItem(part(key, state, index)),
        ),
      )
      if (chunks.some((chunk) => chunk === null))
        throw new Error('Secure session storage is incomplete.')
      return chunks.join('')
    },
    async setItem(key, value) {
      const points = Array.from(value)
      if (points.length > 102400)
        throw new Error('Secure session is too large.')
      const old = manifest(await backend.getItem(root(key)))
      const tracked = await inventory(key)
      if (old && !tracked.some((item) => item.generation === old.generation))
        tracked.push(old)
      if (tracked.length > 8)
        throw new Error('Secure session cleanup is required.')
      const next = {
        generation: `${Date.now()}-${++generationCounter}`,
        count: Math.max(1, Math.ceil(points.length / 400)),
      }
      // A separate inventory lets explicit sign-out delete chunks even if the
      // current manifest is corrupted. It is written before any new chunk.
      await backend.setItem(
        `${root(key)}.inventory`,
        JSON.stringify([...tracked, next]),
      )
      try {
        for (let index = 0; index < next.count; index++)
          await backend.setItem(
            part(key, next, index),
            points.slice(index * 400, (index + 1) * 400).join(''),
          )
        await backend.setItem(root(key), JSON.stringify(next))
      } catch (error) {
        await removeParts(key, next).catch(() => undefined)
        throw error
      }
      try {
        await Promise.all(tracked.map((item) => removeParts(key, item)))
        await backend.setItem(`${root(key)}.inventory`, JSON.stringify([next]))
      } catch {
        /* Keep the inventory so explicit sign-out can retry cleanup. */
      }
    },
    async removeItem(key) {
      const tracked = await inventory(key)
      try {
        const old = manifest(await backend.getItem(root(key)))
        if (old && !tracked.some((item) => item.generation === old.generation))
          tracked.push(old)
      } catch {
        /* Deleting corrupt credentials must not require reading them. */
      }
      await backend.removeItem(root(key))
      await Promise.all(tracked.map((item) => removeParts(key, item)))
      await backend.removeItem(`${root(key)}.inventory`)
    },
  }
  return {
    getItem: (key) => ordered(() => storage.getItem(key)),
    setItem: (key, value) => ordered(() => storage.setItem(key, value)),
    removeItem: (key) => ordered(() => storage.removeItem(key)),
  }
}

export const sessionStorageKey = 'parkey-session'
export const pendingFlowKey = 'pending-email-flow'
const preferenceKey = 'remember-session'

export function createSessionStorage(secrets: SecretStorage) {
  const memory = new Map<string, string>()
  let active = true
  let remember: boolean | undefined
  async function remembered() {
    remember ??= (await secrets.getItem(preferenceKey)) === 'true'
    return remember
  }
  const proof = (key: string) => key.endsWith('-code-verifier')
  return {
    async getItem(key: string) {
      if (!active) return null
      return (
        memory.get(key) ??
        (proof(key) || (await remembered()) ? secrets.getItem(key) : null)
      )
    },
    async setItem(key: string, value: string) {
      if (!active) return
      const persist = proof(key) || (await remembered())
      if (!active) return
      if (persist) await secrets.setItem(key, value)
      if (active) memory.set(key, value)
    },
    async removeItem(key: string) {
      if (!active) return
      memory.delete(key)
      await secrets.removeItem(key)
    },
    async setRemember(value: boolean) {
      await secrets.setItem(preferenceKey, String(value))
      if (!value) await secrets.removeItem(sessionStorageKey)
      remember = value
    },
    deactivate() {
      active = false
      memory.clear()
    },
    async forget() {
      active = false
      memory.clear()
      let index: unknown = []
      try {
        index = JSON.parse(
          (await secrets.getItem(`${sessionStorageKey}-flows-code-verifier`)) ??
            '[]',
        )
      } catch {
        /* A broken flow index must not prevent local session deletion. */
      }
      const flows = Array.isArray(index)
        ? index.filter(
            (id): id is string =>
              typeof id === 'string' && /^[a-f0-9]{32}$/.test(id),
          )
        : []
      await Promise.all([
        secrets.removeItem(sessionStorageKey),
        secrets.removeItem(`${sessionStorageKey}-code-verifier`),
        secrets.removeItem(pendingFlowKey),
        secrets.removeItem(preferenceKey),
        secrets.removeItem(`${sessionStorageKey}-flows-code-verifier`),
        ...flows.map((id) =>
          secrets.removeItem(`${sessionStorageKey}-flow-${id}-code-verifier`),
        ),
      ])
    },
  }
}
