type Subscriber<T> = {
  signal: AbortSignal
  resolve: (value: T) => void
  reject: (reason: unknown) => void
  abort: () => void
}
type Entry<T> = {
  controller: AbortController
  subscribers: Set<Subscriber<T>>
  settled: boolean
}

function canceled(signal: AbortSignal) {
  if (signal.reason !== undefined) return signal.reason
  const error = new Error('The request was canceled.')
  error.name = 'AbortError'
  return error
}

/** Ephemeral parsed-value coalescing. Each subscriber owns its cancellation. */
export function createPublicRequestPool<T>() {
  const pending = new Map<string, Entry<T>>()
  function remove(key: string, entry: Entry<T>) {
    if (pending.get(key) === entry) pending.delete(key)
  }
  function finish(
    key: string,
    entry: Entry<T>,
    outcome: { value: T } | { error: unknown },
  ) {
    if (entry.settled) return
    entry.settled = true
    remove(key, entry)
    for (const subscriber of entry.subscribers) {
      subscriber.signal.removeEventListener('abort', subscriber.abort)
      if ('value' in outcome) subscriber.resolve(outcome.value)
      else subscriber.reject(outcome.error)
    }
    entry.subscribers.clear()
  }
  return {
    run(
      key: string,
      signal: AbortSignal,
      load: (sharedSignal: AbortSignal) => Promise<T>,
    ): Promise<T> {
      if (signal.aborted) return Promise.reject(canceled(signal))
      let entry = pending.get(key)
      const created = !entry
      if (!entry) {
        entry = {
          controller: new AbortController(),
          subscribers: new Set(),
          settled: false,
        }
        pending.set(key, entry)
      }
      const shared = entry
      return new Promise<T>((resolve, reject) => {
        const subscriber: Subscriber<T> = {
          signal,
          resolve,
          reject,
          abort: () => {
            if (!shared.subscribers.delete(subscriber)) return
            signal.removeEventListener('abort', subscriber.abort)
            reject(canceled(signal))
            if (!shared.settled && shared.subscribers.size === 0) {
              shared.settled = true
              remove(key, shared)
              shared.controller.abort()
            }
          },
        }
        shared.subscribers.add(subscriber)
        signal.addEventListener('abort', subscriber.abort, { once: true })
        if (signal.aborted) subscriber.abort()
        if (created && !shared.settled) {
          try {
            void load(shared.controller.signal).then(
              (value) => finish(key, shared, { value }),
              (error: unknown) => finish(key, shared, { error }),
            )
          } catch (error) {
            finish(key, shared, { error })
          }
        }
      })
    },
  }
}
