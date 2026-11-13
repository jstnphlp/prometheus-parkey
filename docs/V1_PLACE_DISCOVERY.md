# V1 in-app place discovery

The default discovery map (production and preview profiles with pilot discovery
disabled) uses MapLibre and the existing OpenFreeMap basemap. A shared symbol
layer adds named OpenMapTiles `poi` features from zoom 14, with collision detection
and rank sorting. No additional POI API, Google credential, database import,
Overpass query, or parking-derived place catalog is used. Parking markers retain
tap priority. Native Android/iOS and Expo web use the same layer and parser.

Tap a label or select a destination search result to open a dismissible in-app
card. Name and available address come from the source; absent addresses say
**Address unavailable**. Most basemap tiles do not include addresses. Selecting
**Find Parking Nearby** centers on the destination and uses the existing viewport
`discover_parking` Supabase RPC, filters and destination-distance ranking. Moving
the map continues browsing. This is viewport discovery, not a completeness or
vacancy guarantee. Empty/error states and the attributed unverified bundled
snapshot fallback remain unchanged. Place data never grants entrance approval,
public parking access, known fees/hours or live availability.

Get Directions on a parking result still uses the existing in-app route preview,
consent, fresh entrance checks, tracking and rerouting. External apps remain
explicit alternatives. Failed routing never renders a fabricated route. The
separate opt-in city pilot and its server destination catalog are unchanged.

## Production providers and licensing

- Map POIs are OSM-derived, supplied through OpenFreeMap under ODbL 1.0. Retain
  OpenFreeMap/OpenMapTiles/OpenStreetMap attribution and the existing map credits.
  Review redistribution/share-alike obligations before persisting or distributing
  a derived database. This feature only reads visible tile features in memory.
- The default OpenFreeMap styles expose the `openmaptiles` vector source and
  `poi` source layer. A custom style must retain that source/schema to support
  these labels. Review custom provider terms before release; retain the existing
  `PARKEY_MAP_PROVIDER_REVIEWED` gate. No new map credentials are required.
- Search continues using the Photon-compatible interface configured by
  `EXPO_PUBLIC_PHOTON_URL`. Production needs an owned or contracted HTTPS service
  with approved mobile/web usage, attribution, result-storage rights (including
  existing local recent searches), limits, privacy terms and web CORS. A private
  credential belongs on an authorized proxy, never in `EXPO_PUBLIC_*` or a bundled
  URL. Only provider-approved public restricted tokens may ship in clients.
  Record the review before setting `PARKEY_SEARCH_PROVIDER_REVIEWED=true`.
- In-app driving needs an owned/licensed OSRM-compatible HTTPS service at
  `EXPO_PUBLIC_OSRM_URL`, with browser CORS and a recorded review before setting
  `PARKEY_ROUTING_PROVIDER_REVIEWED=true`. Routing remains unavailable without it.
  Public Photon and OSRM demos remain prohibited by release configuration checks.
- Supabase still uses only `EXPO_PUBLIC_SUPABASE_URL` and the public publishable
  key, with the existing public RPC and reviewed publication controls. No new
  server resources, provider accounts or credentials were created.

## Verification and limitations

Focused units cover POI validation, unknown addresses, destination navigation
state and distance reference, existing public RPC handling of unknown/unverified
parking, and routing failures. Existing search, parking refresh, entrance trust,
navigation tracking and release-policy tests cover the reused pipelines.

Local validation on this feature branch: mobile typecheck, targeted ESLint and
Prettier checks passed; 51 place/search/parking/route/navigation/release tests and
13 existing discovery tests passed. `pnpm --filter @parkey/mobile export:web`
completed successfully. Review found a stale card on browser Back; cards now
dismiss on `popstate`, with typecheck/lint/format rechecked after the fix.

Android and iOS share the native implementation, but this change still requires
device checks for actual label rendering/hit targets, parking-marker precedence,
card dismissal, large text/screen-reader access, destination recentering and
navigation. Web export validates bundling, not browser interaction. No gate or
production release approval is established by these checks. No bookings,
payments, vacancy claims, analytics or hosted deployments are added.
