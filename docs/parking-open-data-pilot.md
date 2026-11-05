# Poblacion open parking POI pilot (review-only)

This experimental pilot compares **Overture Places** and optional **Foursquare Open Source Places** against Parkey's original 43 OpenStreetMap records in the Poblacion-area rectangle. It is a one-time evaluation, **not** a production pipeline, live availability feed, or a verification system. It never edits `osm-pilot.json`, `seed-discovery.sql`, or `parking-review-queue.json`.

## 1. Download a free Overture snapshot

Overture is a publicly downloadable, periodically released **dataset**, not a live API. The Python client uses the latest release via STAC. Run from the repository root (PowerShell):

```powershell
python -m pip install overturemaps
overturemaps download --bbox=121.024,14.558,121.041,14.572 -f geojson --type=place -o poblacion-places.geojson
```

The bounding box is **a pilot rectangle**, not the administrative boundary of Barangay Poblacion. This downloads *all* places in the rectangle; the script filters for parking-related categories. Confirm the downloaded file is a GeoJSON FeatureCollection and inspect unexpected data before continuing.

## 2. Stage possible matching names

```powershell
node scripts/parking-open-data.mjs --as-of 2026-11-03T12:00:00Z --overture poblacion-places.geojson
```

Replace the `--as-of` timestamp with the actual current UTC timestamp at run time, e.g. `(Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")` in PowerShell. The timestamp labels the **comparison run**, not a site visit or the source release date.

The script writes **`data/parking-open-data-review.json`** once, with an overwrite guard. This file is a staging artifact: archive or manually review it before regenerating. Raw provider files and staged output should not be accidentally committed as verified data.

## Optional: Add an FSQ OS Places export

Foursquare's open dataset currently requires accepting access terms on [Hugging Face](https://huggingface.co/datasets/foursquare/fsq-os-places). It is not an unauthenticated live search API. Export an area-limited CSV with at least:

```text
fsq_place_id,name,latitude,longitude,fsq_category_labels
```

Then run:

```powershell
node scripts/parking-open-data.mjs --as-of 2026-11-03T12:00:00Z --overture poblacion-places.geojson --foursquare poblacion-fsq.csv
```

The optional CSV may include `address`, `date_closed`, and `date_refreshed`. Exact export field mappings may differ by release; inspect headers first. Do **not** assume that records found in Overture and Foursquare are independent confirmations: Overture Places incorporates Foursquare data.

## What to review

Every candidate is `researched`/`unverified`. Review its source ID, claimed name, coordinate and category. For any possible match within 100 metres, check whether the candidate is **really the same facility**, rather than a nearby shop, building, driveway, or separate car park. The simple radius comparison is not a validated entity-resolution model.

Before approval or publication, independently confirm:
- Parking exists and still operates.
- Operator-approved/public/customer-only/private access and current parking legality.
- Actual **vehicle** entrance and usable directions (not just a map centroid).
- Rates, hours and restrictions from dated, first-party or on-site evidence.
- Correct attribution/licensing; particularly when joining new open data with the existing ODbL dataset.
- Duplicate identity and any mismatch between coordinates and business name.

Do not publish a guessed name, claim live occupancy, or promote confidence scores to human verification.

## Output and safeguards

`data/parking-open-data-review.json` contains source hashes, coordinates, names, provider provenance, per-source licenses if present, possible OSM matches, cross-source duplicates and comparison counts. Source release time may be unknown: the run timestamp is never substituted for provider freshness.

The script intentionally does not make network/API requests, store credentials, consume paid quotas, modify Supabase, or overwrite published data. The optional FSQ CSV adapter is experimental. No actual Poblacion live-source coverage measurement has been completed by this PR until the official export is downloaded and run.

### Checks

```powershell
node --test scripts/parking-open-data.test.mjs
pnpm test:data
```

## References

