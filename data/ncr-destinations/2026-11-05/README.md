# Versioned NCR destination source evidence

This directory adds destination context for the private NCR research preview.
It preserves the earlier NCR snapshots, parking identities, coordinates and human
decisions. Nearby destinations support descriptive labels only; they do not
verify official parking names, ownership, access, entrances, routes or operation.

## Fresh OpenStreetMap acquisition

[Acquisition run 42032920734](https://github.com/jstnphlp/prometheus-parkey/actions/runs/42032920734)
executed the extraction scripts at commit `12cb01ccb6b78a13856fcbbaf900db6c57b3dea2`.
The independent download on November 5 resolved to
`https://download.geofabrik.de/asia/philippines-261104.osm.pbf`, with replication
timestamp `2026-11-04T21:21:03Z`. This is newer than the previous November 3 source.

- Source size: **612,888,497 bytes**.
- Source SHA-256: `1d0c37f90af5666473ee5df9f6691e94dfbded65aec40a507474eded60efe1d5`.
- Publisher MD5 verified: `c8d1e3c7c04fbdc98527090a8e1f0afc`.
- License: ODbL-1.0; attribution: © OpenStreetMap contributors.
- Exact frozen 17-LGU selection: **5,085 parking features** and **28,891 named
  destination/property context features**. Whole geometries are retained without
  clipping; the destination matcher separately rejects unsuitable context.
- Two context geometry errors are preserved in the extraction manifest and do
  not produce usable destination geometry.

The source metadata, categories, geometry errors, feature timestamps, source IDs,
licenses, acquisition headers and compressed/uncompressed derivative hashes are
in [the acquisition manifest](acquisition-42032920734/acquisition.json) and
[the derivative manifest](acquisition-42032920734/derivatives/osm-source-manifest.json).
Original tags, coordinates and full geometries are in the two gzip GeoJSON files
under `acquisition-42032920734/derivatives/`. The full country PBF was processed on
the disposable workflow runner; the exact dated source URL and hashes identify
it for reacquisition. It is not committed as a 613 MB repository asset.

An earlier local download attempt was terminated after receiving only 2,097,152
bytes because transfer stalled. Its partial file remains in ignored
`output/ncr/destination-enrichment-20261105/source/`; no derivative uses it.

Reproduce into a **new** output directory (existing outputs are rejected):

```sh
python -m pip install -r scripts/requirements-ncr-research.txt
# For a new latest acquisition with a full response/checksum manifest:
# python scripts/acquire-ncr-name-sources.py --out-dir output/ncr/destinations-new/source
# For exact historical source bytes, download the dated URL into a NEW path:
mkdir -p output/ncr/destinations-new/source
curl --fail --location --output output/ncr/destinations-new/source/philippines.osm.pbf https://download.geofabrik.de/asia/philippines-261104.osm.pbf
python -c "import hashlib; p='output/ncr/destinations-new/source/philippines.osm.pbf'; assert hashlib.file_digest(open(p,'rb'),'sha256').hexdigest() == '1d0c37f90af5666473ee5df9f6691e94dfbded65aec40a507474eded60efe1d5'"
python scripts/extract-ncr-osm.py --input output/ncr/destinations-new/source/philippines.osm.pbf --source-url https://download.geofabrik.de/asia/philippines-261104.osm.pbf --out output/ncr/destinations-new/osm-parking.geojson
bash scripts/extract-ncr-name-context.sh output/ncr/destinations-new/source/philippines.osm.pbf output/ncr/destinations-new/osm-name-context.geojson
python scripts/package-ncr-name-sources.py --parking output/ncr/destinations-new/osm-parking.geojson --context output/ncr/destinations-new/osm-name-context.geojson --boundaries data/ncr-research/ncr-lgus-osm.geojson.gz --out-dir output/ncr/destinations-new/derivatives
```

The shell entry point always delegates to the canonical pinned pyosmium
extractor. Hosts with the osmium CLI now use the same name/category/geometry
filters and source manifests. Extraction timestamps vary on rerun; geometry,
identities and category filtering remain deterministic for the same source.
The existing workflow can also be dispatched on the source commit/ref; future
runs follow the then-current latest Geofabrik release.

The preserved source probes independently rechecked Overture's latest catalog
(`2026-10-21.0`) and OSM changes since November 3 (one updated parking object,
without a name). These probes do not establish current operation or access.

## Independent Wikidata CC0 evidence

A bounded [WDQS query](wikidata/query.rq), retrieved November 5, returned **875
bindings** for museums, universities, hospitals, hotels, shopping centers, parks,
stadiums and attractions in the study rectangle. The rectangle includes areas
outside NCR. Exact frozen-boundary selection retained **776 coordinate features
representing 710 unique items**; 84 outside-NCR items and one item without a
recognizable label were excluded. Items can carry multiple source coordinates;
those alternatives remain separate. Duplicate class bindings are consolidated.

[Acquisition](wikidata/acquisition.json), [raw response](wikidata/response.json.gz),
[selected evidence](wikidata/ncr-destinations.geojson.gz) and
[derivative manifest](wikidata/derivative-manifest.json) preserve provenance and
hashes. This optional source is retained for independent corroboration; it is
**not consumed by the parking destination-label matcher**. The query did not
return item editing timestamps; recorded retrieval time is not represented as
an item modification timestamp. No Google/Waze place information was acquired.

Verify the archived Wikidata derivative without rewriting source evidence:

```sh
python scripts/package-ncr-wikidata.py --response data/ncr-destinations/2026-11-05/wikidata/response.json.gz --acquisition data/ncr-destinations/2026-11-05/wikidata/acquisition.json --boundaries data/ncr-research/ncr-lgus-osm.geojson.gz --out-dir data/ncr-destinations/2026-11-05/wikidata --check
```

To regenerate, omit `--check` and select a new output directory. To reacquire,
submit the archived SPARQL query to `https://query.wikidata.org/sparql` requesting
`application/sparql-results+json`, preserve the new response and its retrieval
time/hashes, and use a separately versioned directory. Live results may change.

All new evidence remains research-only. No official parking names, physical
verification, public publication approvals or operator permissions were created.
