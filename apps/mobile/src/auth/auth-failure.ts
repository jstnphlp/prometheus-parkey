// Only these fixed values may reach local diagnostics. Never include raw
// messages, input values, request bodies, headers, URLs or session data.
const diagnosticCodes = new Set([
  'unexpected_failure',
  'weak_password',
  'over_email_send_rate_limit',
  'over_request_rate_limit',
  'signup_disabled',
  'email_address_not_authorized',
  'email_address_not_valid',
  'email_exists',
  'user_already_exists',
  'validation_failed',
  'captcha_failed',
  'request_timeout',
])

export function authFailure(error: unknown) {
  const record = error && typeof error === 'object' ? error : null
  const rawStatus = record && 'status' in record ? record.status : null
  const status =
    typeof rawStatus === 'number' &&
    Number.isInteger(rawStatus) &&
    rawStatus >= 100 &&
    rawStatus <= 599
      ? rawStatus
      : null
  const rawCode = record && 'code' in record ? record.code : null
  const code =
    typeof rawCode === 'string' && diagnosticCodes.has(rawCode)
      ? rawCode
      : 'unclassified'
  const name = record && 'name' in record ? record.name : null
  const message = record && 'message' in record ? record.message : null
  const category =
    status === 429 ||
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit'
      ? 'rate_limit'
      : status !== null &&
          status >= 500 &&
          message === 'Error sending confirmation email'
        ? 'email_delivery'
        : status !== null &&
            status >= 500 &&
            message === 'Database error saving new user'
          ? 'account_service'
          : status === null &&
              (name === 'AuthRetryableFetchError' ||
                name === 'AbortError' ||
                (name === 'TypeError' &&
                  (message === 'Network request failed' ||
                    message === 'Failed to fetch')))
            ? 'network'
            : status !== null
              ? 'service'
              : 'local'
  return { category, status, code }
}
