import { useEffect, useRef, useState } from 'react'

import logo from '../../../mobile/assets/figma/onboarding/account-logo@3x.png'

import { confirmationToken, confirmEmail } from './email-confirmation'
import type { ConfirmationResult } from './email-confirmation'

const config = {
  url: import.meta.env.VITE_SUPABASE_URL ?? '',
  key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
}
const messages = {
  checking: {
    title: 'Confirming your email…',
    body: 'This will only take a moment.',
    symbol: '…',
  },
  confirmed: {
    title: 'Email confirmed.',
    body: 'You’re ready. Return to Parkey on any device and log in.',
    symbol: '✓',
  },
  expired: {
    title: 'This link has expired.',
    body: 'It may already have been used. Try logging in, or request a new confirmation email from Parkey.',
    symbol: '!',
  },
  invalid: {
    title: 'We couldn’t verify this link.',
    body: 'Open the full link from your latest Parkey email. Already confirmed? Log in from the app.',
    symbol: '!',
  },
  network: {
    title: 'Couldn’t connect.',
    body: 'Check your connection and try again. If you already confirmed, return to Parkey and log in.',
    symbol: '!',
  },
  unavailable: {
    title: 'Confirmation is unavailable.',
    body: 'Please try again later. Your account hasn’t been signed in on this browser.',
    symbol: '!',
  },
} as const

export function EmailConfirmation() {
  const [status, setStatus] = useState<ConfirmationResult | 'checking'>(
    'checking',
  )
  const token = useRef<string | null>(null)
  const initial = useRef<Promise<ConfirmationResult> | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    let active = true
    if (!initial.current) {
      token.current = confirmationToken(window.location.hash)
      // The token stays in the fragment until this point: it is never part of
      // the page request, server log or Referer. Remove it before verifying.
      window.history.replaceState(null, '', window.location.pathname)
      initial.current = token.current
        ? confirmEmail(token.current, config)
        : Promise.resolve('invalid')
    }
    void initial.current.then((result) => {
      if (result !== 'network' && result !== 'unavailable') token.current = null
      if (active) setStatus(result)
    })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    if (status !== 'checking') heading.current?.focus()
  }, [status])

  async function retry() {
    if (!token.current || status === 'checking') return
    setStatus('checking')
    const result = await confirmEmail(token.current, config)
    if (result !== 'network' && result !== 'unavailable') token.current = null
    setStatus(result)
  }
  const message = messages[status]
  return (
    <main id="main" className="confirmation-page">
      <section
        className="confirmation-card"
        aria-busy={status === 'checking'}
        aria-labelledby="confirmation-title"
      >
        <header className="confirmation-brand">
          <img src={logo} width="42" height="46" alt="" />
          <span>
            Parkey<span className="confirmation-accent">.</span>
          </span>
        </header>
        <div className="confirmation-content">
          <span
            className={`confirmation-symbol ${status === 'confirmed' ? 'confirmation-success' : ''}`}
            aria-hidden="true"
          >
            {message.symbol}
          </span>
          <h1 id="confirmation-title" ref={heading} tabIndex={-1}>
            {message.title}
          </h1>
          <p>{message.body}</p>
          {status === 'confirmed' ? (
            <a className="confirmation-button" href="parkey://login">
              Open Parkey
            </a>
          ) : null}
          {status === 'network' || status === 'unavailable' ? (
            <button
              className="confirmation-button"
              onClick={() => void retry()}
            >
              Try again
            </button>
          ) : null}
          {status === 'confirmed' ? (
            <p className="confirmation-small">
              Using another device? Open Parkey there and log in. This browser
              stays signed out.
            </p>
          ) : null}
        </div>
      </section>
      <p className="confirmation-footer">Designed Around the Driver</p>
    </main>
  )
}
