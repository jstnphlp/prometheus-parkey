# Parkey Interactive Architecture implementation

Branch: `codex/figma-exact-ui`, based on fetched `origin/codex/figma-magenta-parity-audit` at `87ca1170cb5f4e1dfa1ab378a82a105360db3e48`. This is a stacked implementation PR against that audit branch. No backend, deployment, schema or canonical V1 gate was changed.

## Implemented behavior

The discovery map now uses frame 22's search header, map controls, source-qualified legend and three-tab navigation. List, destination search, filters, preview, long-scroll details, entrance, directions chooser, saved parking, profile and Appearance use the architecture's page hierarchy rather than the previous discovery drawer. The same MapLibre/data owner stays mounted during theme changes. Pilot discovery uses the same header/preview language and full-page list, search, details and saved views, retaining its stricter publication and navigation guards.

The existing single theme provider remains authoritative. Both modes use the documented semantic palette, Outfit weights and persistent `parkey.appearance.v1`. Search drafts, selected parking, local favorites, addresses, reports, consent and active routes survive appearance changes. Appearance has two choices; the prototype's teal variants are excluded. Map symbols use one P marker rather than implying vacancy from fee categories.

Optional welcome and skippable walkthroughs use local approved Figma artwork. Guest exploration remains accessible. Registration/sign-in/recovery forms use real existing auth capabilities only when configured. Unavailable services remain gated. The approved official P vectors retain their supplied magenta/teal or white/teal fills; the wordmark uses licensed Baloo 2 as specified by Figma. UI text uses Outfit.

## Sources and evidence

The actual Figma page and canonical/light/dark architecture nodes were inspected through connected Figma MCP. `design-reference/mcp-index.json` records **62 actual frames (31 paired screens)**, with 430 x 932 screenshots and corresponding design-context JSON. These JSON files are explicitly MCP context references, not full REST node-tree exports. All exported node IDs and PNG sizes were checked against the 60-pair manifest. Other manifest frames are not claimed exported.

Application evidence and reproducible comparisons live in [evidence/figma-exact](evidence/figma-exact/README.md). Comparison boards show the unmodified Figma frame, actual app capture and a 50% overlay. OS chrome and declared record/map content regions are masked only in the overlay; controls and both original images remain visible. There is no invented pixel-parity score or blanket visual pass.

## Component and flow mapping

| Figma IDs               | Implementation                                                   | Reused functional system                                                            |
| ----------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1, 1B, 2-4              | onboarding screens, BrandLogo                                    | persistent optional completion; guest access                                        |
| 5, 6, 17, 18            | AuthChoices, AuthShell, existing form/recovery screens           | existing auth provider, actual validation, session/recovery guards                  |
| 16, 16A, 79, 80, 83, 84 | AccountMenu, AppearanceScreen, HelpCenter, AboutParkey           | single theme provider; local settings; explicit unavailable integrations            |
| 20, 20A                 | LocationPage                                                     | actual OS permission, denial and manual search                                      |
| 21, 22, 22A-C, 23       | architecture-discovery, filters/search/empty pages               | MapLibre, approved records, real search, truthful feature filters                   |
| 25-28, 26A-B            | ParkingDetails, PilotParkingDetails, SavedPlaces, share/feedback | real source metadata, licensed photos, local persistence, approved entrance gates   |
| 29-30                   | DirectionsChoice, existing route/turn panels                     | current entrance approval recheck, consent, actual route, external provider handoff |

## Remaining differences and integration requirements

- Prototype parking names, illustrations, ratings, prices, photos, available labels and review badges are examples. Runtime records retain source identity, unknown facts, restrictions, review expiry and publication checks. Approved photos render when present; missing photos show a placeholder.
- Detail pages keep longer verification/source and authorization guidance where the prototype has illustrative facts. Pilot records retain research/publication context and show only existing supported fee/category filters. No invented amenity support was added to its API.
- Share uses the actual system share dialog or web clipboard. Prototype per-app social targets are omitted until real supported integrations exist.
- The real route banner, consent and end-navigation controls remain; the navigation concept's illustrative route is never presented as a real route. Pilot directions continue using its existing reviewed external Maps handoff.
- Guest profile text, two appearance cards, device-only saved labels, local reports and recovery tools are deliberate V1 adaptations. Account questionnaires, vehicles, account editing, security, phone auth, OTP, success-only screens and deletion need separately approved product/backend contracts, actual storage/RLS, provider/email setup, privacy/retention decisions and end-to-end integration tests. Existing email-link auth is not a six-digit OTP implementation.
- Help search/FAQ and suggested English work locally. Contact service, extra languages, partnerships, store rating and unpublished legal terms remain explicitly unavailable.
- The walkthrough's static comparison graphic is explicitly labelled illustrative. It supplies no parking facts. No booking, reservation, payment, QR, inventory or vacancy service is exposed.
- iOS runtime and physical-device QA are not available on this Windows host. Android checks use an existing development client; this work does not produce or publish a release build.

