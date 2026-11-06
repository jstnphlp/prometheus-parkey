# Manila and Mandaluyong pilot backend

The pilot runs through Supabase/PostgREST and PostgreSQL. It has no runtime
dependency on the local research preview server. Scope version
`manila-mandaluyong-v1` allows exactly Manila and Mandaluyong.

## Geography and source provenance

`data/pilot-geography.v1.json` retains the selected cities' real source polygons
and licensed attribution. The database retains all 17 original NCR LGU polygons
to detect ambiguous overlaps. Their original hash-verified archive remains at
`data/ncr-research/ncr-lgus-osm.geojson.gz`; it is never overwritten.

The whole original source geometry must be strictly inside the selected city
and intersect no other retained LGU. Border touches, overlaps and crossing
features are excluded rather than clipped, moved or assigned by centroid.
The source anchor and any authorized vehicle entrance must also stay inside
that city. Source points remain source points, not inferred entrances.

The v1 import RPC requires the frozen research, boundary, destination-report and
destination-source hashes. A new source version requires an explicit versioned
change; supplying another snapshot does not silently replace v1 provenance.

## Explicit private catalog import

An authorized local operator supplies an existing reviewer UUID and a JSON array
of 1–50 unique original source IDs. The CLI verifies the retained archives and
freezes each original record, record hash, destination context and context hash.

```powershell
node scripts/pilot-catalog.mjs candidates Manila output/ncr/pilot/manila-ids.json REVIEWER_UUID output/ncr/pilot/manila-import
node scripts/pilot-catalog.mjs destinations Mandaluyong output/ncr/pilot/destination-ids.json REVIEWER_UUID output/ncr/pilot/destination-import
```

The commands write new private `.json` and `.sql` files and refuse overwrites.
Store them under the ignored `output/ncr/` directory with appropriate workstation
access controls. Execute only against an authorized local database using UTF-8
bytes. `pilotCatalogSql` and `preparePilotCatalog` are also exported for controlled
local tooling. PowerShell native-pipe encoding conversion can invalidate hashes;
use a byte-preserving database client or Node subprocess input Buffer.

The service-only `import_pilot_catalog` RPC checks the existing reviewer registry.
It does not enable a city, grant a reviewer role, publish parking, approve a
destination, or copy a public review queue. Candidate imports remain private even
when a source contains an approval/verification claim. Original unknown facility
types and source restrictions are preserved. Latest versions supersede older
catalog views while immutable source snapshots remain available internally.

## Read API and authorization

All RPCs accept exact city and mode values. Public mode is available to anonymous
and authenticated clients. `candidate_research` requires all of:

- A verified `authenticated` JWT with `auth.uid()` and `aal2` assurance.
- An existing `discovery_reviewers` row with `can_candidate_research = true`.
- The selected city's `candidate_research_enabled = true`.

The role and city flags default false. A service credential alone is not a
reviewer session. Revoking a registry flag or city flag denies the next read even
with an otherwise unexpired JWT. Clients cannot access private catalog tables,
change flags, appoint reviewers, import records or publish destinations.

| RPC                           | Parameters                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `discover_pilot_parking`      | `p_city`, `p_mode`, `p_bbox`, `p_limit = 50`, `p_after = null`                 |
| `get_pilot_parking`           | `p_city`, `p_mode`, `p_id`                                                     |
| `discover_pilot_destinations` | `p_city`, `p_mode`, `p_bbox`, `p_limit = 50`, `p_after = null`, `p_query = ''` |

`p_bbox` contains only numeric `west`, `south`, `east` and `north`. It must
intersect the selected city and span at most 0.5 degrees in either direction.
Limits range from 1 to 100. Destination name search is a case-insensitive literal
substring bounded to 100 characters. Signed opaque cursors bind endpoint, scope
version, city, mode, viewport, limit and query; they cannot be replayed across
queries or changed to reveal another city's/private mode's rows.

