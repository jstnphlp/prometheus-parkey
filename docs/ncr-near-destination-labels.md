# NCR destination descriptions ? private research

The fresh November 5 run processes every one of the **3,112 originally unnamed
facility groups**. It supplies **1,099 evidence-supported private descriptions**,
including **486 groups that previously displayed generic labels** and 613 retained
or refined descriptions. The original official/source names remain unchanged.

| Metric                                              | Before | After |
| --------------------------------------------------- | -----: | ----: |
| Officially unnamed facility groups                  |  3,112 | 3,112 |
| Private groups with destination descriptions        |  1,188 | 1,099 |
| Previously generic groups newly described           |      ? |   486 |
| Existing descriptions retained/refined              |      ? |   613 |
| Earlier descriptions withheld after stronger checks |      ? |   575 |
| Previously named facilities                         |    617 |   617 |
| Existing identity/name conflict groups              |     15 |    15 |
| Unnamed groups without a suitable destination       |      ? |   780 |
| Ambiguous destination/identity matches              |      ? |   903 |
| Restricted/unsuitable unnamed groups                |      ? |   330 |
| New official names verified                         |      0 |     0 |
| Public publication approvals                        |      0 |     0 |

The four current outcomes partition all 3,112 unnamed groups:
1,099 described + 780 without a suitable destination + 903 ambiguous + 330
restricted/unsuitable. The descriptor total decreased because generic building
associations, arbitrary winners and conflicting evidence no longer qualify.
The 486 newly useful labels are separate from 575 earlier descriptions withheld.
The baseline captures unchanged PR #17 commit `905f182` and its attached historical
report in `baseline-descriptors.json.gz`, with the old policy source and hashes.

## Open the review map

```powershell
node scripts/ncr-preview-server.mjs --development-preview --port 8090 --enrichment data/ncr-destinations/2026-11-05/destination-enrichment.json.gz
```

Start the existing Expo web preview as described in
[ncr-development-preview.md](ncr-development-preview.md), open
`http://localhost:8088/ncr-research`, and select **Open private research**.
**Named or near destinations (research)** is the default filter. Cross-source
name matches, distinctive source names and all research including unnamed remain
available. MapLibre labels and detail titles may show **Parking near [Destination]**;
the detail panel retains the original source name, category, measured straight-line
distance, containment, source reference/license/edit timestamp, alternatives and
uncertainties. Source coordinates are preserved. No research anchor is a verified
vehicle entrance, and no driving route or visitor eligibility is inferred.

The loopback-only API recomputes every group review from its retained evidence
before loading the immutable attachment. Results and source hashes must match.
The attachment is absent from public responses; clients reject destination review
metadata in public mode. Switching mode clears private labels. Existing access,
license, approval and publication checks remain enforced. Unapproved NCR public
output remains empty.

## Sources and selection

A new full **612,888,497-byte** Geofabrik Philippines snapshot resolves to
`philippines-261104.osm.pbf`, with replication timestamp **2026-11-04T21:21:03Z**.
Publisher MD5 and SHA-256 were verified in
[acquisition run 42032920734](https://github.com/jstnphlp/prometheus-parkey/actions/runs/42032920734).
Its source hash differs from the preserved earlier snapshot. Exact frozen NCR
boundaries select **28,891 named context features** and **5,085 parking features**.
Full geometry, OSM IDs, versions, edit timestamps, names, tags, hashes and ODbL
attribution are retained. Two invalid context areas remain explicit extraction
omissions. Independently acquired Wikidata CC0 evidence retains 776 coordinate
features for 710 items as corroboration; it does not determine parking labels.
No Google Maps/Waze place information is imported.

The deterministic score is `0.4 ? category relevance + max(0, 60 ? distance/3)`
plus 35 for valid source-polygon containment. Haversine measures unchanged parking
anchors against destination points or geometry bounding-box centers. Polygon
holes are respected. Category limits apply outside polygons: for example malls
130 m, restaurants 75 m and cafes 60 m. Generic office/commercial/retail buildings
cannot independently supply descriptions. Named visitor destinations include
malls, food destinations, attractions, parks, entertainment, medical facilities,
universities, hotels and eligible retailers. Category weights and limits remain
explicit in `scripts/ncr-destination-labels.mjs`.

Same-name duplicate OSM features retain supporting IDs; separate branches remain
alternatives. Distinct destinations within seven score points remain ambiguous.
All grouped parking anchors must support the same geographic destination.
Restricted access, lifecycle warnings, preserved exclusions, identity conflicts,
contradictory source anchors and explicit geographic/existence warnings prevent
confident selection. Uncertain source boundaries receive no containment bonus.
Nothing in this score measures popularity, demand, current operation, live
availability, parking ownership or legal access.

## Evidence and human review

[The versioned package](../data/ncr-destinations/2026-11-05/README.md) records the
source acquisition, exact geometry selection, licenses and source hashes.
`review-manifest.json` records the reproduction command, input/output hashes and
totals. The full JSON/CSV queue contains all 3,112 original unnamed groups.
`destination-top-ten.json` contains ten priority accepted examples with original
Parkey IDs, coordinates, distances and evidence references.
`destination-ambiguity-shortlist.json` provides the first 30 unresolved tasks in
the existing Poblacion, BGC, Cubao and other research windows. These are approximate
research pockets, not official neighborhood boundaries or demand rankings.

For a balanced first pass, [the 15-location launch-area shortlist](../data/ncr-destinations/2026-11-05/launch-area-review-shortlist.json)
selects the first five ambiguous tasks each in Poblacion, BGC and Cubao. Its
separate manifest binds the full queue hash and deterministic selection rule.

Start with this shortlist rather than physically visiting every group. Each task
preserves all source-coordinate Google Maps/Waze inspection links, proposed
alternatives, geographic relationships, access restrictions, uncertainties and
specific physical checks: operating parking, actual vehicle entrance, visitor
eligibility, barriers, signage, destination association and competing destinations.
Human identity decisions, operator authorization, physical checks and final
publication approval remain pending. No source archive or prior human decision
was overwritten.

Reproduce into a new output directory:

```powershell
node scripts/ncr-destination-report.mjs --context data/ncr-destinations/2026-11-05/acquisition-42032920734/derivatives/ncr-name-context.geojson.gz --parking data/ncr-destinations/2026-11-05/acquisition-42032920734/derivatives/ncr-osm-parking.geojson.gz --acquisition data/ncr-destinations/2026-11-05/acquisition-42032920734/acquisition.json --baseline data/ncr-destinations/2026-11-05/baseline-descriptors.json.gz --out-dir output/ncr/NEW_DESTINATION_REPORT
node --test scripts/ncr-destination-labels.test.mjs scripts/ncr-destination-report.test.mjs scripts/ncr-destination-evidence.test.mjs scripts/ncr-preview-server.test.mjs
```

Generators refuse to overwrite reports or source inputs. Initial generated
results from the evidence-review pass were preserved separately in ignored
`output/ncr/destination-initial-pass/` before final generation. Check execution
results and limitations in [ncr-destination-verification.md](ncr-destination-verification.md).
