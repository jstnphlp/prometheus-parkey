# Stage A implementation review

Review date: 2026-11-05. Base: `2e91da86b9ba67b13ae057e9ba5e60708d5c0dbf`.
Reviewed head: `ecf34ff` plus the Stage A working-tree changes described below.
The review was read-only except for this report. No sub-reviewer was dispatched.

The scope covers the versioned engineering plan and evaluator, individually
imported reviewer evidence and SQL publication controls, their regression tests,
and the additional navigation guard required to preserve the stated safety
boundary in the existing Poblacion app.

## Strengths

- Engineering readiness is separate from historical phase decisions and release
  authorization. Stage B cannot receive an execution record until every Stage A
  check passes, including the fresh Android build and smoke checks. The CLI
  verifies the historical gate file's hash and recorded decisions.
- Reviewer RPCs require the existing private reviewer registry and service-role
  execution. Review-only and publishing permissions remain distinct. No public
  upload endpoint, self-appointment mechanism or reviewer bootstrap was added.
- Imported source bytes and decisions are append-only. The global publication
  chain is serialized, revisions invalidate stale publication, explicit decisions
  bind the original source observation, and restrictive RLS enforces expiry.
  Rejection, correction requests and revocation preserve the audit history.
- Identity, visitor access, entrance coordinates, operator permission, licensing,
  publication labels and issue resolutions require separate evidence references.
  Official names and descriptive labels are stored separately. Listing approval
  grants no automatic navigation permission or physical-verification badge.
- Navigation now uses only an explicit, current, operator-authorized entrance.
  The application rechecks authorization when starting directions, after consent
  and when resolving the route origin. Source geometry and raw mapped entrances
  provide no fallback driving target.

## Issues

### Critical

No unresolved critical code finding in the reviewed changes.

### Important

1. **Reviewed entrance shape broke the existing mobile feed — fixed.**
   The first version of
   `supabase/migrations/20261105140000_reviewer_evidence_publication.sql`
   wrote `entrances` as objects containing `coordinates` and `kind`. Existing
   `discover_parking` returned that column unchanged, while
   `apps/mobile/src/discovery/data.ts:isParking` requires coordinate arrays. One
   approved record would make `fetchParking` reject the complete viewport
   response. A direct independent check reproduced rejection of the object
   shape and acceptance of `[[longitude, latitude]]`. Both insert and correction
   paths now preserve the existing shape. The backend owner's executed
   cross-runtime test validates the actual anonymous SQL response with the
   existing mobile validator and checks the precise entrance value.

2. **SQL could append events incompatible with the original JS ledger — fixed.**
   Initial SQL text extraction/casts accepted values such as a string sequence,
   string approval booleans or noncanonical timestamps. Original
   `validatePublicationLedger` rejects those values, so an accepted direct RPC
   request could poison the exported chain and prevent subsequent CLI decisions.
   JSONB's retained decimal zeros also differed from JS number serialization.
   The reviewer migration now enforces the relevant JSON types and normalized
   UTC timestamps; the encoding migration checks canonical event bytes and
   explicitly selects shortest-round-trip numeric output. Negative SQL tests
   cover string types, noncanonical/leap-second dates, decimal sequence encoding
   and coordinate trailing zeros. The executed cross-runtime test covers numeric
   fixed/scientific boundaries and validates the exported ledger in the original
   JS implementation.

3. **Legacy navigation could use unverified Poblacion anchors — fixed in code.**
   The original `parking-detail-data.ts:parkingDestination` fell back to a
   geometry anchor, and `explore.tsx` permitted any nonsample record to start
   directions. This contradicted the integration's stated requirement that
   unverified centroids and raw mapped entrances grant no driving authority.
   The root implementation adds optional explicit navigation approval to the
   public contract, server projection and guarded helper; detail/list buttons and
   route handlers fail closed. SQL emits that approval only after an explicit
   `visitorNavigationAuthorized: true` operator decision. Independent tests now
   show the preserved Poblacion archive remains readable and has zero authorized
   navigation targets. Required browser/native execution is recorded separately.

