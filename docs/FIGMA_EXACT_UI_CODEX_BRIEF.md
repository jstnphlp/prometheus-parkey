# Codex execution brief — exact Figma UI and interaction fidelity

**Owner directive (2026-11-17):** The previous magenta implementation is **not visually faithful enough**. Reimplement the existing Parkey React Native UI to match the **actual Parkey – Interactive Architecture Figma designs**, not merely their colors. This is implementation work, not another audit-only assignment.

**Figma:** https://www.figma.com/design/UaU1KMJV2tMlwGB7Y1Co1g/Parkey-Initial-Design?node-id=244-2804

**Design file key:** `UaU1KMJV2tMlwGB7Y1Co1g`  
**Page:** `244:2804` · **Canonical journey:** `283:3352`  
**Light + Magenta board:** `289:3698` · **Dark + Magenta board:** `289:3905`  
**60 numbered screen pairs / exact node IDs:** `design-reference/manifest.json` and `docs/FIGMA_MAGENTA_SCREEN_INDEX.md`.

## Source-of-truth hierarchy

1. **Figma is authoritative for visual UI, layout, component geometry, user-facing copy, interactive navigation patterns, states, and differences between Light + Magenta and Dark + Magenta.** Use connected Figma MCP to inspect **actual leaf frames and nested components**, and check the corresponding screenshot and design-context output. A token table and screen index are not substitutes for inspecting the designs.
2. User explicitly selects **exactly two** modes: **Light + Magenta** and **Dark + Magenta**. The Figma Appearance screen currently demos four modes; reproduce its styling and layout with **two functional choices only**, changing its copy accordingly.
3. **Existing product/security requirements** in root `AGENTS.md` and `docs/V1_EXECUTION_PLAN.md` still override prototype behavior that would be false or unsafe in V1: keep discovery accessible anonymously, actual published parking only, no booking, payments, QR, live vacancy, fictitious verification, private research publication, or fake authentication/OTP success. Adapt example data labels to real source-qualified records; keep visual _composition_ identical wherever possible.
4. Functional integrations from existing code should be reused and refactored behind the new design. **The old screen composition is NOT authoritative.** Do not preserve the map's giant bottom sheet, inline Appearance modal, old card arrangements, or current navigation layout **when these contradict the Figma UI**.

## Starting point

