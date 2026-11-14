import type { PopupRequest } from '../components/popup-provider'

import { authErrorMessage } from './validation.ts'

export function authErrorCode(error: unknown): string | null {
  return error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : null
}
export function authFeedback(
  error: unknown,
  title = 'Could not continue',
): PopupRequest {
  const code = authErrorCode(error)
  const configuration =
    code === 'email_address_not_authorized' ||
    code === 'email_address_not_valid'
  return {
    tone: configuration ? 'warning' : 'error',
    title: configuration ? 'Email unavailable' : title,
    message: authErrorMessage(error),
    group: 'auth-system',
  }
}
