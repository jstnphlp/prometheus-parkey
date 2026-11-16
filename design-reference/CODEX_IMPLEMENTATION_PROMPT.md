# Codex prompt — implement Parkey from the offline Figma reference

Copy everything below into Codex from the `prometheus-parkey` repo. This supersedes the older MCP-first handoff prompt.

---

Implement Parkey's approved Interactive Architecture design in the existing **Expo 58 / React Native / Expo Router** app using exactly **Light + Magenta** and **Dark + Magenta**. The goal is functional, cross-platform discovery with high visual fidelity, not static screenshot rendering.

**Repository:** https://github.com/jstnphlp/prometheus-parkey

**Canonical design file:** https://www.figma.com/design/UaU1KMJV2tMlwGB7Y1Co1g/Parkey-Initial-Design?node-id=244-2804

## First: read source of truth

Pull latest `main`. Read `AGENTS.md`, `docs/V1_EXECUTION_PLAN.md`, `docs/FIGMA_MAGENTA_INTERACTIVE_ARCHITECTURE.md`, `docs/FIGMA_MAGENTA_SCREEN_INDEX.md`, `docs/FIGMA_MAGENTA_DESIGN_TOKENS.md`, `docs/FIGMA_MAGENTA_CODEX_PLAN.md`, and **`design-reference/README.md`**.

Read these local structured sources:

- `design-reference/manifest.json` — 60 paired screens / 120 source Figma frame IDs.
- `design-reference/tokens/figma-tokens.json` — 19 actual magenta light/dark semantic color tokens, spacing and Outfit examples.
- `design-reference/flows/navigation.json` — product-aware flow states and transitions.
- `design-reference/export-index.json` (if present) — evidence of actually exported screenshots and layouts.

The manifest and token JSON are checked in; **screen PNGs, layout JSONs and exported SVGs may not exist yet**. Do not claim they're available without verifying them.

## Figma reading strategy: offline first

1. Use existing `design-reference/screens/<theme>/<id>.png` and `design-reference/layouts/<theme>/<id>.json` first.
2. If missing, run `node scripts/figma-snapshot.mjs --plan` and, if `FIGMA_ACCESS_TOKEN` is _already configured in your local environment_, export only needed screen pairs with `node scripts/figma-snapshot.mjs --screens=21,22,22A,22B,22C,23,24,25 --theme=both`. This uses the **Figma REST API** and obeys its separate rate limits. Never request the secret in chat, print it, log it or write it to a file.
3. If no local token is configured or a REST export is blocked, work safely from the verified tokens, paired IDs, documented flows, existing code and any already exported screenshots. Explicitly report missing visual references rather than inventing layout details.
4. Only call the connected **Figma MCP** if a specific outstanding screen/layer issue cannot be resolved from local reference and MCP is available. Do not loop over all 120 frames via MCP.
5. If new Figma versions invalidate local screenshots, refresh the affected IDs and record provenance; never silently treat stale data as current.
6. Figma PNGs are **comparison references only**, not UI code or substitute map tiles.

## Engineering goals

**A. Exact dual-magenta theme.** Implement a single semantic ThemeProvider or equivalent respecting the existing architecture. Use colors and metrics from `figma-tokens.json`. Persist `light-magenta` / `dark-magenta` without account requirement. Theme changes must not reset search, map, selected parking, saved items, drafts, or navigation. Treat official Parkey logo as a non-recolored asset. Apply to both real runtime branches when `EXPO_PUBLIC_PILOT_DISCOVERY_ENABLED` is enabled/disabled, plus status bar, bottom nav, sheets, modals, maps, errors, controls and overlays.

**B. Typography and components.** Match the Figma **Outfit** font weights/scale and responsive hierarchy. Use RN `StyleSheet` and reusable app components, not Tailwind/web divs or screenshots. Include locally available/licensed font files only after inspecting existing assets. Fix long email-input sizing, inconsistent iconography, overlong inline error text, keyboard and small-screen layout, safe areas, focus/touch targets, accessibility and reduced-motion.

**C. Full allowed functional journey.** Follow the flow graph and the 60-pair index, prioritizing the existing working V1: splash/welcome may be optional and skippable, guest map/list browsing, location denied/manual search, search, filters, empty/error states, selected-parking preview, truthful long details, saved collection, share, entrances, directions chooser, in-app route and recenter, local appearance/settings. Preserve current MapLibre provider, data attribution, route consent, map camera behavior, private draft/report safeguards, cache and stale request protection.

**D. Account and vehicle screens.** Figma also designs registration, OTP, email verified, profile onboarding, vehicles, password reset, security, language, help and logout. Map all reference IDs and classify implementation status; DO NOT enable or simulate absent backend-dependent functionality. In particular, browsing V1 does not require a login; verified-email report sending does not imply a universal account system. No fake OTP delivery, OAuth, profile saves, deletion, or success screens. Backend integrations require separately authorized approval and actual validation.

**E. Product/security prohibitions.** Parkey V1 is discovery-only: no bookings, reservations, payments, QR passes, operator slots, real-time vacancy or guaranteed space claims—even mocks. Figma's illustrative "Parking Available" view must be translated into a truthful unconfirmed/sourced parking preview. No fake rating, fees, hours, location, photo, public research data, or privacy consent. Do not deploy, change production schema, enable analytics, or turn on private ingestion without authorization.

## Implementation order

1. **Audit** current branch and source files, compare to snapshot and Figma paired index, create an explicit gap/feature-gate matrix.
2. **Theme foundation** with exact two-mode tokens and persistent Appearance toggle; update shared components, status bar and both real map renderers.
3. **Discovery interaction and visual implementation** of nodes 20/20A, 21–30/30R, 22A/B/C/R, 23/24 (truthful), 26A/B, EXT; preserve integrations, Back/URL and data invariants.
4. **Optional welcome and settings polish**; keep account-only paths gated, with clear notes for future approved integrations.
5. **Verification**: targeted unit tests, typecheck, lint, browser tests, device smoke, real app screenshots matched against both exported reference themes. Use `node scripts/figma-snapshot.mjs --check` only after exporting all 120 frames; it must not be treated as an app test.
6. **Handoff** in a scoped PR: compare each enabled screen to its Figma ID, tests run and results, local screenshot evidence, known mismatches, deferred integrations, exact commit/branch, and approvals still required.

Work incrementally on a feature branch with small verifiable commits; do not stop after planning if code can be safely implemented. If the export token or a backend dependency is missing, proceed on independent permitted UI/theme work and report the exact blocker. Never pretend missing screen captures, tests or backend behavior are complete.