## Full manifest coverage and gaps

The rows below map every pair. ?Implemented composition? means actual local references and captured UI, not an assertion that synthetic backend-dependent states have passed or that every device/runtime is pixel-perfect.

| Screen | Figma label                                                                   | Light / Dark node   | Implementation / gap                                                           |
| ------ | ----------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------ |
| 1      | Splash                                                                        | 249:1658 / 249:5087 | Implemented composition; paired exports and browser captures.                  |
| 2      | Walkthrough 1                                                                 | 249:1662 / 249:5091 | Implemented composition; paired exports and browser captures.                  |
| 3      | Walkthrough 2                                                                 | 249:1688 / 249:5117 | Implemented composition; paired exports and browser captures.                  |
| 4      | Walkthrough 3                                                                 | 249:1714 / 249:5143 | Implemented composition; paired exports and browser captures.                  |
| 5      | Welcome / auth choice                                                         | 249:1740 / 249:5169 | Implemented composition; paired exports and browser captures.                  |
| 6      | Create account                                                                | 249:1787 / 249:5216 | Implemented composition; paired exports and browser captures.                  |
| 6A     | Registration validation error                                                 | 249:1852 / 249:5282 | Real field validation; no synthetic backend error. Reference missing.          |
| 7      | Verify email                                                                  | 249:1916 / 249:5346 | Backend/product gated; no fake state or account data. Frame export missing.    |
| 7A     | Verification code expired                                                     | 249:1954 / 249:5385 | Backend/product gated; no fake state or account data. Frame export missing.    |
| 7B     | Email verified                                                                | 249:1992 / 249:5423 | Backend/product gated; no fake state or account data. Frame export missing.    |
| 8      | Basic profile information                                                     | 249:2015 / 249:5446 | Backend/product gated; no fake state or account data. Frame export missing.    |
| 9      | Vehicle type selection                                                        | 249:2053 / 249:5485 | Backend/product gated; no fake state or account data. Frame export missing.    |
| 10     | About You (required in Figma)                                                 | 249:2142 / 249:5575 | Backend/product gated; no fake state or account data. Frame export missing.    |
| 11     | Driving Habits (required in Figma)                                            | 249:2181 / 249:5615 | Backend/product gated; no fake state or account data. Frame export missing.    |
| 12     | Parking Preferences (required in Figma)                                       | 249:2222 / 249:5657 | Backend/product gated; no fake state or account data. Frame export missing.    |
| 13     | Setup complete                                                                | 249:2264 / 249:5699 | Backend/product gated; no fake state or account data. Frame export missing.    |
| 16     | Profile & Settings                                                            | 249:2286 / 249:5721 | Implemented composition; paired exports and browser captures.                  |
| 14     | My Vehicles                                                                   | 249:2425 / 249:5860 | Backend/product gated; no fake state or account data. Frame export missing.    |
| 15     | Add another vehicle                                                           | 249:2540 / 249:5975 | Backend/product gated; no fake state or account data. Frame export missing.    |
| 17     | Sign in                                                                       | 249:2625 / 249:6060 | Implemented composition; paired exports and browser captures.                  |
| 17A    | Invalid credentials                                                           | 249:2679 / 249:6114 | Real provider failure dialog only; no synthetic credential response.           |
| 18     | Forgot password                                                               | 249:2733 / 249:6168 | Implemented composition; paired exports and browser captures.                  |
| 18A    | Reset email sent                                                              | 249:2767 / 249:6202 | Backend/product gated; no fake state or account data. Frame export missing.    |
| 18B    | Set new password                                                              | 249:2796 / 249:6231 | Existing recovery-session guard; enabled only by a real recovery session.      |
| 19     | Sign-in success                                                               | 249:2837 / 249:6272 | Backend/product gated; no fake state or account data. Frame export missing.    |
| 20     | Location permission                                                           | 249:2862 / 249:6297 | Implemented composition; paired exports and browser captures.                  |
| 20A    | Location denied                                                               | 249:2913 / 249:6348 | Implemented composition; paired exports and browser captures.                  |
| 21     | Parking list                                                                  | 249:2964 / 249:6399 | Implemented composition; paired exports and browser captures.                  |
| 22     | Parking map                                                                   | 249:3020 / 249:6455 | Implemented composition; paired exports and browser captures.                  |
| 22A    | Destination / parking search                                                  | 249:3098 / 249:6533 | Implemented composition; paired exports and browser captures.                  |
| 22B    | Parking filters                                                               | 249:3144 / 249:6579 | Implemented composition; paired exports and browser captures.                  |
| 22C    | No results                                                                    | 249:3188 / 249:6623 | Implemented composition; paired exports and browser captures.                  |
| 23     | Parking status unconfirmed preview                                            | 249:3217 / 249:6652 | Implemented composition; paired exports and browser captures.                  |
| 24     | Illustrative parking-available preview (V1: truthful record preview only)     | 249:3304 / 249:6739 | Uses frame 23 unconfirmed preview. Availability example deliberately excluded. |
| 25     | Parking details long scroll                                                   | 249:3392 / 249:6827 | Implemented composition; paired exports and browser captures.                  |
| 26     | Saved/bookmark feedback                                                       | 249:3515 / 249:6952 | Implemented composition; paired exports and browser captures.                  |
| 27     | Share parking sheet                                                           | 249:3570 / 249:7008 | Implemented composition; paired exports and browser captures.                  |
| 28     | Entrance & access                                                             | 249:3649 / 249:7088 | Implemented composition; paired exports and browser captures.                  |
| 29     | Directions and external app choice                                            | 249:3714 / 249:7153 | Implemented composition; paired exports and browser captures.                  |
| 30     | In-app navigation concept                                                     | 249:3783 / 249:7222 | Implemented composition; paired exports and browser captures.                  |
| 26B    | Saved collection                                                              | 249:3853 / 249:7292 | Implemented composition; paired exports and browser captures.                  |
| 26A    | Saved empty                                                                   | 249:3911 / 249:7350 | Implemented composition; paired exports and browser captures.                  |
| EXT    | External integration notice                                                   | 249:3935 / 249:7374 | Real external-app handoff, failure and consent handling.                       |
| 22R    | Recentered map feedback                                                       | 249:3942 / 249:7381 | Real recenter action; no illustrative status.                                  |
| 30R    | Recentered navigation/route feedback                                          | 249:4019 / 249:7458 | Real navigation recenter; existing consent and route gates.                    |
| 16A    | Appearance selector (Figma displays four themes; V1 target only magenta pair) | 249:4092 / 249:7531 | Implemented composition; paired exports and browser captures.                  |
| 1B     | Additional welcome                                                            | 249:4141 / 249:7580 | Implemented composition; paired exports and browser captures.                  |
| 77     | Personal Info                                                                 | 249:4164 / 249:7603 | Backend/product gated; no fake state or account data. Frame export missing.    |
| 78     | Security                                                                      | 249:4208 / 249:7647 | Backend/product gated; no fake state or account data. Frame export missing.    |
| 79     | Language                                                                      | 249:4252 / 249:7691 | Implemented composition; paired exports and browser captures.                  |
| 80     | Help Center A                                                                 | 249:4298 / 249:7737 | Implemented composition; paired exports and browser captures.                  |
| 81     | Help Center B                                                                 | 249:4350 / 249:7789 | Backend/product gated; no fake state or account data. Frame export missing.    |
| 82     | Help Center C                                                                 | 249:4458 / 249:7897 | Backend/product gated; no fake state or account data. Frame export missing.    |
| 83     | Privacy & Data                                                                | 249:4523 / 249:7962 | Implemented composition; paired exports and browser captures.                  |
| 84     | About Parkey                                                                  | 249:4563 / 249:8002 | Implemented composition; paired exports and browser captures.                  |
| 85     | Log Out                                                                       | 249:4614 / 249:8053 | Backend/product gated; no fake state or account data. Frame export missing.    |
| 73     | Vehicle delete                                                                | 249:4762 / 249:8201 | Backend/product gated; no fake state or account data. Frame export missing.    |
| 74     | Vehicle delete confirmation                                                   | 249:4881 / 249:8320 | Backend/product gated; no fake state or account data. Frame export missing.    |
| 78A    | Security: Remember enabled                                                    | 249:5009 / 249:8448 | Backend/product gated; no fake state or account data. Frame export missing.    |
| 5P     | Phone sign-in integration notice                                              | 249:5053 / 249:8492 | Backend/product gated; no fake state or account data. Frame export missing.    |
