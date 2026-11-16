# Magenta UI engineering evidence

Date: 2026-11-16. Branch: `codex/figma-magenta-interactive`, stacked on the existing phase-3/auth branch (PR #32). Latest main integrated through `77deb01`. This is an engineering UI increment, not production release approval or complete Figma visual acceptance.

## Checks

| Check                               | Actual result                                                                                                                                                                                                                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile TypeScript                   | Passed (`pnpm --filter @parkey/mobile typecheck`)                                                                                                                                                                                                                                      |
| Mobile source and browser-test lint | Passed (`pnpm exec eslint apps/mobile/src e2e --max-warnings 0`)                                                                                                                                                                                                                       |
| Browser-test TypeScript             | Passed (`pnpm exec tsc -p e2e/tsconfig.json`)                                                                                                                                                                                                                                          |
| Mobile unit tests                   | 327 passed, zero failed/skipped; includes exact 19-role token checks against the offline JSON, contrast and corrupt-preference fallback                                                                                                                                                |
| Desktop discovery browser cases     | 23 distinct cases passed: 20/21 initially; renamed-tab assertion fixed and its one case passed; two added storage-failure/navigation cases passed                                                                                                                                      |
| Mobile discovery browser cases      | 23 distinct cases passed: 22/23 in the final grouped run; one teardown hit a shared Playwright artifact-directory collision while another run started. The affected selected-parking case passed separately with an isolated output directory                                          |
| Pilot browser regression            | 36 passed, desktop and Pixel 7 viewports; includes cache isolation, request races, authorization refusal, offline/private-source guards and entrance reauthorization                                                                                                                   |
| Pilot theme case                    | 2 passed (desktop and mobile); selected public parking and the same map canvas survived both mode changes                                                                                                                                                                              |
| Local Android build                 | `expo run:android --device emulator-5556 --no-bundler` succeeded; 565 Gradle tasks, 1m24s; current JS loaded from credential-free local Metro                                                                                                                                          |
| Native smoke                        | Android 15 / API 35 / x86_64, `Parkey_A0_API35`, emulator-5556. Actual native MapLibre rendered. Both Appearance choices, Android Back from the inline sheet, dark preference after cold restart and 1.3x Appearance text layout were checked. Original system font scale 1.0 restored |

Browser commands: `pnpm exec playwright test e2e/appearance.spec.ts e2e/discovery.spec.ts e2e/search.spec.ts e2e/saved-places.spec.ts e2e/directions.spec.ts --project=<desktop-chromium|mobile-chromium> --reporter=line`, plus the two focused desktop additions and the documented isolated rechecks. Pilot: `pnpm exec playwright test --config playwright.pilot.config.ts e2e/pilot/discovery.spec.ts --reporter=line` and the focused `e2e/pilot/appearance.spec.ts`.

The browser fixtures intercept providers and use explicitly synthetic route approvals. Screenshots show test data and a blank fixture basemap; they prove UI state, not live integration or parking availability. Reduced motion was enabled. No real account success, email delivery, SMS, OAuth provider, private report intake or production navigation approval was exercised.

## Screenshots

All PNGs here are actual application captures, never Figma reference exports or application screen assets.

- `browser/*-16.png`: Profile & Settings, corresponding to Figma 249:2286 / 249:5721.
- `browser/*-16A.png`: inline Appearance, corresponding to 249:4092 / 249:7531, deliberately two choices only.
- `browser/*-17-long-email.png`: existing real login UI with a synthetic 100-character email input; 249:2625 / 249:6060.
- `browser/*-22.png`: discovery state after guest entry; 249:3020 / 249:6455. The map-first drawer remains the existing application presentation.
- `browser/*-23.png`: source-qualified selected record, 249:3217 / 249:6652. No live vacancy.
- `browser/*-30.png`: consented synthetic route after a theme change, dark mode, 249:7222.
- `android/light-magenta-16A.png`, `android/dark-magenta-16A.png`: native standalone Appearance at default text size; inspected visually.
- `android/light-magenta-16A-font130.png`: native Appearance at 1.3x text size; controls and all content remained readable; inspected visually.

Native screenshots containing pre-existing local parked-car state were kept in ignored `output/`, outside this handoff. Existing favorites, car pin and private drafts were not cleared. Browser evidence uses isolated fixture storage.

## Failures retained in the record

Early migration checks caught static-style references, stale generated route types and a nullable native focus target; fixed and rechecked. Browser QA caught the map's retained history listener rewriting other Expo routes, missing web radio state and an existing web-incompatible TextInput focus API; fixed. The default backend test fixture returned no public records despite scenarios requiring them; the fixture now supplies the existing unverified source archive without changing application publication rules.

The installed Android APK initially lacked ExpoWebBrowser. Rebuilding the development client resolved that. Lazy development chunk evaluation later produced Hermes syntax errors; the native renderer now uses a standard import (MapLibre was already in the main graph through the pilot renderer). Cold starts and subsequent theme checks used this code. This is not a measured startup-performance improvement.

An independent focused code review found two contrast defects (dark action icons; NCR map label/halo colors). Both were corrected; regression assertions cover the semantic contrast pairs. The final NCR web effect uses the same fixed map-label palette as native.

## Open acceptance and integration gates

- All 120 offline Figma PNGs and 120 per-screen layout exports are missing. No local FIGMA_ACCESS_TOKEN is configured. No MCP calls were made in the resumed run. Pixel-perfect parity and every-screen visual acceptance remain unverified.
- Full 60-pair implementation/gating matrix: [FIGMA_MAGENTA_IMPLEMENTATION.md](../../FIGMA_MAGENTA_IMPLEMENTATION.md). Many existing flows are states in the retained drawer, not new standalone routes. Not every active state has a screenshot in each mode.
- Profile editing, vehicle CRUD/deletion, questionnaires, phone/SMS, additional languages, outbound support and account deletion remain unavailable. Existing Supabase auth/recovery/OAuth and report intake retain their prior configuration, consent and release gates; no backend or schema was changed.
- Native pilot, native keyboard/auth flows, native route-provider flows, TalkBack traversal, physical devices, iOS and production/release builds were not fully revalidated here. Browser text input, native Appearance and existing unit contracts do not establish those results.
- The pre-JavaScript native splash keeps its configured official branding; the React splash follows the hydrated preference. Basemap tiles remain the existing provider styles rather than illustrative Figma map artwork.
- No canonical V1 gate, production approval, deployment, analytics activation or data publication was advanced.
