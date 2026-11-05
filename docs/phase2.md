# Phase 2 audit and integration plan

Audited at main `a9c6bac` on 2026-11-05, including GitHub metadata and local
merged changes for #1 (`0905509`), #2 (`fd357e4`), #3 (`a9c6bac`).

## Reuse and immutable decisions

Keep the pnpm modular monolith, SDK 58 Expo Router map workspace, MapLibre,
type-only shared contracts, legacy reservation schema and all existing data.
Reuse permission handling, explicit Photon search, detail overlays, retry,
12-second cancellation, viewport debounce, source attribution and telemetry.
No duplicate Supabase/EAS project, provider subscription or deployment is needed.

#1 added audit/provenance and immutable replay imports; #2 added offline source
comparison; #3 separated human decisions from source data. The 43 bundled OSM
records are unverified. Of 15 Overture candidates, 8 have online name
corroboration, 5 need visits, 2 await exclusion reasons; none are approved.
Google Maps name corroboration is never physical verification. Preserve those
artifacts byte-for-byte. Existing imports fail on drift and never update/delete.

Existing `discover_parking` and moderation intentionally permit unverified
publication. Phase 2 must not treat that API as approved data. A separate versioned
RPC adds evidence gates without silently changing Phase 1. **Hosted rollout is
blocked until separately authorized legacy API/table access cutover is reviewed.**

## Review boundaries and order

| Branch / PR                  | Change                                                                | Dependencies |
| ---------------------------- | --------------------------------------------------------------------- | ------------ |
| `phase2/01-contract`         | This audit, type contract, environments                               | main         |
| `phase2/02-approval-storage` | Private RLS approval ledger and content fingerprint                   | 01           |
| `phase2/03-approval-gates`   | Server-only manual evidence approval, drift/replay checks             | 02           |
| `phase2/04-read-api`         | Versioned bounded invoker discovery, approvals before limit           | 03           |
| `phase2/05-mobile`           | Explicit synthetic/hosted mode, validated response, no pilot fallback | 04           |
| `phase2/06-validation`       | Disposable DB CI, synthetic tests and operations runbook              | 05           |

Contracts are finalized before implementation. These are stacked review branches;
merge in order only after authorization. No concurrent edits are necessary for
this shared SQL/mobile integration. Database checks must pass before 02–04 ship.

## Contract and environments

`POST /rest/v1/rpc/discover_approved_parking` accepts the existing west/south/east/
north bounds and returns `HostedDiscoveryResponse`: contractVersion 1, records,
truncated. Existing coordinate order, null unknowns, geometry and provenance stay
unchanged. Detail and parking-name filtering use the returned records; explicit
destination search remains Photon. No availability, occupancy or fee inference.

Leave `EXPO_PUBLIC_DISCOVERY_MODE` unset for unchanged Phase 1 behavior. Phase 2
development uses `synthetic` (existing labeled fixtures, no discovery requests).
`hosted` requires an already authorized project URL and public publishable key;
it calls only the new RPC and never merges bundled unapproved records. A cold
offline launch is empty; session results are retained only on request failure.
Successful empty responses clear previously retained results. No persistent cache
may replay withdrawn approvals. Unknown mode values must fail closed.

Use an existing disposable local stack for tests. Preview and production require
distinct existing project identities, a migration inventory/backup review and
explicit account authorization. Never run `db reset`, `db push`, link, deploy,
upload, seed or remote import against a hosted project as part of this work.
Public environment templates contain no service-role key. Secrets stay only on
trusted server infrastructure. No actual parking records enter Phase 2 until
evidence, redistribution licensing, deduplication, public access and named manual
approval gates all pass. Synthetic fixtures are never hosted seed records.

## Approval procedure and operational gates

The private approval ledger is RLS enabled, with no client or service-role table
grants. Only `approve_discovery_publication` is callable by a trusted service
credential. It requires an existing publisher allowlist identity and four manual
evidence references: physical observation, licensing, access and deduplication.
The trusted caller must verify the reviewer's Auth session and MFA; no new public
approval UI or endpoint is enabled here. A URL is a reference to a human-reviewed
artifact, never proof by itself. Google Maps names do not satisfy physical evidence.
The approver must confirm reuse rights and actual public parking access, including
entrance/facility membership and legal street restrictions. Unknown fees stay null.

