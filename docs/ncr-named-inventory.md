# NCR named-parking reconciliation (research only)

## Purpose

Make the private NCR preview useful without displaying thousands of placeholder-name pins as apparent parking businesses. Nothing is deleted from the 5,427-source-record frozen archive. The legacy Poblacion decisions, source IDs, facility group identities, reviews, licenses and the empty publication ledger remain unchanged.

**A name match is not a verified facility, usable public parking, operator consent, a confirmed vehicle entrance, or permission to publish.**

## How the three filters work

| Private preview filter                  | Meaning                                                                                                                                                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cross-source name matches (default)     | Distinctive names appearing in OSM and Overture within 75 meters, with no obvious shared source-provider identity, for investigation. These are candidate corroborations only and may still represent two distinct facilities. |
| Source-named facilities                 | Facility observations with distinctive OSM/Overture names, whether matched or not. Names are unverified.                                                                                                                       |
| All source research (including unnamed) | Original lots, garages, unspecified facilities, individual spaces, street segments and entrances, including generic/unmatched names. Available only via explicit private research mode.                                        |

The public endpoint never exposes a generic placeholder name even if a synthetic publication approval event were otherwise valid. Every real public record still requires separate human approval for source rights, identity/visitor access, safety and field scope. This filter does not replace those publication checks.

## Reproduce the facility name-review dataset

From the repo root, with Node 24 and dependencies installed:

```powershell
node --test scripts/ncr-name-reconciliation.test.mjs scripts/ncr-preview-server.test.mjs
node scripts/ncr-name-reconciliation.mjs --out output/ncr/name-reconciliation.json
```

The CLI creates a **write-once ignored research report** under `output/ncr/`. It records every provisional facility group, original member IDs/names/licenses, source-supported proposed name when not conflicting, potential independent cross-source name matches, and two navigation-only links per source coordinate.

Every group retains `humanNameReviewRequired: true`, `publicVisitorAccessConfirmed: false`, `operatingStatusConfirmed: false` and `publicationApproved: false`. The report's active public IDs array is intentionally empty. Source names are never overwritten or automatically merged. To re-run, write to a new file; do not overwrite a previously reviewed report.

## Google Maps and Waze references

The private facility detail view can open Google Maps and Waze **coordinate-search links constructed from the existing OSM/Overture point**, without querying provider APIs or scraping their places. If the map point is a polygon midpoint, it is **not** a confirmed vehicle entrance.

Do not store copied Google/Waze place names, descriptions, access data, prices or operating hours in this independently licensed research dataset. Waze and Google are not necessarily independent corroborators; observed names on those platforms must not be treated as second reusable-source records.

To add independently reusable name evidence, obtain and retain permission/source attribution from a licensed source or an authorized operator, or document on-site first-party observations. Then create a separate human review decision referencing the original source record. Do not silently edit the frozen research archive.

## Why this is not a completed Metro Manila business directory

Most of the original 5,427 research observations were not named parking businesses. Some are entrances, bays and street segments. Many provisional facility groups have only an OSM or Overture source record, so strict cross-source matches will show far fewer pins than the 3,744 groups. A missing match can mean poor open-data coverage rather than a nonexistent parking facility.

**Future step:** prepare a separately reviewed active named-facility artifact from approved independent evidence and approved access. Hide unmatched records from public discovery without deleting research history. Site visits and operator verification are still required for reliable entrance and public-access claims.
