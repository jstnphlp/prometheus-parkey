# Parkey — Material 3 motion-only acceptance and QA

**Applies to:** [motion-only brief](MATERIAL3_MOTION_ONLY_BRIEF.md)  
**Mode:** implementation verification checklist, not a release pass.  
**Baseline:** repository `main` and its two existing magenta themes. Figma Material 3 page is a motion reference **only**.

## Required evidence before coding

- [ ] Read `AGENTS.md`, `.agents/skills/ux-psychology/SKILL.md`, V1 plan, motion brief, and inspect actual current branch/working tree.
- [ ] Identify production entry path (`apps/mobile/src/app/index.tsx`) and pilot flag/branch. Do not assume the legacy Explore screen is what ships.
- [ ] Identify existing route/sheet/overlay animations; log current duration, gesture handling, use of `MotionView`/`MotionPressable`/`SelectionPop`.
- [ ] Record before screenshots for onboarding 1–3, Explore/map, search, details and settings in Light + Magenta and Dark + Magenta when available. If unavailable, explicitly mark unverified.
- [ ] Document expected animation boundaries; distinguish prototype-only behavior from current production functionality.

## Motion and state test matrix

| Area | Scenario | Pass condition |
| --- | --- | --- |
| Splash | Fresh app start, persisted theme, slow theme/storage/font hydrate | No early native splash hide, wrong-theme flash, blank or double splash; no artificial wait |
| Onboarding | Welcome → Discover → Compare → Navigate; Back; Skip; Continue | Smooth coordinated step motion; same routes/labels/assets and exact progress; completion/guest behavior unchanged |
| Onboarding | Rapid Next/Back; rotate; low-height screen; 150% font size | No duplicated push, skipped page, stuck lock, misplaced art or clipped controls |
| Reduced motion | Android system Reduce motion enabled **at cold start and while app open** | Translation/scale removed or substantially reduced; still immediate feedback; accessibility state preserved |
| Map → search | Enter/close search with keyboard | No map remount/marker flash; query and camera preserved; keyboard/focus accessible |
| Map ↔ list | Switch both directions while filters and selected parking exist | Motion is subtle; no data, selection, scroll or camera resets |
| Filters | Open/change/apply/close; Back | No ghost hit targets, stale panel, lost filters or flickering labels |
| Map pin/details | Select/deselect repeatedly; open details; Back | Single interruptible selection effect; no geographic marker jumps, unverified data remains truthful |
| Discovery sheet | Drag/fling/interrupt; keyboard and wheel where applicable | Snaps reliably; no double-spring or panel following the finger with unexpected lag |
| Navigation | Directions option, consent prompt, in-app route/external handoff, Android Back | Authorization/consent unchanged; route not reset; only actual available action animates |
| Tabs | Explore / Saved / Profile repeatedly | Active state legible immediately; no new layout or tab content remount side effects |
| Appearance | Toggle Light/Dark with map/detail open | Existing palettes unchanged; no screen blanking or resetting map/search/saved data |
| Auth/settings | Form error, keyboard, keyboard Back, modals | No hidden interactive overlays, lost focus or validation/verification change |
| Error/empty | Offline, retry, location denied, no results, report errors | Messages readable; no repeated entrance motion on every state tick |
| Background/resume | Interrupt animation then minimize/resume | No stuck opacity/transform or stale navigation callback |
| Web | Browser Back/Escape, pointer/click, reduced motion | Functional fallback without native-only crashes or layout jank |

## Strict non-regression contract

- [ ] **Visual identity unchanged:** screenshot comparison of steady-state screen composition: same copy, palette, fonts, cards, controls, positions, map provider and assets. Only in-between frames differ.
- [ ] **Behavior unchanged:** app functionality, data requests, permission gates, auth, onboarding completion, report consent, saved data, public/private record separation, route approvals unchanged.
- [ ] **Map stays live:** no artificial MapLibre tile reload or remount when a search, bottom sheet or full-page panel appears.
- [ ] **No accidental interaction:** exiting overlays do not remain tappable/in accessibility focus; invisible screens cannot intercept touches.
- [ ] **Reduced motion:** no decorative translation/scale and no forced background motion.
- [ ] **Small diff:** do not introduce Reanimated/Moti or a router rewrite merely to show effects; no unnecessary dependencies, assets, schema or config edits.
- [ ] **No false UI assertion:** do not claim Figma Material 3 *visual redesign* is implemented.

## Required local checks

Run targeted commands where the environment supports them, using the pnpm version pinned at repository root:
1. `pnpm --filter @parkey/mobile typecheck`
2. Scoped ESLint/Prettier on changed source; use root scripts per `AGENTS.md`.
3. Targeted existing onboarding/discovery unit tests and new targeted tests for interruption/cleanup or transition state if warranted.
4. Native Android emulator smoke: launch → welcome → onboarding → Explore; Search ↔ Map; select parking → details → Back; repeated tabs, plus system Reduce motion and Android gesture Back.
5. If feasible, mobile browser smoke, focused keyboard, overlay and Back/Escape behavior, both theme modes.
6. Check performance qualitatively; gather frame timing only if measurable on actual runtime. **Do not claim 60fps without evidence.** Any native build/device tests not run must be clearly labeled.

## Deliverables for PR description

- [ ] A compact table: component/screen, previous transition, new transition, duration/easing, reduced-motion behavior.
- [ ] One or more genuine recordings or screenshot pairs if runtime permitted; otherwise an explicit evidence limitation.
- [ ] Checks run, commands, pass/fail/skips, Android/web coverage and unchanged-UI statement.
- [ ] UX psychology: reduced friction by continuity and truthful progress; ensure guest access and controls unchanged; mark untested effectiveness as hypothetical.
- [ ] Explicit remaining issues, performance concerns, and conditions needing real-device confirmation.
- [ ] PR targets **main**; no self-merge/deploy/store release.

**Ready for review when:** P0 onboarding feels cohesive without changing any stationary screen appearance; P1 transitions function on active runtime paths; reduced-motion and Back behavior have evidence; existing product functionality remains intact.
