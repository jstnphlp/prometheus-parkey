# Parkey Phase 1 — permitted parking-name discovery (research only)

## What is implemented

The previous matcher compared existing OSM and Overture parking facility names; 3,112/3,744 provisional groups lacked a distinctive source name. This follow-up **searches for additional clues** instead of simply hiding unnamed pins. It does not claim to have automatically discovered real parking businesses via Google Maps or Waze.

The research-only script `scripts/ncr-permitted-enrichment.mjs` produces **a full JSON report and spreadsheet-friendly CSV review queue** for all 3,744 facility groups. Each entry retains group/source IDs, original status, unused name-tag evidence, operator/brand clues, named nearby OSM properties, navigation-only Google Maps/Waze links, and a transparent manual-review disposition.

New research sources are restricted to **locally provided OSM GeoJSON exports**: (1) named OSM parking objects matched by stable `@type/@id` against the existing frozen parking snapshot and (2) independently extracted named mall/commercial/hospital/university/hotel context features. The script rejects explicit Google/Waze-origin records. No remote map provider is accessed, and there are no automatic updates to stored parking names.

### First pass — use the existing archive (no downloads)

```powershell
git fetch origin
git switch --track origin/feat/ncr-permitted-name-enrichment
pnpm install --frozen-lockfile
node --test scripts/ncr-name-reconciliation.test.mjs scripts/ncr-permitted-enrichment.test.mjs
node scripts/ncr-permitted-enrichment.mjs --out output/ncr/name-leads-base.json --csv output/ncr/name-leads-base.csv
```

This first pass scans **already retained** OSM tags such as `official_name`, `name:en`, `alt_name`, `loc_name`, `short_name`, and `operator`, plus Overture name metadata. An `operator` or `brand` is a **context clue**, not automatically the official name of the parking lot. An OSM alternative name is source evidence, not a human verification.

### Second pass — additional OSM names and property context

Obtain a current Philippines PBF from official Geofabrik following `docs/ncr-parking-research.md` and create a separate NCR extract with `osmium extract`. Do not overwrite the frozen previous source or its manual reviews. Record exact download timestamp, hash and ODbL attribution.

In WSL, from the repository root with `osmium-tool` installed:

```bash
bash scripts/extract-ncr-name-context.sh output/ncr/ncr-area.osm.pbf output/ncr/osm-name-context.geojson
```

For a recent OSM parking subset, run the original `osmium tags-filter` and `osmium export -a type,id,timestamp` commands in the NCR research runbook against the newly downloaded (and independently retained) PBF, saving it under a NEW filename. The enrichment script matches names on the **same OSM object ID**—it does not assume nearby objects are the same physical garage.

```powershell
node scripts/ncr-permitted-enrichment.mjs --context-osm output/ncr/osm-name-context.geojson --refreshed-osm output/ncr/new-osm-parking.geojson --out output/ncr/name-leads-current.json --csv output/ncr/name-leads-current.csv
```

The CSV is a **review queue**, not a clean parking directory. Sort `priority` and inspect `nameTagLeads`, `operatorClues`, `contextClues`, then open Google/Waze review links. The links use existing source coordinates and must not be interpreted as a confirmed vehicle entrance.

### Naming outcomes

| Evidence                                          | Permitted action                                                                                                     | Not permitted as an automated conclusion                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Same OSM object gains a name in a newer snapshot  | Propose source-name update and retain both OSM references/versions                                                   | Do not claim independent cross-platform verification or auto-publish |
| OSM `official_name` or other alternate name tag   | Create attributed review proposal                                                                                    | Do not silently overwrite reviewed names                             |
| OSM `operator` or `brand` tag                     | Contact/entity context                                                                                               | Do not assume brand/operator is the facility name                    |
| Named mall/building containing the parking anchor | Label property association as an uncertain clue                                                                      | Do not convert `Unnamed parking` to `Mall Parking`                   |
| Named building/property within 90 m               | Investigate nearby association                                                                                       | Do not assert it is the same parking property                        |
| Official operator website/public directory        | Document source, date, owner permission and right to reuse; then add through a reviewed authorized-evidence workflow | Do not assume every website permits commercial database reuse        |
| Google Maps or Waze link                          | Open for reviewer navigation/location inspection                                                                     | Do not automate scraping or permanently copy provider place content  |
| No credible name or confirmed public access       | Keep hidden from public discovery, retain archive and assign follow-up                                               | Do not delete original OSM/Overture record                           |

## Verification workflow

1. Run the **base queue**, then add a new OSM PBF snapshot and context input for further clues.
2. Prioritize groups with same-ID OSM name leads, then unconfirmed operator clues, then nearby properties and finally no-lead groups.
3. Research official operator directories and ask authorized operators for reusable names where possible. An agent may draft outreach but must not impersonate or contact owners without permission.
4. For a candidate with insufficient evidence, use its Google Maps/Waze links for **manual inspection**, take permitted on-site sign photos or record an authorized operator statement. An external map label by itself is not a reusable-source publication approval.
5. Record source, dated observation, legal/access limitations, the parking facility's actual visitor name and vehicle entrance separately. Require human approval before any public display.

## Important limits

- **No existing source records, Poblacion decisions or production database were modified.** Existing branch PR #15 remains a draft and should be integrated first; this enrichment work is a follow-up review PR.
- Neither a proximity score nor a same-ID OSM name tag establishes current business operation, entrance, visitor access, lawful curb parking, prices, capacity or vacancies.
- The CSV and JSON are written with `wx` to prevent accidental overwrites. Use a new file name for repeated snapshots.
- Output remains in Git-ignored `output/ncr/`; no commercial sharing, scraping or bulk copying of Google/Waze content. Resolve licensing of any additional data before putting it in the permanent database.

## Engineering follow-ups

Codex should automate operator-directory discovery **subject to each source's permission**, add a reviewed first-party/authorized name-evidence ledger, evaluate extraction coverage by hotspot, add reproducibility hashes, and test name/visitor-access approval separately. Do not mark Phase 1E/1G complete from these source-only leads.

**Official reference sources:**

- [Google Places API policy](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Waze official deep links](https://developers.google.com/waze/deeplinks)
- [Overture Places sources and licensing](https://docs.overturemaps.org/guides/places/)
- [OpenStreetMap copyright/ODbL](https://www.openstreetmap.org/copyright)

For permitted direct-source partnerships, see the
[operator research source list](ncr-operator-research-sources.md).
