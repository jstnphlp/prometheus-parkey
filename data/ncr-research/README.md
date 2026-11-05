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
