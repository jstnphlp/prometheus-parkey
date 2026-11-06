# A0 Android 15 emulator evidence

Actual Parkey native development-client captures from `Parkey_A0_API35`, Android
15/API 35/x86_64. These show the current mobile tree, not the older API 37 run.
The [receipt](receipt.json) records configuration, APK/source identity, test
outcomes, artifact SHA-256 hashes and limitations. See the
[baseline report](../../V1_A0_MOBILE_BASELINE.md) for acceptance and open defects.

- [Real Photon destination results](02-search.png).
- [Garage filter and empty-state recovery](03-garage-filter.png).
- [Truthful details and disabled unapproved navigation](04-details.png).
- [Android foreground permission prompt](05-permission-prompt.png).
- [Favorite retained after restart](08-saved-after-restart.png).
- [Actual offline search failure](09-offline-search.png).
- [Real search results after reconnect and retry](10-search-recovery.png).
- [Explicitly saved simulated parked spot](11-saved-parked.png).
- [Google Maps walking handoff, stopped at onboarding](12-walking-handoff.png).
- [Pilot backend configuration error](13-pilot-unconfigured.png).
- [Empty reviewer token rejected](15-candidate-guard.png).

Matching UI-layout JSON is included where captured under the same name. No
private records or credentials appear. Development Tools/error overlays remain
visible in some captures and are not product controls. MapLibre rendering uses
OpenFreeMap/OpenMapTiles and OpenStreetMap attribution; bundled parking retains
its OSM provenance. Simulated location and unverified source records do not
establish visitor access, approved entrances, available spaces or publication
permission. Screenshots are engineering evidence, not approved parking photos.
