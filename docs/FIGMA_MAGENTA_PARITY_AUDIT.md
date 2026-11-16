# Parkey magenta design parity audit — 2026-11-17

**Implementation target:** `codex/figma-magenta-interactive`, not `main`. This audit PR is stacked on the implementation branch and does not merge it to main or authorize a release.

**Figma reference:** [Interactive Architecture](https://www.figma.com/design/UaU1KMJV2tMlwGB7Y1Co1g/Parkey-Initial-Design?node-id=244-2804). Reviewed original frames:
- Light + Magenta parking map: `249:3020` (live Figma screenshot + reference context).
- Dark + Magenta parking list: `249:6399` (live Figma screenshot).
- Dark + Magenta appearance: `249:7531` (live screenshot and code context).
- Dark + Magenta sign-in: `249:6060` (live Figma screenshot).
- Local implementation evidence: `docs/evidence/figma-magenta/browser/mobile-chromium-*{16A,22,17-long-email}.png` from the implementation branch.

## Verified parity

- **Color tokens:** implementation's 19 semantic roles match the checked-in inspected Figma tokens, as covered by `apps/mobile/src/discovery/theme.test.mjs`. The user-selected scope remains **two magenta themes**, despite Figma's four-theme demo.
- **Typography:** implementation uses bundled Outfit assets; the original design uses Outfit. Need device-level typography screenshot checks for every active route before any full-parity claim.
- **Truthful data and navigation:** current code keeps real MapLibre/parking records, sourced details and existing permissions. Figma's sample map and sample vacancy cannot be used as actual published parking or claims of a vacant spot.
- **Appearance persistence:** existing theme provider persists user preference without remounting the map, with error feedback. Inline Appearance intentionally keeps an active map/route mounted; a separate `/appearance` route exists.

## Confirmed mismatches and action

| Area | Difference against Figma | Correction |
|---|---|---|
| Map vs list, IDs 21/22 | Prototype has distinct List and Map actions; browser evidence labelled 22 shows the expanded results sheet rather than the fullscreen Figma map. Existing app uses a map-first resizable sheet instead of duplicate routes | Added explicitly labelled **Show parking list** map action and **Show parking map** list action, reusing the existing compact/expanded state. This improves functional parity but does **not** claim pixel-level layout parity |
| Search wording, IDs 21/22/22A | Figma uses `Search parking or landmark`, app showed `Where to park today?` | Unified visible input placeholder with Figma |
| Search overlay saved action | An old overlay displayed static `Makati` while invoking *Saved places*, misleading when searching other locations | Corrected visible label to **Saved** (accessibility name was already `Open saved places`) |
| Web-native compatibility | A stored browser evidence image shows a React warning starting `React does not recognize the im...`; native-only accessibility properties were passed to web Views | Guard native-only accessibility properties on both map and popup wrappers; keep web `aria-hidden` / inert behavior, native modal semantics and web-only popup-title `tabIndex` |
| Long detail captions | Current list can clip a long line of recorded distance/status metadata in the captured browser fixture | Not rewritten: data-trust requirements require source/distance qualifiers; needs new responsive screenshot and text-scale verification, not arbitrary data removal |

## Open visual/integration gaps

1. The **Figma sample map is illustrative** and has fixed 430 × 932 composition; production must use real MapLibre tiles, attributions and only published records. Fullscreen reference layout is still more map-dominant than the existing sheet interface. A redesign of the entire drawer/navigation model was intentionally **not** included in this narrow correction PR because it would require regression work for map gestures, native camera padding, search, sheet snap behavior and Android/browser Back.
2. **Profile / Appearance**: Figma presents standalone screens; the app also has inline sheet presentations to preserve active navigation state. The existence of a standalone route does not establish visual equivalence. No claim of pixel-perfect parity is made.
3. **Account / email verification**: sign-in is a real configured integration with environmental limitations; screenshots captured with system errors are not like-for-like comparisons to Figma's neutral input state. Do not remove truthful error messaging for visual fidelity.
4. The checked-in design-reference screen PNGs and layout JSONs remain **unexported**. Four targeted live Figma screens were reviewed, not all 120 references. Full screen-by-screen accessibility/color/geometry acceptance remains pending.
5. New native device screenshots, native screen-reader testing, cross-device auth success, physical devices and iOS have **not** been rerun by this audit; prior device receipts belong to the preceding implementation branch only.

## Verification

- Regression case added in `e2e/discovery.spec.ts`: visible Figma search wording, list→map roundtrip, Explore selection.
- Initial CI found a pre-existing native TypeScript failure on `Text tabIndex` in `popup-provider.tsx`. The audit branch now supplies that web-only attribute conditionally while preserving native focus behavior; CI must reverify this fix.
- Repository CI and device results should be recorded on the review PR after the checks finish; this document makes no new runtime claims.
- Preserve all `AGENTS.md` / V1 constraints: **no bookings, payments, inventory or claimed live parking vacancy**, no fake provider success, and no unapproved backend deployments.
