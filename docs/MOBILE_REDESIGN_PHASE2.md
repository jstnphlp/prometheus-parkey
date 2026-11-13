# Mobile redesign — Phase 2: functional authentication

Branch: `codex/mobile-redesign-phase-2-auth`, targeting `feat/v1-place-discovery`.
Base: `02888c7a09fa53e00c58c04f9244893f4c12bf56` (the Phase 1 squash merge).
PR #29 remains the parent integration into main. This work does not advance a
V1 release gate or authorize a deployment.

## Implementation

- Replaced the Phase 1 account placeholders with native Login and Register forms.
  Reuses Outfit, the original account logo, `BrandButton`, `ScreenContainer`,
  colors and Back navigation. Inputs provide autofill hints, return-key focus,
  accessible labels/errors, password visibility, validation and loading states.
- Registration sends email/password and `full_name` metadata to Supabase Auth.
  A response without a session shows a pending-confirmation screen. Existing
  account obfuscation is respected: the copy does not assert that an account was
  created or that an email was delivered. No public profile row is created.
- Email/password login uses `signInWithPassword`. Only a fresh server `getUser`
  with confirmed email can produce the signed-in UI. Cached user metadata alone
  cannot authenticate. Expiration schedules another check; SDK refresh runs while
  active and stops in the background. Checks are coalesced and stale results
  cannot reverse sign-out.
- Remember me is functional. Checked sessions use Expo SecureStore; unchecked
  sessions remain in memory and do not restore after a process restart.
  Passwords are never persisted. PKCE proofs remain securely available across
  restart so email links can return to the originating device.
- SecureStore values use small Unicode-safe chunks, an atomic manifest and a
  separate cleanup inventory. Explicit sign-out tolerates corrupt cached JSON,
  manifests and flow indexes. Local credentials are cleared before attempting
  server session revocation. Failed remote revocation is reported accurately.
- Forgot password, email callbacks and password update use Supabase's PKCE flow
  with secure native randomness and SHA-256. Only code callbacks are accepted;
  implicit tokens, duplicate code parameters and foreign callback hosts are
  rejected. Recovery requires the local pending request, SDK recovery result and
  a freshly verified user. Password update is followed by local sign-out and a
  fresh login. Android Back cancels recovery rather than granting account access.
- The callback handles a replacement email link on an already-open route and
  ignores stale completions. One pending email purpose is supported at a time;
  use the latest email on the device where it was requested, within one hour.
- Account entry points are available in the discovery You screen and pilot
  controls. Guests can browse throughout. Sign-in/out does not clear saved
  parking, drafts, parked-car data or onboarding completion. Discovery continues
  using its existing public access path; report/research credentials are separate.

## Inspected configuration and policies

The hosted public Auth settings for `nuepweyzpkqfihjsbsik` confirm email signup is
enabled, email confirmation is required, and Google/Facebook are disabled.
Their buttons and the social separator are therefore omitted. No OAuth provider
configuration was changed and no social login is represented as functional.

The owner supplied the password policy: at least eight characters, uppercase,
lowercase and a special character. Client guidance follows it; server policy and
compromised-password rejection remain authoritative. Hosted management access was
unavailable, so dashboard password rules and redirect allowlisting were not
independently read. The repository's local Supabase configuration has older
development defaults and is not treated as the hosted policy.

Reviewed the existing foundation, public discovery, pilot and mobile-report
policy definitions. Existing profile tables are closed to public clients;
published discovery has its existing public/restrictive policies, and private
research still requires its separate reviewer and assurance checks. No policy,
grant, migration, table, privileged key or backend deployment was added. A hosted
anonymous zero-row profile-read probe was denied; this is not a complete hosted
policy audit. See [sanitized integration evidence](evidence/mobile-redesign-phase2/integration.json).

## Required dashboard configuration

