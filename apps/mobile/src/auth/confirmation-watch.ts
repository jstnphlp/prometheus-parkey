type WatchOptions = {
  check: () => Promise<boolean>
  checking: () => void
  waiting: () => void
  confirmed: () => void
  failed: (error: unknown) => void
  expired: () => void
  now?: () => number
  setTimer?: (work: () => void, delay: number) => ReturnType<typeof setTimeout>
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void
}

// A bounded, single-request watcher. Expected unconfirmed-email responses are
// handled by the caller, not shown as repeated errors or logged as failures.
export function watchConfirmation(options: WatchOptions) {
  const now = options.now ?? Date.now
  const setTimer = options.setTimer ?? setTimeout
  const clearTimer = options.clearTimer ?? clearTimeout
  const deadline = now() + 10 * 60 * 1000
  const delays = [5000, 10000, 20000, 30000, 60000]
  let attempt = 0
  let stopped = false
  let inFlight = false
  let timer: ReturnType<typeof setTimeout> | null = null
  function stop() {
    stopped = true
    if (timer !== null) clearTimer(timer)
    timer = null
  }
  function schedule() {
    if (stopped) return
    timer = setTimer(
      () => {
        timer = null
        void checkNow()
      },
      Math.min(
        delays[Math.min(attempt++, delays.length - 1)] ?? 60000,
        Math.max(0, deadline - now()),
      ),
    )
  }
  async function checkNow() {
    if (stopped || inFlight) return
    if (timer !== null) clearTimer(timer)
    timer = null
    if (now() >= deadline) {
      stop()
      options.expired()
      return
    }
    inFlight = true
    options.checking()
    try {
      const confirmed = await options.check()
      if (stopped) return
      if (confirmed) {
        stop()
        options.confirmed()
      } else {
        options.waiting()
        schedule()
      }
    } catch (error) {
      if (!stopped) {
        stop()
        options.failed(error)
      }
    } finally {
      inFlight = false
    }
  }
  schedule()
  return { stop, checkNow }
}
