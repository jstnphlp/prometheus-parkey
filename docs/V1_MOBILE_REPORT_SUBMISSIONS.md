# Verified-email mobile reports and selected-pin fix

Status: implementation under verification on `fix/parking-pin-review-submission`.
The live submission service is **not deployed or enabled**. This does not advance
production release approval or the canonical analytics gates.

## User behavior

The selected parking name now uses text with a light halo. Its dark background
sprite was removed from both native and browser maps, including image registration.
Street parking geometry, directions routes and the parking pin remain intact.

Add a spot and corrections still save a private copy on the phone first. In
**You → Drafts on this device → Review report**, users can inspect a report. Sending
requires a freshly verified email session, an actual observation date within the
last 90 days, and explicit consent to send that report's text and chosen map
location. Existing drafts never upload automatically. Browsing and local saving
require no account. Missing sending configuration preserves the local copy and
explains that sending is unavailable.

The user explicitly selected email verification rather than anonymous intake.
Supabase Auth sends an email code only after the user requests one. Access tokens
stay in panel memory for at most ten minutes or the token lifetime, whichever is
shorter; closing the panel clears them. Refresh tokens are not retained. Auth
stores the verified account email, but reviewer report payloads contain no email.
Email delivery, template configuration and real-device verification remain gates.

Photos remain local. No photo URI, file bytes, arbitrary upload URL, saved-place
list or parked-car location is sent. Secure media ingestion, EXIF removal, private
storage and licensing review remain separate work; attaching a local photo does
not grant permission to upload or publish it.

## Private intake contract

`POST /functions/v1/mobile-reports` receives the project's publishable `apikey`
and a verified user's `Authorization: Bearer` token. The Edge Function validates
that token with this project's `/auth/v1/user` on every request. Anonymous,
unverified and invalid identities cannot write. Reviewer roles/MFA remain separate.
Never bundle a service-role key, reviewer credential or database password.

All requests have `schema_version: 1`, `action`, and a device draft's `client_key`.
Only `submit` adds `disclosure_version: 2026-11-10-email-text-v1` and `report`.
Report fields are exactly `intent`, `target`, `name`, `kind`, `geometry`, `side`,
`restrictions`, `hours`, `fees`, and `observed_at`. Unknown facts stay null.
Authority, publication, storage and verification fields are rejected.

Requests are bounded to 64 KiB while streaming. Facilities are WGS84 points;
new street drafts permit 2–12 coordinates, source corrections permit up to 500,
matching the existing local geometry contract. PostGIS rechecks geometry and
5 m–1 km street length. UUID corrections must still target a published record;
bundled OSM IDs resolve only to the exact canonical node/way/relation URL form.
No submitted URL is fetched. Observation dates must be finite, nonfuture and
within 90 days. Plain text remains untrusted and must be rendered as text.

The trusted service calls a separately committed attempt-quota RPC before body
validation, so malformed reports do not refund that attempt. Account locks enforce
30 attempts/minute, five new reports/hour and 20/day. Withdrawal does not refund
new-report quota. Retries with the same account/key/payload return the stored
receipt; changed content or a withdrawn key returns a conflict. `status` recovers
an uncertain delivery without uploading again. Provider and edge-wide abuse limits
must also be verified before activation; account quotas do not prevent all abuse.

Successful submission returns HTTP 202 with only `state: received`, `receiptId`
and `receivedAt`. This acknowledges delivery, not current moderation outcome,
verification or publication. `status` can also return `not_sent`; `withdraw` can
return `withdrawn`. SQL/provider errors and private fields are never forwarded.

## Console compatibility and deletion

The migration inserts only into `parkey_private.community_reports`, initially
`pending_review`. The existing Research Console **Moderation → Pending** view
reads this queue through `moderate_discovery`. No admin-repository edits are made.
The submitter gains no reviewer, publishing, direct-table or private-list access.
Acceptance and publication retain their existing separate audited decisions.
Submission does not establish parking permission or vacancy.

Receipt/quota tables have RLS and no anonymous/authenticated grants. Their public
RPCs are executable only by the trusted service role. A user can withdraw their
own unpublished private report after email verification. Deleting just the device
copy does not withdraw it; keep the copy to manage its receipt. A published report
requires reviewer assistance for public-data changes.

`cleanup_mobile_reports()` removes linked private report payloads and receipts
after the 90-day window, including the private copy of a subsequently published
report. It preserves independent public parking records and reviewer audit history.
A daily scheduled/monitored invocation is required before enabling collection;
batch deletion may occur within the following 24 hours. A before-delete Auth
trigger removes linked private payloads before account deletion can cascade away
their retention linkage. No cleanup schedule or production deletion is created
by this branch.

## Deployment gates

1. Pass unit, type/lint/format, browser, native and disposable database permission,
   quota, idempotency, queue, withdrawal, account-deletion and retention checks.
2. The backend owner reviews and deploys
   `supabase/migrations/20261110120000_verified_mobile_reports.sql` and
   `supabase/functions/mobile-reports/` to the authorized Parkey project. Keep the
   service disabled while deployment/integration work is incomplete. No hosted
   migration, deployment or admin-repository change is authorized by these docs.
3. Configure Auth SMTP and an email OTP template containing `{{ .Token }}`. Test
   real delivery, verification, expiry, resend/error states and mail/edge abuse
   limits. If the project requires CAPTCHA, an accessible challenge adapter must
   be implemented and verified before enabling this client. Never disable an
   existing Auth protection to make this flow pass.
4. Approve the embedded disclosure and account/report deletion/retention policy;
   schedule and monitor daily `cleanup_mobile_reports()`. Validate that raw private
   content is removed, public data/audit remain correct and cleanup failures alert.
5. Configure server-only `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `MOBILE_REPORTS_WEB_ORIGIN` for the exact approved browser origin if applicable,
   and enable `MOBILE_REPORTS_ENABLED=true` / `MOBILE_REPORTS_PRIVACY_APPROVED=true`
   only after those gates. Native requests have no browser Origin; a verified
   account is required regardless of Origin. Preserve gateway JWT verification.
6. Rebuild mobile with the existing public Supabase configuration and
   `EXPO_PUBLIC_REPORT_SUBMISSIONS_ENABLED=true` only after the endpoint is ready.
   Test a consented real submission appearing in the live Console, lost-response
   recovery, withdrawal and cross-account denial. Never test by publishing a
   synthetic record to the consumer map.

Until these gates pass, the current local configuration leaves sending disabled.
Analytics remains hard-locked off. This is discovery-only work.

## Evidence

- Initial targeted mobile/server/map-font tests: 18 passed.
- Mobile and Edge Function TypeScript checks: passed before integration changes;
  final workspace checks are pending.
- Database runtime, browser UI and updated native artifacts: pending verification.
- Independent review identified account-deletion retention and source-geometry
  mismatches; both have code fixes and regression checks, with re-review pending.
- Docker is not installed on this workstation. Database execution must use the
  repository's disposable GitHub CI PostgreSQL job; no production database is used.