1. In [Auth → URL Configuration](https://supabase.com/dashboard/project/nuepweyzpkqfihjsbsik/auth/url-configuration),
   add `parkey://auth/callback` to Redirect URLs and save. The app uses that exact
   redirect for confirmation and recovery. Native package/scheme configuration is
   already in this PR. An Expo Go callback is not supported; install the native app.
2. Keep email/password signup enabled and email confirmation required. Confirm
   the hosted password policy matches the owner-supplied rules. If a selected
   Supabase strength preset also requires digits, update the app guidance and
   validation to match before release.
3. Verify SMTP sender/delivery, confirmation and recovery expiry/rate limits.
   Email templates should use Supabase's `ConfirmationURL` verification link,
   preserving its PKCE redirect. Direct token-hash/implicit-token links are not
   accepted by this app. Confirmation and reset must be opened on the requesting
   device; another device has no verifier and must start a new request.
4. Use an inbox you control to register through Parkey, confirm the email on that
   same phone, sign out, log in with Remember me, restart, and request/reset the
   password on that phone. A dashboard-created auto-confirmed user does not prove
   that the confirmation email flow works. Do not share personal passwords or
   privileged Supabase keys.
5. Google/Facebook require separate approved provider credentials, consent/app
   configuration, Android/iOS identifiers and redirect/browser-flow testing.
   Enabling a dashboard provider alone does not implement native social login;
   add and test its client flow before displaying its button.

## Visual reference and differences

Inspected Figma MCP design context and screenshots for Register `11:44` and Login
`11:30`. Welcome `11:16` no longer exists; inspected replacement `70:333` and
preserved the Phase 1 Welcome implementation as requested.

The form palette, original 66 × 72.215 logo, Outfit weights, 32-point side gutters,
50-point fields/buttons and 13-point corners match the references. Native safe
areas/status bars and Android font metrics produce small vertical differences.
Android renders the source text glyphs differently from Figma's iPhone emoji.
Show/Hide controls replace the ambiguous password glyph and are also available
for confirmation. Back and guest controls, password guidance and secure-session
explanation are deliberate additions. Social controls are absent because their
providers are disabled. Large system text gets persistent visible field labels;
content scrolls rather than being fixed to the reference frame.

- [Login comparison: Figma left, Android right](evidence/mobile-redesign-phase2/compare-login.png)
- [Register comparison: Figma left, Android right](evidence/mobile-redesign-phase2/compare-register.png)
- [Validation and keyboard](evidence/mobile-redesign-phase2/android-register-validation-keyboard.png)
- [Invalid credentials](evidence/mobile-redesign-phase2/android-invalid-credentials.png)
- [Offline login](evidence/mobile-redesign-phase2/android-offline-login.png)
- [Invalid email link](evidence/mobile-redesign-phase2/android-invalid-email-link.png)
- [Reset guard](evidence/mobile-redesign-phase2/android-reset-guard.png)
- [Small Register with full labels](evidence/mobile-redesign-phase2/android-small-register.png)
- [Small Register keyboard](evidence/mobile-redesign-phase2/android-small-register-keyboard.png)
- [Small Register controls](evidence/mobile-redesign-phase2/android-small-register-controls.png)
- [Small Login controls](evidence/mobile-redesign-phase2/android-small-login-controls.png)

Local phone artifact: `output/ncr/parkey-phase2-test.apk` (109.1 MiB).
The SHA-256, source commit, supported architectures and signing limits are in the
receipt. Install it as an update over the previous locally signed test build.
The APK is an ignored local artifact, not a hosted download or store release.

## Verification and remaining acceptance

Mobile unit tests: **292 passed**, including **26 auth cases** covering policy,
S256 PKCE signup/recovery, pending confirmation, rejected/consumed links, secure
storage and corruption cleanup, Remember me/relaunch, refresh, expiration,
verification races, password-update rejection and network cancellation/timeouts.
SDK tests use explicit fixtures; they are not claimed as hosted signup success.

Workspace lint, typecheck and web build passed. Native debug and locally signed
release-variant Android builds passed. The standalone APK's v2 signature was
verified. It launches with Metro stopped and all original artwork bundled.

Initial GitHub validation failed on moderate `node-forge` advisories in the
existing Expo CLI dependency tree. The repository's existing override was
updated from 1.4.1 to patched 1.4.3, and workspace checks were rerun. Production
dependency audit passes at CI's moderate threshold. Upstream audit metadata still
lists one low `deepmerge` advisory; the repository's existing prototype-key
filtering patch remains applied. No framework version was changed.

Android API 35 checks include native validation/focus/keyboard, password
visibility, Remember me, Back, actual invalid-credentials handling, offline
failure/reconnection, invalid then replacement email links, forgot-password
navigation and rejection of reset without a recovery session. The original
parked-car state survived installation and auth attempts; private discovery
screenshots are not published. Final small-screen captures and artifact metadata
are recorded in the [receipt](evidence/mobile-redesign-phase2/receipt.json).

Local code review identified three edge cases (corrupt storage sign-out, offline
expiry and replacement callbacks); all were fixed and rechecked. No GitHub
review, production approval or V1 gate advancement is implied.

Hosted signup confirmation, successful password login/restoration/sign-out and
password-reset delivery/update still require a dedicated test inbox/account and
verified redirect configuration. No test inbox or credentials were supplied.
iOS and physical phones have not been verified by this implementation run.
Secure auth is native-only; web discovery remains available and web account
screens explain the unavailable secure-storage capability. Production signing,
SMTP/provider/privacy approval and final device acceptance remain separate.

Exact scoped files are listed in [changed-files.json](evidence/mobile-redesign-phase2/changed-files.json).
The two pre-existing local documentation edits are excluded.
