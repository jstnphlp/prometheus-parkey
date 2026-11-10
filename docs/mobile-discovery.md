# Parkey mobile discovery

## Product and implementation

The single Expo Router `/` route opens the actual geographic map immediately.
No account, phone entry, onboarding, or tabs are needed. Search and filters sit
over the map. One persistent discovery sheet presents the compact summary,
nearby results, and selected parking. Its handle follows vertical drags and snaps
to compact, medium, or expanded positions; accessible buttons provide the same
actions. Selecting a marker or list row opens the medium parking preview. Closing
it restores the previous browsing position. Get Directions
opens an in-app driving route with a route line, distance, estimated travel time,
and written maneuver instructions. Foreground navigation recalculates the route
after sustained deviation or wrong-way travel. Other navigation apps
remain an optional external handoff (Apple Maps on iOS, Google Maps, and Waze).
Distances are explicitly straight-line distances to the selected destination,
user location, or map center; each label identifies the reference.
Unknown information stays unknown. There is no live availability claim.

After destination selection, the summary and list show **Parking near [destination]**.
The virtualized list ranks the visible, filtered records by straight-line distance
to that destination, falling back to the user's location and then the actual map
center. Equal distances use record ID for stable ordering. Rows show type,
verification, distance reference, and recorded fees; missing fees remain unknown.
Clear destination restores location/map-center ranking and clears the search text.
The **Lots & garages** filter includes both facility types.

The selected preview shows a photograph or an honest **No photos yet** fallback,
name, type, distance, fees, and source verification. Tap the thumbnail or **Photos
& full details**, or expand the handle, to reveal the horizontal gallery, recorded
hours, restrictions, address, provenance, photo credits, and correction tools.
Directions remain outside the scrolling content. Rows and previews show Open now, Closed, or Hours unknown based only on a
conservatively parsed source schedule in Asia/Manila. Raw source hours remain
visible. These labels describe the recorded schedule, not verified operation. Street distances still use a mapped midpoint
approximation, not a known entrance or walking route.

Browsing starts compact: a one-line summary shares the handle row with Saved
places and Map information, followed by a straight-line distance note and a
tappable first-result peek. Selecting a destination opens medium results;
selecting parking opens the medium preview. The idle search bar carries a small
Parkey wordmark, and the filter row has a trailing fade to indicate scrolling.
When distances reference map center, the header offers one user-initiated
**Use my location** action. Expanded results put rows first, with the longer
coverage, safety and status notes below them.

Compact height follows the measured header, text scale and first-result target;
results use roughly 45% or 80% of usable height. Selected previews have a minimum content
height where screen size permits. Snap heights adapt to orientation, safe areas,
and font scaling. Only the handle captures vertical sheet drags; lists, details,
and the horizontal gallery retain their scrolling gestures. Map data attribution is docked to the sheet's top edge in a measured, wrapping
48 pt minimum touch target; it remains visible when the sheet expands, with a
fallback while another map flow replaces the sheet. Both renderers use measured
top-overlay and sheet heights for initial positioning, explicit recentering and
padding changes. Padding updates preserve a manually panned view, including
when parking is selected.
At the expanded position, search and filter controls give way to the map peek
and return on collapse; attribution stays visible. Camera padding is bounded to
retain a map viewport on short screens, and floating controls hide when they do
not fit above the sheet.
Other markers soften when parking is selected and remain tappable. Search, map
information, drawing, contribution forms, and route itineraries temporarily
replace or hide the discovery sheet. Reduced-motion preferences disable sheet,
image, and map transition animation.

### Curated parking photos

`discovery/photos.ts` holds the approved catalog. It is intentionally empty until
real, location-matched photographs with reuse permission are supplied. No generic,
generated, sample, or local-draft photographs are presented as real parking photos.
The gallery is functional with metadata populated; current records show fallbacks.