Responses contain `schemaVersion: 1`, `scopeVersion`, `city`, `mode`, `records`,
`nextCursor` and `notice`. Parking responses use `kind: pilot_discovery`;
destination responses use `kind: pilot_destinations`.

Parking `name` and `accessClass` retain the original source facts. Reviewed
`officialName` and `descriptiveLabel` remain separate. Candidate context retains
its source category, license, URL, approximate straight-line distance, containment
fact and uncertainties. It grants no parking identity, access, publication,
entrance or walking-route claim. Public parking responses contain no private
destination-context/review-queue copies.

## Public parking and destination decisions

Public parking uses only individually approved Stage A evidence records.
Publication, current expiry, latest approval, source identity, original lot/garage
classification, full geometry and mapped safety/access restrictions are checked
server-side. Normalized `accessClass`, raw `sourceTags.access`, and raw
`sourceTags['parking:access']`, when
present, must be unknown/missing, yes, public or permissive. Recognized string
case and outer whitespace are normalized for this check; arbitrary explicit
values, members/customers access and compound values fail closed. Unknown source
access still requires the existing accountable human visitor-access approval.
It never grants access by itself.

The additive publication-audit trigger enforces that same access check on every
future Stage A approval, regardless of pilot activation. Rejection and revocation
remain available. A raw members tag cannot be masked by `accessClass: unknown`.
The CLI checks the same fields before constructing an approval request. Source
corrections add evidence/version history; do not edit frozen source archives to
bypass a restriction.

Navigation requires the existing explicit, unexpired Stage A visitor entrance
and operator authorization. `get_pilot_parking` supports fresh server revalidation
before external Maps navigation. Expired/revoked/out-of-city records disappear
from that response. No live vacancy or availability is inferred.

Named destinations have a separate source catalog and decision path. The
service-only `moderate_pilot_destination` RPC requires a publisher, an explicit
reason, `public_destination_only` license scope and an expiry of at most 90 days.
Public destination reads additionally require the city's
`public_destinations_enabled` flag, default false. A named museum/shop destination
does not establish parking ownership, access or a vehicle entrance. New imported
destination revisions require another explicit publication decision.

## Founder-controlled activation and rollback

No client-facing flag API exists. An authorized database administrator changes
the private fixed-version configuration only after founder authorization:

- `pilot_activation.active`: defaults false; true applies restrictive RLS to
  public parking and source attribution, including legacy discovery RPC reads.
- `pilot_city_config.candidate_research_enabled`: defaults false per city.
- `pilot_city_config.public_destinations_enabled`: defaults false per city.
- `discovery_reviewers.can_candidate_research`: defaults false per reviewer.

When the global flag is false, legacy public discovery behavior is preserved.
The new pilot RPCs remain strictly scoped regardless of that flag. Activate the
fixed version before a public pilot release so direct-table and legacy RPC reads
cannot bypass the two-city policy. Regulations inherit parent visibility.
Global/city configuration changes append old/new state, database session actor
and timestamp to `pilot_configuration_audit`. Its history cannot be rewritten.

To disable candidate access, disable the city flags and revoke reviewer candidate
roles. To stop public destination discovery, disable its city flags and revoke
individual destination decisions as needed. Restore legacy public scope by
setting global activation false only as an explicit authorized rollback; doing
so intentionally restores the previous legacy read policy. No database reset,
archive deletion or automatic approval is part of rollback.

## Verification

```powershell
node --test scripts/pilot-catalog.test.mjs scripts/ncr-reviewer.test.mjs
pnpm exec supabase test db
```

Database tests use transactions and preserve existing private QA imports and
flags on rollback. Historical unsafe-public-row tests temporarily disable only
the new access trigger for local owner fixture setup, then explicitly reenable
and assert it before any public read checks. Separate actual approval RPC tests
prove the enabled trigger rejects members and unsupported raw/mapped access
atomically. No production bypass, real observation approval, hosted write, bulk
NCR import or public upload endpoint is introduced.