Stage and reconcile records using the existing immutable import machinery, never
the research queue as an import feed. Existing records must be reconciled manually;
do not replace IDs, update reviewed facts via imports, or fabricate verification.
Physical observations must be within 90 days. Approval requires unpublished staging;
only a separately authorized operator may then enable publication. The final staged row state,
its source and all rules/source attributions are fingerprinted. Identical approval
replay is a no-op; drift, changed evidence or expiry rejects replay. Approvals
expire after 90 days. Reapproval requires a separate explicitly reviewed operator
reconciliation; no automatic renewal or overwrite is provided. Deleting an approval
withdraws Phase 2 visibility without modifying parking data. All privileged
reconciliation remains outside mobile and outside this implementation's execution.

The new API is invoker-only, bounded to a 0.5-degree viewport, limits to 250 after
approval filtering, and returns no private evidence or reviewer identities. It
shares the existing geographic indexes and response fields. The legacy RPC/table
reads remain a **launch blocker**, not a secure publication boundary for the whole
project. A later authorized cutover must change those policies/grants and moderation
publication behavior together, with compatibility and RLS tests. Do not deploy
these PRs as a claim that all existing public reads are evidence-gated.

## Validation and monitoring

Run workspace lint, typecheck, formatting and web build for the final stack.
Target mobile tests cover synthetic mode, public-key restrictions, schema version,
unverified rejection, request errors, viewport merging and stale/cancelled results.
Existing data/review/import tests and `audit:data` protect Phase 1 artifacts.
The database CI job uses a disposable GitHub runner and the pinned Supabase CLI;
it starts a local stack, applies migrations, runs all transaction-scoped pgTAP
tests, lints both schemas and stops without backup. It never links a hosted project.
Starting this CI job requires no hosted credentials or paid provider configuration.

Before rollout, require green pgTAP (including both client roles, hidden records,
approval drift/expiry and replay), existing import-integrity tests, migration lint,
and migration inventory review against the authorized target. No destructive
reset or production write belongs in verification. Native map, location-denied,
offline cold launch and retry flows still require an authorized device check.

Reuse existing opt-in Sentry and allowlisted analytics; no telemetry endpoint is
created. Operational review should alert on RPC error rate/latency, truncation,
zero approved coverage, expired approvals and failed import reconciliation. Query
counts/age on the trusted server only; do not export evidence, coordinates, search
terms or user identifiers to analytics. Thresholds and delivery destinations need
operator agreement before enabling alerts. No live metrics or availability claims
are supplied. Roll back the mobile mode to synthetic if needed; keep migrations
and data intact. Never revert by deleting hosted tables.

## Initial evidence (2026-11-05, superseded by pre-merge checks below)

- Node 24.22.2 / pnpm 11.25.0; shared and mobile targeted typechecks passed.
- Workspace `pnpm typecheck` and `pnpm build:web` passed. Router generation
  changed its generated file during checks; that unrelated output was restored.
- 20 mobile API/geography/refresh tests passed; 20 import/open-data/human-review
  tests passed. `pnpm audit:data` passed. Changed-file ESLint and Prettier passed.
- Production `node scripts/check-release.mjs` passed after review fixed the Node
  import extension. Independent review also corrected approval-before-publication.
- Workspace lint is blocked by five pre-existing no-undef errors in
  `scripts/parking-open-data.mjs`, `scripts/parking-reviewed-data.mjs` and its test.
  Workspace formatting reports eight unchanged files from the prior data PRs.
  `node scripts/parking-reviewed-data.mjs --check` reports a stale artifact.
  These immutable Phase 1 files were not rewritten to make checks green.
- Docker is not installed. No migration, pgTAP or RLS runtime check was executed.
  A local migration-list attempt also hit the sandbox restriction on Supabase's
  home-directory telemetry file. Database CI is supplied, not claimed green.
- No browser, emulator, provider integration, hosted migration, import,
  publication, account creation, deployment, spending or merge was performed.

All six PRs remain drafts until the remaining release gates are resolved.
Monitoring here is a
runbook using existing instrumentation; live alert infrastructure is not enabled.
Commits use `[skip ci]` to avoid starting potentially billable hosted runners.
Authorize CI execution separately after confirming account runner allowance.

