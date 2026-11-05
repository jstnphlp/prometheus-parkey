# Parkey — Metro Manila parking research (Phase 1 A–E)

**Research-only:** no new app pins, database writes, verified records, permissions, availability or parking fees are created by these scripts.

The real November 2026 research package lives in [data/ncr-research](../data/ncr-research/).
Read its manifest and [coverage/evidence-gap report](ncr-evidence-gaps.md),
[hotspot assessment](ncr-hotspot-assessment.md), and [Phase 1F/G specification](ncr-phase-1fg-plan.md).
These deliverables distinguish source observations from facility candidates and
do not claim a complete inventory or guaranteed public parking.

Use Node 24 and the pinned pnpm version. On Windows use `pnpm.cmd` if PowerShell
blocks the pnpm.ps1 launcher. Install with `pnpm.cmd install --frozen-lockfile`.
Python extraction versions used in the actual run are pinned in
scripts/requirements-ncr-research.txt (DuckDB 2.0.0, osmium 4.1.1, Shapely 2.2.0).
Install Python dependencies before acquisition with `python -m pip install -r scripts/requirements-ncr-research.txt`.
Use fresh output paths for reruns: snapshot writers refuse overwrites.

## A. Geography

Required: 17 actual LGU polygons, not a rectangular Metro Manila approximation. The geography validator handles boundaries and street segments crossing cities. Download geoBoundaries **Philippines ADM3 municipalities**, not ADM2 provinces. Preserve the returned attribution, year (currently represented as 2020) and license (currently CC BY 3.0 IGO).

From PowerShell:

    New-Item -ItemType Directory -Force output/ncr | Out-Null
    python scripts/download-ncr-boundaries.py --out output/ncr/ncr-lgus.geojson

Boundary API: https://www.geoboundaries.org/api/current/gbOpen/PHL/ADM3/ . The downloader refuses if any of the 17 LGUs is absent. Optional --simplified saves bandwidth but reduces geographic precision.

Real integration correction: Manila appears as 14 districts. The downloader now
requires every district, dissolves them with Shapely and retains all source IDs.
The source represents 2020 and assigns some BGC points to Makati. It is historical
research geography, not current legal city ownership. The OSM extractor also
attempts a separate community-mapped 17-LGU boundary snapshot; incomplete coverage
is explicitly labeled. Never silently mix boundary sources. The package manifest
names the geography actually used for counts.

## B. Source acquisition

Overture Places from the Azure mirror (pinned release 2026-10-21.0):

    python -m pip install -r scripts/requirements-ncr-research.txt
    python scripts/download-ncr-overture.py --out output/ncr/ncr-overture.geojson

OSM from https://download.geofabrik.de/asia/philippines-latest.osm.pbf (large, approximately 600 MB):

    Invoke-WebRequest -Uri 'https://download.geofabrik.de/asia/philippines-latest.osm.pbf' -OutFile 'output/ncr/philippines.osm.pbf'

The actual latest URL resolved to `philippines-261103.osm.pbf`, 612,751,019 bytes.
Its publisher MD5 is `ad2f292321af2cd78b707600e1712730`; the acquisition manifest
also records SHA-256. Use the dated URL to reproduce this run and verify the
publisher checksum. Extract directly on Windows or other platforms with pyosmium:

    python scripts/extract-ncr-osm.py --input output/ncr/philippines-261103.osm.pbf --out output/ncr/ncr-osm.geojson --source-url https://download.geofabrik.de/asia/philippines-261103.osm.pbf --boundaries-out output/ncr/ncr-lgus-osm.geojson

The rectangle is only a broad download prefilter. The normalizer uses the 17 LGU polygons for actual coverage. It preserves OSM IDs, excludes no-parking-only road tags, and does not guess that every mall/hotel/condo has publicly available parking.

