#!/usr/bin/env python3
"""Research-only Overture Places parking extract from public Azure storage.

No Google Maps content, no publication, no automatic verification. Output is a
GeoJSON source snapshot; the Node NCR importer handles boundaries and review.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import pathlib
import re

RELEASE = "2026-10-21.0"  # Explicit, reproducible pilot; update only after review.
AZURE_ACCOUNT = "overturemapswestus2"
# Coarse download filter only, NOT the legal or administrative Metro Manila shape.
BBOX = (120.85, 14.30, 121.27, 14.86)
# Exact taxonomy categories only: a garage-door installer is not parking.
PARKING_CATEGORIES = (
    "parking", "parking_lot", "parking_garage", "car_park", "carpark",
    "parkade", "parking_space", "parking_bay", "parking_entrance",
)


def source_path(release):
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}\.\d+", release):
        raise ValueError("Invalid release string; expected YYYY-MM-DD.N.")
    return f"az://release/{release}/theme=places/type=place/*.parquet"


def build_query(path, destination):
    west, south, east, north = BBOX
    allowed = ", ".join("'" + value + "'" for value in PARKING_CATEGORIES)
    category = "lower(coalesce(taxonomy.primary, basic_category, ''))"
    return f"""
        COPY (
            SELECT id, names.primary AS name, to_json(names) AS names,
                COALESCE(taxonomy.primary, basic_category) AS basic_category,
                to_json(taxonomy) AS taxonomy, confidence, operating_status,
                version, to_json(sources) AS sources, geometry
            FROM read_parquet('{path.replace("'", "''")}')
            WHERE bbox.xmax >= {west} AND bbox.xmin <= {east}
              AND bbox.ymax >= {south} AND bbox.ymin <= {north}
              AND {category} IN ({allowed})
        ) TO '{str(destination).replace("'", "''")}'
        WITH (FORMAT GDAL, DRIVER 'GeoJSON')
    """


def enrich_snapshot(collection, release, downloaded_at):
    """Keep the actual record-level license/provider declarations, not guesses."""
    providers, licenses = Counter(), Counter()
    for feature in collection["features"]:
        props = feature["properties"]
        # GDAL JSON support can return native JSON or an encoded JSON string.
        for key in ("names", "taxonomy", "sources"):
            if isinstance(props.get(key), str):
                props[key] = json.loads(props[key])
        for source in props.get("sources") or []:
            providers[source.get("dataset") or "unknown"] += 1
            licenses[source.get("license") or "unknown"] += 1
    metadata = {
        "provider": "Overture Maps Foundation",
        "release": release,
        "sourceUri": source_path(release),
        "azureAccount": AZURE_ACCOUNT,
        "sourceUrl": f"https://{AZURE_ACCOUNT}.blob.core.windows.net/release/{release}/theme=places/type=place/",
        "downloadedAt": downloaded_at,
        "bboxPrefilter": list(BBOX),
        "parkingCategoryAllowlist": list(PARKING_CATEGORIES),
        "featureCount": len(collection["features"]),
        "providerSourceCounts": dict(sorted(providers.items())),
        "declaredLicenseSourceCounts": dict(sorted(licenses.items())),
        "licenseEvidence": "Record-level sources[].license from the pinned Azure release; provider attribution retained per record.",
        "licenseReferences": {
            "CDLA-Permissive-2.0": "https://cdla.dev/permissive-2-0/",
            "Apache-2.0": "https://www.apache.org/licenses/LICENSE-2.0",
        },
        "policy": "Research only; source declarations do not grant publication approval or confirm parking access. Bounding box is not NCR administrative coverage.",
    }
    collection["sourceMetadata"] = metadata
    return metadata


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="output/ncr/ncr-overture.geojson")
    parser.add_argument("--release", default=RELEASE,
                        help="Overture release; pin and document changes.")
    args = parser.parse_args()
    out = pathlib.Path(args.out).resolve()
    if out.exists():
        parser.error("Output exists; refuse to overwrite the source snapshot.")
    try:
        path = source_path(args.release)
    except ValueError as error:
        parser.error(str(error))
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".partial.geojson")
    if tmp.exists():
        parser.error("Previous partial download exists; inspect it first.")
    metadata_path = out.with_suffix(".metadata.json")
    if metadata_path.exists():
        parser.error("Metadata exists; inspect the previous source snapshot first.")
    import duckdb
    db = duckdb.connect()
    db.execute("INSTALL azure; LOAD azure;")
    db.execute("INSTALL spatial; LOAD spatial;")
    db.execute("SET geometry_always_xy = true;")
    db.execute(
        "CREATE SECRET overture_public (TYPE AZURE, PROVIDER CONFIG, "
        "ACCOUNT_NAME 'overturemapswestus2');"
    )
    try:
        print("Querying public Overture Azure source. This may take network I/O.")
        db.execute(build_query(path, tmp))
        collection = json.loads(tmp.read_text(encoding="utf-8"))
        metadata = enrich_snapshot(collection, args.release,
                                   datetime.now(timezone.utc).isoformat())
        tmp.write_text(json.dumps(collection, ensure_ascii=False,
                                  separators=(",", ":")) + "\n", encoding="utf-8")
        tmp.replace(out)
        metadata["sha256"] = hashlib.sha256(out.read_bytes()).hexdigest()
        with metadata_path.open("x", encoding="utf-8", newline="\n") as output:
            json.dump(metadata, output, ensure_ascii=False, indent=2)
            output.write("\n")
    finally:
        db.close()
    print("Saved research-only snapshot:", out)
    print("Release:", args.release)
    print("Do not count this bounding-box export as confirmed NCR coverage.")
    print("Review record-level licenses and provider attribution before publication.")


if __name__ == "__main__":
    main()
