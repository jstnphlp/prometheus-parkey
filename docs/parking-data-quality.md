# Poblacion parking data preparation

This branch prepares an auditable discovery dataset and import workflow. It does
not certify production readiness or permission to park. No production database,
record publication, legacy reservation or user data was changed.

## Delivered artifacts

- [Prioritized plan and acceptance criteria](parking-data-plan.md).
- [Exact before/after source audit](parking-source-audit.md), including geographic
  envelopes, access restrictions, source ages, duplication risks and release gates.
- [Machine-readable audit](../data/parking-audit.json), reproducible at the saved
  [audit reference time](../data/parking-audit-config.json), with content hash.
- [Candidate evidence](../data/parking-research.json) and
  [source research report](parking-research.md): 12 unpublished candidates with
  actual public-source observation dates, URLs, source versions, confidence and
  rationale. Six are entrance features, two are street-parking points, one is a
  historical first-party facility lead and three fail current import criteria.
- [Offline review queue](../data/parking-review-queue.json): 52 researched,
  0 verified, 3 rejected. It includes all 43 bundled identities and all 12 research
  identities exactly once. Related-facility hints never cause automatic merges.
- Validated offline extractor, SHA256 manifests, snapshot/provenance validators,
  immutable local seed generation, audit/queue consistency checks and regression
  tests. Candidate research is never consumed by the SQL generator.
- Mobile source/edit/verification and freshness labels, entrance/geometry caveats,
  source links and explicit device-only correction/photo drafts. No-fee detail
  labels say Recorded no fee; no live availability or Free now claim is added.

## Before and after

Reference: 2026-11-03T00:00:00Z for the original bundled snapshot. Research source
observations later that day are separately dated and never treated as site visits.

| Metric                                            |       Before |        After |
| ------------------------------------------------- | -----------: | -----------: |
| Bundled records                                   |           43 |           43 |
| Lots / garages / street segments                  |   35 / 2 / 6 |   35 / 2 / 6 |
| Field verified                                    |            0 |            0 |
| Missing fees / hours / address                    | 41 / 43 / 35 | 41 / 43 / 35 |
| Facilities without mapped entrance                |     36 of 37 |     36 of 37 |
| Private / customers-only / unknown access         |   3 / 7 / 33 |   3 / 7 / 33 |
| OSM edit older than 365 / 730 days                |      34 / 25 |      34 / 25 |
| Research candidate identities tracked separately  |            0 |           12 |
| Researched / verified / rejected queue identities |    0 / 0 / 0 |   52 / 0 / 3 |
| Newly published records from this mission         |            0 |            0 |

Unknown facts remain unknown. Source edit age is an editorial review signal;
it does not identify the age of each parking fact. The pilot rectangle is not
an official Poblacion boundary, and completeness remains unknown. Two street
lines cross its western edge and retain their original geometry. Three facility
pairs within 50 m require duplicate review; none is merged by proximity.

## Repeatable offline workflow

The app continues to use the original snapshot. To research a replacement,
follow [parking maintenance](operations-readiness.md#parking-data-maintenance).
Supply the actual export observation timestamp and permitted public source URL:

```sh
python scripts/extract-osm-parking.py export.osm candidate.json \
  --observed-at ACTUAL_EXPORT_TIME_ISO8601 \
  --source-url 'https://api.openstreetmap.org/api/0.6/map?bbox=121.024,14.558,121.041,14.572'
node scripts/audit-parking.mjs candidate.json --as-of ACTUAL_AUDIT_TIME_ISO8601
```

The extractor performs no network requests. Identical XML, observation time and
source URL produce identical JSON and manifest bytes. Snapshot time, OSM edit
and human verification are separate. Invalid coordinates, identities, calendars,
timezones, conflicting street prohibitions and unsupported geometry cannot be
silently promoted. Streets require true intersection with the pilot rectangle.
Missing way members never become a line bridging missing geometry.

After human review of the replacement, retain the JSON with its matching
`.manifest.json` sidecar at `apps/mobile/src/discovery/osm-pilot.json`. Set the
actual audit reference in `data/parking-audit-config.json` to a time at or after
the snapshot observation, then run:

```sh
pnpm data:refresh
pnpm audit:data
pnpm test:data
```

`data:refresh` writes local artifacts only. `audit:data` detects stale artifacts
and validates the manifest. New or changed snapshots require a sidecar. Only the
original, explicitly hashed historical snapshot can omit one because its raw
export was not retained; this limitation cannot be repaired retrospectively.
Snapshot and manifest files retain LF bytes and bypass Prettier to preserve
extractor hashes. The separately generated audit hashes parsed JSON content.

The SQL seed contains only the reviewed bundled OSM dataset, with existing local
publication behavior preserved. It is **not a production import command**. It
uses one transaction and table locks, accepts identical replay, and aborts on
changed parking/rules/source attribution or reviewed/hidden/verified state.
It never overwrites or deletes existing records. Changed snapshots need explicit
human reconciliation; records absent from a replacement are not silently removed.
No schema/API permission expansion or RLS change was needed.

## Verification and remaining gates

The implementation has regression coverage for geography, duplicate identities,
source URLs/licenses, calendar/timezone chronology, candidate admission, manifest
hashes, deterministic extraction, seed generation, review queue integrity and
mobile trust presentation. Generated pgTAP tests exercise the actual SQL with
synthetic namespaced data and roll back; they cover identical replay and protection
of corrected, hidden and verified records. They have not run on this machine,
which lacks Docker/PostgreSQL. Run them on an authorized disposable local stack:

```sh
pnpm exec supabase test db --local
```

Checks after integration with main passed:

- `pnpm typecheck`, including mobile/web/shared contracts, E2E TypeScript and Edge
  Function TypeScript.
- `pnpm lint`, `pnpm format:check` and `pnpm audit:data`.
- `pnpm test`: 175 Node tests (143 app/workspace, 32 operations/import/review) and
  9 Python extraction/CLI tests.
- `pnpm build:web` and `pnpm --filter @parkey/mobile export:web`.
- Independent read-only review approved the branch for PR review, with the
  production gates below retained.

Browser/native flows and live provider
behavior were not verified. No dev server, hosted migration or deployment was run.

Before production publication, humans must confirm entrances/facility membership,
current operation, fees, hours, visitor access, signage and street legality. Keep
private and customers-only facilities explicit. Review ODbL attribution and the
derived-database distribution/share-alike process, first-party reuse rights,
provider privacy disclosures, and photo licensing/location match. Existing media
resolution is not certified by this work. The discovery RPC must expose public
verification evidence before any verified records are published. A separate
reviewed process must handle hosted refreshes and preserve human decisions.