- [Overture Python downloader](https://docs.overturemaps.org/getting-data/overturemaps-py/)
- [Overture Places and attribution](https://docs.overturemaps.org/guides/places/)
- [Overture per-provider licensing](https://docs.overturemaps.org/attribution/)
- [Foursquare Open Source Places](https://docs.foursquare.com/data-products/docs/fsq-places-open-source)

**Next decision:** Compare observed counts, verify a small sample manually and only then decide whether monthly refresh should be automated. Avoid using TomTom-derived search data as a permanent database source until its applicable license and caching rights have been reviewed.

## November 3 review decisions: Google Maps name checks vs physical confirmation

This repository now keeps the **machine-generated source comparison separate from human review decisions**:

- `poblacion-places.geojson` — 15 downloaded Overture records (unchanged source snapshot).
- `data/parking-open-data-review.json` — baseline comparison for all 15 records; no human verification claims.
- `data/parking-open-data-decisions.json` — human decision ledger, keyed by Overture ID. The project owner reported checking eight names using Google Maps on **2026-11-03**; five require physical inspection, and two were removed from the shortlist without a recorded exclusion reason.
- `data/parking-open-data-reviewed.json` — deterministic joined view for human inspection, not an app publication feed.

`online_corroborated` is intentionally **not** `verified`. It means the owner reports finding the place when searching its name in Google Maps; this has not independently established that the candidate's Overture coordinate is the correct parking entrance, that the facility operates, or that visitors are allowed to park there. The export retains the name and coordinates from the open-source Overture input, not copied Google Maps coordinates or API content.

**Current counts:** 15 original source candidates; 8 online-corroborated, 5 needing site visits, 2 excluded pending reasons. Thirteen remain on the review shortlist; six are potential new locations based on a *100-metre heuristic*, and six distinct unnamed OSM records have at least one potential match. All 15 require licensing review because source-level license fields were absent from this export.

To validate or regenerate the joined review file without changing the decisions ledger:

```powershell
node --test scripts/parking-reviewed-data.test.mjs
node scripts/parking-reviewed-data.mjs --check
# If the derived file is stale and the human ledger has been reviewed:
node scripts/parking-reviewed-data.mjs --write
```

**Do not edit the derived file to make review decisions.** Edit `data/parking-open-data-decisions.json` instead, preserving every source ID, even for excluded candidates. The validation is designed to fail if a source candidate is added without a human status, if a decision name does not match the source, if a status falsely claims physical verification, or if it tries to mark publication approved.

Site reviewers should later record independent dated evidence for operation, correct vehicle entrance and parking restrictions in a separate verified-publication workflow. Any Google Maps confirmation here remains research evidence only, not an importable Google Maps Places dataset. Do not copy Google Maps listings, coordinates, reviews or opening hours into Overture/OSM records.

**Local Supabase config note:** Port overrides on a developer's Windows machine do not imply a hosted Parkey database migration or production publication.

## November 5: user-provided map pins for site visits

Three Google Maps **coordinate-pin URLs supplied directly by the project owner** have been linked to existing Overture review IDs in `data/parking-open-data-decisions.json` and the derived review report. These are navigation aids for future field checks, **not** a Google Places API import or evidence that parking is legal, publicly accessible, open, or available.

| Source candidate | Approximate Overture coordinates (longitude, latitude) | Review interpretation |
| --- | --- | --- |
| Riki Carreon Parking Lot | 121.03067135, 14.5671261 | Earlier Google Maps name corroboration retained; **now also queued for a physical visit** |
| Osmeña St | 121.030627, 14.568952 | Existing needs-site-visit record with owner-supplied pin |
| Classica 1 Parking Garage | 121.02405134, 14.56122542 | Existing needs-site-visit record with owner-supplied pin |

The pin validation requires the URL to be a Google Maps coordinate link no more than 100 metres from the Overture candidate; it **does not** establish that the map pin depicts an actual parking entrance. Riki and Classica pins match their Overture points to within rounding precision; Osmeña's is about 2 metres away.

The total physical-visit queue is now **6 candidates** (5 originally needing a visit, plus Riki's additional visit requirement), while the eight online name checks remain recorded as before. Three of those six have owner-supplied location links. Nobody has conducted or recorded these site visits yet, so **0 are physically verified or approved for publication**.

For each visit, photograph signage only where permitted, check parking eligibility and operating status, note the usable vehicle entrance, restrictions, rate and hours if available, and preserve dated evidence. Use an independent first-party source or on-site inspection for those claims. Do not copy Google Maps business content into open-data records.

After updating the human ledger, regenerate and validate the derived report:

```powershell
node scripts/parking-reviewed-data.mjs --write
node scripts/parking-reviewed-data.mjs --check
node --test scripts/parking-reviewed-data.test.mjs
```
