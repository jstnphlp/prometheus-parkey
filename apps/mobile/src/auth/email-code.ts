import type { SupabaseClient } from '@supabase/supabase-js'

import type { AuthSnapshot } from './session.ts'

// Must match auth.email.otp_length in Supabase. Its supported minimum is six.
export const emailCodeLength = 6

export async function confirmSignupSession(
  auth: Pick<SupabaseClient['auth'], 'verifyOtp' | 'getSession'>,
  email: string,
  token: string,
  verifySession: () => Promise<AuthSnapshot | undefined>,
  cleanup: () => Promise<void>,
) {
  const normalizedEmail = email.trim().toLowerCase()
  const cached = await auth.getSession()
  if (cached.error) throw cached.error
  const existingUser = cached.data.session?.user
  // A previous successful OTP may have been followed by a failed network check.
  // Cached claims only select the retry path; server verification still gates success.
  if (
    !existingUser?.email_confirmed_at ||
    existingUser.email?.toLowerCase() !== normalizedEmail
  )
    await verifySignupCode(auth, email, token)
  const verified = await verifySession()
  if (
    verified?.status !== 'signed-in' ||
    verified.user.email?.toLowerCase() !== normalizedEmail
  )
    throw Object.assign(
      new Error('Reconnect to finish checking your verified session.'),
      { code: 'verification_session_pending' },
    )
  try {
    await cleanup()
  } catch {
    // Removing spent signup context is housekeeping, not a second verification gate.
  }
}

export async function verifySignupCode(
  auth: Pick<SupabaseClient['auth'], 'verifyOtp'>,
  email: string,
  token: string,
) {
  if (!new RegExp(`^\\d{${emailCodeLength}}$`).test(token))
    throw Object.assign(new Error('Enter the code from your email.'), {
      code: 'invalid_otp',
    })
  const normalizedEmail = email.trim().toLowerCase()
  const { data, error } = await auth.verifyOtp({
    email: normalizedEmail,
    token,
    type: 'signup',
  })
  if (error) throw error
  if (
    !data.session ||
    !data.user?.email_confirmed_at ||
    data.user.email?.toLowerCase() !== normalizedEmail
  )
    throw new Error('Email verification could not be confirmed.')
}
