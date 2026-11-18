# Parkey — Profile Setup & Research Survey: Codex Implementation Brief

**Owner decision:** 2026-11-18. **Status:** approved implementation specification; **this document does not implement code**.

## Required reading / precedence

1. Root `AGENTS.md`, `docs/V1_EXECUTION_PLAN.md`, `docs/FIGMA_EXACT_UI_CODEX_BRIEF.md`, and `docs/FIGMA_MAGENTA_INTERACTIVE_ARCHITECTURE.md`.
2. `.agents/skills/ux-psychology/SKILL.md`, `references/principles.md` and `references/audit-template.md`.
3. `docs/PROFILE_SURVEY_DATA_CONTRACT.md` (required for age removal, consent, schema, privacy).
4. Exact paired Figma **Light + Magenta** / **Dark + Magenta** screen nodes in `docs/FIGMA_MAGENTA_SCREEN_INDEX.md`, especially 6–13, 16/16A, 77 and account/auth settings. Use inspected screenshots/design context before claiming visual fidelity.

**Authority order:** V1 discovery-only contract, privacy/auth/data correctness > approved Figma composition and Outfit/magenta tokens > UX-psychology enhancements. Figma's old requirement to force 5 profile stages before discovery is superseded by this owner's approval to permit exploration without finishing the survey; the approved Figma *visual design* remains the starting point.

## Decision summary

- **Keep the questionnaire.** It exists to collect potentially useful, voluntarily supplied research responses; do **not** delete occupation, residence city, driving purpose, driving frequency, typical parking duration, vehicle types, or parking preferences.
- **Remove age range completely from active UI, validation, new submissions and personal-info edits.** See the data contract for legacy values.
- **Reuse the verified/full name collected during registration; don't ask it twice.** If an OAuth/legacy profile genuinely lacks a valid name, request it once as a short field in the first step, not as a separate age/name page. Do not invent defaults.
- Change the five-step account setup to **four meaningful survey steps** (vehicle → about you → driving habits → parking preferences) plus a truthful confirmation state. All remaining answers are required for a **completed survey**, but completion is **not required to browse Parkey**. This preserves full responses from completers while retaining V1 anonymous and signed-in discovery.
- On the account-setup route, supply an unobtrusive `Explore without setup` or `Finish later` exit that works for signed-in users; the existing welcome/register/login guest route stays functional. A skipped survey is explicitly **incomplete**, never marked as complete or submitted as a full research response.
- Offer a single contextual `Complete your profile` entry within Profile/Account for incomplete signed-in users. Do not nag via repeated modals or artificially block Saved, Map, Search or Directions.
- Preserve truthful security behavior: verified authentication for profile saves; no new fake submissions, fake backend confirmations, release flags, or hidden automatic data collection.

## Flow & expected interaction

```text
Splash / Walkthrough (skippable)
    ├─ Explore parking ────────────────────────────> Discovery (no account required)
    └─ Sign up / Sign in ── verified session ──> Intro to optional profile survey
                                                     ├─ Explore without setup ─> Discovery
                                                     └─ Start setup
                                                          Step 1: Vehicle types [+ name if missing]
                                                          Step 2: About you (work, city, driving purpose)
                                                          Step 3: Driving habits (frequency, duration)
                                                          Step 4: Parking preferences
                                                          └─ Save & verify server response
                                                              ├─ Success → Explore parking
                                                              └─ Failure → preserve draft + retry
Profile → Complete profile (if incomplete) → restore confirmed choices and continue
Profile → Personal information / settings → view/edit available profile fields
```

### Screen-by-screen specification

**Entry:** Title `Make Parkey yours`; concise, accurate explanation: `Tell us about your vehicle and parking habits. Your answers are saved to your account. You can finish later and still explore parking.` If research analysis is actually enabled with valid consent/data policy, distinguish research use from personal account storage. Do not claim answers affect recommendations unless real matching behavior has been implemented. CTA `Set up my profile`; secondary `Explore without setup`. Prefer an inline intro on the first survey step rather than an extra progress-counted page.

1. **Vehicle:** Title `What do you drive?`; multi-select the existing 6 vehicle categories with licensed Figma images, clear selected/unselected state and `Choose all that apply`. State the honest benefit (`Tell us what kinds of vehicles you park`), not a fabricated vehicle-specific availability filter. Name appears only if not already valid.
2. **About you:** Title `Tell us about your driving life`; preserve **occupation**, **city of residence**, and **driving purpose** with existing choice sets and `Other` text fields. Avoid pretending that city of residence is current GPS or a search default; treat as survey data. No age question.
3. **Driving habits:** Title `Your driving habits`; preserve **frequency** and **usual parking duration**, editable single-select choices.
4. **Parking priorities:** Title `What matters when you park?`; preserve **covered parking, 24-hour access, EV charging, accessible parking** multi-select (at least one for a completed survey). Keep labels honest: preference alone does not prove a facility offers that attribute. If genuine existing filters can match known records, show their relevance without promising complete data.
5. **Success:** Show only after the real verified profile-save response; `You're ready to explore`, concise `You can update your answers in Profile`, CTA `Explore parking`. Returning fully completed users should not be forced through a fresh questionnaire; edits should take them to relevant profile fields.

### Smart defaults, progress & motion

