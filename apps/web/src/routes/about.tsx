import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  head: () => ({ meta: [{ title: 'About | Parkey' }] }),
  component: About,
})

function About() {
  return (
    <main id="main" tabIndex={-1} className="about-page">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
        About Parkey
      </p>
      <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
        Review parking information.
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-muted">
        Parkey helps people discover parking around Poblacion, Makati.
      </p>
      <p className="mt-5 leading-relaxed text-muted">
        Authorized reviewers use this workspace to accept or reject private
        community reports. Publishers separately review public provenance before
        adding an unverified discovery record. Acceptance never establishes
        current availability or permission to park.
      </p>
      <p className="mt-5 leading-relaxed text-muted">
        Sign-in requires an authenticator and reviewer authorization. Reports
        come from the configured Supabase service. Mobile contributions remain
        on-device while public submission and private photo handling are gated.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex min-h-11 items-center text-sm font-medium text-accent underline underline-offset-4"
      >
        Back to overview
      </Link>
    </main>
  )
}
