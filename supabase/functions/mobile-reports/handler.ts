import { isReportId, readReportBody, reportRequest } from './validation.ts'

export function createHandler(
  env: Record<string, string | undefined>,
  requestFetch: typeof fetch = fetch,
  now = Date.now,
) {
  return async (request: Request): Promise<Response> => {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
    })
    const reply = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers })
    const url = env.SUPABASE_URL,
      key = env.SUPABASE_SERVICE_ROLE_KEY
    if (
      env.MOBILE_REPORTS_ENABLED !== 'true' ||
      env.MOBILE_REPORTS_PRIVACY_APPROVED !== 'true' ||
      !url ||
      !key
    )
      return reply(503, {
        error:
          'Report sending is unavailable. Your draft remains on this device.',
      })
    const origin = request.headers.get('origin')
    if (origin) {
      if (origin !== env.MOBILE_REPORTS_WEB_ORIGIN)
        return reply(403, { error: 'Origin denied' })
      headers.set('Access-Control-Allow-Origin', origin)
      headers.set(
        'Access-Control-Allow-Headers',
        'authorization, apikey, content-type',
      )
      headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    }
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return reply(405, { error: 'POST required' })
    const authorization = request.headers.get('authorization') ?? ''
    if (!/^Bearer [A-Za-z0-9_.-]{20,8192}$/.test(authorization))
      return reply(401, { error: 'Verify your email before sending.' })
    try {
      const auth = await requestFetch(`${url}/auth/v1/user`, {
        headers: { apikey: key, Authorization: authorization },
        signal: AbortSignal.timeout(10000),
      })
      if (!auth.ok)
        return reply(auth.status >= 500 ? 503 : 401, {
          error: 'Verification expired. Verify your email again.',
        })
      const user: unknown = await auth.json()
      if (
        !user ||
        typeof user !== 'object' ||
        !('id' in user) ||
        !isReportId(user.id) ||
        !('email' in user) ||
        typeof user.email !== 'string' ||
        !user.email.trim() ||
        !('email_confirmed_at' in user) ||
        typeof user.email_confirmed_at !== 'string' ||
        !Number.isFinite(Date.parse(user.email_confirmed_at)) ||
        Date.parse(user.email_confirmed_at) > now() ||
        ('is_anonymous' in user && user.is_anonymous === true)
      )
        return reply(403, { error: 'A verified email account is required.' })
      const quota = await requestFetch(
        `${url}/rest/v1/rpc/consume_mobile_report_attempt`,
        {
          method: 'POST',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ actor: user.id }),
          signal: AbortSignal.timeout(10000),
        },
      )
      if (!quota.ok) {
        if (quota.status === 429) {
          headers.set('Retry-After', '60')
          return reply(429, {
            error: 'Request limit reached. Try again later.',
          })
        }
        return reply(503, {
          error: 'Report sending is temporarily unavailable.',
        })
      }
      let body: ReturnType<typeof reportRequest>
      try {
        body = reportRequest(await readReportBody(request), now())
      } catch (error) {
        return reply(error instanceof RangeError ? 413 : 422, {
          error:
            'Check the report fields and observation date. Photos are not sent.',
        })
      }
      const response = await requestFetch(
        `${url}/rest/v1/rpc/mobile_report_action`,
        {
          method: 'POST',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ actor: user.id, ...body }),
          signal: AbortSignal.timeout(12000),
        },
      )
      if (!response.ok) {
        if (response.status === 429) {
          headers.set('Retry-After', '3600')
          return reply(429, {
            error: 'Sending limit reached. Keep the draft and try later.',
          })
        }
        const status = [403, 404, 409, 422].includes(response.status)
          ? response.status
          : 503
        return reply(status, {
          error:
            status === 409
              ? 'This report was already sent with different details or was withdrawn. Check its sent status.'
              : 'Report unavailable. Your local draft is retained.',
        })
      }
      const receipt: unknown = await response.json()
      if (
        !receipt ||
        typeof receipt !== 'object' ||
        !('state' in receipt) ||
        !['not_sent', 'received', 'withdrawn'].includes(String(receipt.state))
      )
        return reply(503, {
          error:
            'Delivery could not be confirmed. Check sent status before retrying.',
        })
      // Never forward a database response wholesale to a public client.
      if (receipt.state === 'not_sent') return reply(200, { state: 'not_sent' })
      if (
        !('receiptId' in receipt) ||
        !isReportId(receipt.receiptId) ||
        !('receivedAt' in receipt) ||
        typeof receipt.receivedAt !== 'string' ||
        !Number.isFinite(Date.parse(receipt.receivedAt))
      )
        return reply(503, {
          error:
            'Delivery could not be confirmed. Check sent status before retrying.',
        })
      return reply(body.operation === 'submit' ? 202 : 200, {
        state: receipt.state,
        receiptId: receipt.receiptId,
        receivedAt: receipt.receivedAt,
      })
    } catch {
      return reply(503, {
        error:
          'Delivery could not be confirmed. Keep the draft and check sent status before retrying.',
      })
    }
  }
}
