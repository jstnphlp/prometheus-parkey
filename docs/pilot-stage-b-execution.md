# Manila and Mandaluyong engineering execution

Stage B started from `f54f2b5`, after the executed Stage A gate. Draft
[PR #19](https://github.com/jstnphlp/prometheus-parkey/pull/19) depends on
[PR #18](https://github.com/jstnphlp/prometheus-parkey/pull/18), which depends on
PR #17. Nothing is merged or deployed. Historical phase decisions are unchanged.

The founder-selected cities establish geographic scope only. Both technical
stages passed. [The versioned execution status](../data/pilot-execution/2026-11-06/status-v4.json)
records `1F_ENGINEERING_READY: true` for the executed Android discovery milestone
and `PILOT_RELEASE_AUTHORIZED: false`. Phase 1E and 1G remain
`DEFERRED_TO_PILOT`; the execution policy retains 1F `IN_PROGRESS` and the
historical full public-display gate remains blocked. No historical decision is
replaced by the engineering result.

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

## Executed verification and platform limits

At code commit `da05ae2`, frozen installation, lint, typecheck, formatting, unit
tests, data audit and web build passed. The local full unit run passed 344
JavaScript and 38 Python tests with zero skips. All 343 local database assertions
passed across six files, including the final raw-access guard regressions.

Both exact-head CI runs passed validation, clean database migrations/tests and
the complete browser suite: 52 legacy and 20 pilot cases. The pilot checks cover
city/mode clearing, detail selection, destination search, authentication rejection,
retry, expired data, late responses, reviewed-entrance navigation and revocation.
See [the CI evidence](../data/pilot-execution/2026-11-06/stage-b-ci-v1.json) and
https://github.com/jstnphlp/prometheus-parkey/actions/runs/42135667381.

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

The fresh Stage B Android development APK built successfully in 12m 43s, with
565 tasks (533 executed). All 17 actual native checks passed on the Pixel 10 Pro
Android 17/API 37.2 x86_64 emulator with NVIDIA host GPU rendering. They include
both city searches/details, actual category filters, permission denial and
unavailable-location recovery, anonymous rejection, authenticated research,
restart/token loss, real API connection interruption/recovery, public/private
clearing, Poblacion regression and live reviewer revocation.

The installed APK matches the archived APK SHA-256
`d44de93e814045e42232de704d317d7556902031213ae68fe7c371dcd1149d47`.
Version is `0.1.0`, Android code `2`. The debug artifact is
`output/ncr/pilot-stage-b/fresh-stage-b-app-debug.apk`; it is not a signed
distribution release. Source commit, mobile tree, JavaScript bundle identity,
device configuration, 67 raw artifact hashes and limitations are in the
[native receipt](../data/pilot-execution/2026-11-06/stage-b-android.json).
[Selected native images](evidence/pilot-2026-11-06/README.md) are committed for
review; the large APK and full raw evidence remain in the local output directory.

The parent independently verified all 67 artifact hashes/sizes, case references,
installed/archive APK equality, runtime bundle and committed mobile tree, and
inspected main-map, detail-warning and live-revocation captures. No reviewer token
is bundled or included in the committed evidence.

Temporary local QA permissions and both candidate city flags are now disabled.
[The cleanup proof](../data/pilot-execution/2026-11-06/stage-b-qa-access-revocation-v1.json)
records six private RPC denials, two empty public reads and four preserved private
imports. Native refresh also cleared the private view after revocation. Actual
official names verified, operator approvals, parking publication approvals and
physical site verifications remain zero.

Successful GPS positioning, iOS device/simulator execution and a signed release
archive were not demonstrated. iOS requires an Apple test host. The Android
debug proof uses the local Supabase gateway and Metro; release profiles require
an approved public HTTPS backend and their own final build/signing validation.
No hosted resources, production data, paid build or deployment were created.

## Remaining conditions for internal distribution

No Android coding/test blocker remains in the executed milestone. Internal
distribution still requires an approved environment and audience, source/provider
and privacy/safety approval, actual reviewer account authorization when research
is enabled, and a build using that environment's reviewed configuration/signing.
iOS distribution additionally requires an executed Apple-platform build and smoke
test. The current debug APK is engineering evidence, not release authorization.

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
