# Interactive Architecture verification evidence

Date: 2026-11-17. Branch: `codex/figma-exact-ui`. See [implementation and all 60 screen pairs](../../FIGMA_EXACT_UI_IMPLEMENTATION.md).

## What the images establish

`browser/` contains real application screenshots at the canonical 430 x 932 CSS viewport, paired with the exact Light + Magenta / Dark + Magenta Figma node. `pilot/` captures the pilot's actual guarded client with explicitly synthetic test responses. Screenshots are evidence of UI behavior, not real-world parking approval, photos, vacancy, route availability or account services. Fixture text retains its source qualifications.

`android/` contains actual API 35 Android emulator screenshots (1080 x 2400, 360 x 800 logical layout at density 480). These are native small-device checks, not 430 x 932 pixel comparisons. No personal parked-car location, reviewer token or account identity is included in committed native captures.

`browser/interaction/` and `pilot/interaction/` are functional regression captures at their test project's viewport; they are not canonical frame geometry evidence.

`comparisons/{browser,pilot}/` contains reproducible Figma / app / 50% overlay boards and exact node IDs in `index.json`. Generate them with:

```sh
python scripts/compare-figma-snapshots.py --runtime browser
python scripts/compare-figma-snapshots.py --runtime pilot
```

Both original images remain unmodified. Overlay-only masks cover OS bars and declared record/map regions that cannot truthfully reproduce illustrative prototype data. Map controls and preview geometry remain visible. Masks are listed per image. Boards are manually reviewed; no image is labelled a pixel-perfect pass.

## Actual checks

- Mobile TypeScript (`pnpm --filter @parkey/mobile typecheck`): passed.
- Browser test TypeScript (`pnpm typecheck:e2e`): passed.
- Scoped ESLint, all 65 changed source/test files, zero warnings: passed.
- Mobile discovery, auth and onboarding unit tests: **329 passed**, using `node --test --test-reporter=dot apps/mobile/src/discovery/*.test.mjs apps/mobile/src/onboarding/*.test.mjs apps/mobile/src/auth/*.test.mjs`.
- Desktop regression run: **56 passed / 1 stale assertion failed** in 57 cases. Empty Saved intentionally has no bottom tabs; its test was corrected to use Explore Parking. Final follow-up result is recorded below. The 56 passes include theme/write failure/persistence, route consent and revocation, navigation races, source trust, unknown/contradictory facts, local reports, saved addresses/car/undo and search recovery.
- Mobile Chromium: **26 passed / 0 failed**. Both modes cover map/list, filters, selected parking, preview/details/Entrance Back, saved collection, search drafts, long email geometry, startup hydration, location denial/manual search, empty recovery, local help/settings, clipboard share, route consent and theme persistence during navigation. These are browser checks, not iOS device evidence.
- Earlier pilot run: **21 passed / 2 failed**. The failures exposed damaged-car recovery hidden by the empty state and the Entrance callback/history layer; those implementations were corrected. Final follow-up result is recorded below.

## Android results and limits

An existing Android development client was opened visibly on `Parkey_A0_API35` / `emulator-5556`. Actual checks include Light/Dark switching, selected radio state, status/navigation bar colors, appearance persistence across cold launch, Back from Appearance to Account, map/list presentation, and background-map accessibility isolation on full-page screens. The retained native map is removed from layout/accessibility while covered and restored on return, without changing its React instance.

Native appearance captures were visually inspected. Android 130% text testing and final runtime details are recorded below. The emulator contains pre-existing user local state; it was not wiped. Native network discovery was not claimed verified when its current viewport returned no records. Real backend/device navigation acceptance remains in the canonical V1 plan.

Windows provides no iOS runtime. No physical-device, production backend, email/OTP/OAuth success, App Store build or deployment was performed. The canonical release gates remain unchanged.

## Visual review and intentional differences

