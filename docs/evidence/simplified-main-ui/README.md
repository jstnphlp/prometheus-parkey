# Parkey simplified main UI verification

The Android QA build ran on the connected x86_64 emulator at 360 × 800 dp. The installed QA package used the isolated implementation worktree and the existing local public discovery configuration. The live basemap, parking records, geocoder results, provider attribution, Android system bars, and safe areas determine the app content shown beside the illustrative 430 × 932 Figma frames.

| Figma state                           | Light Magenta | Dark Magenta |
| ------------------------------------- | ------------- | ------------ |
| Main map and collapsed legend         | `427:478`     | `427:760`    |
| Selected parking                      | `427:530`     | `427:812`    |
| Search                                | `427:603`     | `431:310`    |
| Guest drawer                          | `427:674`     | `431:340`    |
| Expanded legend                       | `445:418`     | `445:503`    |
| Expanded legend with selected parking | `445:460`     | `445:552`    |
| Signed-in drawer                      | `459:756`     | `459:802`    |
| Guest account                         | `461:868`     | `461:924`    |
| Signed-in account                     | `461:889`     | `461:925`    |
| Sign-out confirmation                 | `464:875`     | `464:919`    |

The design contexts, screenshots, sizes, and prototype connections were inspected through the Figma MCP connection. [Parkey Figma design](https://www.figma.com/design/UaU1KMJV2tMlwGB7Y1Co1g/Parkey-Initial-Design?node-id=427-478)

## Visual comparisons

- [Android map and legend in both themes](map-and-legend.webp)
- [Android search, guest drawer, and account entry in both themes](search-drawer-account.webp)
- [Android parking details and expanded legend in both themes](selected-parking.webp)
- [Figma signed-in drawer, account, and confirmation references](signed-in-references.webp)

## Verification scope

- Android exercised the left drawer, close button, backdrop, Back, both legend states, theme switching, and the guest account screen.
- Android opened the existing email sign-in and registration forms, Saved parking, and the private report form. The live destination search returned Glorietta and moved the map to the selected result. The map showed an inline notice when the area had no mapped parking.
- Android saved a private QA draft and tapped its rendered marker. The native check covered compact and full details, a retained selection across themes, plus search focus and typed input. The draft stayed in the isolated build on the emulator.
- Focused Chromium checks covered overlay map identity, compact and full details for a published-record fixture, provider results, empty and failed search recovery, recents, and local draft creation and review. A pilot-specific test preserved the selected record and MapLibre instance while switching both themes.
- Profile setup, session verification, navigation approval, search, reporting, and discovery regression tests use their existing contracts. The required signed-in profile setup comes from the prerequisite implementation branch.

Signed-in Android screenshots, a completed registration and sign-out against the live service, physical-device accessibility, software-keyboard resizing, and an approved live directions handoff remain unverified. The signed-in comparison sheet contains the Figma references. Some broader browser scenarios still target the previous tab navigation.
