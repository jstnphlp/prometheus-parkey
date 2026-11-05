# NCR parking coverage and evidence gaps

Research date: 5 November 2026. This is a mapped-source audit, not a complete
parking inventory, available-space count, demand study or permission to park.
No physical visits or publication approvals were performed. Read the frozen
[manifest](../data/ncr-research/manifest.json),
[coverage JSON](../data/ncr-research/coverage.json) and
[city CSV](../data/ncr-research/per-city.csv) with these limitations.

## Actual extraction and normalization results

The primary geography is **all 17 OpenStreetMap municipal relations from the
3 November 2026 Geofabrik snapshot**, not the historical geoBoundaries polygons.
Every exported parking geometry and every selected LGU geometry passed Shapely
validity checks. Source data time is 2026-11-03T21:24:23Z; import as-of is
2026-11-05T05:22:13Z. Neither timestamp is a field-verification date.

- Geofabrik: **12,074** coarse-envelope parking features; all unique by source
  object/geometry. Includes **79 explicit parking buildings**, of which **12**
  lack an amenity tag and would have been missed by the starter.
- Azure Overture: **389** coarse-envelope parking places from release
  `2026-10-21.0`, after excluding **11** garage-door-service false positives.
- Polygon filtering retains **5,427 observations** (**5,085 OSM**, **342 Overture**)
  and excludes **7,036** broad-envelope observations outside NCR. The large
  prefilter contains neighboring provinces; it must not be called NCR inventory.
- Types: **1,248 lots**, **186 garages**, **2,325 unspecified facilities**,
  **515 street segments**, **165 individual bays**, **988 entrances**.
- **3,759 facility source observations** become **3,744 provisional facility
  groups** after collapsing **15** repeated explicit provider identities.
  All source observations remain intact. **10** shared-identity groups have
  representative locations more than 100 m apart and need conflict review.
- **70 unresolved review pairs**: **12** same-name pairs within 100 m and **58**
  Overture points contained in OSM parking footprints. They are not automatically
  merged and may overlap known identity groups.
- **3,845 access-unknown**, **541 mapped restricted**, and **821 customer-only**
  observations. Other access tags include destination, delivery and designated
  use. Even the **87 `access=yes`** and **48 `access=permissive`** observations
  remain unverified and do not establish present permission or availability.
- **Zero missing declared source licenses** in retained records, **zero physically
  verified**, and **zero publication approved**. All normalized prices, hours,
  capacities and live availability remain null.
- All **15** legacy Poblacion IDs reconcile. Preserve **8** prior online
  corroborations, **6** pending visits and **3** owner navigation references;
  these do not turn into physical verification.

### Per-city source and type counts

| LGU         | Observations | Facility groups | Lots | Garages | Unspecified | Bays | Streets | Entrances |  OSM | Overture |
| ----------- | -----------: | --------------: | ---: | ------: | ----------: | ---: | ------: | --------: | ---: | -------: |
| Caloocan    |          171 |             134 |   63 |       4 |          67 |    5 |      20 |        12 |  162 |        9 |
| Las Piñas   |          213 |             181 |   99 |       5 |          77 |   11 |      10 |        11 |  204 |        9 |
| Makati      |          442 |             246 |   61 |      15 |         172 |    0 |      64 |       130 |  387 |       55 |
| Malabon     |           55 |              45 |   18 |       0 |          27 |    3 |       5 |         2 |   48 |        7 |
| Mandaluyong |          304 |             173 |   33 |      19 |         121 |    6 |      41 |        84 |  280 |       24 |
| Manila      |          653 |             441 |  137 |      19 |         289 |   82 |      51 |        75 |  614 |       39 |
| Marikina    |          208 |             107 |   41 |       3 |          63 |    4 |      82 |        15 |  202 |        6 |
| Muntinlupa  |          229 |             178 |   55 |      11 |         113 |    7 |       8 |        35 |  210 |       19 |
| Navotas     |           23 |              18 |   12 |       0 |           6 |    0 |       5 |         0 |   21 |        2 |
| Parañaque   |          247 |             164 |   60 |      13 |          91 |   15 |       6 |        62 |  230 |       17 |
| Pasay       |          285 |             238 |   64 |      11 |         164 |    3 |       7 |        36 |  258 |       27 |
| Pasig       |          488 |             312 |   91 |      17 |         204 |    4 |      46 |       126 |  459 |       29 |
| Pateros     |           14 |              11 |    8 |       0 |           3 |    2 |       1 |         0 |   14 |        0 |
| Quezon City |         1418 |            1037 |  365 |      50 |         625 |   11 |     120 |       247 | 1348 |       70 |
| San Juan    |          225 |             121 |   20 |       7 |          95 |    1 |      34 |        68 |  218 |        7 |
| Taguig      |          328 |             225 |   59 |      12 |         156 |    9 |      16 |        76 |  310 |       18 |
| Valenzuela  |          138 |             122 |   65 |       0 |          57 |    2 |       5 |         9 |  134 |        4 |

