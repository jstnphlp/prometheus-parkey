export type PhotoLoadStatus = 'loading' | 'ready' | 'error'

type Timeout = ReturnType<typeof setTimeout>
type PhotoLoadOptions = {
  timeoutMs?: number
  schedule?: (callback: () => void, delay: number) => Timeout
  cancel?: (timeout: Timeout) => void
}

/** One mounted image attempt. Disposed/late events cannot update another image. */
export function createPhotoLoadSession(
  onStatus: (status: PhotoLoadStatus) => void,
  {
    timeoutMs = 8000,
    schedule = (callback, delay) => setTimeout(callback, delay),
    cancel = (timeout) => clearTimeout(timeout),
  }: PhotoLoadOptions = {},
) {
  let active = true
  let settled = false
  let timeout: Timeout | undefined
  function clear() {
    if (timeout !== undefined) cancel(timeout)
    timeout = undefined
  }
  function finish(status: 'ready' | 'error') {
    if (!active || settled) return
    settled = true
    clear()
    onStatus(status)
  }
  timeout = schedule(
    () => finish('error'),
    Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000,
  )
  return {
    loaded: () => finish('ready'),
    failed: () => finish('error'),
    dispose() {
      active = false
      clear()
    },
  }
}
