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
- Public autocomplete now uses a provider-neutral Supabase Edge Function at
  `/functions/v1/place-search`, with LocationIQ as the server adapter. Set
  `EXPO_PUBLIC_PLACE_SEARCH_ENABLED=true` after deployment. The app sends only
  search text, with a 600 ms debounce; no map bias, research mode or provider token
  is sent. Country filtering is fixed to `ph` server-side. `EXPO_PUBLIC_PHOTON_URL`
  remains the explicitly configured legacy adapter when the proxy is disabled.
  Release builds still prohibit public Photon demo endpoints.
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

Android and iOS share the native implementation. Android API 35 results for the
completed integration are recorded below; physical Android and iOS validation
remain outstanding. No canonical production gate is advanced.

## LocationIQ rollout (13 November 2026)

User-authorized target: `nuepweyzpkqfihjsbsik`. Only `place-search` and its new
`20261113120000_place_search_quota` migration are deployed; unrelated pending
migrations, research publication controls and analytics are untouched. The quota
migration was tested in a rollback transaction before deployment and recorded
atomically in the migration ledger.

Supabase secrets (never Expo configuration):

- `LOCATIONIQ_API_TOKEN`: the provider token, used only by the Edge Function.
- `PLACE_SEARCH_PUBLIC_KEY`: this project's public publishable key, used to reject
  misconfigured clients; public keys are not user authentication or bot protection.
- `PLACE_SEARCH_WEB_ORIGINS`: comma-separated exact approved browser origins.
  Development localhost ports 8088/8081 are configured; add the actual deployed
  web origin before public web use. Native apps do not send browser Origin.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: platform-provided server values.

The function has gateway JWT verification disabled for anonymous discovery, then
checks the public project key. Shared atomic quotas across all function instances
allow at most 2 requests/second, 30/minute and 1,000/day. These are conservative
application budgets, not a statement of the account's subscribed allowance. The
three private counter rows store no searches, coordinates, IPs or identities.
Provider rate limits return 429 with Retry-After; clients respect the cooldown.
Upstream failures are sanitized and never expose the token or raw provider body.
POST input is bounded, provider requests have an eight-second timeout, and
responses use no-store. All quota failures fail closed before calling LocationIQ.

The server returns only normalized name, address, coordinates, ID and attribution.
Changing the server adapter leaves the map UI unchanged. It cannot read restricted
research destinations. Configured parking reads use only the existing public RPC,
without silently reintroducing the unverified bundled snapshot. Empty coverage
never establishes that no parking exists.

LocationIQ attribution links appear with suggestions, the place card and the
selected destination. Credit survives shared navigation and browser refresh and
is cleared for a subsequently chosen basemap place. LocationIQ selections are
excluded from persistent recent-search storage. Existing navigation URLs can
retain an explicitly selected name/point and credit; searches/response lists are
not stored by the proxy. Existing web navigation behavior therefore still applies.

Provider references: [Autocomplete API](https://docs.locationiq.com/reference/autocomplete),
[attribution](https://locationiq.com/attribution), and
[terms](https://locationiq.com/terms). The owner must maintain an account/plan
allowing autocomplete and comply with its current quota and attribution terms.
`PARKEY_SEARCH_PROVIDER_REVIEWED=true` records the technical provider review for
this phone-test build; it does not advance the canonical production/privacy gates.
No LocationIQ key is present in the APK or tracked source. OSRM production
restrictions and fresh parking-entrance authorization remain unchanged.

Live proxy validation returned HTTP 200 for SM Megamall (6 suggestions), Jollibee
(6), Rizal Park (6) and Ayala Avenue (2), with LocationIQ attribution. These are
actual provider responses, not parking approvals or vacancy claims.

### Integration validation

- Workspace lint, strict TypeScript, formatting and operator-web build passed.
- 65 targeted mobile/search/proxy/parking/navigation/release tests passed, with no
  skips. The eight quota SQL checks passed in a rollback-only transaction.
- Real endpoint tests returned the four Philippine queries above. Research-mode
  field injection returned HTTP 400. The public parking RPC returned HTTP 200 and
  zero records around the tested SM Megamall point; no positive parking or live
  vacancy claim is made.
- The final standalone release-variant APK installed on Android 15/API 35
  `Parkey_A0_API35`. Native checks verified real SM Megamall suggestions, name and
  address selection, destination recentering, Find Parking Nearby, the empty
  parking state and credit. Empty-query-result handling and Wi-Fi/mobile-data
  offline/reconnection recovery were also exercised. A credit layout defect
  found with the keyboard open was fixed, rebuilt and verified on the final APK.
- APK v2 signing verification passed. Architectures: ARM64 and x86_64; Android
  minimum SDK 24. Private-token and server-handler bundle exclusion checks passed.
  This remains locally development-key signed, not a production-signed release.
- Artifact: `output/ncr/locationiq/parkey-locationiq-test.apk` (excluded from Git),
  SHA-256 `5ba880c394c2071527c39755ab12f4a9fd3ebd61a79d7d57a0bed6b43f2f4417`.
  Local XML, screenshot and API/test receipts are under `output/ncr/locationiq/`
  and `output/ncr/place-search-live-receipt.json` (also excluded).
- No physical Android or iOS test was performed. Positive live approved-parking
  navigation could not be exercised at the test destination because no public
  records were returned; existing entrance-refresh, routing/rerouting and failure
  unit coverage passed. Routing remains disabled without an approved OSRM service.
  No canonical production gate was changed.

### Owner-requested test UI adjustment

Visible LocationIQ credits in suggestions and destination views, and the extra
Map places source paragraph in the place card, were removed at the owner's
request for the current test UI. General places/labels and the existing map
information/source control are retained. Server attribution metadata is retained.
This does not waive LocationIQ or basemap licensing obligations: restore any
required visible attribution before public release unless the provider plan
explicitly permits removal. Earlier attribution screenshots/checks above describe
the preceding APK, not this revised UI.

Validation of this follow-up: mobile typecheck and targeted ESLint passed. The
standalone APK rebuilt successfully and its signature verified; the removed
credit strings are absent from its app bundle. Artifact:
`output/ncr/locationiq/parkey-locationiq-test-no-credits.apk`. The emulator was
closed, so this revised UI was not reinstalled or rechecked on a device.