City intersection rows sum to **5441**, exceeding 5,427 because
border-crossing features contribute to multiple LGUs. Facility groups are
provisional identities, not confirmed independent facilities or available spaces.
Navotas (23 observations) and Pateros (14) are sparse mapping checks; Pateros has
no Overture observations. Makati and Navotas have no individually mapped bays.
Neither sparse counts nor missing categories establish low supply or low demand.

### Grid and investigation-window counts

There are **822** intersecting/occupied 0.01-degree cells, including **392**
zero-mapped cells. Grid observation totals reconcile exactly to **5,427**.
**0** occupied cells have source representative anchors outside the administrative
grid and remain explicitly flagged. All per-cell type/source/access counts are
in coverage.json, including zeros; no vacancy or capacity is inferred.

| Study window                       | Observations | Facility groups | Access unknown | Mapped restricted |
| ---------------------------------- | -----------: | --------------: | -------------: | ----------------: |
| Poblacion legacy research envelope |          100 |              54 |             87 |                 5 |
| BGC                                |          152 |              75 |            118 |                 3 |
| Binondo                            |          125 |              74 |             80 |                24 |
| Makati CBD                         |          247 |             128 |            216 |                11 |
| Ortigas                            |          279 |             154 |            200 |                56 |
| MOA                                |          107 |              82 |             80 |                 5 |
| Cubao                              |          102 |              57 |             66 |                17 |
| Tomas Morato                       |          134 |              89 |             95 |                 7 |
| North EDSA                         |           88 |              48 |             79 |                 3 |
| Alabang                            |          126 |              95 |            108 |                 4 |
| Maginhawa                          |          119 |              94 |            101 |                10 |

These windows overlap and are not ranked. The Poblacion row uses the preserved
legacy research envelope rather than a newly claimed official neighborhood
boundary. For source edit chronology, **3801** retained OSM observations have
last-edit dates before 5 November 2024. This is an object-edit-age signal, not
proof of stale parking conditions; recent edits also do not verify conditions.

The corrected full-extraction audit reports **zero geometry errors, zero
unassembled in-envelope area ways, and zero unassembled parking relations**.
The initial audit falsely listed already assembled relations because native
iteration yielded some areas before their source relations. A regression and
full-source rerun verified the correction without changing any parking or LGU
feature; [osm-acquisition.json](../data/ncr-research/osm-acquisition.json) records
that evidence. This audit does not detect parking that was never mapped.

## Geographic coverage and boundary uncertainty

All city names refer to the selected polygon source in the manifest. A source
feature crossing two LGUs contributes to both city intersection counts; city
rows therefore need not sum to the national research total. Grid observations
are assigned once by a representative point and reconcile to the total. Grid
cells measure mapped observations, not capacity or land-area completeness.
Zero cells may be unmapped, water, industrial/private land or low-activity areas;
they cannot establish an opportunity gap. Roughly 1-km cells vary in physical
area; no density-per-land-area or population-demand estimate is asserted.

The full geoBoundaries ADM3 source represents 2020. Manila is a union of 14
required source districts with original IDs retained. Source polygons are valid,
but their city ownership is materially stale/disputed: BGC High Street and
Uptown test points fall in its Makati polygon. EMBO transfers, disputed borders,
coastal reclamation and new facilities need newer, reviewed geography. The
separate OSM municipal extraction is a community-mapped comparison, not an
official legal survey; missing or ambiguous LGUs must never be silently filled.
Neighborhood study windows are analyst-defined rectangles, overlap and are not
official Poblacion/BGC/Ortigas or barangay boundaries. The legacy Poblacion
envelope is deliberately retained for comparability even though it spans
adjacent commercial areas.

## What the source counts can and cannot say