The comparison pass corrected the old drawer composition, missing/white-on-light logo, onboarding art capture timing, preview spacing, detail action/tab spacing, save feedback placement, page Back behavior and full-page map isolation. Appearance intentionally has only two magenta cards. Welcome adds an optional guest action. Actual unknown facts and source metadata replace prototype examples. Photos are shown only for approved licensed location matches. Share uses real system/clipboard capabilities; navigation retains functional operational controls. Further device-specific layout polish and iOS visual review remain owner acceptance work; no blanket pixel-perfect claim is made.

## Final follow-up results

- Desktop final captures/discovery: **23 passed / 0 failed** (`figma-exact.spec.ts`, `figma-states.spec.ts`, `figma-routing.spec.ts`, `discovery.spec.ts`, desktop-chromium). This includes the corrected empty-Saved navigation assertion and clean captures after platform-prop/spacing fixes.
- Pilot final: **23 passed / 0 failed** (`pilot/discovery.spec.ts`, `pilot/figma-exact.spec.ts`, `pilot/navigation.spec.ts`, `pilot/appearance.spec.ts`, pilot-desktop). Damaged-car storage recovery, Entrance browser Back/Escape, Appearance Back, retained map instance and all publication/navigation safeguards pass.
- Android cold launch retained Light + Magenta; immediate Light/Dark selection and actual Android system Back were checked. `light-magenta-16A-font130.png` shows 130% text: labels wrap without clipping. Font scale was restored to 1.0.
- Native automation initially needed its incompatible task-owned daemon restarted; changing font scale during hot reload also produced a development-only linking warning. Cold launch removed it. Neither is represented as a release-build result.
- Original native user local data was retained. No committed screenshot contains the user's parked-car pin.

Final receipts deliberately retain earlier failures and the fixes they caused; reruns are not described as first-pass success. Raw traces/build outputs remain ignored under `output/playwright/`; reproducible tests and curated captures are committed.

- Final visual-polish follow-up: **17 passed / 0 failed** (`figma-exact.spec.ts`, `figma-states.spec.ts`, `figma-review-regressions.spec.ts`, desktop-chromium). This run captures the corrected empty Saved header, fixed filter actions and completed destination results after save feedback expires.
- Android normal-text filter screenshot shows visible Apply/Clear controls; scrolling exposes actual parking type and fee choices above that footer. Native Back discards the unsubmitted filter draft.

The final dark entry review selects the supplied white/teal logo in Splash, Welcome and auth/location entry frames, while Profile/Saved/About keep the supplied magenta/teal logo in both modes. These are original Figma variants, not runtime tinting.

- Supplied-logo final follow-up: **14 passed / 0 failed** across both modes (`figma-exact.spec.ts`, `figma-states.spec.ts`, desktop-chromium). Entry and settings captures now use their exact supplied Figma logo variants.

## Entry flow correction ? 2026-11-17

Walkthrough Finish and Skip now go to Login, not discovery. Verified sign-in/email confirmation/OAuth go to the protected profile entry at `/account-setup` (Figma 8). Profile saving, vehicle/preferences setup and final completion remain gated until the missing backend contracts are explicitly authorized and integrated. No profile completion flag is inferred from finishing the visual introduction.

Correction checks: mobile and E2E TypeScript passed; scoped ESLint passed; 18 targeted session/setup/intro persistence tests passed; updated paired Figma browser tests passed 6/6, and dedicated flow browser tests passed 4/4 after fixing a test synchronization race between successive Next buttons. The successful-auth boundary is covered with server-verifier unit fixtures, not a fake login in production or an asserted live-account test.

Android API 35: Welcome ? all three walkthrough screens ? Login verified using the existing native client. `android/entry-flow-login-light-magenta.png` is the actual blank login form after completing the walkthrough. The development Tools overlay remains visible in this proof image; it is not a Figma parity capture. The native preview now loads existing local public auth configuration instead of the earlier auth-disabled QA environment. No account was created, no credentials were entered, and no verification email was sent by the agent.

The two actual frame-8 Figma exports were added to the MCP index (64 references total, 32 pairs). There is no claimed signed-in application screenshot or pixel comparison for this gated profile screen.
