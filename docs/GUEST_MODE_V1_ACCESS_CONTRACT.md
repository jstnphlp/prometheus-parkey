# Parkey V1 — Guest Access and Account Feature Contract

**Owner decision:** 2026-11-18. **Status:** approved product/implementation specification, **not implemented or release-verified by this document**.
**Target stack:** [mandatory profile survey PR #40](https://github.com/jstnphlp/prometheus-parkey/pull/40) -> [simplified discovery UI PR #41](https://github.com/jstnphlp/prometheus-parkey/pull/41). The [documentation PR #42](https://github.com/jstnphlp/prometheus-parkey/pull/42) branches from #41; while #42 is open, start follow-on code from `docs/guest-mode-v1-access-20261118` so this contract is available, then target that docs branch. If #42 merges into #41, use the updated #41 branch instead.

## Authority and purpose

Read root [AGENTS.md](../AGENTS.md), the [canonical V1 execution plan](V1_EXECUTION_PLAN.md), [mobile reports contract](V1_MOBILE_REPORT_SUBMISSIONS.md), [survey brief](UX_PSYCHOLOGY_PROFILE_SETUP_CODEX_BRIEF.md), [survey data contract](PROFILE_SURVEY_DATA_CONTRACT.md), and [UX psychology skill](../.agents/skills/ux-psychology/SKILL.md). Existing V1 security, public-data controls, privacy, and real integrations override visual mockups and this feature matrix. For the simplified home UI, use the approved Figma design and PR #41 as the current visual/interaction baseline, not legacy Figma tabs or outdated drawer layouts. Preserve **Light + Magenta** and **Dark + Magenta**; Outfit typography.

**Product rule: Discover freely; require a real account only to submit or manage account-bound information.** Guest is a **signed-out local experience**, NOT a synthetic Supabase user, anonymous privileged account, new database row, or separate map implementation. Guest discovery must remain usable when auth is unconfigured. Avoid creating arbitrary query/search/directions quotas to incentivize signup.

## V1 permission matrix

| Action | Signed-out guest | Verified signed-in, complete profile | Important boundary |
| --- | --- | --- | --- |
| Open map, search destinations, map/list switch, parking markers/details | Allowed | Allowed | Only approved published public data; unknown vacancy/fees/hours remain honest |
| Browse parking types/fees filters, use map controls/legend | Allowed | Allowed | No login wall, artificial limit, or fabricated search results |
| Directions/navigation and share public parking | Allowed | Allowed | Existing provider, GPS permission, entrance review, routing consent and fallback remain |
| Save/view/remove favorite parking and parked-car position | Allowed on device | Allowed on device | Persistence is **local-only** in V1; no implied cloud sync |
| Save, edit, review, discard an add-a-spot/correction draft | Allowed on device | Allowed on device | A local draft is not a submitted or published report |
| Send a private text contribution for moderation | **Account required** | Allowed only after server-side email/session verification, explicit per-report consent and enabled backend | Feature remains unavailable when report intake is disabled; no automatic upload |
| Check/withdraw an already sent contribution | **Account required** | Allowed for the same verified owning identity when backend supports it | Existing receipt, idempotency, retention, ownership and moderation rules apply |
| Register, sign in, recover password | Available as entry paths | Available as account actions where relevant | Advertise only configured working providers; no fake email or OTP success |
| Profile survey, personal account information, security, sign out | Registration/sign-in required | Allowed | All four survey steps required and backend-confirmed before signed-in discovery |
| Appearance, help, privacy/about, local saved parking | Allowed | Allowed | Guest menu displays real options; don't imply a guest profile exists |
| Cloud sync of saved places/preferences/history | **Not shipped** | **Not shipped** | A separate, explicitly approved future feature, never V1 marketing copy |
| Booking, payment, QR entry, live vacancies | Out of scope | Out of scope | Forbidden by canonical V1 |

**No new registered-only restriction on:** search count, map usage, parking details, filter usage, free parking discovery, directions or basic local saves. Registration is **not** a prerequisite to testing the core product.

## Identity and routing states

1. First-run/welcome offers `Explore parking` (guest) and the actual register/login paths. Walkthrough is dismissible; no guest survey, forced account creation or location-permission wall for manual search.
2. `signed-out` and securely recognized `unavailable` auth states may use public discovery. An auth `checking`/session-recovery/error state must be handled safely: do not infer a valid signed-in identity from local flags or bypass a known incomplete profile; provide retry/sign-out/guest recovery paths appropriate to verified state.
3. After actual email verification, a new registered user goes **immediately to mandatory four-step profile survey**, then enters signed-in discovery **only after confirmed server save**. Returning incomplete accounts resume the survey; completed verified accounts enter the map. No signed-in survey skip/finish-later action.
4. Incomplete signed-in users can **explicitly sign out to guest exploration**, with a truthful warning about unsaved profile answers. This is not a signed-in survey bypass.
5. Guest -> registration/login -> (complete mandatory survey if needed) -> original public discovery. Preserve **device-local** favorites, parked-car marker, appearance, and draft storage; preserve navigation intent only where compatible with real router state. Do not promise automatic transfer to a cloud account.
6. On sign-out, purge sensitive auth credentials and account-scoped in-memory state while keeping intentional on-device public saved parking and drafts. Explain that local data remains accessible on the device; do not mislabel it as private account data.
7. If auth/configuration/network is unavailable, public discovery and local drafts still work. Do not claim a report was sent, a profile saved, or a contribution approved.

## Contribution flow — critical distinction

**`Report parking` is NOT locked for guests.** Guests may enter the add/correction form and save or review locally. Gate only the **Send for review**, sent-report status, and withdrawal actions behind an identity that the actual backend verifies. If a guest taps Send:

- If live intake is **disabled**, show the truthful unavailable message; leave the draft intact. Don't promise a functioning account-only submission.
- If live intake is enabled, show a compact, dismissible explanation: **`Create an account to submit this report for review.`** Actions: `Create account`, `Sign in`, `Not now`. Preserve the local draft and its review context across navigation/relaunch where the existing device store permits.
- A newly registered user completes the mandatory survey before using registered sending; an existing verified complete user proceeds to existing report review, verified send and **explicit** per-report consent. No auto-send after login, verification, or setup.
- The current `discovery/report-submission.tsx` uses a **short-lived report-specific email code/session**, distinct from main account login. Codex must audit `report-client.ts` and deployed intake compatibility before reusing or changing token handling. Do **not** assume main signed-in session automatically satisfies the report API, introduce token leakage, bypass verified-email validation, or replace a working owner/receipt contract with a local `isSignedIn` check. Backend verification is authoritative. If incompatible, keep sending disabled pending a separately reviewed integration.
- Preserve per-draft explicit consent, text/location only (photos local), no silent upload, attempts/receipt uncertainty, idempotency, ownership, withdrawals, 90-day retention, moderation approval and disabled-until-deployed release gates from [the report contract](V1_MOBILE_REPORT_SUBMISSIONS.md).

## Minimal UI/copy states

Use the **existing PR #41 full-screen map**: left hamburger and search in one row, collapsible icon-only parking legend beneath the menu, selected-marker compact details, and drawer with the account entry pinned to the bottom. Never reintroduce a full-screen login wall or persistent upsell banner on the map.

- Guest drawer account footer: `Sign in` / `Create account` entry as supported; no fake avatar/profile, account email or `My vehicles` promise. Keep `Saved parking`, `Report parking`, `Appearance`, `Help & privacy` usable.
- Guest profile-only destination: explain `Sign in to manage your account`; allow `Not now`/Back to return to map, preserving state. Do not gate local Saved.
- Registered drawer footer: show validated user name/email and real account/logout access; incomplete signed-in account obeys survey router guard rather than silently using signed-in map.
- Contribution gate (when service is usable): `Create an account to send parking reports for review.` Clarify reports are reviewed, **not instantly published or verified**. Primary `Create account`, secondary `Sign in`, dismiss `Not now`.
- Loading, denied permission, offline, auth unavailable, expired token, report disabled, and missing route provider should give accurate recovery or local-only fallback. No fake successful send/save.
- Dialogs/modals should be short, dismissible, accessible, correctly layered over the map, and never trap Back/keyboard focus. Preserve reduced-motion settings and min 44px targets.

## Privacy, analytics and future scope

- **Guest saved data and drafts remain on-device**, potentially accessible to someone using that device. Do not bind to a generated cloud account or silently upload on registration.
- Account profile data is separately governed by [survey contract](PROFILE_SURVEY_DATA_CONTRACT.md). The mandatory questionnaire does not grant consent to optional research export or analytics.
- No new telemetry or personal data in events; follow [analytics contract](V1_ANALYTICS_CONTRACT.md) with off-by-default consent and D2 dependency.
- **Defer** cloud favorite/parked-car sync, synced search history, contribution dashboard beyond actual receipt/status actions, follow-up recommendation personalization, social/score systems and usage limits until independently approved.
- No production Supabase changes, external sends, releases or feature flags are authorized by this doc alone.

## Acceptance criteria

- [ ] Cold start can reach a functioning public map as guest; manual destination search works without GPS/auth.
- [ ] Guest can open real published details, filters, directions, local saved places and local reporting drafts; relaunch persists intentional local state.
- [ ] No unauthenticated submission/status/withdrawal is permitted by server; no report auto-submits during signup/upgrade.
- [ ] Real verified registration routes to mandatory four-step survey; incomplete signed-in account cannot bypass; explicit sign-out returns to guest discovery.
- [ ] Onboarding/account state transitions do not erase public saved places or drafts; no false cloud sync labels.
- [ ] Both magenta themes, drawer footer, dismissible gate, search row and icon-only legend remain faithful to the approved Figma/PR #41 design.
- [ ] Offline, provider disabled, session expiry and lost-report-response behavior are truthful and recoverable.
- [ ] Tests and native/browser evidence distinguish UI fixtures from live endpoints and never mark release gates passed without evidence.

**Implementation work breakdown:** [GUEST_MODE_IMPLEMENTATION_MAP.md](GUEST_MODE_IMPLEMENTATION_MAP.md).
