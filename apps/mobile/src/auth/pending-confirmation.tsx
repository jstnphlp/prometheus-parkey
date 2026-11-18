import { useEffect, useRef, useState } from 'react'
import type { ComponentRef } from 'react'
import { Keyboard } from 'react-native'
import type { TextInput } from 'react-native'

import { useCompletion } from '../onboarding/use-completion'
import { emailCodeLength } from './email-code'
import { EmailVerificationForm } from './email-verification-form'
import { authErrorCode } from './feedback'
import { useAuth } from './provider'
import { SignedInRedirect } from './signed-in-redirect'
import { authErrorMessage } from './validation'

export function PendingConfirmation({
  email,
  onDifferentEmail,
}: {
  email: string
  onDifferentEmail: () => void
}) {
  const auth = useAuth()
  const completion = useCompletion('/account-setup')
  const input = useRef<ComponentRef<typeof TextInput>>(null)
  const inFlight = useRef(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [verified, setVerified] = useState(false)
  const [sessionPending, setSessionPending] = useState(false)
  const [retryAt, setRetryAt] = useState(() => Date.now() + 60000)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000))
  const busy = auth.busy || completion.busy

  async function verify() {
    if (busy || inFlight.current) return
    if (!sessionPending && code.length !== emailCodeLength) {
      setError(`Enter the ${emailCodeLength}-digit code from your email.`)
      input.current?.focus()
      return
    }
    inFlight.current = true
    setError(null)
    Keyboard.dismiss()
    try {
      await auth.verifyEmailCode(email, code)
      setVerified(true)
      setCode('')
    } catch (failure) {
      setSessionPending(
        authErrorCode(failure) === 'verification_session_pending',
      )
      setExpired(authErrorCode(failure) === 'otp_expired')
      setError(authErrorMessage(failure))
    } finally {
      inFlight.current = false
    }
  }
  async function resend() {
    if (busy || sessionPending || remaining > 0 || inFlight.current) return
    inFlight.current = true
    setError(null)
    try {
      await auth.sendEmail(email, 'signup')
      setRetryAt(Date.now() + 60000)
      setNow(Date.now())
      setExpired(false)
      setCode('')
      input.current?.focus()
    } catch (failure) {
      setError(authErrorMessage(failure))
    } finally {
      inFlight.current = false
    }
  }
  if (verified && auth.state.status === 'signed-in')
    return <SignedInRedirect user={auth.state.user} />

  return (
    <EmailVerificationForm
      email={email}
      code={code}
      error={error}
      expired={expired}
      verified={verified}
      remaining={remaining}
      busy={busy}
      sessionPending={sessionPending}
      continueDisabled={auth.state.status !== 'signed-in'}
      inputRef={input}
      onCodeChange={(value) => {
        setCode(value.replace(/\D/g, '').slice(0, emailCodeLength))
        setError(null)
        setExpired(false)
      }}
      onVerify={() => void verify()}
      onResend={() => void resend()}
      onDifferentEmail={onDifferentEmail}
      onContinue={() => void completion.finish()}
    />
  )
}
