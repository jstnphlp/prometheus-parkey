# Phase 3 visual evidence

Captured from the installed standalone Android APK on `Parkey_A0_API35`.
The [receipt](receipt.json) distinguishes native checks, SDK fixtures, unverified
integration paths and deferred work. [Input measurements](native-input-measurements.json)
retain native pixel bounds. [Paste measurements](native-paste-measurements.json)
show the 254-character value and cursor without publishing its full address.

Screenshots are downsampled to logical display size. Before/after pairs use
360×800 normal text. `reference-size-*` images use 390×844. `small-large-text-*`
images use 320×640 and 150% text, with scrolling where needed. Native Android
safe areas, status/navigation bars and keyboard replace Figma's device chrome.

| Screen   | Before/after                       | Figma vs Android                         |
| -------- | ---------------------------------- | ---------------------------------------- |
| Welcome  | [Compare](comparison-welcome.png)  | [Compare](figma-vs-android-welcome.png)  |
| Discover | [Compare](comparison-discover.png) | [Compare](figma-vs-android-discover.png) |
| Compare  | [Compare](comparison-compare.png)  | [Compare](figma-vs-android-compare.png)  |
| Navigate | [Compare](comparison-navigate.png) | [Compare](figma-vs-android-navigate.png) |
| Login    | [Compare](comparison-login.png)    | [Compare](figma-vs-android-login.png)    |
| Register | [Compare](comparison-register.png) | [Compare](figma-vs-android-register.png) |

Additional captures cover the native splash; Forgot/unauthorized Reset/guest
Account; inline Register validation; information, network, invalid-link and
reset-validation modals; real Gboard keyboard; native selection/paste; and
large-text input, modal, registration and onboarding layouts.

Only synthetic addresses appear in the auth captures. Private guest map,
parking locations and saved-data screenshots are excluded. The original native
pixel captures and test APK remain under ignored local `output/ncr/`.

The reported input expansion was not reproduced in the Phase 2 API 35 baseline.
Phase 3 explicitly constrains text sizing and measures stable container/icon
bounds with short/long/maximum text and large system fonts. No iOS or physical
device, positive hosted email/auth flow, manual screen-reader acceptance or
final-animation approval is implied by these images.