The extractor assembles complete polygons/multipolygons, retains crossing lines,
avoids equivalent closed-way line/area duplicates, and audits failed geometry and
unassembled areas. Native tag filtering retains geometry dependencies and all
source tags on supported parking objects, including explicit `building=parking`
and legacy marked lanes. A real relation callback-order audit defect was fixed
by comparing expected/assembled sets after traversal; a second full extraction
reproduced all 12,074 parking features and 17 boundaries with no geometry errors
or unassembled parking areas. See the committed osm-acquisition.json. Raw national files and native dependencies remain ignored
under output/ncr. The compressed extracted source snapshots are reviewable
derivatives accompanied by source-specific licenses and attribution in
[licenses](../data/ncr-research/licenses/).

The corrected actual Azure extract contains 389 parking places. Exact category
filtering removed 11 garage-door-service businesses returned by the starter's
loose regular expression. All retained Overture taxonomy is generic `parking`,
so type is `facility_unspecified`, not an inferred lot/garage/entrance. Full
provider arrays, licenses, update times, taxonomy, names and operating status are
retained. GDAL native JSON arrays are supported as well as encoded JSON strings.

## C–D. Normalization and quality review

The actual primary counts use the complete 17-LGU OSM boundary snapshot. The
historical geoBoundaries source is retained for comparison, with its BGC/EMBO
caveats. Back in PowerShell, run with a fresh as-of timestamp:

    $asOf = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    node scripts/ncr-parking-research.mjs --boundaries output/ncr/ncr-lgus-osm.geojson --osm output/ncr/ncr-osm.geojson --overture output/ncr/ncr-overture.geojson --reviews data/ncr-research/poblacion-preservation.json --as-of $asOf --out output/ncr/metro-parking-research.json
    node scripts/ncr-coverage.mjs output/ncr/metro-parking-research.json output/ncr/ncr-lgus-osm.geojson data/ncr-research
    node scripts/package-ncr-research.mjs output/ncr/metro-parking-research.json output/ncr/ncr-lgus-osm.geojson output/ncr/ncr-osm.geojson output/ncr/ncr-overture.geojson data/ncr-research

The importer distinguishes dedicated lots, garages, individual bays, entrances, street segments, and facilities with unspecified subtypes. It retains source IDs, licenses, geometry, source hashes, per-city counts, grid cells, and possible same-name duplicates. An individual bay or entrance is not a separate facility. Street legality is unknown until separately checked. A polygon representative point is not a driving entrance.

Every imported record is research-only: unverified, publicationApproved=false, and pending human/license review. Private or restricted records must not be offered as public parking. Raw inputs and generated outputs are excluded from Git.

The frozen licensed derivative package is explicitly committed under
data/ncr-research; large working downloads remain ignored. Gzip archives recover
exact source bytes and have compressed/uncompressed SHA-256 hashes in manifest.json.
Only explicit shared provider IDs merge facility observations. Nearby same-name
features and Overture points inside OSM footprints become manual identity review
pairs; they are not automatically fused. Remaining facility counts are subject to
unresolved identity review. Tagged mall parking is retained, but mall membership
and public access are not inferred from proximity or a mall name.

City counts use full-geometry intersections and can overlap. The 0.01-degree grid
is about 1.08 by 1.11 km in NCR; it counts each source observation once, includes
zero-mapped cells and retains occupied representative cells outside administrative
geography. Grid totals must reconcile to imported observations. Polygon bbox
centers may fall outside the polygon; they are research anchors, never entrances.

The original Poblacion source/ledgers remain byte-preserved. The preservation
supplement retains PR #4's 15 owner decisions, eight online corroborations, six
pending visits and three owner-supplied navigation references. Exact-ID matches
carry those decisions without upgrading verification or publication; unmatched
IDs are reported. Reference URLs are prior owner navigation notes, not newly
acquired Google Maps content. Immutable byte-hashed files are excluded from
Prettier so formatting cannot invalidate provenance.

Tests:

    node --test scripts/ncr-geography.test.mjs scripts/ncr-parking-research.test.mjs
    pnpm test:data
    pnpm format:check
    pnpm lint
    pnpm typecheck
    pnpm build:web
    node scripts/parking-reviewed-data.mjs --check
    node scripts/check-ncr-package.mjs data/ncr-research

The Python runner executes each scripts/test-*.py file directly because unittest
discovery ignores their hyphenated names. Optional native-dependency cases skip
explicitly when packages are absent; run them in the extraction environment
before claiming full verification. No browser/E2E, emulator, Docker or production
integration is implied by these checks.

