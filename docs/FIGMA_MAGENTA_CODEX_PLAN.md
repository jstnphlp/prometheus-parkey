# Codex execution plan — Figma Interactive Architecture (two magenta modes)

Entry references: [architecture](FIGMA_MAGENTA_INTERACTIVE_ARCHITECTURE.md), [all 60 paired screens](FIGMA_MAGENTA_SCREEN_INDEX.md), [exact tokens](FIGMA_MAGENTA_DESIGN_TOKENS.md), [V1 scope](V1_EXECUTION_PLAN.md), root `AGENTS.md`. Figma URL: https://www.figma.com/design/UaU1KMJV2tMlwGB7Y1Co1g/Parkey-Initial-Design?node-id=244-2804

**Status:** documentation/specification only; no app-code migration, backend release, or test completion is claimed here. These phases are guidance; none overrides V1 scope or constitutes authorization for unrelated backend/deployment changes.

## Working agreement

1. Read `AGENTS.md`, canonical V1 plan, discovery docs, all three magenta handoff docs; inspect the current Expo tree and current PRs before modifying. Run `git status` and never overwrite local work.
2. Use the connected Figma MCP to get **high-fidelity node context and screenshot** of each paired screen and its essential children. Refer to exact IDs in the screen index. Node `244:2804` is the page; fetch leaf frames rather than dumping the whole canvas. Review the two architecture route boards and canonical journey. Test real interactions, not decorative flow connections.
3. Make a brief existing-vs-Figma feature gap table. Classify each screen as **V1 ready**, **V1 UI with controlled gating**, **requires backend/consent**, or **out of V1**; retain references for deferred screens. Never implement fake auth, public inventory, live parking availability, or booking.
4. Work in staged PRs (or self-contained commits), each buildable/testable. Maintain the existing discovery map and provider code. No speculative UI framework/large navigation rewrite. Use React Native/Expo Router/StyleSheet and existing shared primitives.
5. Existing `src/app/index.tsx` selects the pilot experience when `EXPO_PUBLIC_PILOT_DISCOVERY_ENABLED=true`. Address **both active runtime branches** or explicitly and safely consolidate only with owner authorization; no invisible theme mismatch on production pilot builds.

## Delivery order

### Phase 0 — inspection, screenshot inventory, functional gap analysis
- Read tokens, route boards, all paired frame IDs and representative metadata. Inspect actual source: `palette.ts`, `ui.tsx`, `typography.ts`, `explore.tsx`, `pilot-discovery.tsx`, `bottom-navigation.tsx`, `discovery-sheet.tsx`, map renderers, account/security/report source.
- Record screenshot baselines for representative splash, welcome, discovery map/list, search/filter, selected parking, details, direction, saved, appearance, permission and error states in **both modes**. Mark which app components already exist and which flows need approval.
- Produce a traceable PR checklist against the 60-pair index. Do not edit Figma canvas unless explicitly requested.

### Phase 1 — centralized themes + typography
- Introduce a single reactive semantic theme provider/model; store two choices `light-magenta` / `dark-magenta`. Use exact color table, semantic aliases, metrics and Outfit fonts (include properly licensed static assets; verify Expo font loading).
- Update shared primitives, buttons, text/input, bottom navigation, sheets, cards, status bar, toast, map controls, feedback, and native/web map styling as appropriate. All touch targets retain accessible roles/labels, focus states, press feedback.
- Add Appearance view or entry in account/local settings (ref `16A`) with only two functional choices; save selection on device, restore at launch, honor reduced motion and contrast. Test theme switch while a sheet, destination, saved state or navigation is active. No data reset.
- Acceptance: both modes match the reference **without changing business logic**; color role tests, persistence/relaunch tests, visual screenshots on browser and an actual native runtime.

