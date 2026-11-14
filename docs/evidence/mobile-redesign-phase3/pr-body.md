Long authentication input relied on intrinsic native text sizing, field icons
used Unicode glyphs, and system failures competed with helper paragraphs inline.
This change constrains the input slot, uses consistent SVG icons, and presents
system failures through accessible Parkey modals with retry/recovery actions.
Password creation shows its four requirements directly below the field. Auth
Explore parking buttons are removed; existing Back/onboarding routes retain
guest discovery.

Welcome and onboarding now match the current static Figma compositions and
locally exported artwork. The owner deferred final animations. SMTP investigation
has resumed with owner-configured Resend; delivery remains unverified.
Resend now preserves failed requests, renews successful requests, and binds the
email to the local PKCE signup. Callback focus and failed sign-out retry are
hardened. Signup failure feedback distinguishes transport from server/email
failures and records only safe local codes/status. An owner signup failure was
traced to emulator DNS, which was corrected; the next attempt reached Check your
email. A later fresh-address attempt returned HTTP 500 during confirmation-email
sending; detailed server configuration diagnosis remains open. Guest discovery
and persisted parking data remain intact.

Validation: mobile strict TypeScript, scoped ESLint/Prettier, 299 baseline mobile tests
plus 38 passing targeted auth tests after the follow-up (including five new cases),
dependency audit (one existing low advisory), signed standalone Android APK,
API 35 native checks at 360×800, 390×844 and 320×640/150% text. Includes real
keyboard, 254-character selection/paste, modal Back/focus and onboarding/relaunch
checks. Before/after screenshots, measurements and platform/integration limits
are documented in `docs/MOBILE_REDESIGN_PHASE3.md`.

Review target: `codex/mobile-redesign-phase-2-auth` (PR #31), not main. Positive
email delivery/auth recovery, iOS/physical devices, manual screen-reader and
autofill-provider checks, and final animations remain outstanding. No settings,
migrations, deployment or auth-confirmation bypass was introduced.
