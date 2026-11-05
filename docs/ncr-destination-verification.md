# NCR destination enrichment verification

Run date: 5 November 2026. Continuation of draft
[PR #17](https://github.com/jstnphlp/prometheus-parkey/pull/17), after reviewing
PRs #13, #15 and #16, their datasets and the failed PR #17 validation job.
The final pushed commit's validate, database and browser results are linked in
the PR description and GitHub checks; those checks must pass before integration.

## Executed source and data checks

- Fresh [acquisition run 42032920734](https://github.com/jstnphlp/prometheus-parkey/actions/runs/42032920734)
  passed the full country download, publisher MD5 verification, parking and
  expanded destination extraction, exact NCR boundary selection and source probes.
  Snapshot replication timestamp: `2026-11-04T21:21:03Z`; full source size:
  612,888,497 bytes. Source SHA-256 and derivative hashes are preserved.
- Four final destination evidence audits passed: acquisition/boundary/report
  hashes, exact 3,744-group reproduction, every accepted descriptor's original
  parking coordinate and fresh OSM identity/version/edit timestamp/hash/distance/
  containment, and complete 3,112-group JSON/CSV/coordinate-link review coverage.
  The separate baseline preserves unchanged PR #17 policy output and its source
  report hash. All ten priority accepted examples were reviewed against raw OSM
  features and their explicit access, lifecycle and geographic warning tags.
- The complete report CLI was rerun into a new local directory. All six output
  file hashes match the committed artifacts byte for byte. The source derivatives
  and initial generated pass were preserved separately.
- The 15-task launch-area handoff reproduces its source-queue hash and deterministic
  first-five-per-area selection for Poblacion, BGC and Cubao.
- `package-ncr-wikidata.py --check` reproduces the separately acquired CC0
  destination derivative: 776 coordinate features for 710 items.
- The frozen package, quality-review, fieldwork and phase-gate checks passed their
  existing technical checks. Phases 1E/1F/1G remain blocked on actual demand,
  permission, fieldwork and publication decisions. There are still zero physical
  verification and publication approvals.

## Executed application checks

- Final `pnpm test`: **304 JavaScript and 38 Python tests passed**, zero skips.
  The native osmium/Shapely dependencies were installed at their pinned versions.
  An initial sandboxed native import was denied; the complete native run with
  package read access passed. No tests were disabled or assertions weakened.
- `pnpm lint`, strict `pnpm typecheck`, `pnpm format:check`, `pnpm audit:data` and
  `pnpm build:web` passed. Formatting required read access to ignored dependency
  directories; generated hash-bound evidence manifests remain byte-preserved.
- Existing local PostgreSQL: **186 assertions across four SQL files passed**
  using `pnpm exec supabase test db`. Only the existing local Podman VM and Parkey
  database container were started. SQL tests rolled back; no reset, hosted
  database changes or production migration occurred.
- Actual fresh private API/client loading accepted **all 5,427 observations in
  eleven pages**. Immutable report loading and validation took approximately
  2.5 seconds; all eleven pages completed in approximately 4.5 seconds in this
  local measurement. These are execution timings, not user demand or guarantees.
- API/client regression checks cover group consensus, immutable validation cache,
  tampered source references, public metadata rejection, retained source names,
  absence of approval/navigation claims and research/public mode clearing.

## Browser execution and limitations

The full desktop and Pixel 7 Chromium suite contains **50 tests**, including
real fresh-source descriptions, competing destination alternatives, original
source identity, complete snapshot loading, public clearing and layout stability.
The test API loads the final committed destination report. Provider fixtures
exercise browser behavior; the research dataset and enrichment are actual data.

An early browser run was intentionally stopped after 13 passing tests so it
could restart against the final immutable report/cache implementation. In the
subsequent run, the desktop full-screen test exposed a selected-state accessibility
defect: React Native Web did not map the native selected state to `aria-selected`.
The UI now exposes that state explicitly while preserving native accessibility
state and the original test assertion. Final rerun and full CI outcomes are
reported on PR #17; the earlier failed attempt is not represented as a clean pass.

Native MapLibre components were typechecked. No native emulator/device flow was
executed in this continuation. Source anchors remain unverified vehicle entrances;
physical access, current operation, ownership and parking suitability require
the focused human checks. Two invalid OSM destination areas remain extraction
omissions. No merge, production deployment or public publication was performed.
