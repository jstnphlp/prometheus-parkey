# Parkey — Guest Mode Implementation Map (Codex Handoff)

**Date:** 2026-11-18. **Status:** staged implementation plan only, not completed code or deployed functionality.
**Product rules:** [guest access contract](GUEST_MODE_V1_ACCESS_CONTRACT.md); [canonical V1](V1_EXECUTION_PLAN.md); [profile survey](UX_PSYCHOLOGY_PROFILE_SETUP_CODEX_BRIEF.md) and [data contract](PROFILE_SURVEY_DATA_CONTRACT.md).
**Base:** [docs PR #42](https://github.com/jstnphlp/prometheus-parkey/pull/42) branch `docs/guest-mode-v1-access-20261118`, built from [simplified UI PR #41](https://github.com/jstnphlp/prometheus-parkey/pull/41) branch `codex/simplified-main-ui`, itself stacked on [survey PR #40](https://github.com/jstnphlp/prometheus-parkey/pull/40) `codex/mandatory-profile-survey`. **While PR #42 is open, branch implementation from the docs branch and target that branch** so the contracts are present in the code branch. After #42 merges into #41, branch from the updated #41 and target #41. Re-check ancestry before starting; do not target `main` prematurely.

## Current implementation facts to preserve

Verified in the PR #41 branch source at the time of writing, **not** fresh device testing:

- `apps/mobile/src/app/index.tsx` already composes `discoveryDestination` with the actual auth/onboarding state and renders the normal or pilot map.
- `auth/setup-access.ts` already distinguishes signed-out, auth checking, verified session, and incomplete post-registration survey. `auth/signed-in-redirect.tsx` routes to account setup when incomplete.
- `onboarding/account-setup-screen.tsx` and `onboarding/profile.ts` implement four mandatory profile stages with confirmed saves; do not create a second survey.
- `onboarding/welcome-screen.tsx` has a direct `Explore parking` entry; keep it discoverable.
- `discovery/main-drawer.tsx` has the new left-side drawer and signed-out `Sign In` footer; its visible actions already include local Saved, Report parking, Appearance, and Help & privacy.
- `discovery/explore.tsx`, `discovery/main-map-ui.tsx`, and `discovery/main-drawer-state.ts` own the simplified map/search/legend/details and associated UI state. Do not replace the map.
- `discovery/use-local-state.ts`, `local-storage.ts`, `contributions.ts`, and report review views already retain device-local state.
- `discovery/report-submission.tsx` has **separate short-lived OTP verification** and a build-time live-intake gate. Its server/API identity assumptions must be audited before changing it.
- [PR #41 evidence](https://github.com/jstnphlp/prometheus-parkey/blob/codex/simplified-main-ui/docs/evidence/simplified-main-ui/README.md) reports map/drawer/browser/Android testing; **not** verification of live account/report submission.

## Sequence / dependency graph

```text
PR #40 mandatory profile survey
              |
              v
PR #41 simplified map + left drawer
              |
              v
PR #42 guest contract + implementation docs
              |
              v
[0] Audit and baseline tests
              |
              v
[1] Centralize effective guest/registered permissions + routing
              |
              v
[2] Guest UX / explicit contribution/account gate + return context
              |
              v
[3] Verified report-send integration audit and safe gating
              |
              v
[4] Browser/native/security regression + PR evidence
              |
              v
Review + merge through the existing PR stack (not production release)

[FUTURE, separate approval] Cloud sync/personalized recommendations
```

## [0] Preflight — baseline and source-of-truth check

**Goal:** avoid rewrites and avoid a branch starting from outdated `main`.

1. Read `AGENTS.md`, this map, the guest contract, V1 plan/analytics, report submissions, survey brief/data contract, and `.agents/skills/ux-psychology/SKILL.md`. Inspect the current actual Figma simplified home nodes and PR #41 evidence before changing layout.
2. `git status` / `git fetch`, inspect PRs #40/#41/#42 and current code; do not override user changes. Branch from `docs/guest-mode-v1-access-20261118` while #42 remains open, or from updated `codex/simplified-main-ui` after #42 merges into #41.
3. Inventory auth states, current guest entry, account drawer actions, local saves, local drafts, Report Review/Send, enabled flags, backend contract, and tests. Create a brief discrepancy matrix against [guest contract](GUEST_MODE_V1_ACCESS_CONTRACT.md).
4. Record baseline targeted tests and screenshots; identify external blockers, especially live email/report intake/provider behavior.

**Gate:** scope, affected source paths and current behavior are documented; no unnecessary new backend/database schema.

## [1] Access policy — reuse auth and existing routes

**Goal:** one consistent effective-access decision, not role simulation.

Inspect and update as needed:
- `apps/mobile/src/auth/setup-access.ts`
- `apps/mobile/src/auth/provider.tsx`, `session.ts`
- `apps/mobile/src/auth/signed-in-redirect.tsx`, `account-screen.tsx`
- `apps/mobile/src/app/index.tsx`, guest/welcome/registration routes
- `apps/mobile/src/onboarding/account-setup-screen.tsx`, only for an actual routing bug

Rules:
- Public map/search/details/filters/saved/directions/local drafts require **no account**.
- Verified signed-in + confirmed survey complete unlocks account-bound operations; incomplete signed-in goes to setup, not map; registered accounts must not use a signed-in skip.
- Handle checking/unavailable/recovery/error safely without inferring identity from a preference flag or blocking truly signed-out public discovery. Sign-out offers a guest path.
- Centralize only genuine duplicated guard logic, preferably using existing helper(s). **Do not** add a second AuthProvider, guest user creation, session token in AsyncStorage, profile-skip switch, new RPC, or fake account status.

**Gate:** unit/route tests cover guest, configured/unconfigured auth, verification pending, incomplete/complete profile, expiry, recovery, sign-out and account mismatch.

## [2] Guest UX — preserve PR #41 home, offer a contextual account upgrade

Inspect/update:
- `apps/mobile/src/discovery/main-drawer.tsx` and `main-drawer-state.ts`
- `apps/mobile/src/discovery/explore.tsx`
- `apps/mobile/src/auth/account-screen.tsx`, `settings/account-menu.tsx`
- Existing popup/sheet controls and navigation/return-intent handling
- `discovery/use-local-state.ts` and `contributions.ts` only if regression fixes are required

Behaviors:
- Preserve full-screen MapLibre, shared hamburger/search row, collapsible icon-only legend, selected parking details, and bottom-positioned account footer; both magenta modes.
- Guest drawer: Saved parking, Report parking, Appearance, Help & privacy work unchanged; account entry clearly offers Sign in/Create account with Back/Not now.
- Guest can draft/review a contribution; **only Send** (and managing sent receipts) triggers an account requirement when live service is enabled. If intake disabled, show existing service-unavailable messaging instead of implying signup alone enables sending.
- A compact dismissible modal at restricted actions explains what account is needed for. `Create account` / `Sign in` / `Not now` controls must all function. No blanket login banner, auto-triggered modal or artificial count limit.
- Preserve local favorites/parked spot and report drafts across guest -> auth -> verified mandatory setup -> map. Ensure Back, dismissal, account-unavailable and map state are meaningful. Resume previously opened **local** report review if technically safe; otherwise clearly link the user back to device drafts without fabricating continuity.
- Preserve sign-out cleanup of sensitive session data; keep intentional on-device public saved content and explain that privacy limitation.
- Use shared popup, real theme tokens/Outfit, accessible labels, 44px targets, reduced motion. No new onboarding questions or changes to survey v2.

**Gate:** guest does the whole discovery journey; dismissing registration does not lose map/search/saved/drafts; neither theme regresses PR #41 composition.

## [3] Report send — security compatibility and release gating

Inspect/update only after audit:
- `discovery/report-submission.tsx`, `report-client.ts`, `contributions.ts`
- Account/auth runtime only if necessary and approved
- [verified mobile report contract](V1_MOBILE_REPORT_SUBMISSIONS.md)
- Relevant tests for server identity, consent, receipts and withdrawal

Important: current report flow uses a **verified short-lived email code/session** and the private Edge Function independently verifies its bearer token. Main Auth login does not by itself establish compatible report-send credentials. Codex must:

1. Distinguish **guest draft** vs **verified signed-in ownership** vs **verified report-service session**. Gate only meaningful server actions; never use a client boolean as server authorization.
2. Propose/use the smallest safe reuse of the existing verified identity flow *only if proven compatible* with the private `mobile-reports` intake, ownership, quota and withdrawal contract.
3. Keep per-report disclosure/consent, 90-day observation window, idempotent `client_key`, attempt state, lost-receipt recovery, own-report status/withdraw, local-only photos, moderation and retention protections.
4. If report service is disabled or integration/backend proof missing, **leave live sending disabled** and local drafts working; record blocker. Do not silently deploy Supabase migrations, Edge Functions, SMTP, Auth templates, turn on env flags, or publish reports.
5. Test unauthorized guest or mismatched-account writes are actually refused at the real server/approved disposable test boundary; UI tests alone cannot establish backend security.

**Gate:** clear evidence that sending remains gated off OR verified end-to-end with approved service. No fake receipts, status, permissions, or submission success.

## [4] QA, privacy and handoff

Minimum verification:
- **Unit/route:** full permission matrix; new vs returning account; incomplete survey; guest recovery after sign-out; no auth or location permission wall on manual search; no cloud sync claims.
- **Browser e2e:** guest cold start -> map -> search -> details -> directions consent; filters/legend; Saved/parked-car persistence after reload; create/review local report; dismiss account gate; auth unavailable/offline; logout does not clear local public data.
- **Account fixtures:** real authenticated routing where available, mandatory four survey steps after verified registration, saved answers rehydrated; re-enter local draft after signup; no auto-send; session expiry and retries. Fixtures are *not* hosted email or production submission evidence.
- **Native:** Android hardware Back, drawer/footer, safe areas, focus/keyboard and map persistence, reduced motion, light/dark snapshots; iOS and physical device if available. Mark any unrun checks explicitly.
- **Security/privacy:** no private data in public reads/events; no guest elevation; report token compatibility; opt-in analytics only; no personal survey upload to analytics.
- **Checks:** targeted tests, `pnpm --filter @parkey/mobile typecheck` (or actual workspace script), scoped lint, format, focused browser E2E; follow repo `AGENTS.md` test discipline. Record actual command outputs.

Deliver: one focused implementation PR **targeting `docs/guest-mode-v1-access-20261118` while #42 is open, otherwise the updated `codex/simplified-main-ui` after #42 merges into #41**; bullet list of changed paths, screenshots paired with source Figma nodes, tests run, actual results, remaining blockers. **Do not merge/deploy without separate permission.** Do not advance V1 release gates just for guest UI completion.

## Stage-by-stage acceptance matrix

| Stage | Deliverable | Must pass before proceeding |
| --- | --- | --- |
| 0 | Code/design inventory and test baseline | Appropriate branch, actual guards and backend state identified |
| 1 | Shared auth/permission decisions | Guest public discovery and required signed-in survey both enforce correctly |
| 2 | Guest/account UI and local context | No new guest login wall; map/drawer/drafts preserved through cancel/upgrade |
| 3 | Report-send identity/gate audit | Real verified owner checks or explicit disabled gate; no fake success |
| 4 | PR, tests and visual/native evidence | Regressions addressed or explicitly blocked; unchanged V1 guarantees |

## Separate future work — **not part of this change**

Cloud synchronization of favorites, parked-car location, history or preferences would require a reviewed schema/RLS, user-owned APIs, guest-device-to-account migration/conflict/merge policy, deletion/export/privacy rules, offline sync and device tests. Do not scope this into the guest feature.

## Ready-to-run Codex instruction

> Implement Parkey V1 guest mode using `docs/GUEST_MODE_V1_ACCESS_CONTRACT.md` and this implementation map as the acceptance contracts. Read `AGENTS.md`, UX psychology skill, canonical V1 execution plan, verified report contract, and mandatory profile survey docs first. Start from `docs/guest-mode-v1-access-20261118` (docs PR #42, based on simplified UI #41 stacked on survey #40) while #42 is open; if #42 has merged into #41, start from the updated #41 branch instead. Never start from outdated `main`. Audit current code and tests before editing. Reuse the existing signed-out discovery and Supabase auth rather than creating a guest account. Preserve map/search/details/directions/filters, local favorites, parked-car and local contribution drafts without registration. Require a verified registered identity for **sending** reports and owning sent-report actions, but preserve existing report OTP/backend authorization, per-report consent and disabled service gates. Registration must route to the required four-step profile survey, with no signed-in skip and no false server success; preserve local public data during account changes. Match the simplified Figma/PR #41 UI in both magenta themes, including hamburger/search same row, collapsible icon-only legend and drawer account footer. Implement contextual dismissible auth prompts only where needed. Verify route tests, browser/native behavior and report security boundaries with actual evidence, open a focused stacked PR against docs PR #42 while it is open (or against updated PR #41 if the docs merged), and do not merge/deploy or add cloud syncing. If a real backend dependency is unavailable, keep that action disabled, document the blocker and complete independent safe work.
