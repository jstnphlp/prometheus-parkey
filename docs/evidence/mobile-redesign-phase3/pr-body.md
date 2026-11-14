Long authentication input can rely on intrinsic native text sizing, field icons
use Unicode glyphs, and system failures compete with helper paragraphs inline.
This change constrains the input slot, uses consistent SVG icons, and presents
system failures through accessible Parkey modals with retry/recovery actions.

Welcome and onboarding now match the current static Figma compositions and
locally exported artwork. The owner deferred final animations and SMTP work.
Resend now preserves failed requests, renews successful requests, and binds the
email to the local PKCE signup. Callback focus and failed sign-out retry are
hardened. Guest discovery and persisted parking data remain intact.

Validation: mobile strict TypeScript, scoped ESLint/Prettier, 299 mobile tests,
dependency audit (one existing low advisory), signed standalone Android APK,
API 35 native checks at 360×800, 390×844 and 320×640/150% text. Includes real
keyboard, 254-character selection/paste, modal Back/focus and onboarding/relaunch
checks. Before/after screenshots, measurements and platform/integration limits
are documented in `docs/MOBILE_REDESIGN_PHASE3.md`.

Review target: `codex/mobile-redesign-phase-2-auth` (PR #31), not main. Positive
email delivery/auth recovery, iOS/physical devices, manual screen-reader and
autofill-provider checks, and final animations remain outstanding. No settings,
migrations, deployment or auth-confirmation bypass was introduced.
