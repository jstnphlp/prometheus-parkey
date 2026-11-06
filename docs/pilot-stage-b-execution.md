# Manila and Mandaluyong engineering execution

Stage B started from `f54f2b5`, after the executed Stage A gate. Draft
[PR #19](https://github.com/jstnphlp/prometheus-parkey/pull/19) depends on
[PR #18](https://github.com/jstnphlp/prometheus-parkey/pull/18), which depends on
PR #17. Nothing is merged or deployed. Historical phase decisions are unchanged.

The founder-selected cities establish geographic scope only. Phase 1E and 1G
remain `DEFERRED_TO_PILOT`; 1F engineering remains `IN_PROGRESS` until all recorded
technical checks pass. The historical full public-display gate remains blocked.
`PILOT_RELEASE_AUTHORIZED` remains false.

## Implemented engineering

| Requirement              | Implementation                                                                                                                                                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trusted geography        | Versioned `manila-mandaluyong-v1` allowlist and PostGIS functions use all 17 retained, hash-checked municipal polygons. City of Manila is distinct from Metro Manila.                                                                         |
| Border handling          | The complete original shape and source anchor must lie strictly inside one selected city and intersect no other LGU. Border touches and crossing shapes fail closed; nothing is clipped or reassigned.                                        |
| Main mobile discovery    | An opt-in main map searches server destinations, focuses the map, retrieves bounded pages, filters loaded categories and presents original names, descriptive context, source dates, licenses, restrictions and unknown facts.                |
| Private research         | Short-lived authenticated AAL2 reviewer session, private reviewer registry permission and city flags are all required server-side. Tokens stay in memory. Client flags grant no access.                                                       |
| Public discovery         | Only current, individually approved records from the reviewer workflow are eligible. Source restrictions, closure, expiry, revocation and geographic conflicts fail closed. Private queue data is never a public fallback.                    |
| Legacy paths             | Explicit server pilot activation adds restrictive RLS to legacy/direct-table discovery and source attribution. The legacy Poblacion experience remains available in development; it cannot bypass the active pilot screen in a release build. |
| Navigation               | Candidate navigation is disabled. Public navigation requires an authorized reviewed entrance and re-fetches the record before opening Maps. A source anchor is never an entrance substitute.                                                  |
| Requests                 | Bounded geographic queries, signed scope-bound cursors, cancellation, stale-result guards, approval expiry, loading/error/empty states and retry.                                                                                             |
| Evidence and publication | Immutable source/package hashes, append-only human decision history, explicit correction/rejection, expiry and revocation. Imports and destination proximity never approve a parking record.                                                  |
| Build configuration      | Android/iOS internal and release profiles, public-key screening, production endpoint/provider validation, foreground-only location and documented build/rollback steps. No cloud build or resource is created.                                |

See [the build and rollback runbook](manila-mandaluyong-pilot-build.md), the
versioned [geography configuration](../data/pilot-geography.v1.json), and the
[reviewer workflow](ncr-reviewer-workflow.md).

## Executed evidence and remaining verification

Local frozen installation, typecheck, unit tests, data audit and web build passed.
The initial full unit run passed 337 JavaScript and 38 Python tests with zero
skips; later guard additions require their recorded incremental/full verification.
Sixteen initial pilot browser checks passed on desktop and mobile Chromium,
including city/mode clearing, actual detail selection, destination search,
authentication rejection, retry, expired data and late responses. Additional
navigation checks and the complete browser suite remain to be recorded.

The actual local Supabase/PostgREST response passed the real mobile parser for
both cities. Anonymous public results were zero; anonymous candidate access was
denied. A synthetic local AAL2 reviewer could read exactly two explicitly imported
private parking observations and their two independently sourced destinations:

| City        | Original source ID                | Private descriptive context                           | Straight-line estimate |
| ----------- | --------------------------------- | ----------------------------------------------------- | ---------------------- |
| Manila      | `osm:node/11729826407:Point`      | Parking near Museum of the Chinese in Philippine Life | 58.6 m                 |
| Mandaluyong | `osm:way/1306648012:MultiPolygon` | Parking near Crossings Department Store               | 60.5 m                 |

These are unverified research associations, not official names, route distances,
vehicle entrances, ownership claims or parking offers. The Manila source remains
unclassified; the Mandaluyong source remains a lot. Original coordinates and
geometries are preserved. No real parking publication, operator authorization or
physical verification was created by QA. The complete 5,427-observation NCR
archive and original human decisions remain intact.

Fresh Stage B Android build/device evidence, final access-guard verification,
complete CI and the final engineering gate are still pending in this interim
report. iOS execution is unavailable on this Windows host and remains a blocker
to claiming iOS device readiness.

## Founder approvals still required

1. Approve the internal environment, distribution audience and named reviewer
   access to candidate research. A local QA session is not pilot authorization.
2. Approve source/provider licensing, attribution and safety/privacy disclosures
   for that distribution. Public destination publication is a separate,
   destination-only decision.
3. Approve any specific public parking records through the evidence workflow,
   including visitor access, entrance and operator navigation permission when
   navigation is requested. Otherwise public parking stays empty.
4. Approve final merge and deployment separately. No store submission, paid cloud
   build, hosted migration or production data write has been performed.