Catalog keys prefer a parking record's `sourceUrl`, which survives the change
from a bundled OSM ID to a server UUID. A record ID is the fallback key. Each
`ParkingPhoto` requires a unique `id`, `thumbnailUrl`, `imageUrl`, `caption`,
`credit`, `sourceUrl`, and `license`. Use approved public HTTPS URLs and place the
entrance photo first; invalid or incomplete entries are ignored. Keep thumbnails
small and full images optimized. Attribution and license accompany each photo.
This is a local metadata catalog, not a new discovery API field or database table.

Only a selected parking thumbnail loads in the preview. Full-image gallery items
mount on expansion and use a virtualized horizontal pager with previous/next
buttons and a counter. Failed images show **Photo unavailable** and do not block
details or directions. No upload endpoint, storage bucket, automatic submission,
or hosted resource was added; local contribution signage images remain separate.

Empty lists offer the relevant recovery: clear a filter hiding records, zoom into
a queryable neighborhood, or return to the Poblacion pilot when using only the
bundled snapshot outside its coverage. Missing coverage never implies no parking.
Adding missing parking remains a secondary action.

Server refreshes retain the last successful result until a new request succeeds,
and only records intersecting the current viewport are shown. Loading and refresh
failures are explicit; Retry requests fresh records. Failed, cancelled, or late
requests do not replace the retained data. This is session-only retention, not a
persistent offline cache. Map geometry is memoized separately from list ranking,
and web map sources update independently so GPS changes do not resend unchanged
parking or route geometry.

Visual direction: magenta, teal, and white, with navy headings and native system
sans-serif typography (SF Pro on iOS). `discovery/palette.ts` centralizes UI and map
colors. White panels sit over `#F8F9FB`, with light borders, subtle dividers, and
restrained navy-tinted shadows. Rectangular controls and sheet corners use 12–16 px radii; map controls remain
circular. The primary magenta is `#980064`, with `#800052` for darker accents and
`#FCEAF4` for selected surfaces. Existing system text sizes and line heights remain
in use; the discovery sheet and preview layout now follow the map-first flow.

Primary actions use `#007F89` with white labels; secondary actions use white with
magenta outlines and deep magenta labels. Selected filters use light magenta with
deep magenta text. Buttons and inputs have coordinated pressed, disabled, and
focus treatments. Small secondary text uses `#667386`; `#7B8798` is reserved for
disabled or decorative elements. Bright teal (`#00B5B8`) is decorative or used for
progress indicators, never small text or white-label button backgrounds. Warning
and error colors remain distinct.

Both MapLibre renderers retain the existing light basemap and provider. Facility
markers are white with magenta outlines/labels and invert to magenta with white
labels when selected. Street lines are dark teal, magenta when selected. Routes
are dark teal with white casing; user location is teal and destinations magenta.
The legend follows the same palette. Geometry, layer order, hit areas, and
loading behavior are preserved. The map remains the working surface with padding
for the snapped sheet height. Data credits remain visible and open source details.
The separate operator website is unchanged.

Implementation lives in `apps/mobile/src/discovery`:

- `explore.tsx`: map workspace, filters, selections, map drawing, and local flow.
- `native-map.tsx` / `parking-map.web.tsx`: MapLibre native / GL JS renderers.
- `search.tsx`: explicit-submit destination search, cancellation, loading/error/empty states.
- `discovery-sheet.tsx` / `sheet-state.ts`: animated discovery panel, attribution,
  snap geometry, bounded camera padding, and browsing/selection transitions.
- `parking-row.tsx` / `presentation.ts`: type-based unnamed display titles and
  two metadata lines (distance/reference with verification, then recorded facts).
  Missing hours and fees share one muted label; provenance stays in full details.
- `chip-fade.tsx`: palette-based SVG fade for the horizontally scrollable filters.
- `parking-details.tsx`: parking preview, expanded details, and directions chooser.
- `photos.ts` / `parking-photos.tsx`: curated photo matching, validation, gallery,
  image loading and fallback states. `sheets.tsx` retains the shared modal shell.
- `route-details.tsx`, `routing.ts`, `use-route.ts`: in-app itinerary, validated
  OSRM route requests, explicit location sharing, cancellation, and request cooldown.
