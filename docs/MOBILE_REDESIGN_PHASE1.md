# Mobile redesign — Phase 1

Branch: `codex/mobile-redesign-phase-1`, based on the existing discovery branch
`feat/v1-place-discovery` / PR #29. This introduction does not advance a V1
execution gate or grant production approval.

## Implemented scope

- Original native launch splash color and logo, a matching React loading state,
  welcome, Discover, Compare, and Navigate. Native splash stays visible until
  fonts and local onboarding progress resolve.
- Shared native StyleSheet tokens, bundled Outfit typography, original Nunito
  Black wordmark, safe-area screen container, buttons, and logos.
- Native Expo Router stack navigation, including Back, welcome login access,
  Skip, and completion to registration. Registration and login are explicit
  destinations that explain account access is unavailable in this build; they
  collect no credentials and simulate no authentication.
- Explore parking opens the original `/` discovery route. Its existing pilot,
  legacy, saved parking, and other discovery behavior remains in place.
- AsyncStorage key `parkey:onboarding:v1` records completion after finishing or
  skipping. Relaunch goes directly to discovery. Read failures offer retry or an
  explicit session-only continuation; write failures retain the screen and offer
  retry. Completion never clears discovery storage. Back history is cleared on
  completion; an outstanding save cannot navigate after its screen loses focus.
- Native stack transitions respect initial and changed reduced-motion settings;
  previews remain static. Scrollable layouts, flexible widths, growing buttons,
  and uncapped system text scaling support other display sizes.

No backend, migration, deployment, reservation, payment, or booking changes.
The existing local documentation edits are excluded from this PR.

## Design sources and deliberate differences

Inspected the actual Figma MCP design context and screenshots for `41:5`, `39:6`,
`11:16`, `19:2`, `19:32`, `19:60`, `11:44`, and `11:30` in
[Parkey Initial Design](https://www.figma.com/design/UaU1KMJV2tMlwGB7Y1Co1g/Parkey-Initial-Design?node-id=0-1).

The splash logo is centered exactly as placed over the reference background.
Original Compare and Navigate illustration frames were exported without changing
the Figma file. Discover uses the supplied static PNG from node `54:83`.
See the [asset provenance](../apps/mobile/assets/figma/onboarding/README.md).
Runtime assets are local PNGs; vector-derived assets have standard and 3x density
copies, and their original SVGs are retained. Fonts and their licenses are bundled
locally. The four `figma-*.png` screen references freeze the inspected design
context snapshot used for the final implementation.

Expo's SDK-compatible splash plugin controls native startup. Android uses a
155-point square image viewport to keep the complete logo inside Android's
192-point circular icon mask, without stretching or changing the vector. This
native icon is smaller than the Figma reference; the React loading screen and
iOS configuration retain the original 176-point width. The SDK 58 status-bar
plugin starts native status text in light style, while discovery keeps its own
runtime dark status bar. No custom splash fade is added.

The final Welcome reference uses the centered logo/wordmark, “Designed Around the
Driver.” heading, and expanded discovery copy, with no GIF slot. Discover uses
the supplied illustration in its wider 365 × 274 slot. The numbered onboarding
counters are absent from the inspected design; screen-reader headings still
announce the step. All onboarding illustrations remain static previews until
approved animation files are supplied. They are illustrative, not live parking
data.

Native Android/iOS status bars, safe areas, and navigation bars replace the drawn
iPhone status icons, home indicator, and rounded phone frame. Their platform
insets naturally change vertical placement. Welcome adds a top-right Log In
link, and onboarding/account destinations add an accessible Back control. Full
auth fields and social sign-in from the reference are deferred; Phase 1 only
provides truthful destinations with guest discovery access.

## Verification

- Targeted mobile typecheck and lint passed after Expo regenerated new route
  declarations. No generated declarations were manually edited.
- Six onboarding persistence tests and nine existing discovery persistence tests
  passed (15 total). The new tests are included in mobile and root test scripts.
- Required workspace `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, and
  `pnpm build:web` passed after the test-script updates.
- Discovery browser fixtures explicitly represent returning users. Browser/E2E
  suites were not run for this change.
- Android API 35 development-client captures at 390 × 844 logical points match
  the reference colors, fonts, artwork, and layout, with the native insets and
  added navigation controls described above. At 320 × 640 and 1.5× system text,
  welcome controls fit and onboarding scrolls to its primary controls. Fixed link controls
  have matching backdrops so scrolling text cannot blend into their labels.
- Native splash, welcome/login and Android Back, all three onboarding steps,
  Compare-to-Discover Back, Skip-to-registration, completion-to-registration,
  cleared Back history, guest discovery access, and force-stop/relaunch directly
  to discovery were exercised. Existing saved-car state remained available.
- The emulator was offline. Discovery displayed its existing offline recovery
  UI; live map tiles, search providers, and backend integrations were not verified.
- Reference-side comparison images place Figma on the left and Android on the
  right. Native status bars and insets produce small vertical offsets. Android's
  system splash icon is deliberately smaller to avoid clipping its original logo.

## Review evidence

- [Welcome comparison](evidence/mobile-redesign-phase1/compare-welcome.png)
- [Discover comparison](evidence/mobile-redesign-phase1/compare-discover.png)
- [Compare comparison](evidence/mobile-redesign-phase1/compare-compare.png)
- [Navigate comparison](evidence/mobile-redesign-phase1/compare-navigate.png)
- [Native splash](evidence/mobile-redesign-phase1/android-native-splash.png)
- [Small welcome](evidence/mobile-redesign-phase1/android-small-large-text-top.png)
- [Small welcome controls](evidence/mobile-redesign-phase1/android-small-large-text-controls.png)
- [Small onboarding controls](evidence/mobile-redesign-phase1/android-small-discover-controls.png)
- [Source/device/check receipt](evidence/mobile-redesign-phase1/receipt.json)

Discovery screenshots containing existing local parking state are not published.
iOS and physical devices were not tested.

Changing font scale while the development client was active produced a
duplicate-linking warning. The captured size/text profiles were verified after
clean launches. Live font-setting changes in release builds remain unverified;
no warning suppression or framework upgrade was added to this PR.

Initial offline debug build failed because Expo dev-menu Maven dependencies were
not cached. Retried with dependency downloads enabled. Development-build emulator
evidence does not establish iOS, physical-device, performance, or production
release validation.
