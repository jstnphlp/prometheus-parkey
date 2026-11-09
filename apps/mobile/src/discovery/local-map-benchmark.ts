type LocalMapBenchmarkOptions = {
  environment?: string | undefined
  requested?: string | undefined
  releaseBuild?: string | undefined
  now?: () => number
  write?: (message: string) => void
}

/** Local development measurement only: no network, identifiers or persistence. */
export function createLocalMapBenchmark({
  environment = process.env.NODE_ENV,
  requested = process.env.EXPO_PUBLIC_LOCAL_MAP_BENCHMARK,
  releaseBuild = process.env.PARKEY_RELEASE_BUILD,
  now = () => globalThis.performance.now(),
  write = (message) => globalThis.console.info(message),
}: LocalMapBenchmarkOptions = {}): () => void {
  if (
    environment !== 'development' ||
    requested !== 'true' ||
    releaseBuild === 'true'
  )
    return () => undefined

  let started: number
  try {
    started = now()
  } catch {
    return () => undefined
  }
  if (!Number.isFinite(started) || started < 0) return () => undefined
  let reported = false
  return () => {
    if (reported) return
    let elapsed: number
    try {
      elapsed = now() - started
    } catch {
      return
    }
    if (!Number.isFinite(elapsed) || elapsed < 0) return
    reported = true
    try {
      write(`PARKEY_LOCAL_MAP_READY ${Math.round(elapsed)}`)
    } catch {
      // Optional local diagnostics must not interrupt map rendering.
    }
  }
}
