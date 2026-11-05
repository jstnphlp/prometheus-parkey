# NCR parking research snapshot

This directory contains an offline research database, not app listings, confirmed
public parking or live availability. Read [the evidence-gap report](../../docs/ncr-evidence-gaps.md)
before interpreting its counts. [The execution runbook](../../docs/ncr-parking-research.md)
describes acquisition and normalization; [the hotspot assessment](../../docs/ncr-hotspot-assessment.md)
and [Phase 1F/G plan](../../docs/ncr-phase-1fg-plan.md) describe the next work.

- `manifest.json` identifies the selected geography, source snapshots, hashes,
  record counts and gzip archives. Each archive preserves exact decompressed
  bytes; the national PBF and national administrative file remain local.
- `metro-parking-research.json.gz` contains normalized source observations,
  original geometry/tags/provider IDs, safety flags, prior human review links,
  explicit identity groups and unresolved duplicate review pairs.
- Source GeoJSON archives retain the extracted evidence needed to reproduce the
  research normalization without another national download.
- `coverage.json` contains per-city, per-type, source, grid and hotspot-window
  counts; `per-city.csv` is the compact city table. City intersections can overlap;
  representative grid cells account for each source observation once. Study
  windows are analyst-defined, overlap and are not official neighborhood borders.
- `poblacion-preservation.json` preserves existing owner decisions and PR #4
  navigation references. New source snapshots cannot upgrade or erase them.
- `hotspot-source-evidence.json` records actual public-source retrievals and
  limitations. `hotspot-evidence.json` leaves unsupported score metrics empty;
  `hotspot-score.json` records the resulting absence of rankings.
- `licenses/` contains attribution, license agreements and their source hashes.
  Research distribution does not constitute Parkey app publication approval.

Verify archive bytes, original input hashes, identities, safety gates, review
references and grid reconciliation with:

```powershell
node scripts/check-ncr-package.mjs data/ncr-research
```

Use a gzip-capable tool or Python's `gzip` module to unpack into a fresh local
directory. The normalizer and package scripts refuse to overwrite snapshots.
There are no site visits, measured capacities, validated entrances or occupancy
claims in this package. Names and coordinates are sourced from OSM/Overture;
the three existing owner navigation links are references only. No Google Maps
data was scraped or imported into the research source dataset.

## Offline aggregate preview

Generate a local research heatmap from the frozen `coverage.json`:

```powershell
node scripts/ncr-research-preview.mjs data/ncr-research/coverage.json output/ncr/research-preview.html
```

The preview is for internal audits only. It makes no claims about available
spaces, legal street parking, visitor access, or verified vehicle entrances.
See [publication review](../../docs/ncr-release-review.md) and
[hotspot fieldwork](../../docs/ncr-hotspot-fieldwork.md) before release.

## Phase 1A–G autonomous continuation

The frozen archives and original Poblacion decisions above remain unchanged.
The continuation adds:

- [Data-quality report](../../docs/ncr-data-quality.md), `review-ledger.json`
  (5,507 individually traceable issues) and `relationship-review.json` (1,668
  unconfirmed geometric proposals). All 70 duplicate pairs and 10 provider
  conflicts have explicit unresolved human review dispositions; no additional
  proximity-only merges were made.
- [Licensing/publication report](../../docs/ncr-licensing-publication.md), the
  official Foursquare NOTICE and `publication-ledger.json` with zero approvals.
- `hotspot-additional-sources.json` and `hotspot-comparison.json`, documented in
  the [11-area evidence comparison](../../docs/ncr-hotspot-comparison.md).
  Priorities describe research readiness; all commercial scores remain unranked.
- `fieldwork-checklist.json` covering every source ID, and a compact CSV for
  66 candidates in 12 routes. [Field instructions](../../docs/ncr-fieldwork.md)
  link the private local form, map links and unreviewed reconciliation workflow.
- The [Expo/API development preview](../../docs/ncr-development-preview.md),
  tested independently from public approval. Actual public NCR output is empty.
- `phase1-verification.json`, `phase1-security-report.json` and the strict
  machine-readable `phase1-gates.json`. The historical `verification.json`
  remains the earlier baseline; use the new record for this continuation.

Validate the new reproducible catalogs and gate consistency with:

```powershell
node scripts/ncr-quality-review.mjs data/ncr-research --check
node scripts/ncr-fieldwork.mjs data/ncr-research --check
node scripts/ncr-phase-gates.mjs data/ncr-research
```

Neither a valid report nor a passing code test upgrades an actual record's
verification or publication status. The current report retains human fieldwork,
commercial evidence, legal/distribution review and release authorization gates.
