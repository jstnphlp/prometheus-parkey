# NCR parking-name evidence, 5 November 2026

This versioned research package preserves the original 5,427 observations and
3,744 provisional facility groups. It grants no public display approval and
records no completed site visits or operator permissions. The source-bound
review attachment is visible only in the opted-in loopback development preview.

The original PR #16 first pass found **zero** new name clues among 3,112 unnamed
groups. Four unused name tags belonged to already named groups and do not count
as discoveries. After the additional research, **zero additional credible
facility-name proposals** were established. All 3,112 groups remain unnamed.

| Evidence among originally unnamed groups   | Groups |
| ------------------------------------------ | -----: |
| Same-ID or unused name-tag clue            |      0 |
| Nearby named parking, identity unconfirmed |     56 |
| Of those, independent source provenance    |     41 |
| Named nearby/containing property           |  1,833 |
| Operator/brand clue                        |    158 |
| No additional clue                         |  1,227 |

These categories overlap. Nearby names are investigation leads, not newly
discovered names for the unnamed facilities. Counts concern groups, not aliases.

| Classification                                         | All groups | Originally unnamed |
| ------------------------------------------------------ | ---------: | -----------------: |
| Credible reusable name, final review pending           |        581 |                  0 |
| Proposed identity with incomplete/conflicting evidence |         72 |                 53 |
| Nearby named property only                             |      1,651 |              1,651 |
| Operator/brand only                                    |         27 |                 27 |
| No reliable name evidence                              |      1,054 |              1,054 |
| Restricted/closed/otherwise unsuitable                 |        359 |                327 |
| Total                                                  |      3,744 |              3,112 |

The 581 credible proposals retain existing names. There are 19 groups with
name/alias/location discrepancies, including the 15 baseline conflict groups;
none is an originally unnamed group. All 3,744 groups await final human review.
None has publication approval from this package.

## Files and provenance

- `baseline-totals.json`: exact original PR #16 first-pass counts.
- `name-enrichment.json.gz`: full review report, source IDs, coordinates, name
  evidence, classifications, prior human decisions and pending on-site checks.
- `name-review-queue.csv.gz`: spreadsheet queue for every group, ordered by area,
  evidence and mapped access clues. Includes every source coordinate and Google
  Maps/Waze review link, original evidence URLs and exact physical checks.
- `human-inspection-checklist.md.gz`: complete checklist grouped by Poblacion,
  BGC, Cubao and other research areas. All tasks remain pending.
- `review-manifest.json`: output hashes, frozen source hashes, totals and exact
  reproduction command. Use new output paths; writers refuse overwrites.
- `acquisition-42023326894/`: completed independent acquisition, extraction and
  current-source probes from the [successful runner acquisition](https://github.com/jstnphlp/prometheus-parkey/actions/runs/42023326894).
- `current-osm-updates.geojson.gz`: dated revision-comparison derivative of that
  run's raw Overpass response. Its metadata retains raw-source hash and query.
- `operator-research.json`: dated operator-source retrieval/permission register.
- `osm-source-manifest.json`, `ncr-*.geojson.gz`, `osm-parking-updates.geojson.gz`
  and `source-research.json` at this directory's top level retain the preliminary
  local re-extraction and source-probe audit. The completed acquisition subfolder
  supplies the canonical report inputs. Its success supersedes the recorded
  incomplete local download attempt without erasing that history.

The complete separately downloaded Philippines PBF was 612,751,019 bytes,
retrieved 11:59:18–12:00:42 UTC on 5 November. Geofabrik latest still resolved to
`philippines-261103.osm.pbf`, replication timestamp `2026-11-03T21:24:23Z`.
SHA-256: `ba1749901aa7559084dda822f1e2716324208fab8646b8de5309cef6206a5c51`.
Publisher MD5: `ad2f292321af2cd78b707600e1712730`, verified after the full download.
The bytes match the frozen national snapshot; a new retrieval is not a newer
editing date. The runner's temporary national file was not uploaded; the dated
publisher URL, full hashes, completed acquisition manifest and retained original
local national file preserve reproducibility. The compact derivatives are
committed here and the runner artifact has a 30-day retention period.

Exact geometry intersection with the frozen 17-LGU union retained 5,085 parking
objects and 6,951 named contextual properties, with original stable OSM IDs and
full geometries. Context extraction recorded one invalid area,
`relation/20181304`, in the coarse extraction audit; it was not manufactured or
silently counted as valid. No expected named-property IDs remained unassembled.
The live update audit at OSM base `2026-11-05T12:01:35Z` found one edited parking
way, `303264612`, with no name. Query scope covers currently tagged parking
objects; it cannot establish deletions or all former parking uses.

Official Overture STAC still reported release `2026-10-21.0`. The frozen
389-record per-provider licensed extract remains the current source; downloading
it again would add no new source date. The catalog bytes, URLs, dates and hashes
are retained in the acquisition probes. Overture/Foursquare provider overlap
does not count as independent corroboration of itself.

## Licensing and use

OSM/Geofabrik and Overpass derivatives retain **© OpenStreetMap contributors,
ODbL 1.0**. To the extent Parkey holds database rights in these OSM-derived
research databases, those rights are made available under ODbL 1.0; retain
attribution and corresponding database/share-alike obligations on redistribution.
Original record content retains its declared rights. Full [ODbL terms](../../ncr-research/licenses/ODbL-1.0.txt)
and the [source licensing report](../../ncr-research/licenses/README.md) accompany
the repository's research package.

Overture evidence retains every provider ID and declared license. The current
extract uses CDLA-Permissive-2.0 and Apache-2.0; retain their [agreement texts and
Foursquare NOTICE](../../ncr-research/licenses/README.md). New records with unknown
or unsupported licenses cannot supply reusable name proposals. The official
Places guide was checked again and its response hash is in the source probes.

APMC, UPark and Metro Parking sources supplied permission/contact research only.
No commercial directory reuse grant was established, no facility directory was
imported, and all [outreach drafts](../../../docs/ncr-operator-outreach.md) remain
unsent. Their HTML is retained only in the ignored local research archive.

Google Maps and Waze links use retained source coordinates only. No provider
content was scraped, copied, or treated as independent verification. Research
anchors and Overpass centers are not confirmed vehicle entrances. Unresolved
facilities remain hidden from active public discovery and retained in research.

## Open locally

For a readable full checklist on Windows:

```powershell
python -c "import gzip,pathlib; p=pathlib.Path('data/ncr-enrichment/2026-11-05/human-inspection-checklist.md.gz'); pathlib.Path('output/ncr/human-inspection-checklist.md').write_bytes(gzip.decompress(p.read_bytes()))"
```

Replace the compressed filename and output extension to open the full CSV or
JSON. A smaller [first-stop checklist](../../../docs/ncr-name-inspection-checklist.md)
is included for fieldwork planning. This is not a claim that inspections occurred.