OSM extraction includes tagged lots, garages, street parking, bays and entrances;
mall parking is included when mapped, but no building is assigned parking merely
because it is a mall. Exact Overture parking taxonomy excludes automotive
businesses. Generic parking stays `facility_unspecified`; names containing
"garage", "entrance" or a mall name are identity/context clues for review and
cannot determine structure, vehicle entrance or mall membership.

Facility groups collapse only explicit shared source/provider identity. Duplicate
review pairs cover same-name facilities within 100 m and Overture points inside
OSM parking polygons, including unnamed footprints. They remain unresolved until
human identity review. Nearby floors, entrances and adjacent lots may be separate
objects. Differently named nearby points, unmapped entrances, provider aliases,
multi-floor garages, mall subdivisions and footprints that extend beyond the
download envelope remain additional conflation risks. No manual decision is
invented to obtain a smaller facility count.

Each observation retains original source ID, raw geometry/tags, source version
or release, record-edit/provider times where supplied, license and attribution.
The national Geofabrik file was checked against the publisher MD5 and recorded
with SHA-256. Original source hashes, selected boundaries and gzip integrity are
recorded separately. A download timestamp is not a visit date, and a recent map
edit does not prove recent on-site observation or current business operation.

## Evidence and access gaps

| Gap                                    | Why it matters                                                                                      | Action and completion evidence                                                                                                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unknown or conditional public access   | A mapped point can serve employees, residents, customers or permit holders.                         | Visit or obtain dated confirmation from an authorized operator; retain vehicle/customer/permit conditions. Never infer public use from absent `access` tags.                    |
| Restricted, closed or disused records  | Warning text cannot make these usable public parking.                                               | Keep research evidence and exclusions; resolve conflicts with dated operator/legal evidence before any display decision.                                                        |
| Street legality and schedules          | Lane tags can be stale, conditional or conflict with current signs, loading areas or road closures. | Audit exact block/side, signs and applicable rules; require legal/access review. No-parking-only and unsupported conditional-only tagging is not affirmative usable supply.     |
| Tomas Morato temporal restrictions     | Official QC notice titles identify Sunday vehicle restrictions on part of the corridor.             | Retrieve/review the full ordinance, amendments, implementation and posted signs. The notice is a research constraint, not a complete current legal determination.               |
| Unknown entrances and geometry         | A footprint bbox center can lie outside the footprint or across a wall/road.                        | Record a permitted vehicle entrance and safe approach during fieldwork; never route to a source representative point. Preserve original geometry and record repairs separately. |
| Individual bays/entrances and capacity | A mapped bay or entrance is not a separate facility; a polygon area is not space capacity.          | Link reviewed children to facilities; validate capacity scope with operator evidence. Never sum them as independent lots or estimate capacity from footprint area.              |
| Prices, opening hours and operation    | Research does not validate present fees, hours, customer restrictions or reopening.                 | Photograph permitted signs or obtain dated operator evidence, including overtime/event/overnight conditions. Unknowns remain null.                                              |
| Duplicate/alias/mall identity          | Several providers or floors can represent the same facility.                                        | Review unresolved pairs and containment matches, retain source lineage and an append-only human group decision. Do not rename or delete existing owner records.                 |
| Sparse and skewed mapping              | Counts reflect mapper/provider coverage, not a census.                                              | Check low-count cities and absent feature categories against permitted LGU/operator records and a predeclared field sample; document denominators before claiming completeness. |
| Actual parking demand                  | Destinations and source-pin density do not measure parking difficulty.                              | Dated arrival/search/queue/refusal observations by period and context, plus recruited-driver trip-purpose interviews with sampling limitations.                                 |
| Usable supply gap                      | Unknown capacity/access and overlapping identities prevent an unmet-demand calculation.             | Match observed demand periods to legal, accessible, deduplicated facilities and contemporaneous counts.                                                                         |
| Willingness to pay                     | A posted parking price or business-district location does not establish willingness to pay Parkey.  | Record actual past trip payments separately from hypothetical product/price choices; retain consent and sampling limitations.                                                   |
| Partner readiness                      | Public names and inquiry forms show contact leads, not commitment.                                  | Obtain authorized response, authority to offer inventory, terms, inventory/control scope and dated interest. No outreach was performed in this phase.                           |
| Launch feasibility                     | Geography, operator control, safety and data permissions remain unresolved.                         | Complete Phase 1F display gates and Phase 1G site/operator checks; use a documented go/no-go review rather than a fabricated weighted score.                                    |
| Licensing and redistribution           | Free access alone does not waive record-level terms.                                                | Retain ODbL, CDLA-Permissive-2.0, Apache-2.0 and boundary attribution/notices. Check each new provider on refresh; any missing provider license stays pending.                  |
| Failed online sources                  | A 403, TLS failure or JavaScript shell supplies no location-specific parking fact.                  | Keep the actual retrieval outcome and pursue permitted alternatives or fieldwork. Do not bypass restrictions or fill gaps with restricted Google Maps content.                  |