- `contribution-form.tsx` / `contributions.ts`: optional signage photo, validated
  local drafts, persistence, deletion, cooldown/deduplication, and storage failures.
- `use-parking.ts` / `data.ts`: viewport reads, schema validation, stale-request
  cancellation, source-aware snapshot merging, and network errors.
- `parking-results.ts`: retained-result transitions, debounced/cancellable refresh,
  and viewport-limited source matching.
- `use-location.ts`: user-requested foreground location, permission/error handling,
  timeout, and foreground tracking. Location is never sent to Parkey by this hook.
- `model.ts`, `map-data.ts`, and shared type-only contracts: geographic invariants.

The former welcome, phone, tabs, account, vehicles, bookings, checkout, confirmation,
QR pass, booking notifications, fees, and mobile operator-preview components and
reducers were removed. The independent operator web application remains unchanged.
Unreferenced historical SVG art and bundled Inter/Plus Jakarta Sans fonts were
removed after checking individual names, paths, and dynamic asset/font references.
Configured app icon and favicon remain; discovery uses native system fonts.

## Map renderer and native build

The embedded map uses **MapLibre React Native 11.5.0** on native and **MapLibre
GL JS 6.16.0** on web, with the OpenFreeMap basemap by default. No Google Maps
account, keys, or billing setup is needed. The native renderer requires React
Native 0.80+ and the new architecture; this repository uses Expo 58 / React
Native 0.88 / React 19.3. Expo Go displays a development-build requirement.

```sh
pnpm install --frozen-lockfile
# Regenerate ignored native projects after changing the map provider/plugin:
pnpm --filter @parkey/mobile exec expo prebuild --clean --no-install
pnpm --filter @parkey/mobile ios       # Xcode/CocoaPods; builds and starts Metro
pnpm --filter @parkey/mobile android   # Android SDK/JDK; builds and starts Metro
# Subsequent starts for an already-installed development client:
pnpm dev:mobile
pnpm --filter @parkey/mobile web
```

Native directories are generated and ignored. Rebuild after native dependency or
plugin changes. Application IDs default to `com.parkey.discovery`; configure
owned store IDs and signing separately for release. No hosted resource is created.

GL JS 6 needs an explicit worker URL under Metro. The start/web/export scripts
copy the pinned package's unmodified worker and shared module into ignored public
assets, served from the same origin. Keep these generated assets in web exports.
No Metro override or map worker CDN is needed.

Provider references:

- https://maplibre.org/maplibre-react-native/docs/setup/getting-started/
- https://maplibre.org/maplibre-react-native/docs/setup/expo/
- https://openfreemap.org/quick_start/
- https://project-osrm.org/docs/v5.24.0/api/
- https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server

## Public configuration and routing

The default basemap and modest development search need no keys. Customize
`EXPO_PUBLIC_MAP_STYLE_URL` with a compatible licensed style if needed. Create
an untracked `apps/mobile/.env` from `.env.example` only when configuring providers.
Never put private API keys or credentials in public configuration.

`EXPO_PUBLIC_OSRM_URL` is an OSRM-compatible base URL, before `/route/v1/driving/`.
It can include a path prefix. Use an HTTPS endpoint for deployed clients and
allow the browser app's origins in its CORS configuration. The service must
support car routing, GeoJSON geometry, full overview, and maneuver steps.

With no explicit endpoint, **development builds only** use
`https://router.project-osrm.org`. Its usage policy permits reasonable,
**non-commercial use only**, at most one request per second, with no uptime,
latency, or freshness guarantee. This is a development convenience, not free
production hosting. Production builds leave routing disabled until an
owned/licensed endpoint is explicitly configured. MapLibre and OSRM are free
software; hosting a routing server or using a provider can cost money.

Directions opens a preview using an existing location fix or the labeled map
center; it never asks for location permission. Start explains the reason and
starts a high-accuracy foreground location watch. Permission denial leaves the
preview open with Google Maps, Apple Maps, and Waze links. Routing consent
discloses that start, destination, and travel direction when rerouting go directly
to the configured routing provider, never through Parkey's backend.

