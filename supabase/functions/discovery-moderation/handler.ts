import { readBody, reviewRequest } from './validation.ts'

export function createHandler(
  env: Record<string, string | undefined>,
  requestFetch: typeof fetch = fetch,
) {
  return async (request: Request): Promise<Response> => {
    const origin = env.MODERATION_ORIGIN
    const url = env.SUPABASE_URL
    const key = env.SUPABASE_SERVICE_ROLE_KEY
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
    })
    const reply = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers })
    if (!origin || !url || !key)
      return reply(503, { error: 'Moderation unavailable' })
    if (request.headers.get('origin') !== origin)
      return reply(403, { error: 'Origin denied' })
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set(
      'Access-Control-Allow-Headers',
      'authorization, content-type, apikey',
    )
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return reply(405, { error: 'POST required' })
    const authorization = request.headers.get('authorization') ?? ''
    if (!/^Bearer [^\s]+$/.test(authorization))
      return reply(401, { error: 'Sign in required' })
    try {
      // Auth validates the signature, expiry and user before any JWT claim is read.
      const auth = await requestFetch(`${url}/auth/v1/user`, {
        headers: { apikey: key, Authorization: authorization },
        signal: AbortSignal.timeout(10000),
      })
      if (!auth.ok)
        return reply(401, { error: 'Session expired. Sign in again.' })
      const user: unknown = await auth.json()
      if (
        !user ||
        typeof user !== 'object' ||
        !('id' in user) ||
        typeof user.id !== 'string'
      )
        return reply(401, { error: 'Invalid session' })
      const payload = authorization.split('.')[1]
      if (!payload) return reply(401, { error: 'Invalid session' })
      const claims: unknown = JSON.parse(
        atob(payload.replaceAll('-', '+').replaceAll('_', '/')),
      )
      if (
        !claims ||
        typeof claims !== 'object' ||
        !('aal' in claims) ||
        claims.aal !== 'aal2'
      )
        return reply(403, { error: 'Multi-factor authentication required' })
      let body: ReturnType<typeof reviewRequest>
      try {
        body = reviewRequest(await readBody(request))
      } catch (error) {
        if (error instanceof RangeError)
          return reply(413, { error: 'Request too large' })
        return reply(422, { error: 'Invalid review request' })
      }
      const response = await requestFetch(
        `${url}/rest/v1/rpc/moderate_discovery`,
        {
          method: 'POST',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reviewer: user.id, ...body }),
          signal: AbortSignal.timeout(10000),
        },
      )
      if (!response.ok) {
        if (response.status === 403)
          return reply(403, { error: 'Reviewer access required' })
        if (response.status >= 500 || response.status === 429)
          return reply(503, { error: 'Moderation temporarily unavailable' })
        return reply(409, {
          error:
            'Action unavailable. Refresh the queue and check the report and provenance.',
        })
      }
      return reply(200, await response.json())
    } catch {
      return reply(503, { error: 'Moderation temporarily unavailable' })
    }
  }
}
