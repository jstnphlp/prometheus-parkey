# Discovery database

Parkey V2 adds a discovery dataset alongside the legacy reservation foundation.
The migration does **not** rename, delete, copy, or reinterpret legacy records.
No hosted migration has been run. See [legacy schema](legacy-reservation-schema.md)
for its operators, inventory, reservations, vehicles, payments, and constraints.
Those tables remain denied to mobile clients and are unused by discovery.
Existing hosted data must be audited before any later archival or deletion.

## Entities

| Entity                             | Purpose                                                                                                                                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `discovery_sources`                | Public attribution, license, source kind (`osm`, `parkey`, `community`), import date. Never private review evidence.                                                                                 |
| `discovery_parking`                | Facility `Point` or street `LineString` in WGS84; type, optional address/fees/hours, street side, source record/link/date, publication and verification metadata. No operator or account dependency. |
| `discovery_regulations`            | Sourced restriction text, observation date, and publication flag for a parking record. Independent source attribution.                                                                               |
| `parkey_private.community_reports` | Private new-location/correction reports with geography, optional details/photo path, and `pending_review`/`accepted`/`rejected` state. No client access or automatic publication.                    |

Facilities are points in this MVP. Imported polygon centroids are explicitly not
entrances. Street geometry describes the road extent, never individual bays.
Left/right follows the stored line's coordinate order. Unknown side is explicit.
Geometry constraints reject empty, non-WGS84, invalid, degenerate, out-of-range,
and kind-incompatible data. Report lines must be 5 m–1 km long. Verification
requires a finite date and a public evidence URL; it never means current vacancy
or unrestricted legal parking. Unknown fees/hours stay NULL; sourced fees/hours
require an observation date. Do not copy speculative values into these fields.

## Read API and indexes

`POST /rest/v1/rpc/discover_parking` accepts `west`, `south`, `east`, `north` and
returns `{ records: DiscoveryParking[], truncated: boolean }`. It includes only
published records/rules intersecting the viewport and at most 250 records.
The stable, **security invoker** RPC respects RLS. It rejects null/non-finite,
inverted, dateline-crossing, and greater-than-0.5-degree bounds. Clients query
at neighborhood zoom (12+) after a 400 ms settling delay and cancel stale requests.
The MVP does not support viewport queries across the antimeridian.

A partial geometry GiST index serves `ST_Intersects` viewport queries. A separate
geography GiST index supports future `ST_DWithin`/nearest queries in meters.
Source identity and all foreign keys have supporting indexes. No occupancy,
reservation, or payment fields are added to the discovery model.

## Access and submission boundary

Anonymous and authenticated roles have SELECT only on discovery tables. RLS
exposes published parking and published rules of published parents; source
attribution is public. All mutation and truncate grants are explicitly revoked.
Private reports have RLS, no policies, no client grants, and no private schema
usage for clients. The legacy schema's deny-by-default access is unchanged.
No public security-definer function, storage bucket, or upload endpoint is added.

**The mobile contribution flow is local only**, even with Supabase configured.
It never writes these tables. Before enabling server submissions, add a trusted
endpoint with server validation, challenge verification, durable rate limits,
idempotency/replay limits, body/photo size and MIME checks, private storage,
moderation, retention rules, and a privacy disclosure. Client cooldowns are not
server abuse protection. Publish only through a reviewed trusted process; accepting
a report must not silently verify parking. No admin dashboard is included.

## Local data and verification

`seed.sql` retains the explicitly fictional legacy fixtures. The separate
`seed-discovery.sql` loads the actual attributed OSM pilot snapshot, unverified,
using the new schema. Both are **local-only**, configured in `config.toml`.
No sample street fixture is inserted into Postgres. Regenerate the discovery seed
with `pnpm data:refresh` after a reviewed OSM JSON refresh. Run `pnpm audit:data`
to detect stale audit/queue/seed artifacts. See [data preparation](parking-data-quality.md)
for the offline candidate and immutable seed replay workflow. The seed validates
the entire snapshot before SQL generation and fails closed if an existing record,
attribution, publication/verification state, or regulation differs. Repeated identical
imports are safe; changed data requires explicit human reconciliation. It does
not update or delete existing records and never imports the research queue.

With an available local Supabase stack:

```sh
pnpm exec supabase migration up --local
pnpm exec supabase test db --local
pnpm exec supabase db lint --local --schema public,parkey_private --fail-on error
```

Do not reset a database containing valuable data. Standard local resets run both
seed files and are destructive to local data. Tests are transaction-scoped and
roll back. `discovery.test.sql` checks geometry, provenance requirements, public
reads, hidden records/rules, private report isolation, denied mutation grants,
viewport intersections, bad bounds, and truncation for both client roles.