### Phase 2 — discovery screens and real flow
- Apply Figma patterns to **21, 22, 22A/B/C/R, 23/24 (truthful data), 25–30/30R, 26/26A/26B, 27–29 and EXT**, with no replacement of real map or invented listing properties.
- Preserve existing filter/ranking/attribution, stale-request guards, cache, geometry, permission-denial behavior, map selection and route/entrance authorization. Navigation remains within existing provider/consent limitations.
- Search, map/list switching, saved empty/list, selected marker, share, directions chooser and route Back/close must work end-to-end on both modes. Reconcile Figma nav with current app's existing sheet and panel model rather than duplicating two parallel user journeys.
- Acceptance: native/browser regression, data-trust checks, network/offline/empty/loading recovery, screenshot comparison on both themes.

### Phase 3 — optional entry and account UI (gated)
- Translate **1/1B/2–5** visuals and auth-entry choices only if browsing without account remains immediately accessible, splash does not block, and onboarding can be skipped; never display an unimplemented sign-in method as working.
- Map **6/6A, 7/7A/7B, 8–13, 14/15/73/74, 17/17A/18/18A/18B/19, 77–85, 78A, 5P** to an audited integration matrix. The reference includes optional account/profile paths **not currently part of discovery-only V1**. Do not force required onboarding questionnaire or vehicle collection onto guests. Security, email delivery, OAuth, deletion, storage/retention and social sign-in need explicit product/backend approval and real integration before enabling. Decorative screens may be documented or kept gated; never fake success.
- Existing verified-email intake for manually submitted private reports is **not** equivalent to full account onboarding or a universal application login. Preserve report consent and operational gates.
- Acceptance: only active paths are testable; unavailable ones have truthful notices/disabled affordances, no dead buttons, no unauthorized network calls.

### Phase 4 — release evidence and handoff
- Run targeted typecheck/lint/unit tests first, then relevant browser/native flows; perform Android Back, iOS/Android safe-area/keyboard checks, accessibility, large text, dark/light status bars, reduced motion, permission denied, route provider errors and offline recovery.
- Measure and screenshot appearance for every **enabled** screen, in both modes. Record exact Figma node ID, app implementation, behavior, visual match, test command/result and device used. Record screenshots/links in the PR. Never claim device tests that did not run.
- Update docs for actual implemented functionality only. Do not mark canonical V1 release gates passed without their separately required evidence; do not deploy or mutate backend.
- Deliver final summary listing touched paths, confirmed pass/fail counts, remaining gaps, deferred/back-end work and exact branch/PR/SHA.

## Acceptance matrix

| Area | Required acceptance |
|---|---|
| Two themes | Exact Figma token values, appearance persistence and no state reset; 2 reference screenshots per active screen |
| Typography | Outfit styles and readable adaptive text, no truncated inputs or platform-specific layout bugs |
| Splash / welcome | No indefinite screen; guest can directly use discovery, intro skip works if introduced |
| Map / list | Consistent published-only records, filters, destination, selection and visible required attribution |
| Search / permission | Real provider and clear failures; GPS denied still allows manual search |
| Preview / details | Unknown availability stays unknown; no fake ratings, fees, photos, verification or parking permission |
| Saved / share | Persist and restore expected local data; meaningful share content and feedback |
| Routing | Existing consent, provider configuration, reviewed entrance, GPS/Back handling and degradation intact |
| Account screens | Only approved integrations are enabled; no fake auth/OTP/OAuth, profile storage or deletion |
| Regression | Browser + native smoke, focus/Back/reduced motion/a11y and visual comparison, documented evidence |

### Hard stop / escalation rules

Stop that specific feature and report a blocker if it requires new Supabase schema/auth wiring, secret configuration, outbound messages, publishing data, external route/commercial provider access, personally identifying profile data, or release/deployment approval. Continue safely on independent UI/theme work. Figma's "Parking Available" mock is **not** permission to introduce V1 vacancy claims. Appearance in the Figma reference lists four themes; this user request is **two magenta modes only**. No adding teal modes or feature flags just for the four-way demo.
