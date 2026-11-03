# Poblacion parking data implementation plan

Reference audit date: 2026-11-03T00:00:00Z. Scope: discovery only; no production writes,
bookings, payments, or deletion of legacy/user data. Work is isolated on
`feat/poblacion-data-quality`, initially from `5313e646` and rebased onto
main `8ca64f4` after its operations changes landed.

## P0: Establish an honest baseline

- Audit the bundled 43-record snapshot with reproducible machine-readable counts,
  geometry extent, missing fields, datedness, access restrictions, provenance,
  and duplicate risks. Distinguish import dates from OSM edits and field visits.
- Acceptance: audit records a fixed as-of date and input hashes; every original
  record is accounted for; source links and ODbL attribution remain intact.

## P0: Make imports safe and repeatable

- Validate source identity, geography, dates, unknowns, verification, attribution,
  and duplicate identities before generating SQL. Preserve complete intersecting
  street geometry, including vertices beyond the pilot rectangle.
- Make extraction repeatable with explicit snapshot time and input provenance;
  fail closed on malformed input and unsafe database conflicts. Keep new research
  outside published discovery data. Do not alter RLS or legacy tables.
- Acceptance: malformed, out-of-area, duplicate and unsupported claims fail tests;
  repeated extraction/seed generation is deterministic; stale seeds fail CI;
  repeated seed execution cannot silently overwrite reviewed data.

## P1: Evidence and review queue

- Research permitted public sources; retain evidence URLs, observation dates,
  confidence rationale, source licensing, and unknown coordinates/facts.
- Generate separate researched, verified and rejected queue sections. Verification
  requires human-reviewed evidence and is never inferred from research confidence.
- Acceptance: every bundled/candidate identity appears once; no AI candidate is
  field verified or imported into public discovery; uncertain entrances/access/
  legality and possible duplicates stay explicit human review tasks.

## P1: Mobile trust display

- Correct unsupported current-fee/verification/freshness labels and distinguish
  source edit/snapshot dates from real-world verification. Preserve discovery,
  directions, attribution and explicitly on-device corrections.
- Acceptance: focused presentation regressions pass; unknown fees/hours remain
  unknown; centroids do not become claimed entrances or permission to park.

## P2: Verification, audit and delivery

- Run typecheck, lint, unit/import tests, format checks, web build and mobile web
  export as relevant. Have a separate agent review privacy, attribution, ODbL,
  unsupported claims and release gates. Do not run a database reset/deployment.
- Acceptance: record actual command results and limitations, before/after metrics,
  unchanged production publication count, and human next steps. Commit only this
  isolated work and open a PR against main when GitHub authentication is available.

## Initial measured gaps

43 records: 35 lots, 2 garages, 6 street segments. 41 missing fees, 43 missing
hours, 35 missing addresses, 36 of 37 facilities missing mapped entrances.
All records are unverified. Three record private access and seven customers-only
access. Thirty-four OSM edit timestamps are over 365 days old at the reference
date; these measure edit age, not actual parking-condition age. The documented
pilot is a rectangular query area, not an official barangay boundary or a coverage
completeness claim. Two street lines extend beyond its western boundary.
