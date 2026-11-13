import { autocomplete, attribution, parseQuery } from './provider.ts'

export function createHandler(
  env: Record<string, string | undefined>,
  requestFetch: typeof fetch = fetch,
) {
  return async (request: Request): Promise<Response> => {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
    })
    const reply = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers })
    const origin = request.headers.get('origin')
    if (origin) {
      if (
        !(env.PLACE_SEARCH_WEB_ORIGINS || '')
          .split(',')
          .map((v) => v.trim())
          .includes(origin)
      )
        return reply(403, { error: 'Origin denied' })
      headers.set('Access-Control-Allow-Origin', origin)
      headers.set(
        'Access-Control-Allow-Headers',
        'apikey, content-type, authorization, x-client-info',
      )
      headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
      headers.set('Access-Control-Expose-Headers', 'Retry-After')
    }
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return reply(405, { error: 'POST required' })
    const token = env.LOCATIONIQ_API_TOKEN,
      backend = env.SUPABASE_URL,
      serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
    if (!token || !backend || !serviceKey || !env.PLACE_SEARCH_PUBLIC_KEY)
      return reply(503, { error: 'Search unavailable' })
    if (request.headers.get('apikey') !== env.PLACE_SEARCH_PUBLIC_KEY)
      return reply(401, { error: 'Public project key required' })
    let query: string
    try {
      if (
        request.headers.get('content-type')?.split(';')[0]?.trim() !==
        'application/json'
      )
        throw new TypeError()
      // Bounded streaming input: never buffer arbitrary client bodies or log queries.
      const reader = request.body?.getReader()
      if (!reader) throw new TypeError()
      const timeout = AbortSignal.timeout(3000)
      const deadline = new Promise<never>((_, reject) =>
        timeout.addEventListener('abort', () => reject(new Error('Timeout')), {
          once: true,
        }),
      )
      let body = '',
        bytes = 0
      const decoder = new TextDecoder('utf-8', { fatal: true })
      try {
        while (true) {
          const { done, value } = await Promise.race([reader.read(), deadline])
          if (done) break
          bytes += value.byteLength
          if (bytes > 2048) throw new TypeError()
          body += decoder.decode(value, { stream: true })
        }
        body += decoder.decode()
      } finally {
        void reader.cancel().catch(() => undefined)
      }
      query = parseQuery(JSON.parse(body))
    } catch {
      return reply(400, { error: 'Enter 3 to 180 characters' })
    }
    try {
      // Atomic global quotas across isolates protect the private provider token.
      // This RPC stores counters only, never queries, locations, IPs or identities.
      const quota = await requestFetch(
        `${backend}/rest/v1/rpc/consume_place_search`,
        {
          method: 'POST',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: '{}',
          signal: AbortSignal.timeout(5000),
        },
      )
      if (!quota.ok) return reply(503, { error: 'Search unavailable' })
      const retry: unknown = await quota.json()
      if (
        typeof retry !== 'number' ||
        !Number.isInteger(retry) ||
        retry < 0 ||
        retry > 86400
      )
        return reply(503, { error: 'Search unavailable' })
      if (retry > 0) {
        headers.set('Retry-After', String(retry))
        return reply(429, { error: 'Search limit reached' })
      }
      const abort = new AbortController()
      const cancel = () => abort.abort()
      request.signal.addEventListener('abort', cancel, { once: true })
      const timer = setTimeout(cancel, 8000)
      try {
        if (request.signal.aborted) cancel()
        const result = await autocomplete(
          token,
          query,
          abort.signal,
          requestFetch,
        )
        if (result.status === 429) {
          headers.set('Retry-After', '60')
          return reply(429, { error: 'Search limit reached' })
        }
        return reply(200, { results: result.results, attribution })
      } finally {
        clearTimeout(timer)
        request.signal.removeEventListener('abort', cancel)
      }
    } catch {
      return reply(503, { error: 'Search unavailable' })
    }
  }
}
