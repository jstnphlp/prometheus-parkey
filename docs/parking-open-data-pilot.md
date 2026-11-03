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