## E. Hotspot research

The output provides mapped-supply counts by LGU and roughly 1-km cell. These figures do not measure parking difficulty, current vacancy, unmet demand or willingness to pay. A zero-mapped city does not mean zero parking. Add evidence from driver interviews, peak-hour samples, permitted demand proxies and potential host/operator partners before ranking opportunity hotspots.

Initial investigation shortlist: Poblacion, BGC, Binondo, Makati CBD, Ortigas, MOA, Cubao and Tomas Morato. These are hypotheses, not scored winners.

The actual assessment also investigates North EDSA, Alabang and Maginhawa, with
27 recorded public-source retrieval attempts. First-party pages establish context
and partner leads; they do not prove measured demand, a usable supply gap,
willingness to pay or partner interest. All five scoring metrics remain empty.
Use the committed evidence file for an honest unranked result:

    node scripts/ncr-hotspot-score.mjs --evidence data/ncr-research/hotspot-evidence.json --research output/ncr/metro-parking-research.json --out data/ncr-research/hotspot-score.json

## Later Phase 1 F/G: app and site visits

Only after approvals: implement viewport queries/clustering and clear mapped-unverified/operator-confirmed/Parkey-verified labels. Do not present known illegal/private/closed parking as usable merely because a warning is displayed. Keep the previous Poblacion user decisions and three site-visit pins intact.

**Phase 1 exit:** real licensed boundary and source exports; tests and coverage/duplicate audit; separately grounded hotspot demand evidence; physical-visit/operator-verification plan. The scripts do not directly publish records.

### Evidence-gated hotspot scoring (Stage E implementation)

The separate script accepts a reviewed JSON evidence file and a generated Metro Manila supply report. A hotspot is ranked ONLY when all five human-scored 0–5 metrics have dated evidence references and confidence >=0.6: demand (30%), usable supply gap (25%), willingness to pay (20%), partner potential (15%), and launch feasibility (10%). Missing/low-confidence evidence results in more_evidence_needed, never a fabricated score.

Evidence JSON structure (save under output/ncr/hotspot-evidence.json, which Git ignores):

    {"schemaVersion":1,"asOf":"2026-11-05T00:00:00Z","areas":[{"id":"poblacion","name":"Poblacion","lgu":"Makati","metrics":[]}]}

An individual metric has fields metric, score (0–5), confidence (0–1), sourceKind (field_survey, interview, first_party, licensed_public), observedOn (YYYY-MM-DD) and evidenceReference (dated URL or internal reference). The empty example intentionally ranks nobody. Fill metrics using real observations; do not copy restricted Google Maps content.

    node scripts/ncr-hotspot-score.mjs --evidence output/ncr/hotspot-evidence.json --research output/ncr/metro-parking-research.json --out output/ncr/hotspot-score.json
    node --test scripts/ncr-hotspot-score.test.mjs

## Local-only Phase 1F research heatmap preview

This is not the public Parkey map, a hosted data feed, or a usable-parking inventory. It renders the generated `coverage.json` as an offline geographic grid. It displays only **aggregate mapped-source counts** by cell; no individual candidate pins, directions, operator details or access claims are exposed.

From the repository root:

```powershell
node --test scripts/ncr-research-preview.test.mjs
node scripts/ncr-research-preview.mjs data/ncr-research/coverage.json output/ncr/research-preview.html
Start-Process output/ncr/research-preview.html
```

The HTML contains no external map tiles, remote libraries or API requests. It is intended for internal research only. Filters cover all observations, facility source observations, street-parking tags with unconfirmed legality, and restricted-access observations. Counts are not a number of empty spaces or independently verified facilities. The `output/ncr/` directory remains Git-ignored. For a public app, implement reviewed server-side display eligibility, current access/legality and attribution requirements described in `docs/ncr-phase-1fg-plan.md`.

Also see `docs/ncr-release-review.md` for the licensing, duplication, street-legality and approval gates and `docs/ncr-hotspot-fieldwork.md` for the next actual demand-data collection wave.