Navigation rejects invalid coordinates, fixes older than 10 seconds, out-of-order
timestamps, fixes worse than 100 m, and jumps exceeding plausible road speeds plus
GPS uncertainty. Fixes worse than 40 m can update the raw location dot but cannot
advance guidance or trigger rerouting. Local route matching scores distance,
travel direction, and continuity within a movement-based progress window. The dot
and maneuver progress use the same match, avoiding a second nearest-segment snap
that could jump to a later crossing or parallel carriageway. Stationary compass
headings are ignored. Matching geometry is indexed once per route.

Maneuvers use per-step geometry lengths, with maneuver vertices and step distances
as fallbacks. A turn stays visible until the match is at least 3 m past it.
Remaining travel time interpolates the provider's per-step durations, falling
back to distance-weighted time when absent. These are provider estimates without
live traffic. Route requests limit road snapping at both ends to 100 m and reject
responses whose geometry endpoints exceed that distance. Reroutes constrain the
departure road to within 60 degrees of a reliable travel heading, when available;
the destination approach remains unrestricted.

Deviation beyond the larger of 50 m or twice the fix uncertainty, or consistent
travel opposite the route direction, must persist across fresh samples for at
least five seconds before rerouting. A missing GPS interval, uncertain fix,
location error, or hidden browser tab clears confirmation evidence. There are at
least 15 seconds between automatic requests. Requests have a 15-second timeout;
changing or ending navigation aborts pending work. Public demo endpoints remain
for modest non-commercial development testing only; throttling does not make
them suitable for production navigation.

The camera follows until a user gesture; Re-center resumes following. Web uses
the Screen Wake Lock API where supported and reacquires it on return to a visible
tab. End, X, Escape, and browser Back stop the watch and release the lock, with a
five-second Resume toast. Tracking samples exist only in memory; navigation
freezes backend parking-viewport queries and never writes GPS history to storage
or the URL. Arrival requires at least three accurate fixes spanning two seconds,
within the final 20 m of the route and 12–25 m of its endpoint, without a reported
speed above 5 m/s. Being near the destination across another road or at the start
of a loop is insufficient. Confirmed arrival stops tracking. I parked here
explicitly saves one car coordinate and timestamp on this device; Next
nearest uses already loaded real records of the same parking type, excluding
session rejections. Availability is not inferred. No notification timers are
offered because parking notifications are not implemented.

Routes are validated before rendering; missing routes, invalid responses, HTTP
failures, location failures, and timeouts have explicit states. The route line
comes from the routing service, never a straight line substituted on failure.
Distances and durations come from the route response; estimates exclude live
traffic. Written instructions describe each maneuver and the distance to travel
**after** it. Routes lead to a mapped location, which may not be the entrance.
Voice guidance, background navigation, and live traffic are not included.