## Pre-merge verification follow-up

The user authorized resolving the pre-merge failures. Baseline-only fixes are
isolated in [PR #11](https://github.com/jstnphlp/prometheus-parkey/pull/11), based on
main. Review/merge it before #5–#10. It adds explicit Node global declarations,
formats the affected scripts/runbook and preserves deterministic LF bytes. The
reviewed artifact mismatch was exclusively CRLF versus LF; parsed contents and
all decisions were identical. No source hash, parking fact or approval changed.

Completed locally on the integrated stack:

- Workspace lint, strict typecheck (including E2E/Edge), formatting and web build.
- Existing Node/Python test commands, data audit and reviewed-data artifact check.
- All seven migrations applied successfully to a disposable Supabase PostgreSQL
  17 database using the existing Podman VM and cached images. Existing project
  containers/volumes stayed untouched; seeds were disabled in the temporary copy.
- All five pgTAP files passed: 208 assertions, including legacy foundation,
  discovery RLS, immutable import replay, moderation and Phase 2 approval gates.
  Database lint found no errors in public or parkey_private. The first run exposed
  a test fixture that attempted reconciliation while still published; the test
  now correctly returns to unpublished staging. Additional tests cover fact/rule
  drift, denied approval/writes and viewport bounds.
- Phase 2 browser tests passed on mobile Chromium: hosted search/detail,
  location-denied browsing, cold backend failure/Retry with no pilot fallback,
  and synthetic mode's banner with zero discovery requests. Responses were
  fictional intercepted fixtures, not live provider integration. Cold backend
  failure does not prove a fully offline native app can boot its app bundle.
- Independent review identified permissive legacy provenance validation. Hosted
  responses now require a public HTTPS source URL without embedded credentials,
  a nonempty source label and a known nonempty license. A new regression test
  first failed, then passed; the fix is also on mobile PR #9.
- Native Android checks used the existing SDK 58 development APK and local Metro:
  native MapLibre map, sample labels, denied location permission, expanded results
  and synthetic parking detail were observed. The detail remained available with
  emulator Wi-Fi/mobile data disabled; both were restored. This is session offline
  behavior, not a release-build cold-offline launch guarantee. Metro needed IPv4
  localhost resolution for the ADB bridge (`NODE_OPTIONS=--dns-result-order=ipv4first`).
- Hosted CI exposed two baseline portability issues: setup-node's automatic pnpm
  cache lookup ran before pnpm installation, and newer Python normalized
  `24:00:00`. Setup order and explicit clock-component validation now preserve
  the existing contracts; the nine Python tests pass locally. Both fixes are
  included in prerequisite PR #11.

The full legacy browser run reached all 36 desktop/mobile cases: 33 passed and
three exposed stale search text and a phone viewport without garage coverage.
After those fixture/selector fixes, all four affected cases passed in targeted
checks. Other maintenance fixes align profile/saved-place controls with the
current UI and feed uninterrupted synthetic GPS into the arrival test. Tracing
confirmed Chromium emits POSITION_UNAVAILABLE while replacing a geolocation
override; production arrival evidence correctly resets on that error and was
not changed. Independent review confirmed persistence, undo, recovery, consent
and arrival assertions remain substantive.

PR #11 now precedes the six-PR stack; #5 explicitly targets its branch, then each
PR targets its predecessor. Verified prerequisite commits were propagated using
ordinary branch merges without rewriting history or merging main. Check the PR
pages for the final hosted CI results; all seven remain reviewable separately.

The reviewed-artifact CI check additionally found that the original comparison
captured a Windows CRLF hash of the exact historical OSM snapshot while Git
stores LF. Its recorded hash and artifacts remain unchanged. Reconciliation
accepts only the proven historical LF/CRLF SHA256 pair; all other mismatches
still abort. Five review tests cover exact equivalence and changed-byte rejection.

CI includes the same synthetic-only database setup and both Phase 2 browser
modes. Repository visibility was confirmed public; standard ubuntu-latest runners
are free for public repositories. New verification commits can therefore run CI
without spending. Earlier skip markers document the initial precaution, not a
remaining account-authorization requirement. Hosted CI results are recorded below
after execution. No actual parking data was approved or published. The legacy public
API/table RLS cutover remains a separately authorized rollout gate.