## Existing decisions and audit preservation

The original Poblacion input, manual decision ledger, original research and
generated review reports are preserved. Their byte-hashed artifacts are excluded
from formatting, and LF attributes preserve hashes across Windows checkouts.
[The preservation supplement](../data/ncr-research/poblacion-preservation.json)
also snapshots existing PR #4 decisions and owner navigation references, including
Riki's online corroboration and additional visit requirement. Online corroborated
does not mean physically verified. Prior exclusions and missing reasons stay
visible; a source refresh cannot approve a record or erase a visit task.

New source observations remain researched/unverified. Exact-ID human decisions
are carried separately; unmatched legacy IDs remain in the ledger for review.
The original owner's three navigation links are not a new Google data source,
verified entrances or permission to park. No Maps scraping or restricted listing
content was acquired. No production database, app pin or deployment was changed.

## Decision on hotspot ranking and next steps

The [hotspot assessment](ncr-hotspot-assessment.md) covers the eight requested
areas plus North EDSA, Alabang and Maginhawa. Twenty-seven real public-source
retrieval attempts provide contextual evidence and partner leads, with failures
and limits recorded. They do not satisfy all five commercial scoring dimensions.
All eleven areas remain unranked with missing metrics, rather than receiving
invented zero-demand or opportunity scores. Physical verification, interviews,
operator commitments and publication approval remain unfinished work.

Use the [Phase 1F/G specification](ncr-phase-1fg-plan.md) for explicit implementation
packages, response contracts, access/license/publication gates, warning copy,
field sampling, interviews, evidence retention and acceptance checks. Select
investigation order by existing owner requests, evidence access and fieldwork
logistics; that order is not a claimed commercial ranking.

## Verification and practical limits

All final commands passed on Node 24.22.2 / pnpm 11.25.0 / Python 3.12.6.
The frozen [verification record](../data/ncr-research/verification.json) lists the
commands, toolchain and limits.

| Check                                                  | Actual result                                                                                                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                       | Passed with the pinned pnpm version.                                                                                                            |
| `pnpm test`                                            | 210 Node tests and 29 Python tests passed; no skips with native dependencies available.                                                         |
| `pnpm test:data`                                       | 56 Node data tests and the same 29 Python tests passed; these overlap the root unit checks.                                                     |
| `pnpm lint`                                            | Passed with zero lint warnings/errors.                                                                                                          |
| `pnpm typecheck`                                       | Shared/mobile/web, E2E TypeScript and Edge Function checks passed; no E2E execution implied.                                                    |
| `pnpm format:check`                                    | Passed; immutable legacy artifacts intentionally excluded.                                                                                      |
| `pnpm build:web`                                       | Client/server production build passed locally; nothing deployed.                                                                                |
| `pnpm audit:data`                                      | Existing audit, review queue, local SQL seed and import fixture checks passed without database execution.                                       |
| `node scripts/parking-reviewed-data.mjs --check`       | Original Poblacion provenance/report reconciliation passed.                                                                                     |
| `node scripts/check-ncr-package.mjs data/ncr-research` | All four gzip archives, source/decision/license hashes, unique IDs and safety gates passed; normalized dataset and coverage reproduced exactly. |

The final Python checks used the pinned native geospatial dependencies through
PYTHONPATH=output/ncr/osmium-deps. The sandbox needed read access to that native
dependency folder; checks completed with that access. Default environments without
optional packages explicitly skip native tests and must not claim extraction
verification from those skips. An independent final review found no unresolved
critical, important or minor findings; Shapely recomputation found no LGU
assignment discrepancy and CSV recomputation found no count discrepancy.

The Node toolchain still emits existing module-type/circular-dependency warnings;
they did not fail the checks. This work does not claim browser/E2E, emulator,
Docker, live integration, production migration or field-visit verification.
