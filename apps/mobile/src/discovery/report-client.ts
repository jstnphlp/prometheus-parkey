import type {
  ParkingContribution,
  ParkingReportReceipt,
} from '@parkey/shared-types'

import { isObject } from './model.ts'
import { publicSupabaseProblem } from './pilot-config.ts'

export const reportDisclosure = '2026-11-10-email-text-v1'
export type ReportConnection = { url: string; key: string }
export type ReportSession = { token: string; userId: string; expiresAt: number }
export class ReportAuthenticationError extends Error {}
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function isReportReceipt(value: unknown): value is ParkingReportReceipt {
  return (
    isObject(value) &&
    (value.state === 'received' || value.state === 'withdrawn') &&
    typeof value.receiptId === 'string' &&
    uuid.test(value.receiptId) &&
    typeof value.receivedAt === 'string' &&
    Number.isFinite(Date.parse(value.receivedAt))
  )
}
function connectionIssue(connection: ReportConnection) {
  const issue = publicSupabaseProblem(connection.url, connection.key, true)
  if (issue)
    throw new Error(
      'Report sending is not configured. Your draft stays on this device.',
    )
}
function emailAddress(email: string) {
  const value = email.trim().toLowerCase()
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    throw new Error('Enter a valid email address.')
  return value
}
async function post(
  connection: ReportConnection,
  path: string,
  body: unknown,
  signal: AbortSignal,
  token?: string,
  requestFetch: typeof fetch = fetch,
) {
  connectionIssue(connection)
  if (signal.aborted) throw new Error('Request canceled.')
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, path.startsWith('/auth/') ? 15000 : 45000)
  try {
    const response = await requestFetch(
      `${connection.url.replace(/\/$/, '')}${path}`,
      {
        method: 'POST',
        headers: {
          apikey: connection.key,
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        credentials: 'omit',
        redirect: 'error',
      },
    )
    if (!response.ok) {
      if (response.status === 429)
        throw new Error('Sending limit reached. Wait before trying again.')
      if (path.startsWith('/auth/'))
        throw new Error(
          'Email verification failed. Check the address or code and try again.',
        )
      if (response.status === 401 || response.status === 403)
        throw new ReportAuthenticationError(
          'Verify your email again before sending.',
        )
      if (response.status === 409)
        throw new Error(
          'This report may already have been sent with different details. Check sent status.',
        )
      if (response.status === 422)
        throw new Error(
          'Check the name, correction and observation date (last 90 days).',
        )
      throw new Error(
        'The service could not confirm delivery. Keep your draft and check sent status before retrying.',
      )
    }
    const text = await response.text()
    if (text.length > 32768)
      throw new Error('The service returned an unsupported response.')
    try {
      return text ? (JSON.parse(text) as unknown) : null
    } catch {
      throw new Error('The service returned an unsupported response.')
    }
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}
export async function requestReportCode(
  connection: ReportConnection,
  email: string,
  signal: AbortSignal,
  requestFetch: typeof fetch = fetch,
) {
  await post(
    connection,
    '/auth/v1/otp',
    { email: emailAddress(email), create_user: true },
    signal,
    undefined,
    requestFetch,
  )
}
export async function verifyReportCode(
  connection: ReportConnection,
  email: string,
  code: string,
  signal: AbortSignal,
  requestFetch: typeof fetch = fetch,
): Promise<ReportSession> {
  if (!/^\d{6,8}$/.test(code.trim()))
    throw new Error('Enter the verification code from your email.')
  const value = await post(
    connection,
    '/auth/v1/verify',
    { email: emailAddress(email), token: code.trim(), type: 'email' },
    signal,
    undefined,
    requestFetch,
  )
  if (
    !isObject(value) ||
    typeof value.access_token !== 'string' ||
    !/^[A-Za-z0-9_.-]{20,8192}$/.test(value.access_token) ||
    typeof value.expires_in !== 'number' ||
    !Number.isFinite(value.expires_in) ||
    value.expires_in <= 0 ||
    !isObject(value.user) ||
    typeof value.user.id !== 'string' ||
    !uuid.test(value.user.id) ||
    typeof value.user.email_confirmed_at !== 'string' ||
    !Number.isFinite(Date.parse(value.user.email_confirmed_at)) ||
    value.user.is_anonymous === true
  )
    throw new Error('Email verification could not be confirmed.')
  return {
    token: value.access_token,
    userId: value.user.id,
    expiresAt: Date.now() + Math.min(value.expires_in, 600) * 1000,
  }
}
export function reportObservationDate(value: string, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error('Enter the observed date as YYYY-MM-DD.')
  const date = new Date(`${value}T00:00:00`)
  const parts = value.split('-').map(Number)
  if (
    !Number.isFinite(date.getTime()) ||
    date.getFullYear() !== parts[0] ||
    date.getMonth() + 1 !== parts[1] ||
    date.getDate() !== parts[2] ||
    date.getTime() > now ||
    date.getTime() < now - 90 * 86400000
  )
    throw new Error('Use the actual observed date within the last 90 days.')
  return date.toISOString()
}
export function reportForSending(
  draft: ParkingContribution,
  name: string,
  observationDate: string,
) {
  const cleanName = name.trim()
  if (cleanName.length < 3 || cleanName.length > 100)
    throw new Error(
      'Enter a parking name or description between 3 and 100 characters.',
    )
  const optional = (value: string) => value.trim() || null
  return {
    intent: draft.intent,
    target: draft.targetId,
    name: cleanName,
    kind: draft.kind,
    geometry: draft.geometry,
    side: draft.side,
    restrictions: optional(draft.restrictions),
    hours: optional(draft.hours),
    fees: optional(draft.fees),
    observed_at: reportObservationDate(observationDate),
  }
}
export async function sendReportRequest(
  connection: ReportConnection,
  session: ReportSession,
  draft: ParkingContribution,
  action: 'submit' | 'status' | 'withdraw',
  signal: AbortSignal,
  fields?: { name: string; observationDate: string; consent: boolean },
  requestFetch: typeof fetch = fetch,
): Promise<ParkingReportReceipt | { state: 'not_sent' }> {
  if (session.expiresAt <= Date.now())
    throw new ReportAuthenticationError(
      'Verification expired. Verify your email again.',
    )
  if (action === 'submit' && !fields?.consent)
    throw new Error(
      'Confirm that you want to send this report for private review.',
    )
  const value = await post(
    connection,
    '/functions/v1/mobile-reports',
    {
      schema_version: 1,
      action,
      client_key: draft.id,
      ...(action === 'submit' && fields
        ? {
            disclosure_version: reportDisclosure,
            report: reportForSending(
              draft,
              fields.name,
              fields.observationDate,
            ),
          }
        : {}),
    },
    signal,
    session.token,
    requestFetch,
  )
  if (isReportReceipt(value))
    return {
      state: value.state,
      receiptId: value.receiptId,
      receivedAt: value.receivedAt,
    }
  if (isObject(value) && value.state === 'not_sent' && action === 'status')
    return { state: 'not_sent' }
  throw new Error(
    'Delivery could not be confirmed. Check sent status before retrying.',
  )
}
