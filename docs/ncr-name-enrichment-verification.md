# NCR name-enrichment verification

Research performed 5 November 2026 on `feat/ncr-permitted-name-enrichment`,
continuing draft [PR #16](https://github.com/jstnphlp/prometheus-parkey/pull/16).
This document records executed checks. The PR's latest commit checks and its
description supply the final pushed CI run links and browser results.

## Implementation and data checks

- Inspected PR #16's latest sixteen commits and its passing validate, browser E2E
  and database jobs at original head `d40541280096cecfee9f81a1b33c3cece76adb88`.
- Executed the original enrichment CLI against the hash-verified 5,427-record
  archive before changing code. It found zero new name clues among 3,112 unnamed
  groups; four unused tags belonged to already named groups. Exact output totals
  are retained in `data/ncr-enrichment/2026-11-05/baseline-totals.json`.
- Executed the final CLI against the completed new acquisition derivatives,
  named property context and dated live OSM updates. The exact command, totals
  and output hashes are in `review-manifest.json` in that directory.
- `pnpm lint`, `pnpm typecheck`, `pnpm format:check` and `pnpm build:web` passed
  locally. Formatting required read access to ignored dependency directories;
  the initial sandbox traversal failure was environmental, not reformatted data.
- `pnpm test` with the existing native dependencies on `PYTHONPATH` passed:
  279 JavaScript tests and 32 Python tests, zero failures or skips at that run.
  The initial default-environment run skipped twelve optional native cases;
  the later native run exercised them successfully.
- `pnpm test:data` passed with native dependencies. Later archive tests also
  verify acquired-source hashes, exact report reproduction and complete CSV and
  checklist coverage of all 3,744 groups.
- Targeted reconciliation/enrichment/preview/publication checks passed 42 tests.
  Client tests validate optional private evidence, source-only names, exact
  coordinate URLs, and withholding from public responses.
- The client accepted all 5,427 observations across eleven actual enriched
  private API pages. This was a direct API/client check, not an emulator claim.
- `pnpm audit:data`, `check-ncr-package.mjs`, quality-review and fieldwork checks
  passed. The frozen archive still contains 5,427 observations and 3,744 groups;
  all prior Poblacion decisions, six legacy visit tasks and three owner navigation
  references remain intact.
- `ncr-phase-gates.mjs` continues to report phases 1E/1F/1G blocked. No field
  observation, permission, demand score or release approval was fabricated.

## Source acquisition

[Acquisition run 42023326894](https://github.com/jstnphlp/prometheus-parkey/actions/runs/42023326894)
passed every step: full independent Geofabrik download, exact byte length,
publisher MD5 verification, SHA-256, original parking extraction, requested
context shell command, exact NCR selection and current Overture/Overpass probes.
The download has a new retrieval timestamp but the same source date and bytes as
the frozen source. That is not counted as new name evidence.

The portable context and source-packaging regression checks passed with native
dependencies. The source manifest records one invalid context area and no
unassembled named-property IDs. This extraction limitation remains explicit.

## Database and browser checks

The existing local Podman machine and Parkey PostgreSQL container were stopped.
After starting them, `pnpm exec supabase test db` passed **186 assertions in four
SQL test files**. Tests rolled back their transactions. No local reset, hosted
database operation, production migration or production write was performed.

The initial browser command could not use ports 8088/8090 because existing
preview processes occupied them. A subsequent local run used a separate UI port
and the existing read-only research API: **32 passed, 14 failed**. The failures
showed Expo's `Bundling... app/index.tsx` screen or page/reload timeouts; both
desktop and mobile NCR full-snapshot and interrupted-load/retry flows passed.
That run also overlapped active UI development, so it does not establish a clean
final browser result. It is retained in
`output/ncr/name-enrichment-20261105/e2e-isolated-ui.log`.

The test configuration now permits isolated UI/API ports and loads the real
enrichment attachment in a fresh test API. Browser coverage includes the private
name-review section and public clearing, with the original assertions preserved.
Final clean browser and CI outcomes are recorded on PR #16; the earlier failed
local run is not described as passing.

The complete implementation at commit `3b419c9` passed clean
[CI run 42025799721](https://github.com/jstnphlp/prometheus-parkey/actions/runs/42025799721):
validate, database and browser E2E all succeeded. Browser output recorded
**48 passed (5.1 minutes)**, including private evidence details and public
clearing on both desktop and mobile Chromium viewports.

The subsequent fresh isolated local run passed **46 of 48**; a desktop favorites
flow and mobile directions flow exceeded their 60-second deadlines. All six NCR
name-review/loading/retry cases passed. Those two unrelated local flows were
selected for a serial rerun with unchanged assertions; its outcome is recorded
in the PR description. No application assertions were weakened to mask them.

Both selected tests passed serially, **2 passed (1.3 minutes)**. Local Playwright
now defaults to one worker to avoid the observed contention with Metro route
bundling and existing previews; clean CI retains two workers. The final local
browser evidence is 46 passed in the fresh full run plus those two successful
serial reruns, not a claim that its first attempt was uniformly green.

The additional [Wikidata/Foursquare source audit](ncr-additional-open-sources.md)
records the successful zero-row actual-parking Wikidata query and Foursquare
access/licensing limitations. No additional names or verification claims were
created from that audit.

## Limits and human decisions

There are **zero new credible names** for the original 3,112 unnamed groups.
The [evidence report](../data/ncr-enrichment/2026-11-05/README.md) separates nearby
parking associations, property context, operator clues and actual names, and
reports the 19 name/alias/location discrepancies across all groups.

Physical inspections, authorized operator reuse permission, unresolved identity
decisions and final publication approval remain human tasks. All 3,744 groups
remain pending final review; research attachments approve none for publication.
No operator messages were sent, public app deployed, production data changed or
branch merged.