- Prefill only from verified account metadata and previously saved responses. Do **not** preselect one vehicle or preference just to show progress; show accurate empty state where nothing is known.
- Show `Step X of 4` and a consistent four-segment indicator in **both** themes. Progress must reflect **steps actually completed**, not count visited steps as answered. A page index may be labelled independently from completed steps; don't show `100% complete` until save succeeds.
- Use the existing `discovery/motion.tsx` primitives (`MotionPressable`, `SelectionPop`, `MotionView`, `useEntranceProgress`) as applicable. Target short **180–240ms** enter/step transitions; animate selection feedback without moving hit targets or causing layout jitter. Respect `useReducedMotion`; never require animation to see state changes.
- Selection cards and check states use **semantic theme roles**, not hardcoded mint/teal `#E8F7F4`/`#E0F5F0`; implement the Light + Magenta / Dark + Magenta pairs with approved Outfit typography. Preserve responsive layout, text scaling, focus, screen reader labels and 44px+ hit targets.
- Keep entered values when stepping backwards, switching themes, submitting/failing, and safely navigating away. If persisting an unsent personal survey locally, use an approved secure per-user storage strategy, an explicit expiry/cleanup path and no background upload; otherwise keep state in-memory and warn of genuine unsaved-data loss when relevant. Never state `saved` before server confirmation.
- Allow Android Back/iOS gestures, keyboard return, scroll-to-first-error and explicit `Other` corrections. Validation feedback should be field-local for actionable form inputs; use the shared popup for server-level errors, no dense repeated paragraphs.
- Make disabled, loading, missing permission/provider, offline and session-expired states truthful and retryable. Do not redirect a guest or incomplete signed-in user away from discovery.

## Implementation scope / code map

Inspect current code before editing; files may have moved:

- `apps/mobile/src/onboarding/profile.ts`: remove age from active type/choices, required steps, normalization, completion and serialization; map 4-step validators; handle older metadata.
- `apps/mobile/src/onboarding/account-setup-screen.tsx`: optional survey entry/exit, correct 4-step state, errors, server save, back behavior, and no false success.
- `apps/mobile/src/onboarding/profile-setup-form.tsx`: 4-step UI, copy, Figma parity, 2-mode styling, checkboxes, accessible progress and motion.
- `apps/mobile/src/auth/profile-save.ts`: preserve verified-account server confirmations and registered name; enforce complete responses for explicit completed-survey saves.
- `apps/mobile/src/settings/personal-info.tsx` and `apps/mobile/src/auth/personal-info.ts`: no age field/age validation/age write; preserve other saved survey answers and avoid reintroducing legacy age on updates.
- `apps/mobile/src/settings/account-menu.tsx`: honest optional `Complete profile` entry (if incomplete); no fabricated progress or synced saved-parking promises.
- `apps/mobile/src/auth/signed-in-redirect.tsx`, auth entry routes and account navigation: direct discovery without forced profile setup; no auth bypass and no interference with email verification.
- Relevant `*.test.mjs` and browser E2E tests: adjust fixtures/expected progress, validate guest and signed-in behavior.

Do not modify unrelated map, routing, admin analytics, Supabase migrations, production deployment or Research Console integrations to complete this task.

## UX psychology checks

| Principle | Concrete application | Boundary |
| --- | --- | --- |
| Smart defaults | Verified name/previous responses; reversible controls | No guessed survey answers or prechecked consent |
| Goal gradient | Four honest survey steps + accurate saved state | No false completion on visit/skip or failed write |
| Reciprocity | Parking discovery accessible even before profile | No fake personalized results |
| IKEA/endowment | Vehicle images and personal preference selections | No unnecessary mandatory decoration |
| Loss aversion | Only warn if exiting would actually lose unsaved answers | No guilt, fake scarcity, or misleading deadlines |
| Contrast | Legible category options / clear selected states | No misleading availability or pricing claims |

## Codex delivery and verification

1. Read all required docs, inspect branch, relevant source and existing PR stacks. Create a focused feature branch from the **appropriate latest implementation branch**, avoiding overwriting ongoing Figma work.
2. Implement end-to-end; update active types, routes, state, persistence and tests, not merely mock screens or an audit/prompt.
3. Unit tests: complete survey accepts all remaining answers/no age; missing required response fails a **completed survey**; unknown values and `Other` validation fail; legacy `ageRange` ignored/stripped on new writes; verified name reused; saved profile rehydration; failed save retains draft; session/account mismatch rejected; nonresearch-consent path does not cause unauthorized aggregation.
4. Flow tests: guest discovery; signed-in skip setup; resume incomplete questionnaire; already-complete account; back/forward retention; safe theme switch; keyboard/errors; offline retry; route guards; no false success or personal data logging. Run reduced-motion and accessibility checks.
5. Run targeted tests, mobile typecheck, lint and format checks. Run relevant browser and Android smoke where feasible and record actual commands/results; never claim unrun tests.
6. Provide light/dark screenshot comparisons **against inspected Figma nodes** for changed views; distinguish intentional removal of age and optional skip from visual parity issues.
7. Open PR with changed files, accurate screenshots/links, test evidence, explicitly deferred research analysis/consent and legacy-data cleanup work. **Do not merge/deploy** without a separate request.

## Acceptance checklist

- [ ] Age is absent from setup, profile editing, active types, validators and new serialized writes.
- [ ] All other original survey questions remain accessible and required to **complete** the survey.
- [ ] Profile name is reused; missing name is collected once.
- [ ] Optional skip/finish-later and unrestricted guest/signed-in parking discovery work.
- [ ] Four stages and success route are functional, with accurate completed-step state.
- [ ] Server-confirmed save only; never fake research collection or completion.
- [ ] Both magenta themes match paired Figma styling with no mint/teal regression.
- [ ] Motion, reduced motion, Back, text scaling, focus and screen reader paths work.
- [ ] Consent and privacy boundaries in `PROFILE_SURVEY_DATA_CONTRACT.md` are respected.
- [ ] Tests and PR evidence accurately reflect what was exercised.
