# Parkey — Metro Manila parking research (Phase 1 A–E)

**Research-only:** no new app pins, database writes, verified records, permissions, availability or parking fees are created by these scripts.

## A. Geography

Required: 17 actual LGU polygons, not a rectangular Metro Manila approximation. The geography validator handles boundaries and street segments crossing cities. Download geoBoundaries **Philippines ADM3 municipalities**, not ADM2 provinces. Preserve the returned attribution, year (currently represented as 2020) and license (currently CC BY 3.0 IGO).

From PowerShell:

    New-Item -ItemType Directory -Force output/ncr | Out-Null
    python scripts/download-ncr-boundaries.py --out output/ncr/ncr-lgus.geojson

Boundary API: https://www.geoboundaries.org/api/current/gbOpen/PHL/ADM3/ . The downloader refuses if any of the 17 LGUs is absent. Optional --simplified saves bandwidth but reduces geographic precision.

## B. Source acquisition

Overture Places from the Azure mirror (pinned release 2026-10-21.0):

    python -m pip install --upgrade duckdb
    python scripts/download-ncr-overture.py --out output/ncr/ncr-overture.geojson

OSM from https://download.geofabrik.de/asia/philippines-latest.osm.pbf (large, approximately 600 MB):

    Invoke-WebRequest -Uri 'https://download.geofabrik.de/asia/philippines-latest.osm.pbf' -OutFile 'output/ncr/philippines.osm.pbf'

Then inside WSL Ubuntu, from the project directory with osmium-tool installed:

    sudo apt-get update && sudo apt-get install -y osmium-tool
    osmium extract --bbox=120.85,14.30,121.27,14.86 --strategy=smart output/ncr/philippines.osm.pbf -o output/ncr/ncr-area.osm.pbf
    osmium tags-filter output/ncr/ncr-area.osm.pbf nwr/amenity=parking,parking_space,parking_entrance w/parking:left w/parking:right w/parking:both 'w/parking:lane:*' -o output/ncr/ncr-parking.osm.pbf
    osmium export output/ncr/ncr-parking.osm.pbf -a type,id,timestamp -f geojson -o output/ncr/ncr-osm.geojson

The rectangle is only a broad download prefilter. The normalizer uses the 17 LGU polygons for actual coverage. It preserves OSM IDs, excludes no-parking-only road tags, and does not guess that every mall/hotel/condo has publicly available parking.

## C–D. Normalization and quality review

Back in PowerShell, run with a fresh as-of timestamp:

    $asOf = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    node scripts/ncr-parking-research.mjs --boundaries output/ncr/ncr-lgus.geojson --osm output/ncr/ncr-osm.geojson --overture output/ncr/ncr-overture.geojson --as-of $asOf --out output/ncr/metro-parking-research.json

The importer distinguishes dedicated lots, garages, individual bays, entrances, and street segments. It retains source IDs, licenses, geometry, source hashes, per-city counts, grid cells, and possible same-name duplicates. An individual bay or entrance is not a separate facility. Street legality is unknown until separately checked. A polygon representative point is not a driving entrance.

Every imported record is research-only: unverified, publicationApproved=false, and pending human/license review. Private or restricted records must not be offered as public parking. Raw inputs and generated outputs are excluded from Git.

Tests:

    node --test scripts/ncr-geography.test.mjs scripts/ncr-parking-research.test.mjs
    pnpm test:data
    pnpm format:check

## E. Hotspot research

The output provides mapped-supply counts by LGU and roughly 1-km cell. These figures do not measure parking difficulty, current vacancy, unmet demand or willingness to pay. A zero-mapped city does not mean zero parking. Add evidence from driver interviews, peak-hour samples, permitted demand proxies and potential host/operator partners before ranking opportunity hotspots.

Initial investigation shortlist: Poblacion, BGC, Binondo, Makati CBD, Ortigas, MOA, Cubao and Tomas Morato. These are hypotheses, not scored winners.

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