- `git status`, `git fetch`, and inspect existing branches/PRs; do not overwrite user changes.
- Start a **new feature branch from `codex/figma-magenta-parity-audit`** (contains the prior full implementation + targeted corrections; PR #35 stacks on the implementation branch).
- Read `AGENTS.md`, `docs/V1_EXECUTION_PLAN.md`, `docs/FIGMA_MAGENTA_INTERACTIVE_ARCHITECTURE.md`, `docs/FIGMA_MAGENTA_SCREEN_INDEX.md`, `docs/FIGMA_MAGENTA_DESIGN_TOKENS.md`, `docs/FIGMA_MAGENTA_CODEX_PLAN.md`, `docs/FIGMA_MAGENTA_IMPLEMENTATION.md`, `docs/FIGMA_MAGENTA_PARITY_AUDIT.md`, and `design-reference/README.md`.
- Read the actual active screens/components in `apps/mobile/src`, particularly `discovery/explore.tsx`, `discovery/discovery-sheet.tsx`, search, cards, bottom nav, settings, auth, onboarding, map native/web, and the shared theme providers.

## First use the connected Figma MCP — do not replace it with guesses

- Open the Figma page and its canonical interactive journey, then inspect each **active** pair of magenta frames (node IDs in manifest). Prioritize **1/1B/2–5, 16/16A, 17/17A, 20/20A, 21, 22/22A/B/C/R, 23–30/30R, 26A/B, 27–29** and all active settings routes; inspect gated onboarding/account frames too for accurate future structure.
- Use `get_design_context` and screenshots for each relevant pair, drilling into nested nodes when needed. Record dimensions, margins, paddings, font sizes/weights/line heights, colors, icons, controls, artwork, z-order, bottom navigation, sheet geometry, keyboard/focus states and prototype transitions.
- Save **actual Figma screenshots and layout metadata** under `design-reference/screens/<theme>/<id>.png` and `design-reference/layouts/<theme>/<id>.json` when tooling permits. Update export provenance/index only for files actually exported; no fake snapshots. Prefer local exports on repeated reviews.
- Respect MCP quota and pace calls; reuse paired components and local references. A daily quota blocker can defer new reference inspection, but do not declare uninspected screens pixel-matched. Do not stop independent implementation work because one design node is temporarily inaccessible.
- Use exact Figma assets where licensed/available. Never ship a flattened screenshot in place of a real UI, Figma demo map tiles as geographic truth, temporary asset URLs, or hardcoded sample parking listings.

## Mandatory visual corrections

**Discovery Map — Figma 22.** This must be a **map-dominant screen**, with Figma's search field placement, floating list/filter/recenter controls, visible parking markers and source-qualified attribution, and matching bottom navigation. **The existing expanded sheet must not visually replace the map**. Preserve the working MapLibre native/web map, data queries, marker interaction, privacy and route provider contract beneath this new composition.

**Discovery List — Figma 21.** Implement the Figma's distinct list presentation, search/header, parking rows/cards, **List/Map switch**, spacing, background and bottom navigation. Transition to Map without dropping destination, selected facility, filters or saved state. Do not treat an expanded map drawer as pixel-accurate list parity.

**Parking preview/details/saved/directions/navigation — Figma 23–30/30R, 26A/B, EXT.** Align exact header, card stacking, buttons, iconography, status pills, back behavior, scroll structure, share sheet and directions chooser. Real content replaces mock examples, but the frame geometry should match Figma. Existing reviewed entrances, route consent, real MapLibre, back semantics and saved-item persistence must remain functional.

**Appearance — Figma 16A.** The Figma screen is a **standalone page** with specific title, spacing, preview cards and back treatment. Make the canonical experience match it, offering only Light + Magenta and Dark + Magenta; preserve device-local preference persistence without remounting/losing user state. An inline modal may only remain if the design explicitly calls for it as a separate state and it does not supplant the canonical page.

**Entry/onboarding/auth — Figma 1–13 and 17–19.** Match splash, walkthrough, welcome, form typography, iconography, field dimensions, validation states and authentic flow transitions in each mode. Do not substitute previous phase-3 designs when visibly different. Account/provider-dependent journeys may only advance after real successful auth and must not force signup for V1 guest exploration.

**Settings/profile — Figma 16, 77–85.** Match the actual screen hierarchy and controls. Keep legal/help/account information accurate. Missing backends (vehicle CRUD, extra languages, profile deletion) must be marked as deferred, not represented by fake data/success.

**Theme & typography.** Keep exact 19 inspected semantic color roles and Outfit weights; check every active frame in both modes, including status bar/navigation bar, modal roots, overlays, selection, pressed/disabled/focus/error, and map controls. Never invent extra teal modes; never recolor official logo artwork.

## Implementation approach (execute, don't just report)

1. Build a **Figma-versus-current UI discrepancy matrix** with Figma node IDs, screenshots, current route/component, severity, and owner-approved V1 gating. Treat a theme-color match alone as insufficient.
2. Build/update true reusable RN components reflecting the reference designs: screen scaffold, search field, map controls, bottom tabs, headers/back, list rows, parking cards/details, auth inputs, dialogs and theme previews. Use Expo Router, React Native and native StyleSheet, with responsive safe-area measurements. No Tailwind DOM mock implementation.
3. **Replace** conflicting existing UI composition, especially the map/list drawer layout and Appearance inline modal, while keeping existing data/navigation logic and tests. Update browser Back/Android Back/gesture behavior; do not create parallel inoperable screens.
4. Implement and compare both themes **as explicit paired reference frames**, not an algorithmic dark inversion. Preserve input values, destination, favorites, navigation state and local drafts across theme switches.
5. Capture running app screenshots at the **same viewport size** as the actual Figma frame (e.g. 430×932 where applicable). Compare side by side or with image-diff overlays. Dynamic map/real records may need masked data-only regions; compare _UI chrome, spacing, shape, and layout_ directly. Iteratively fix mismatches until active screens are visually faithful, not just functionally acceptable.
6. Run typecheck, lint, unit tests, browser E2E, relevant native Android smoke and iOS when available. Check safe areas, font scale, touch targets, keyboard, loading, empty/denied/error, screen readers, and no misleading parking availability. Record device/browser and actual results.
7. Commit in reviewable stages and open a **new PR targeting `codex/figma-magenta-parity-audit`** (not `main` until the stacked UI implementation is reviewed). Include before/after screenshots, the reference node IDs, visual discrepancies resolved, test evidence, and explicitly deferred backend items.

## Strict definition of done

- Every **active** reference screen has both a Light + Magenta and a Dark + Magenta visual comparison against a **real Figma screenshot** and a real app screenshot. Screens not inspected/implemented must be explicitly listed as open, never silently marked done.
- The map/list, Appearance, onboarding, auth, selected parking and navigation screen compositions match the selected Figma variants, not the original drawer design.
- Required interactive branches operate using real data/services or truthful gated states; no dead buttons or fictional successes.
- Functional discovery/security integration and platform-specific back/keyboard behaviors regressions are checked.
- Deliver actual code, app screenshots and PRs. **Do not finish with another prompt, screen inventory, audit-only document, or unchanged legacy UI.**

When Figma and existing code disagree about **how it should look and navigate**, follow Figma. When Figma demo content and real product safety/data commitments disagree about **what is operationally true**, preserve the real product contract and document the exception.
