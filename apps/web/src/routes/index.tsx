import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'

import {
  accessToken,
  auth,
  configured,
  moderate,
  object,
  parseQueue,
} from '../moderation/api'
import type { Queue, Report } from '../moderation/api'

export const Route = createFileRoute('/')({ component: Workspace })

function Workspace() {
  const [token, setToken] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [factor, setFactor] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [queue, setQueue] = useState<Queue | null>(null)
  const [queueStatus, setQueueStatus] = useState<'pending_review' | 'accepted'>(
    'pending_review',
  )
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function run(work: () => Promise<void>) {
    setBusy(true)
    setMessage('')
    try {
      await work()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Service unavailable.',
      )
    } finally {
      setBusy(false)
    }
  }
  async function refresh(
    session: string,
    status = queueStatus,
    currentPage = page,
  ) {
    setQueue(
      parseQueue(
        await moderate(session, {
          operation: 'list',
          queue_status: status,
          page: currentPage,
        }),
      ),
    )
    setQueueStatus(status)
    setPage(currentPage)
  }
  async function signIn() {
    const session = accessToken(
      await auth('token?grant_type=password', '', { email, password }),
    )
    setPassword('')
    setToken(session)
    const response = await auth('user', session)
    if (
      !object(response) ||
      (response.factors !== undefined && !Array.isArray(response.factors))
    )
      throw new Error('Could not load MFA factors.')
    const factors: unknown[] = Array.isArray(response.factors)
      ? response.factors
      : []
    const verified = factors.find(
      (item: unknown) =>
        object(item) &&
        item.factor_type === 'totp' &&
        item.status === 'verified',
    )
    if (object(verified) && typeof verified.id === 'string') {
      setFactor(verified.id)
    } else {
      const enrollment = await auth('factors', session, {
        factor_type: 'totp',
        friendly_name: 'Parkey reviewer',
      })
      if (
        !object(enrollment) ||
        typeof enrollment.id !== 'string' ||
        !object(enrollment.totp) ||
        typeof enrollment.totp.secret !== 'string'
      )
        throw new Error('Could not enroll an authenticator.')
      setFactor(enrollment.id)
      setSecret(enrollment.totp.secret)
    }
  }
  async function verify() {
    const challenge = await auth(
      `factors/${encodeURIComponent(factor)}/challenge`,
      token,
      {},
    )
    if (!object(challenge) || typeof challenge.id !== 'string')
      throw new Error('Could not start verification.')
    const session = accessToken(
      await auth(`factors/${encodeURIComponent(factor)}/verify`, token, {
        challenge_id: challenge.id,
        code,
      }),
    )
    setCode('')
    setSecret('')
    setToken(session)
    await refresh(session)
  }
  function clear() {
    setToken('')
    setFactor('')
    setSecret('')
    setCode('')
    setPassword('')
    setQueue(null)
  }
  return (
    <main id="main" className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Discovery moderation</h1>
        <Link to="/about" className="underline">
          About
        </Link>
      </header>
      <p>
        Review community parking information. Acceptance does not publish or
        verify a location.
      </p>
      {!configured ? (
        <p role="status">
          The review service is not configured. Contact the workspace
          administrator.
        </p>
      ) : null}
      {configured && !token ? (
        <form
          className="max-w-md space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void run(signIn)
          }}
        >
          <label className="block">
            Email
            <input
              className="block w-full rounded border p-3"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="block">
            Password
            <input
              className="block w-full rounded border p-3"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="rounded border px-4 py-3" disabled={busy}>
            Sign in
          </button>
        </form>
      ) : null}
      {token && !queue ? (
        <form
          className="max-w-md space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void run(verify)
          }}
        >
          <h2 className="text-xl font-semibold">Authenticator verification</h2>
          {secret ? (
            <p>
              Add this setup key to your authenticator:{' '}
              <code className="break-all">{secret}</code>
            </p>
          ) : null}
          <label className="block">
            Six-digit code
            <input
              className="block w-full rounded border p-3"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <button
            className="rounded border px-4 py-3"
            disabled={busy || !factor}
          >
            Verify and open queue
          </button>
        </form>
      ) : null}
      {token ? (
        <button
          className="rounded border px-4 py-3"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const previous = token
              clear()
              await auth('logout', previous, {})
            })
          }
        >
          Sign out
        </button>
      ) : null}
      {queue ? (
        <>
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded border p-3"
              disabled={busy}
              onClick={() =>
                void run(() => refresh(token, 'pending_review', 0))
              }
            >
              Pending reports
            </button>
            <button
              className="rounded border p-3"
              disabled={busy}
              onClick={() => void run(() => refresh(token, 'accepted', 0))}
            >
              Accepted reports
            </button>
            <button
              className="rounded border p-3"
              disabled={busy || page === 0}
              onClick={() =>
                void run(() => refresh(token, queueStatus, page - 1))
              }
            >
              Previous page
            </button>
            <button
              className="rounded border p-3"
              disabled={busy || !queue.hasMore}
              onClick={() =>
                void run(() => refresh(token, queueStatus, page + 1))
              }
            >
              Next page
            </button>
          </div>
          <p>
            {queueStatus === 'pending_review' ? 'Pending' : 'Accepted'} reports,
            page {page + 1}
          </p>
          <button
            className="rounded border px-4 py-3"
            disabled={busy}
            onClick={() => void run(() => refresh(token))}
          >
            Refresh queue
          </button>
          <p role="status">
            {queue.reports.length
              ? `${queue.reports.length} reports shown (up to 100).`
              : 'No reports awaiting review or publication.'}
          </p>
          {queue.reports.map((report) => (
            <ReviewCard
              key={report.id}
              report={report}
              canPublish={queue.canPublish}
              busy={busy}
              act={(body) =>
                void run(async () => {
                  await moderate(token, body)
                  await refresh(token)
                  setMessage('Review action saved.')
                })
              }
            />
          ))}
        </>
      ) : null}
      {message ? <p role="alert">{message}</p> : null}
    </main>
  )
}