The matching approach follows the public principles in
[Google Roads snapping guidance](https://developers.google.com/maps/documentation/roads/snap)
(use a sequence of nearby GPS points),
[Mapbox location tracking](https://docs.mapbox.com/android/navigation/guides/device-location/)
(match location before computing progress and detecting deviation), and the
[OSRM API specification](https://github.com/Project-OSRM/osrm-backend/blob/master/docs/http.md)
(step geometry/durations and bounded waypoint snapping). Parkey uses its existing
OSRM provider and local heuristics; it does not include these providers' full
road-graph matching engines or proprietary traffic data. Closely spaced roads
and different road levels still need real-device calibration and better provider
data. No additional service or location-history upload is introduced.

The route is shown inside the existing native and web maps, fitted above the
itinerary panel. The original optional external-navigation chooser remains
available from parking details. Sample records cannot request directions.

`EXPO_PUBLIC_PHOTON_URL` must implement Photon's `/api/` GeoJSON interface. Search
is sent only after an explicit submission, with a 1-second client cooldown, 5
results, geographic bias, and a 12-second timeout. The public Photon demo permits
reasonable use, can throttle/ban excessive use, has no SLA, and can change without
notice. Use self-hosted Photon or a contracted compatible service before launch.
Search text and map-center bias go to that provider; the UI discloses this.

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to load
published records through the discovery RPC after applying the migration in an
authorized environment. Leave both blank for the bundled pilot snapshot. No
Supabase SDK/auth dependency is needed for this read-only PostgREST request.
Secret keys never belong in `EXPO_PUBLIC_` variables. Supabase configuration does
**not** enable community uploads.

## Initial OSM data and licensing

The bundled JSON contains **43 real OSM records, including 6 street segments**,
from the WGS84 box `[121.024, 14.558, 121.041, 14.572]` around Poblacion and nearby
Makati streets. Its source snapshot date is recorded on every record. These are
not field-verified records. OSM geometry and tags may be outdated or incomplete.
All 43 bundled records currently have unknown hours. The hours parser is tested
with those real missing values and clearly synthetic normal, overnight, 24/7, and
malformed schedules; no source values are fabricated. Unsupported syntax stays
unknown. Daily/weekly schedules refresh while the app is active and on resume. Facility centroids are not guaranteed entrances.

The snapshot was extracted from a one-time OSM API map export after public
Overpass services were unavailable. **No runtime map interaction queries Overpass
or the OSM data API.** Update offline using a small export or a suitable regional
extract; do not repeatedly download data during app sessions:

```sh
# Supply a licensed local .osm XML export of the pilot box.
python3 scripts/extract-osm-parking.py pilot.osm candidate-snapshot.json \
  --observed-at ACTUAL_EXPORT_TIME_ISO8601 \
  --source-url https://api.openstreetmap.org/api/0.6/map?bbox=121.024,14.558,121.041,14.572
# Review candidate-snapshot.json and its manifest before replacing the bundled snapshot.
# After an approved replacement, refresh the audit, queue and local seed:
pnpm data:refresh
pnpm audit:data
```

The extractor preserves source identity and links. It accepts explicitly tagged
parking facilities and street lanes, retains explicitly tagged restricted-access
facilities with source restrictions, excludes construction, unsupported
conditional-only lanes, and street-parking point tags
without line geometry. Restricted-access mapping does not establish public access
or permission to park. It skips relations until member/polygon assembly is added.
It never infers parking from an untagged road. Source restrictions and unknown
sides are retained. No capacity tags become vacancy counts.

OSM-derived data is licensed under [ODbL 1.0](https://www.openstreetmap.org/copyright),
© OpenStreetMap contributors. The JSON and generated SQL are the distributed
extract, with attribution in the app and each source. Retain attribution and
ODbL obligations when redistributing a derived database; do not relabel OSM data
as proprietary Parkey data. Keep provenance distinguishable when merging sources.
Provider-specific licensed data must not be persisted without permission.

## Contributions and preview boundaries

Tap **+**, select a type, and tap the map. Street contributions take 2–12 ordered
points (with undo); lots/garages take one point. Add a name, optional sourced
restrictions/hours/fees, side of street, and optional signage photograph.
Reports from the details sheet retain the target record. Adjusting the geometry
preserves entered form fields. Reports require a correction description.

**Save local preview** persists only on this device. It does not call a server,
enter a real moderation queue, become publicly visible, or auto-upload later.
The success screen says this explicitly. Map information shows local drafts and
delete controls. At most 20 drafts are kept, with a 30-second cooldown and duplicate
checks; these are local safeguards, not production abuse protection. Photographs
use local picker URIs and may expire if the system clears cached media.
See [database boundaries](database.md) for the server work needed before launch.

Development samples are opt-in from Map information, replace the visible dataset,
carry SAMPLE names and a persistent warning, and disable directions. They are
separate from the real unverified OSM snapshot and are never database seed records.

## Validation

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build:web
pnpm --filter @parkey/mobile export:web
```

`pnpm test` covers geographic validity, filter/line rendering data, source metadata,
unknown values, contribution validation and limits, provider coordinate order,
response validation, geocoder requests, safe OSM extraction, and the unchanged
operator reducer. PostGIS/RLS tests are separate under `supabase/tests/database`.
No automated check can establish current parking legality or data freshness.

## Previous renderer verification · 28 October 2026

The results below describe an earlier MapLibre implementation and predate in-app
routing. They do not verify the new directions flow on a device or in a browser.

- Workspace lint, strict typecheck, formatting, and operator production build passed.
- 14 Node tests and the Python OSM extraction test passed.
- Both migrations and local seeds applied to an isolated disposable Supabase
  Postgres 17 container. All 53 discovery and 103 legacy pgTAP checks passed.
  Actual anonymous RPC output for all 41 seeded records passed mobile contract validation.
- Expo browser static export passed. Playwright checked real tile rendering,
  actual Photon search/recentering, details expansion, directions chooser,
  correction validation/local saving, two-point street drawing, and layouts
  at 390×844 and 320×568. No browser console errors remained; the upstream
  basemap style emits non-fatal road-shield filter warnings with GL JS 6.
- iOS development build succeeded, installed on an iPhone 17 Pro simulator,
  and rendered the native geographic map, facility markers, and street line.
  Xcode's binary download initially stalled; caching the official archive after
  checking its Package.swift SHA-256 allowed compilation without source overrides.
- Android, physical-device GPS/permissions/photo picking, and native navigation
  app handoffs were not verified. No hosted Supabase API or server submission
  flow was deployed or verified. Database tests used SQL against the disposable
  container because the standard local Supabase port was occupied.
- `expo install --check` recommends patch updates for pre-existing pins
  (`expo` 58.0.20 and `expo-router` 58.0.27). Installed 58.0.19/58.0.26 were retained;
  newly added native packages use SDK 58's prescribed versions. No framework
  upgrade was made as part of this redesign.

### Discovery filters

Type filters include street, lots and garages together, lots, and garages. Fee
applies matches only an explicit supported source assertion; it does not estimate
a price. When active, unknown fees appear separately after matches, with an
explicit count and label. Missing fees never imply free parking. No vacancy,
amenity, numeric price, or hours filter is offered by this dataset.

### Saved places on this device

The star beside the discovery sheet handle opens saved places. Save where I parked explicitly
requests the current location; it never silently saves the map center or a previous
GPS fix. A navy Your car marker distinguishes the saved point. The home chip
shows its age and opens walking directions in Google Maps; the OSRM driving
profile is never presented as a walking route. Replace or clear the pin in Saved
places. Only this explicitly saved point and timestamp are persisted, with no
tracking history.

Parking details offer a favorites star. Recently viewed keeps the last 10 distinct
real records, newest first. Samples are excluded. Identity prefers source URL over
record ID, so an OSM record can resolve after a server UUID change. Saved metadata
is minimal and never substitutes for current parking details. Records absent from
loaded data offer Show saved area and removal; this does not assert deletion.

Versioned AsyncStorage data persists across restarts with validation, serialized
writes and recoverable errors. Failed writes do not display a successful change.
Retry loading or explicitly clear damaged saved data; contribution drafts use a
separate key and remain intact. No account, sync, auto-upload, or server writes
are involved. Device backup behavior is controlled by the operating system.

### Optional analytics and crash diagnostics

**V1 collection is locked off in `config.ts`, even when provider environment
values are supplied.** The adapter descriptions below are historical integration
references, not authorization to collect. Enabling either provider requires the
canonical privacy and release gates. No Track D adapter is implemented here.

Plausible Events API is configured with EXPO_PUBLIC_ANALYTICS_ENDPOINT (an HTTPS
ingestion endpoint) and EXPO_PUBLIC_ANALYTICS_DOMAIN (the registered hostname).
Both are required; unset/invalid configuration makes no requests. Register custom
events and their properties in your existing Plausible service before enabling.
No hosted service, account, or dashboard was created. This adapter uses fetch,
not an analytics SDK; it creates no persistent/session identity, cookies, or queue.
A fixed https://<configured-domain>/app URL is sent, never the current URL.
Requests time out after five seconds; failures are ignored, with no retries.
The provider still receives ordinary connection metadata such as IP and user agent;
review its processing and retention policy before enabling in a release.

Each event includes schema_version=1 and platform (ios/android/web). The only
additional properties are these bounded enums; no record identifiers, coordinates,
search text, names, source URLs, or user identifiers are included:

| Event              | Properties / trigger                                                         |
| ------------------ | ---------------------------------------------------------------------------- |
| app_open           | Once per cold JS launch                                                      |
| parking_viewed     | parking_kind, source_kind, verification; explicit record selection           |
| directions_tapped  | target_type (parking/parked), navigation_provider (in_app/apple/google/waze) |
| filter_used        | filter (kind/fees), value (supported filter enum)                            |
| contribution_saved | intent (add/correction), parking_kind, storage=local; successful local write |
| parked_spot_saved  | Successful local write                                                       |
| favorite_added     | parking_kind, source_kind; successful local add                              |

EXPO_PUBLIC_SENTRY_DSN accepts a public HTTPS Sentry DSN. Blank/invalid means no
Sentry import or initialization. @sentry/react-native is pinned to 8.33.0; published
peer ranges accept the current React, React Native and Expo versions. Framework
pins were not upgraded. Rebuild the native development client after installation.
The reviewed @sentry/cli binary download scripts are explicitly denied in workspace
build policy: source-map upload tooling is not used, and no upload credentials
are configured.

**Crash coverage is JavaScript-only.** Native capture and native initialization
remain disabled because native crash envelopes bypass the JavaScript sanitizer.
Native crash reporting requires equivalent native privacy controls and device
verification before enabling. Only global JS errors/unhandled rejections are
collected, with no Promise replacement; non-Hermes native rejection tracking may
therefore be unavailable. The allowlist reconstructs generic error text and safe
bundle line/column frames. User data, raw messages, URLs, request bodies, breadcrumbs,
replay, screenshots, view hierarchy, sessions, logs, profiling and tracing are
excluded. Detailed source symbolication and native crashes are not verified.

On a rebuilt Android/iOS client, verify cold-launch event deduplication, every
action event, offline failures, absent-config silence, and sanitized JS crash
delivery against an authorized existing provider. Never put Sentry auth tokens
or private analytics API keys in EXPO_PUBLIC_ variables.

### Android smoke flows (Maestro)

See [flow prerequisites, commands, and manual checks](../apps/mobile/.maestro/README.md).
The smoke flow opens the map, searches a destination, selects a facility, opens
full details, and taps Get Directions. Search and map data are real provider
responses. Location is denied in the automated smoke run so directions must show
an honest recoverable location error, not fabricated route success. Run the
documented permission-granted route check separately on a real Android device.
These flows have been statically checked, not executed on an emulator/device.

### User-facing release experience

The public map uses the Parkey wordmark, Saved places and Map information controls,
without a pilot badge or setup/configuration messages. Coverage recovery offers
Explore Poblacion and explains that missing records do not establish parking
availability or permission. Map information includes privacy/reporting status,
attribution and drafts stored on this device. Source credits and Last updated
remain in full details. The historical OSM pilot qualifier is removed only from
its display label; the source snapshot and contracts are unchanged.

Development sample controls render only in development builds. A second guard
prevents sample selection from affecting release/test data even if requested.
Local contributions say Draft saved on this device, explicitly not submitted for
review, with no implication of a real moderation queue. Hours refresh at minute
boundaries and on resume. No new account, upload, vacancy claim or public provider
resource is introduced.

### V1 A3 parking trust

The [A3 completion report](V1_A3_COMPLETION.md) records the current detail/photo/navigation acceptance evidence. Consumer imagery uses only the curated, location-matched catalog with license and credit; that catalog remains empty. Raw image, Commons and Mapillary tags cannot authorize publication. Future photos require documented reuse rights, original source and an exact parking-location review. All parking driving handoffs refresh current public entrance authorization; source geometry, cached approval, ambiguous identity and offline failures never grant a route.