### Minor

- **Empty or nonstring execution evidence references — fixed.** The evaluator
  initially accepted any nonempty array, including `[null]`. Passing checks now
  require nonempty string references; the regression assertion passes.

No additional unresolved code finding was identified in this review.

## Verification reviewed

Executed independently by this reviewer:

```text
node --test --test-reporter=spec scripts/pilot-execution.test.mjs
```

Result: 3 passed, zero failed.

```text
node --test --test-reporter=spec apps/mobile/src/discovery/parking-navigation.test.mjs apps/mobile/src/discovery/parking-detail-data.test.mjs
```

Result: 12 passed, zero failed. These exercise authorized-entrance selection,
missing/expired/mismatched approval, false permission flags, restricted source
facts, malformed wire metadata and preserved legacy browsing. Node's existing
mobile module-type inference warning was emitted; assertions passed.

Backend owner reported actual local execution after the fixes:

- 60 pgTAP checks passed in `reviewer_evidence.test.sql`, including anonymous
  table/RPC expiry and revocation checks and negative ledger-format cases.
- 19 targeted Node ledger/workflow regressions passed.
- The opt-in local integration test generated SQL from JS, executed it in a
  rolled-back PostgreSQL transaction, validated the exported ledger with the
  original JS validator, and validated actual anonymous discovery records and
  navigation metadata with the mobile contract.

These backend results were supplied by the executing owner; they were not rerun
by this read-only reviewer. Workspace checks, browser flows and native execution
belong to the main Stage A execution record.

## Recommendations

Keep the new SQL-to-mobile and SQL-to-original-ledger integration test in the
documented local verification path. It catches contract failures that passing
isolated unit or SQL tests did not catch initially. Retain actual evidence
references when recording Stage A outcomes; code-review acceptance cannot replace
the mandatory native gate.

## Declined to judge

- Manila/Mandaluyong server filtering, integrated pilot discovery modes and
  broader client expiry/revocation synchronization: Stage B has not started and
  those features are outside this Stage A implementation.
- Actual site visits, operator participation, public access, legal distribution
  rights and commercial demand: code tests cannot establish these human facts.
- Fresh Android/browser success: the execution owners must supply actual results;
  this review did not run a browser or device.
- Public service authentication or hosted reviewer operation: the implemented
  workflow is local and service-only; no public endpoint or hosted deployment is
  authorized by the plan.

## Assessment

**Reviewed code: acceptable after the fixes above; no unresolved important code
finding. Overall Stage A completion: pending its separately recorded execution
gates. Ready to merge: no merge authorization or completed native gate is supplied
by this review.**

This report supersedes the earlier integration audit's broad no-defect statement
for the subsequently added Stage A implementation and explicitly records the
legacy navigation issue found during the continuation. It grants no Stage B
start, publication approval, verification claim or deployment permission.

## Addendum — unspecified facility classification

Reviewed `432bb98` plus the additive
`20261105140200_reviewer_supported_facility_types.sql` migration and accompanying
CLI, tests and runbook changes. **Important finding resolved:** publication
previously accepted `facility_unspecified` and the SQL insertion mapped every
nongarage facility to `lot`, inventing a source classification. CLI and SQL
approval now require an original `lot` or `garage` type; insertion copies that
supported type directly. Unspecified observations remain importable as private
evidence and cannot receive publication approval or a successful ledger event.

An extracted function-body comparison confirmed that the additive replacement
changes only the supported-type guard and insertion classification; prior
reviewer, provenance, expiry and navigation checks remain intact. The targeted
Node classification regression passed independently, including private import,
refused unspecified publication, unchanged original type and permitted garage
approval. The backend owner reported 65 SQL checks and six Node checks passing,
including the actual local database roundtrip. No database test was rerun by this
read-only reviewer. No unresolved code finding remains from this addendum;
overall Stage A still depends on its separately recorded execution gates.
