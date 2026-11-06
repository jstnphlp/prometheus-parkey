# Native Android review images

These are byte-identical copies of selected actual emulator captures from the
fresh version `0.1.0` / Android code `2` development APK. The
[manifest](manifest.json) records their source paths, byte counts, SHA-256 hashes
and code commit. Full raw captures, layouts and build logs remain under
`output/ncr/pilot-stage-b/`; the [final native execution record](../../../data/pilot-execution/2026-11-06/stage-b-android.json)
describes all 17 executed checks and limitations. Screenshots alone do not
establish a completed engineering gate.

- [Main Manila map, public results empty](01-main-public.png).
- Manila source details: [original identity and unknowns](07-manila-detail-top.png),
  [destination context and disabled entrance navigation](07-manila-detail-bottom.png).
- [Map focused by the museum destination search](08-manila-museum-map-focus.png).
- Mandaluyong source details: [original identity and access](11-mandaluyong-detail-top.png),
  [context and disabled entrance navigation](11-mandaluyong-detail-bottom.png).
- [Live reviewer revocation cleared private records and restored public mode](17-live-revocation-cleared-private.png).

The records are private, unverified source observations. Nearby descriptions are
not official names, ownership claims, visitor-access permission or parking offers.
No credential entry screens or session tokens are included.

MapLibre rendering uses OpenFreeMap/OpenMapTiles and © OpenStreetMap contributors
under ODbL-1.0. The displayed parking and destination observations retain their
OpenStreetMap source attribution. No Google/Waze place data is imported.
