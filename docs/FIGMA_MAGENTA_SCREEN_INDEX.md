# Figma magenta variants — paired screen index

Figma file: https://www.figma.com/design/UaU1KMJV2tMlwGB7Y1Co1g/Parkey-Initial-Design?node-id=244-2804

**Use the offline design snapshot first**, when present: [design-reference/README.md](../design-reference/README.md) and its `manifest.json`, screenshot PNGs, and layout JSONs. If an export is missing or stale, use the local Figma REST exporter; reserve live MCP for a narrow unresolved visual detail. **Do not claim PNGs/layout data exist before export.** Each row below pairs the same screen in Light + Magenta and Dark + Magenta. All 60 pairs were inspected in the Figma page index on 2026-11-16. Their order is the canvas order, **not** the navigation order. Figma's canonical journey is node `283:3352`; architecture route boards are `289:3698` and `289:3905`. Implementation requirements and V1 feature gating: [interactive architecture](FIGMA_MAGENTA_INTERACTIVE_ARCHITECTURE.md).

| ID  | Intent / UI state                                                             | Light + Magenta | Dark + Magenta |
| --- | ----------------------------------------------------------------------------- | --------------- | -------------- |
| 1   | Splash                                                                        | 249:1658        | 249:5087       |
| 2   | Walkthrough 1                                                                 | 249:1662        | 249:5091       |
| 3   | Walkthrough 2                                                                 | 249:1688        | 249:5117       |
| 4   | Walkthrough 3                                                                 | 249:1714        | 249:5143       |
| 5   | Welcome / auth choice                                                         | 249:1740        | 249:5169       |
| 6   | Create account                                                                | 249:1787        | 249:5216       |
| 6A  | Registration validation error                                                 | 249:1852        | 249:5282       |
| 7   | Verify email                                                                  | 249:1916        | 249:5346       |
| 7A  | Verification code expired                                                     | 249:1954        | 249:5385       |
| 7B  | Email verified                                                                | 249:1992        | 249:5423       |
| 8   | Basic profile information                                                     | 249:2015        | 249:5446       |
| 9   | Vehicle type selection                                                        | 249:2053        | 249:5485       |
| 10  | About You (required in Figma)                                                 | 249:2142        | 249:5575       |
| 11  | Driving Habits (required in Figma)                                            | 249:2181        | 249:5615       |
| 12  | Parking Preferences (required in Figma)                                       | 249:2222        | 249:5657       |
| 13  | Setup complete                                                                | 249:2264        | 249:5699       |
| 16  | Profile & Settings                                                            | 249:2286        | 249:5721       |
| 14  | My Vehicles                                                                   | 249:2425        | 249:5860       |
| 15  | Add another vehicle                                                           | 249:2540        | 249:5975       |
| 17  | Sign in                                                                       | 249:2625        | 249:6060       |
| 17A | Invalid credentials                                                           | 249:2679        | 249:6114       |
| 18  | Forgot password                                                               | 249:2733        | 249:6168       |
| 18A | Reset email sent                                                              | 249:2767        | 249:6202       |
| 18B | Set new password                                                              | 249:2796        | 249:6231       |
| 19  | Sign-in success                                                               | 249:2837        | 249:6272       |
| 20  | Location permission                                                           | 249:2862        | 249:6297       |
| 20A | Location denied                                                               | 249:2913        | 249:6348       |
| 21  | Parking list                                                                  | 249:2964        | 249:6399       |
| 22  | Parking map                                                                   | 249:3020        | 249:6455       |
| 22A | Destination / parking search                                                  | 249:3098        | 249:6533       |
| 22B | Parking filters                                                               | 249:3144        | 249:6579       |
| 22C | No results                                                                    | 249:3188        | 249:6623       |
| 23  | Parking status unconfirmed preview                                            | 249:3217        | 249:6652       |
| 24  | Illustrative parking-available preview (V1: truthful record preview only)     | 249:3304        | 249:6739       |
| 25  | Parking details long scroll                                                   | 249:3392        | 249:6827       |
| 26  | Saved/bookmark feedback                                                       | 249:3515        | 249:6952       |
| 27  | Share parking sheet                                                           | 249:3570        | 249:7008       |
| 28  | Entrance & access                                                             | 249:3649        | 249:7088       |
| 29  | Directions and external app choice                                            | 249:3714        | 249:7153       |
| 30  | In-app navigation concept                                                     | 249:3783        | 249:7222       |
| 26B | Saved collection                                                              | 249:3853        | 249:7292       |
| 26A | Saved empty                                                                   | 249:3911        | 249:7350       |
| EXT | External integration notice                                                   | 249:3935        | 249:7374       |
| 22R | Recentered map feedback                                                       | 249:3942        | 249:7381       |
| 30R | Recentered navigation/route feedback                                          | 249:4019        | 249:7458       |
| 16A | Appearance selector (Figma displays four themes; V1 target only magenta pair) | 249:4092        | 249:7531       |
| 1B  | Additional welcome                                                            | 249:4141        | 249:7580       |
| 77  | Personal Info                                                                 | 249:4164        | 249:7603       |
| 78  | Security                                                                      | 249:4208        | 249:7647       |
| 79  | Language                                                                      | 249:4252        | 249:7691       |
| 80  | Help Center A                                                                 | 249:4298        | 249:7737       |
| 81  | Help Center B                                                                 | 249:4350        | 249:7789       |
| 82  | Help Center C                                                                 | 249:4458        | 249:7897       |
| 83  | Privacy & Data                                                                | 249:4523        | 249:7962       |
| 84  | About Parkey                                                                  | 249:4563        | 249:8002       |
| 85  | Log Out                                                                       | 249:4614        | 249:8053       |
| 73  | Vehicle delete                                                                | 249:4762        | 249:8201       |
| 74  | Vehicle delete confirmation                                                   | 249:4881        | 249:8320       |
| 78A | Security: Remember enabled                                                    | 249:5009        | 249:8448       |
| 5P  | Phone sign-in integration notice                                              | 249:5053        | 249:8492       |

## Codex usage

1. For each feature, first check `design-reference/screens/<theme>/<id>.png` and `design-reference/layouts/<theme>/<id>.json` (verify via `export-index.json`). Export missing frames with `node scripts/figma-snapshot.mjs --screens=<ids>` using a locally configured REST token. Only use MCP on a specific Figma node when those exports are insufficient or stale.
2. Build the interaction once and theme with semantic roles from [design tokens](FIGMA_MAGENTA_DESIGN_TOKENS.md). Verify both screenshots and runtime behavior.
3. Validate success, error, permission-denied, empty, keyboard, loading, offline and Back states; do not skip small variant screens.
4. Distinguish designed click-through states from actual operational integrations. Do not make setup/account required for discovery under the canonical V1 plan. Never implement booking or live availability.
5. Record parity / missing-backend / excluded-V1 status per row in PR notes (or a companion checklist) with exact device evidence. A node ID is a locator, not proof the flow works.
