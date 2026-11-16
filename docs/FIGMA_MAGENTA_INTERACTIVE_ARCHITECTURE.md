# Parkey — Interactive Architecture (magenta variants)

Status: implementation handoff / design reference, 2026-11-16. This document defines **screen and interaction intent**, not authority to change the canonical V1 product scope.

## Sources and precedence

1. **Product/release scope:** [V1_EXECUTION_PLAN.md](V1_EXECUTION_PLAN.md), [V1_OWNER_ACCEPTANCE_CHECKLIST.md](V1_OWNER_ACCEPTANCE_CHECKLIST.md), and root [AGENTS.md](../AGENTS.md). V1 is **discovery-only**; anonymous browsing remains available. No booking, payments, QR entry/exit, operator inventory, real-time vacancy, or reservation UI—even mocked.
2. **Visual and interaction target:** [Parkey — Interactive Architecture page](https://www.figma.com/design/UaU1KMJV2tMlwGB7Y1Co1g/Parkey-Initial-Design?node-id=244-2804). Use the _Light + Magenta_ and _Dark + Magenta_ frames and their corresponding route boards (below). The same state and action must work in both modes.
3. **Screen locator:** [FIGMA_MAGENTA_SCREEN_INDEX.md](FIGMA_MAGENTA_SCREEN_INDEX.md), containing the exact 60 light/dark node pairs.
4. **Colors/type:** [FIGMA_MAGENTA_DESIGN_TOKENS.md](FIGMA_MAGENTA_DESIGN_TOKENS.md), sourced from Figma variable values (not guessed from pixels).
5. **Engineering sequence and verification:** [FIGMA_MAGENTA_CODEX_PLAN.md](FIGMA_MAGENTA_CODEX_PLAN.md). Existing production behavior and validated geo/data/security rules take precedence over contradictory decorative prototype copy.

Figma nodes: architecture root `244:2804`, canonical interactive journey `283:3352`, four-theme reference `283:3284`, light-magenta routes `289:3698`, dark-magenta routes `289:3905`; light-magenta screens start `249:1658`, dark-magenta `249:5087`. This handoff deliberately **selects only the two magenta families**, even though the appearance mock shows four selectable styles. Preserve the official Parkey logo without recoloring it.

## Canonical journey and route state machine

The Figma canonical journey reads: "One Journey. Two Authentication Paths. Real Decision Branches"; location access is not required for manual search. Screen IDs are stable identifiers **within Figma**, not proposed Expo Router URLs.

### Entry / two authentication paths

- New user: **1 Splash → 1B Welcome / 2–4 Walkthrough → 5 Welcome/auth choice → 6 Create Account**, with `6A` invalid-input state. **7 Verify Email → 7A expired code / 7B email verified**, then **8 Basic Profile → 9 Vehicle Type → 10 About You → 11 Driving Habits → 12 Parking Preferences → 13 Setup Complete**; then location permission and discovery.
- Returning user: **5 → 17 Sign In**, including **17A Invalid Credentials** and **18 → 18A → 18B** reset-password states; successful session **19 → 20 Location Permission → 21 Parking List / 22 Parking Map**.
- **20A Location Denied** must still permit manual search and map browsing. No forced GPS permission or account for V1 discovery.
- `5P` is a **phone sign-in integration notice**, _not_ a working SMS authentication promise. Google/Facebook buttons visible in prototype `6` are not proof that providers are configured. Only advertise an auth path when real provider behavior, delivery, verification, session/recovery/deletion requirements and release checks are completed.
- Figma includes **required profile and vehicle stages** as a future target. They must not become prerequisites for existing anonymous V1 discovery, and must not collect new personal data by default. Implement only with an approved, functional backend and consent/data-retention design. No dummy profile saves or fake success screens.

### Discovery / saved / route states

- **21 List ↔ 22 Map**: same parking records, search, selected feature, filters, data attribution and destination across switches; no re-fetch that silently discards valid state.
- **22A Search**: search an actual public destination/landmark provider; loading, request cancellation, empty and error recovery; search does not require GPS. **22B Filters** filter real published parking; **22C No Results** means no matching **known** records, not that parking does not exist.
- **22R Recentered Map**: recenter interaction and visible feedback while preserving intended manual-pan rules. Do not recenter automatically after every data refresh.
- **23 Status Unconfirmed** vs **24 "Parking Available" preview**: Figma uses _illustrative markers_. In actual V1, **never show available/open spot or guaranteed vacancy**; translate `24` to a truthful, source-qualified **facility/record preview**. Separately sourced recorded _opening hours_ may say "Open now" only with the existing qualification that this does not imply a free space.
- **25 Details / long scroll**: real record title/type/source, unknown fees/hours, access/restrictions, licensed photos or honest fallback, reporting/correction and attribution. Example-only locations, prices, ratings and photographs in Figma must never be copied into production data.
- **26 Saved confirmation → 26A Saved empty / 26B Saved collection**: use existing on-device saved-record behavior; preserve state on reload. **27 Share sheet** uses a legitimate shareable link/text; **28 Entrance & Access** uses the existing reviewed entrance-validation contract; **29 Directions / external-app choice** preserves existing privacy/route consent; **30 in-app navigation → 30R recentered route feedback** preserves foreground GPS and reroute constraints. **EXT** is an honest external integration notice, not a fake completed handoff.
- Parking discovery is **map-first in the current implementation**. A first-run intro may be dismissible, but **Explore remains accessible immediately without login**, and the Figma list/map bottom navigation is a presentation to reconcile with current, already-tested drawer/sheet and browser Back semantics.

### Profile / settings reference

- **16 Account & Settings → 16A Appearance** (this implementation offers **Light + Magenta** and **Dark + Magenta** only); **14 My Vehicles / 15 Add Vehicle / 73 Delete Vehicle / 74 Delete Confirmation** are subject to persistence and data-policy approval.
- **77 Personal Info, 78 Security, 78A Remember enabled, 79 Language, 80–82 Help Center, 83 Privacy & Data, 84 About Parkey, 85 Log Out** are real destinations in the reference. Only surface functional controls and accurate account/session/privacy statements. Avoid presenting a decorative password toggle, account-delete action, support message, or legal link as operational when its integration does not exist.
- **Account/Profile** in the Figma bottom bar must not make a login a prerequisite for **Explore** or **Saved**. An anonymous Profile destination can show available local settings and explain optional account functionality without pretending the user has a server account.

## Existing codebase seam map

- Workspace: **Expo SDK 58 / React Native / Expo Router / native StyleSheet**. Root `apps/mobile/src/app/index.tsx` chooses `Explore` or a pilot-only `PilotDiscovery` via `EXPO_PUBLIC_PILOT_DISCOVERY_ENABLED`. Do **not** create a second unmaintained screen tree or replace the map providers.
- Main behavior: `apps/mobile/src/discovery/explore.tsx`, `discovery-state.ts`, `use-navigation.ts`, `bottom-navigation.tsx`, `discovery-sheet.tsx`, `search.tsx`, `parking-details.tsx`, `saved-places.tsx`, `route-details.tsx`, `use-drive-navigation.ts`, map native/web renderers. Inspect before modifying: do not assume Figma code generated in React/Tailwind maps to RN components.
- Existing theme: `apps/mobile/src/discovery/palette.ts` and `ui.tsx` expose **static** colors, while `typography.ts` currently loads **Nunito**. The target Figma screens use **Outfit**. A functional mode switch must propagate via reusable semantic tokens, shared components, modal roots, overlays, status bar, maps/markers and error/loading states—not a single inverted background.
- Existing data: sourced OpenStreetMap snapshot and approved Supabase public reads; routing through OSRM-compatible provider only where allowed; existing private local contribution drafts, report sending gates, public-data checks, and disclosure rules survive intact.
- Latest repo docs retain some older screenshots/typographic statements. When implementation completes, **update only demonstrably obsolete visual descriptions**, not backend/product guarantees or recorded test receipts.

## Non-negotiable interaction and quality decisions

1. No fake availability, payments, booking CTAs, ratings, "verified" badges, locations, photos, or provider integrations. **Sample city artwork in the Figma map is an illustration**, not data; do not ship it as real MapLibre map imagery.
2. All visible enabled controls perform the indicated action. If a necessary backend is missing, either keep the feature gated/clearly unavailable or explicitly return an integration notice—never silently succeed.
3. Respect Android Back, iOS back gestures, browser Back, safe areas, adaptive text, keyboard/small-screen layout, hit target accessibility, reduced motion, and RN native/web parity.
4. Use one route/state model across themes; switching themes **must not reset** destination/search, selected parking, saved collection, sheet position, route, permission decision or unsent local drafts.
5. Field data collection/publication and production readiness remain separately gated under the V1 plan. A Figma-perfect screen is not evidence of a production integration.
6. Require emulator/physical-device UI screenshots and actual checks before claiming visual or functional parity. Record mismatches and test evidence in the implementation PR.
