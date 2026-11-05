#!/usr/bin/env python3
"""Research-only Overture Places parking extract from public Azure storage.

No Google Maps content, no publication, no automatic verification. Output is a
GeoJSON source snapshot; the Node NCR importer handles boundaries and review.
"""
import argparse
import pathlib
import duckdb

RELEASE = "2026-10-21.0"  # Explicit, reproducible pilot; update only after review.
AZURE_ACCOUNT = "overturemapswestus2"
# Coarse download filter only, NOT the legal or administrative Metro Manila shape.
BBOX = (120.85, 14.30, 121.27, 14.86)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="output/ncr/ncr-overture.geojson")
    parser.add_argument("--release", default=RELEASE,
                        help="Overture release; pin and document changes.")
    args = parser.parse_args()
    out = pathlib.Path(args.out).resolve()
    if out.exists():
        parser.error("Output exists; refuse to overwrite the source snapshot.")
    if not all(c.isdigit() or c in "-." for c in args.release):
        parser.error("Invalid release string.")
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".partial.geojson")
    if tmp.exists():
        parser.error("Previous partial download exists; inspect it first.")
    db = duckdb.connect()
    db.execute("INSTALL azure; LOAD azure;")
    db.execute("INSTALL spatial; LOAD spatial;")
    db.execute("SET geometry_always_xy = true;")
    db.execute(
        "CREATE SECRET overture_public (TYPE AZURE, PROVIDER CONFIG, "
        "ACCOUNT_NAME 'overturemapswestus2');"
    )
    west, south, east, north = BBOX
    path = f"az://release/{args.release}/theme=places/type=place/*.parquet"
    sql = f"""
        COPY (
            SELECT
                id,
                names.primary AS name,
                COALESCE(taxonomy.primary, basic_category) AS basic_category,
                confidence,
                to_json(sources) AS sources_json,
                geometry
            FROM read_parquet('{path}')
            WHERE bbox.xmax >= {west} AND bbox.xmin <= {east}
              AND bbox.ymax >= {south} AND bbox.ymin <= {north}
              AND names.primary IS NOT NULL
              AND regexp_matches(lower(coalesce(taxonomy.primary, basic_category, '')),
                    'parking|garage|parkade')
        ) TO '{str(tmp).replace("'", "''")}'
        WITH (FORMAT GDAL, DRIVER 'GeoJSON')
    """
    try:
        print("Querying public Overture Azure source. This may take network I/O.")
        db.execute(sql)
        tmp.replace(out)
    finally:
        db.close()
    print("Saved research-only snapshot:", out)
    print("Release:", args.release)
    print("Do not count this bounding-box export as confirmed NCR coverage.")
    print("Review record-level licenses and provider attribution before publication.")


if __name__ == "__main__":
    main()
