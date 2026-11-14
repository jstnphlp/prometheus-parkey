# Mobile redesign Phase 3

Branch: `codex/mobile-redesign-phase-3-polish`.
Stacked parent/PR target: `codex/mobile-redesign-phase-2-auth` (draft PR #31).
Verified latest parent: `dbfeccc046e3068a9d96ba8732ec3d98d1daf7f2`.
This branch does not start from main. GitHub connectivity recovered after the
initial timeouts; [draft PR #32](https://github.com/jstnphlp/prometheus-parkey/pull/32)
is open against Phase 2.
No V1 acceptance gate is advanced.

## Implementation

The email field now has a constrained flex slot, stable container geometry and
fixed vector-icon/toggle slots. It retains native horizontal scrolling,
selection, cursor, autofill configuration and accessibility font scaling.
Register, Login and password screens share clean SVG icons. No icon library or
other dependency was added.

A reusable Parkey native modal handles system failures and progressive help.
It provides deduplication, retry/recovery actions, native Back, keyboard
dismissal, input-focus restoration, safe-area scrolling and screen-reader title
focus. Stale messages clear on navigation. Only field validation stays inline.
The account flow's repeated notices and long helper paragraphs were shortened;
password and Remember me guidance remain available on demand. Discovery's
parking caveats, legal information, data and logic were preserved.

Confirmation resend is bound to the original email, an unexpired local signup
request and its secure PKCE proof. Failed resends preserve the original callback
metadata; accepted resends renew its validity window. Legacy Phase 2 requests
can still finish their callbacks, but need a new registration request to resend.
Failed sign-out cleanup remains guarded and retryable, including failed runtime
recreation. Invalid callbacks now wait for navigation focus before showing
feedback or attempting exchange.

See the [input and popup standard](MOBILE_INPUT_AND_POPUP_STANDARD.md).

## Figma and static artwork

Inspected with Figma MCP design context and screenshots: Register `11:44`,
Login `11:30`, current Welcome `70:333`, Discover `70:537`, Compare `94:920`,
Navigate `103:980`, and alternative Navigate `103:1017`.
Historical Compare `19:32` and Navigate `19:60` no longer resolve.

The owner explicitly deferred final animation files and requested the current
Figma design. Welcome now uses the compact original logo/wordmark lockup and
concise tagline. Onboarding places the current original artwork above the
current headings/copy, with step-aware progress and the corresponding buttons.
The standard Navigate variant preserves clear text and button placement.

All four newly exported PNG assets are local Figma renders, not generated or
substituted artwork. The wordmark export preserves Figma's Baloo 2 glyphs
without substituting a different runtime font. Existing local original logo
assets remain in use. No runtime Figma URL or drawn iPhone chrome is present.
Exports/motion inspection found PNG fills and no keyframes. There is no final
animation integration or claim about seamless loops, map stability or parking
orientation; those require the later approved animation files.

Intentional differences: native platform safe areas/status bars; functional
Back and Welcome Log In controls; progress advances by step; content scrolls
on small displays/large text. System popups and vector field icons implement
the owner's Phase 3 requirements. Raster Figma artwork is static and may look
softer at high device pixel densities than final source animation/vector art.

## Email delivery diagnosis — paused by owner

Verified before the pause: the hosted public Auth settings returned HTTP 200;
email/password signup is enabled, email confirmation is required, and Google
and Facebook are disabled. The authenticated local Supabase CLI account does
not list project `nuepweyzpkqfihjsbsik`. No management tool for that project or
owner-controlled test inbox was available.

The actual delivery cause is **not established**. A pending-confirmation UI
and an accepted signup/resend response do not establish that mail was sent or
received. Repeated signup may deliberately return a generic response to avoid
account enumeration. The client fixes above do not establish an SMTP fix.

Resume with these owner-visible checks, without sharing secrets:

1. Authentication → Emails → SMTP Settings: custom SMTP enabled/disabled,
   sender address/domain verification, configured sending limits. Supabase's
   built-in development SMTP restricts recipients to organization members;
   check that restriction if custom SMTP is disabled. Do not assume it is the
   configuration of this project.
2. Authentication → URL Configuration: inspect whether
   `parkey://auth/callback` is allowlisted. No allowlist change was made here.
3. Auth logs around an owner-run fresh signup/resend: timestamp, response
   status and structured error code. With custom SMTP, correlate provider
   delivery/rejection/bounce and sender/domain verification logs. Check spam.
4. Inspect email templates. The confirmation/recovery link must go through
   Supabase verification (`{{ .ConfirmationURL }}` in the standard templates)
   before redirecting with a PKCE authorization code; do not insert raw session
   tokens or bypass verification. Open on the same device that requested it.
5. If custom SMTP is required, the owner configures the provider host/port,
   credentials, verified sender address/name and domain DNS in the dashboard.
   Credentials remain owner-managed. Any production setting change needs
   separate authorization; none was made by this work.
6. Use a fresh address/inbox controlled by the owner to verify receipt,
   confirmation, verified session, actual login and password recovery end to
   end. Creating a user manually in Supabase Users is not required.

The owner paused SMTP investigation while the dashboard was unavailable.
Email confirmation, templates, sender, rates, logs, allowlist and actual inbox
delivery remain unverified. Confirmation was not disabled. No hosted resources,
policies, migrations, deployments or OAuth providers were changed.

## Checks and evidence

- Targeted mobile strict TypeScript, ESLint and Prettier pass.
- All **299 mobile tests pass**, covering discovery, onboarding, secure session
  storage/refresh/expiry, validation, callbacks and SDK auth errors. New tests
  cover popup deduplication, safe delivery errors, email-bound resend, failure
  retention and successful resend near expiration. SDK fixtures are not hosted
  account-success evidence.
- Production dependency audit: 0 critical/high/moderate; 1 pre-existing low
  `deepmerge` advisory. The existing prototype-filtering patch is unchanged.
- Android release-variant APK builds successfully and its v2 signature verifies.
  It bundles JavaScript/assets and uses the existing local test signing key.
  Production signing/store distribution is outside this work.
- API 35 Android emulator: 360×800 and 390×844 normal text, plus 320×640 at
  150% system text. The real Gboard email keyboard was used after switching
  away from the automation IME. Container/icon bounds are stable for short,
  long and 254-character emails. Native copy/paste retains all 254 characters
  and the cursor reaches position 254. See the measurement JSON files.
- Native validation, SVG password visibility, network-error popup, Android
  popup Back/input-focus restoration, invalid callback popup and recovery
  actions, and large-text modal/registration scrolling were exercised.

The Phase 2 baseline on this API 35 emulator already measured the same email
TextInput bounds for a short and a 254-character address. The reported resize
was not reproduced on that platform/profile. Phase 3 removes reliance on text
intrinsic sizing explicitly and adds container/icon measurements under the real
keyboard and large text; iOS confirmation of the original defect remains open.

- Welcome → Login → Back, all onboarding steps and Back, final Register guest
  exit, cold-launch splash and relaunch without onboarding replay pass. Saved
  car state survived the auth attempts, app upgrades and onboarding completion.
  Guest MapLibre, Saved, search input and navigation entry remain accessible.
  Remote search-result and routing completion were not verified.
- Android's animator duration scale was already zero during the native checks;
  reduced-motion navigation/modal paths were exercised. No final artwork
  animation was supplied or tested.

Before/after and Figma reference screenshots are in
[the evidence directory](evidence/mobile-redesign-phase3/). Screenshots are
downsampled to logical display size for review; measurement JSON retains native
pixel coordinates. Private guest discovery screenshots are not published.
The [receipt](evidence/mobile-redesign-phase3/receipt.json) records final device,
artifact and flow results. Exact scoped files are in
[changed-files.json](evidence/mobile-redesign-phase3/changed-files.json).

## Remaining verification and delivery limits

iOS and physical phones were unavailable. Google Autofill is configured on the
emulator, but actual provider suggestions were not exercised. Manual TalkBack/
VoiceOver review was not performed. Positive hosted signup/email verification,
session restoration/sign-out and recovery need the owner-controlled test
account/inbox and configuration review described above. Native secure-storage
failure injection was not performed. No fake success states or auth bypasses
were introduced. Final animations remain deferred by the owner.

The latest Phase 2 parent is verified and the stacked review PR is published.
CI validate and database jobs pass; browser E2E jobs were still running at this
update. No merge or deployment was attempted. The two pre-existing documentation edits in
`V1_OWNER_ACCEPTANCE_CHECKLIST.md` and `mobile-discovery.md` are excluded.

## Owner follow-up: inline password rules and signup diagnosis

The owner requested a visible password checklist directly under the password
input, removal of Explore parking, and investigation of failed registration
despite internet connectivity. This supersedes the baseline password-help modal
and auth guest buttons shown in the earlier screenshots.

Register and verified Reset now share the four-rule checklist with their actual
validation policy. There is no requirements modal or button. Login, Register,
Forgot and Account no longer show Explore parking. Discovery remains accessible
through the existing Back/onboarding routes and retains its data and logic.

Unknown service/local failures no longer blame the connection. Known transport,
HTTP/service, email-delivery, account-database and rate-limit failures are
distinguished. A failed signup logs only a fixed safe category, allowlisted code
and numeric status locally; no entered identity, password, token, raw provider
message, body or header is logged. A new SDK fixture demonstrates that a rejected
confirmation-email send can fail the signup request before the pending screen;
it is not evidence that this was the owner's actual server error.

The public settings request for the configured Parkey project returned HTTP 200
with email signup enabled and confirmation still required. Android reported a
validated internet-capable network. The owner reports configuring Resend for
`auth.promths.com`; DKIM/SPF records resolve publicly. Successful mail delivery
and the actual failed signup response still require a real owner attempt and
sanitized failure evidence. No hosted settings were changed by this follow-up.

Targeted mobile strict TypeScript, auth ESLint and 38 auth tests pass. The updated
standalone Android APK builds and its signature verifies. Native inspection
confirmed the checklist order and absence of the removed buttons. The original
baseline build is preserved locally as `output/ncr/parkey-phase3-d80ca7af.apk`;
`output/ncr/parkey-phase3-test.apk` now contains these corrections. See the
[follow-up receipt](evidence/mobile-redesign-phase3/auth-corrections.json).

During the owner retry, the emulator was found using the automation IME and had
hardware keyboard input disabled. It was restarted with hardware input enabled,
Gboard selected and the software keyboard available. App data was preserved.
Automation input was released for manual testing.

The owner confirmed typing worked and retried signup. Its actual local
diagnostic was `network`, null HTTP status and `unclassified` code. Android
could not resolve the configured Supabase hostname, while the host reached its
public Auth settings and the APK's URL/public key matched that configuration.
The emulator was restarted with `-dns-server 1.1.1.1,8.8.8.8`. After network
startup, the Supabase hostname resolved from Android. The owner then confirmed
that signup reached Check your email. This establishes that the prior signup
transport failure was resolved on this emulator; it does not certify delivery.

The owner has not received mail and reports no entry in Resend. The first test
address was already listed in Supabase Auth and used for a console account;
its confirmation status was not supplied. Accepted signup responses can be generic for previously
registered addresses, so this work does not infer a fresh account or successful
email send from the pending screen. Email delivery, confirmation, verified
session and recovery remain open until actual provider/inbox evidence exists.

A subsequent owner attempt produced an actual `email_delivery` failure with
HTTP 500 and no recognized structured code, followed by another transport
failure. The email-delivery category matches Supabase's fixed Error sending
confirmation email response. This confirms that the email-sending step failed;
it does not identify a specific SMTP credential, sender, template or timeout
cause. Further signup attempts were paused while requesting the detailed Auth
log error from the owner. Neither SMTP nor confirmation security was changed
as a workaround.

Authenticated dashboard inspection subsequently established the specific
failure: the Auth log at 14 Nov 2026 11:10:30 reports HTTP 500 on POST `/signup`
with SMTP `535 "Invalid username"`. The SMTP configuration contains username
`Resend`; Resend's official Supabase SMTP guide specifies lowercase `resend`.
Host `smtp.resend.com`, port 465 and sender `no-reply@auth.promths.com` match the
documented setup. The password remains hidden and was not read or modified.
The owner explicitly authorized saving the username correction. The dashboard
reported Successfully updated settings; a reload confirmed persisted username
`resend`. The stored password was not changed. Read-only URL Configuration
inspection also confirmed `parkey://auth/callback` is allowlisted, without an
allowlist change. Delivery remains unverified pending an owner retry. The
existing emulator is open on Register with Gboard and explicit DNS enabled;
Supabase hostname resolution was verified after startup networking settled.
