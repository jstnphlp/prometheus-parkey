Long authentication input relied on intrinsic native text sizing, field icons
used Unicode glyphs, and system failures competed with helper paragraphs inline.
This change constrains the input slot, uses consistent SVG icons, and presents
system failures through accessible Parkey modals with retry/recovery actions.
Password creation shows its four requirements directly below the field. Auth
Explore parking buttons are removed; existing Back/onboarding routes retain
guest discovery.

Welcome and onboarding now match the current static Figma compositions and
locally exported artwork. The owner deferred final animations. Auth logs proved
SMTP `535 Invalid username`; the owner authorized correcting `Resend` to
`resend`, and confirmed email receipt afterward.
Resend now preserves failed requests, renews successful requests, and binds the
email to the local PKCE signup. Callback focus and failed sign-out retry are
hardened. Signup failure feedback distinguishes transport from server/email
failures and records only safe local codes/status. An owner signup failure was
traced to emulator DNS, which was corrected; the next attempt reached Check your
email. Guest discovery and persisted parking data remain intact.

A branded signup email now confirms on any device through a dedicated HTTPS
page at `parkey.promths.com`. It verifies the one-time fragment token with
Supabase, rejects failed/expired links and discards browser session credentials.
The static build excludes the moderation workspace. The owner explicitly
approved hosting/domain/template activation, added the CNAME and confirmed a
real successful verification from another device. Native recovery stays PKCE.

The pending mobile screen checks with the signup password held only in memory,
using bounded/backed-off real sign-in and server user verification. It stops and
clears credentials on blur, background, failure, expiry or success. The app
continues only after Supabase confirms a session, without public email-status
enumeration or password persistence.

Validation: mobile strict TypeScript, scoped ESLint/Prettier, 299 baseline mobile tests
plus 44 passing targeted auth tests after the follow-ups,
dependency audit (one existing low advisory), signed standalone Android APK,
API 35 native checks at 360×800, 390×844 and 320×640/150% text. Includes real
keyboard, 254-character selection/paste, modal Back/focus and onboarding/relaunch
checks. Before/after screenshots, measurements and platform/integration limits
are documented in `docs/MOBILE_REDESIGN_PHASE3.md`.

Cross-device page: workspace lint/TypeScript/format/web build, auth-only build,
six new confirmation unit tests, local browser cases and live HTTPS/fragment
checks passed. Operations reports 192 passed and one existing skip.

Review target: `codex/mobile-redesign-phase-2-auth` (PR #31), not main. The owner
reported successful automatic continuation after PC confirmation in the updated
emulator. Positive password recovery, background/resume, iOS/physical devices, manual
screen-reader and autofill-provider checks, and final animations remain open.
The authorized confirmation-site/template activation is recorded separately;
there are no database migrations, app deployments/merges or auth bypasses.

Optional Google/Facebook follow-up: both hosted providers are independently confirmed
enabled. Native system-browser S256 PKCE, request-specific secure verifier slots,
cancellation cleanup, recovery isolation and fresh server user verification are
implemented. Buttons require hosted enablement plus explicit build flags, off
by default. The internal OAuth APK exposes both for testing. Both real provider
login pages and Google Android Back cancellation were observed; successful
consent/native return remains pending owner acceptance. No secrets enter the app.
56 auth tests pass, including 12 OAuth cases. Required workspace checks,
scoped final type/lint/format and the signed native release build passed. Audit:
one low deepmerge advisory, no moderate or higher. New before/after and
320x640/150% text screenshots are in the Phase 3 evidence folder.
See docs/MOBILE_SOCIAL_AUTH.md for provider setup, public eligibility/privacy
and deletion requirements, native limitations and acceptance steps.

Owner phone feedback follow-up: successful email/social authentication and email
confirmation now open the main discovery app instead of Your account. The shared
handoff reuses durable onboarding completion and clears introduction history,
including Login from Welcome. Recovery and the explicit Account entry stay intact.
62 auth/onboarding-persistence tests, mobile types and auth lint pass. Updated
phone APK and exact verification limits are in the navigation receipt/report.