function ReviewCard({
  report,
  canPublish,
  busy,
  act,
}: {
  report: Report
  canPublish: boolean
  busy: boolean
  act: (body: unknown) => void
}) {
  const [reason, setReason] = useState('')
  const [url, setUrl] = useState('')
  const [license, setLicense] = useState('')
  const [attribution, setAttribution] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  return (
    <article className="space-y-4 rounded-xl border p-5">
      <h2 className="text-xl font-semibold">{report.name}</h2>
      <p>
        {report.kind} / {report.intent} / {report.status}
      </p>
      <dl className="grid gap-2 sm:grid-cols-2">
        <div>
          <dt>Correction target</dt>
          <dd>
            {report.target_id ?? report.external_target_url ?? 'New location'}
          </dd>
          <dt>Street side</dt>
          <dd>{report.side ?? 'Unknown'}</dd>
          <dt>Fees</dt>
          <dd>{report.fees ?? 'Unknown'}</dd>
        </div>
        <div>
          <dt>Hours</dt>
          <dd>{report.hours ?? 'Unknown'}</dd>
        </div>
        <div>
          <dt>Restrictions or correction</dt>
          <dd>{report.restrictions ?? 'Not provided'}</dd>
        </div>
        <div>
          <dt>Observed</dt>
          <dd>{report.observed_at ?? 'Not recorded - cannot publish'}</dd>
        </div>
      </dl>
      <details>
        <summary>Submitted location</summary>
        <pre className="overflow-auto">
          {JSON.stringify(report.geometry, null, 2)}
        </pre>
      </details>
      <label className="block">
        Private review reason
        <textarea
          className="block w-full rounded border p-3"
          minLength={3}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      {report.status === 'pending_review' ? (
        <div className="flex gap-3">
          <button
            className="rounded border px-4 py-3"
            disabled={busy || reason.trim().length < 3}
            onClick={() =>
              act({ operation: 'accepted', report: report.id, reason })
            }
          >
            Accept for publication review
          </button>
          <button
            className="rounded border px-4 py-3"
            disabled={busy || reason.trim().length < 3}
            onClick={() =>
              act({ operation: 'rejected', report: report.id, reason })
            }
          >
            Reject
          </button>
        </div>
      ) : null}
      {report.status === 'accepted' && report.intent === 'correction' ? (
        <p>
          This correction needs a provenance-preserving data merge before
          publication.
        </p>
      ) : null}
      {report.status === 'accepted' && report.intent === 'add' && canPublish ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            act({
              operation: 'published',
              report: report.id,
              reason,
              public_url: url,
              public_license: license,
              public_attribution: attribution,
            })
          }}
        >
          <h3 className="font-semibold">Publish an unverified record</h3>
          <label className="block">
            Public source URL
            <input
              className="block w-full rounded border p-3"
              type="url"
              pattern="https://.*"
              required
              maxLength={1000}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </label>
          <label className="block">
            Approved license
            <input
              className="block w-full rounded border p-3"
              required
              minLength={3}
              maxLength={200}
              value={license}
              onChange={(event) => setLicense(event.target.value)}
            />
          </label>
          <label className="block">
            Public attribution
            <input
              className="block w-full rounded border p-3"
              required
              minLength={3}
              maxLength={500}
              value={attribution}
              onChange={(event) => setAttribution(event.target.value)}
            />
          </label>
          <label className="block">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />{' '}
            I reviewed the location, facts, license, and provenance; public text
            contains no private evidence or personal data.
          </label>
          <button
            className="rounded border px-4 py-3"
            disabled={
              busy ||
              !confirmed ||
              !report.observed_at ||
              reason.trim().length < 3
            }
          >
            Publish as unverified
          </button>
        </form>
      ) : null}
    </article>
  )
}
