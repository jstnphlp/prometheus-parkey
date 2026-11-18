export async function boundedAuthFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  requestFetch: typeof fetch = fetch,
  timeoutMs = 15000,
) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  init?.signal?.addEventListener('abort', abort, { once: true })
  if (init?.signal?.aborted) abort()
  const timer = setTimeout(abort, timeoutMs)
  try {
    return await requestFetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
    init?.signal?.removeEventListener('abort', abort)
  }
}
