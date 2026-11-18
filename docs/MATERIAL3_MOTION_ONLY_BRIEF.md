# Parkey — Material 3 motion-only implementation brief

**Status:** implementation handoff; no app motion changes are made by this document.  
**Date:** 2026-11-18  
**Repository:** `jstnphlp/prometheus-parkey`  
**Scope:** Android-first motion and transition behavior across the **existing** Parkey mobile experience; web parity where practical. **This is not a visual redesign.**

## User directive (highest priority within approved V1 scope)

> Implement the **motions** inspired by Google Material Design 3 and the new Parkey Figma prototype **on my current Parkey setup**, **not its UI**.

Do **not** copy Figma's new rounded components, typography, wording, layout, colors, theme palette, map illustration, sizing, navigation architecture, buttons, or 25 screen compositions into the app. Current app screens and established **Light + Magenta / Dark + Magenta** designs remain exactly as shipped at the chosen baseline. No unrelated visual polish. This supersedes any implication in older Figma *visual parity* instructions that this task should replace existing screen layouts.

The design reference contains **interaction intent and timing examples, not executable production animations**:
- [Figma: Parkey — Main UI Flow / Material 3 Expressive, Explore start](https://www.figma.com/design/UaU1KMJV2tMlwGB7Y1Co1g/Parkey-Initial-Design?node-id=402-194).
- Existing prototype has linked screen transitions using approximately **320 ms / Smart Animate / ease-out**. Implement equivalent *behavioral polish* only where it works in the current navigation architecture.
- [Google Material Design 3 motion guidance](https://m3.material.io/styles/motion/overview); review the latest authoritative guidance before introducing any platform-specific motion API.

## Required reading and authority

1. `AGENTS.md`, including the mandatory UX psychology skill `.agents/skills/ux-psychology/SKILL.md` and `.agents/skills/ux-psychology/references/principles.md`.
2. `docs/V1_EXECUTION_PLAN.md`, `docs/V1_ANALYTICS_CONTRACT.md` and actual product/privacy/permission constraints.
3. This brief and [motion acceptance checklist](MATERIAL3_MOTION_ACCEPTANCE.md).
4. Inspect the **current main-branch** code and active mobile runtime routes before editing. In particular:
   - `apps/mobile/src/app/_layout.tsx`
   - `apps/mobile/src/onboarding/{splash-screen,welcome-screen,onboarding-screen,use-reduced-motion}.tsx/ts` and `use-completion.ts`
   - `apps/mobile/src/discovery/{motion,use-reduced-motion,bottom-navigation,explore,pilot-discovery,use-pilot-panels,architecture-discovery,discovery-sheet,sheets}.tsx/ts`
   - Current account/settings/search/parking-details screens and relevant tests.
5. Existing magenta visual handoff docs are **non-editable layout references**. The current running UI, rather than the redesigned Figma frames, is the visual baseline for this assignment.

## Non-goals and guardrails

- No changes to colors, fonts (Outfit), font sizes, spacing, radii, illustration assets, words, visual hierarchy, screen geometry, safe areas, bottom navigation structure, or responsiveness. No wholesale component migrations.
- No business logic changes, navigation-route rewrite, new tabs, new permissions, new map provider, backend/auth/storage/Supabase changes, analytics changes, network calls, or data changes. No reservation/booking/payment/live availability.
- Do not mask data loading with a timed animation, add artificial delays, or block entry to guest discovery.
- Preserve signed-in / guest state, saved places, selected parking, search query, filters, camera position, scroll state, reporting drafts, consent, and Android Back/gesture behavior.
- Do not animate/recreate the MapLibre view on every overlay transition, trigger map tile reloads or unintended geolocation requests, or change authorized entrance/route behavior.
- No giant motion framework dependency for simple opacity/transform transitions. Reuse existing `Animated`, existing motion primitives, native stack transitions and established sheet springs. If a new dependency is genuinely necessary, justify it with measured evidence, Expo 58 compatibility, bundle/native build impact and lockfile changes before adding it.
- Motion must not decrease screen-reader usability, cause focus loss, break keyboard handling, render content behind dismissing overlays, or leave invisible interactive layers.
- Support Android reduced-motion, interruption, fast repeated input, background/foreground changes, low-end devices and the web fallback. Respect app preferences already in place.

## Current starting point (verify against working branch)

These observations were made from the repository's active source on 2026-11-18; verify before changing:
- `src/app/_layout.tsx` already chooses `slide_from_right` onboarding routes and `fade` for Welcome, with reduced-motion alternatives.
- `src/onboarding/onboarding-screen.tsx` uses `router.push` across 3 walkthrough steps and static PNG illustrations. The progress bar/dots, heading, copy and illustration **do not themselves coordinate** with navigation motion.
- `src/onboarding/splash-screen.tsx` displays the logo while fonts/theme/onboarding state hydrate.
- `src/discovery/motion.tsx` supplies `MotionPressable`, `MotionView` (220 ms / 8px entrance), and `SelectionPop`; **reuse/refine**, don't add parallel ad-hoc animation helpers.
- `src/discovery/discovery-sheet.tsx` already uses a physics spring and gesture snapping. Preserve the snap/drag interaction.
- `src/discovery/bottom-navigation.tsx` uses `MotionPressable` but not a persistent active-indicator motion.
- The default and pilot discovery paths can differ; inspect `src/app/index.tsx` and `pilot-config.ts` before scoping shared changes.
- There are separate onboarding and discovery reduced-motion hooks. Their behavior must remain reliable across preference resolution; consolidation is optional only if a clear bug exists.

## Motion token proposal (targets; tune after device checks)

Motion conveys **continuity, hierarchy, and immediate feedback**, never entertainment for its own sake.

| Token / context | Proposed duration | Curve / behavior | Reduced-motion equivalent |
| --- | --- | --- | --- |
| Tap or pressed feedback | 80–120 ms in, spring back | Subtle scale/opacity, no layout shift | Instant state feedback |
| Navigation between related pages | 260–340 ms | Directional slide, ease-out; reverse on Back | Short dissolve or instant |
| Discover / onboarding step transition | 320–420 ms total | Existing route slide + coordinated content fade/short translation | Instant contents; no large motion |
| Entrance content reveal | 180–260 ms | Opacity + 6–12px translation, optional 40–90ms stagger | Direct display |
| Bottom sheet open/close | Existing spring; settle quickly | Preserve drag velocity and snap points; no stacked spring | Immediate snap |
| Map pin selection | 150–240 ms | Gentle state/scale emphasis; no bouncing marker geography | Static selected styling |
| Search / filters / details overlay | 200–300 ms | Fade + short translation; reverse on close | Instant or short dissolve |
| Tab selection indicator (if current indicator supports it) | 180–260 ms | Smooth shift/resize **inside existing bounds** | Instant indicator |
| Confirmation/toast | 160–240 ms | Brief non-blocking fade/slide | Immediate appearance |
| Theme switch | <= 220 ms when safe | Optional surface fade only, avoid map remount/flash | Immediate mode switch |

These are tuning ranges, not rigid animation mandates. Prefer predictable motion over animating every element. Maintain perceived response to taps immediately; do not let cumulative stagger make navigation feel slow.

## Implementation priority / exact behavior

### P0 — First launch and onboarding (fix the original complaint first)
- Preserve exact current splash image, welcome layout, onboarding PNGs, three-step order, copy, indicator sizes/positions and `Next`, `Skip`, `Continue` behavior.
- Splash → Welcome or discovery: smoothly hand off as hydration completes, without extra splash hold or double fades. Never hide native splash before app content is ready.
- Walkthrough: preserve Expo Router route semantics. Animate **content within** the existing screen: illustration slightly settles; title and copy fade/translate; existing progress indicator smoothly updates without changing its resting geometry.
- Outgoing and incoming animations must not produce an empty frame, double animate, or flash. Forward/Back directions should feel consistent. Guard rapid Next presses while transition is in flight without blocking Skip or making Back ineffective.
- If a single carousel is proposed, **do not** refactor routes into one as part of this brief unless demonstrably required to solve a reproducible bug; keep the existing router stack first.
- Respect keyboard, resize, font scaling, scroll positions, screen reader accessible labels, and offline onboarding completion.

### P1 — Discovery, map, search and details
- Animate **overlay/panel presentation** while keeping map/data components mounted: map ↔ search, filters, map ↔ list, pin preview ↔ details, directions choice, saved/profile/settings (only where current state machine supports a safe transition).
- Prefer subtle transitions to animated full-screen map sliding. Never animate map coordinates/markers without synchronizing the native MapLibre camera state and provider capability.
- Preserve the existing bottom navigation visual design. If adding active selection motion, animate an existing selection/background only; do not redraw tabs, add elements, or alter touch sizes.
- Preserve map-sheet PanResponder behavior and native/web wheel, keyboard, and resize handling. Improve jank only when reproducible; do not replace the entire sheet.
- Keep `MotionPressable` tactile feedback and `SelectionPop` selection response restrained and interruptible.

### P2 — Settings, auth, feedback and recovery
- Apply consistent short entrance/exit transitions to full-page settings, appearance, account entry, dialogs, empty/error states and report review **only if present in active routes**.
- Maintain exact validation copy, focus order, real Supabase authentication, guest accessibility, notification and permission prompts.
- Keep toasts/errors visible long enough to read, and do not animate away ongoing errors because unrelated data refreshed.
- Avoid distracting repeated animations during location updates, loading retries, network changes or route guidance.

## Architecture strategy

1. Audit existing animations, screen stack, active pilot/default discovery and mounting behavior; write a before → after motion map without editing screen composition.
2. Use a small shared motion-token object or augment existing `motion.tsx` only if needed. Prefer `Animated` transforms and opacity with `useNativeDriver` where supported; animation of height/layout may require JS driver but must remain bounded.
3. Preserve existing DOM/native paths; no browser-only API in native code. Avoid `Animated.Value` recreation on every render and unhandled animation cleanup.
4. Interrupt and cancel on unmount, gesture reversal, reduced-motion preference change, screen changes or backgrounding, and prevent animated callbacks from navigating after a stale state update.
5. Ensure animated views' accessibility/pointer-events state tracks logical visibility, not merely `opacity`.
6. Implement P0 first. Add P1 only where there is a measurable improvement and tests do not show regressions; finish P2 selectively.
7. Capture BEFORE/AFTER screen recordings for the same visual states if actual runtime tooling is available. Record what was *really tested* rather than promising 60 fps or native-device acceptance without measurements.

## Completion contract

Read [MATERIAL3_MOTION_ACCEPTANCE.md](MATERIAL3_MOTION_ACCEPTANCE.md) and check every applicable row. Report:
- branch and PR; changed paths; where motion was added; exact unchanged-UI scope and any exceptions;
- before/after evidence, Android/web checks, reduced-motion checks, Android Back and touch-interruption checks;
- performance observations and known gaps (not claims of guaranteed 60/120fps);
- short UX psychology review: **honest progress and clear continuity** for onboarding, **value first** for guest discovery, any other principles skipped as irrelevant;
- no claim that the new Figma UI was implemented, since only motion was authorized.

No deployment, store upload, backend migration, or merge to main is part of this handoff.
