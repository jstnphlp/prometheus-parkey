#!/usr/bin/env python3
"""Freeze separately versioned OSM name evidence intersecting actual NCR LGUs."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path

from shapely.geometry import shape
from shapely.ops import unary_union


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def read_geojson(path):
    raw = path.read_bytes()
    return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def package(parking_path, context_path, boundary_path, out_dir):
    for filename in ("ncr-osm-parking.geojson.gz", "ncr-name-context.geojson.gz", "osm-source-manifest.json"):
        if (out_dir / filename).exists():
            raise FileExistsError("Refusing to overwrite source derivative: " + filename)
    boundary_bytes = boundary_path.read_bytes()
    boundaries = read_geojson(boundary_path)
    if len(boundaries["features"]) != 17:
        raise ValueError("Expected the frozen 17-LGU NCR boundary snapshot")
    region = unary_union([shape(f["geometry"]) for f in boundaries["features"]])
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "schemaVersion": 1,
        "scope": "Full source geometries intersecting the frozen 17-LGU NCR polygon union; geometries are not clipped or modified.",
        "boundaryFile": boundary_path.as_posix(),
        "boundarySha256": digest(boundary_bytes),
        "license": "ODbL-1.0", "attribution": "© OpenStreetMap contributors",
        "licenseUrl": "https://www.openstreetmap.org/copyright",
        "policy": "Private research evidence; no identities, public access, field visits or publication approved.",
        "artifacts": [],
    }
    outputs = [(parking_path, "ncr-osm-parking.geojson.gz", "parking"),
               (context_path, "ncr-name-context.geojson.gz", "property_context")]
    for source, filename, role in outputs:
        collection = read_geojson(source)
        retained = [f for f in collection["features"] if shape(f["geometry"]).intersects(region)]
        collection["features"] = retained
        collection.setdefault("sourceMetadata", {})["geographyPolicy"] = manifest["scope"]
        raw = (json.dumps(collection, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
        compressed = gzip.compress(raw, mtime=0)
        with (out_dir / filename).open("xb") as output:
            output.write(compressed)
        source_manifest = Path(str(source) + ".manifest.json")
        manifest["artifacts"].append({
            "filename": filename, "role": role, "features": len(retained),
            "sha256": digest(compressed), "uncompressedSha256": digest(raw),
            "bytes": len(compressed), "uncompressedBytes": len(raw),
            "coarseSourceFile": source.as_posix(),
            "coarseSourceSha256": digest(source.read_bytes()),
            "coarseExtractionManifest": json.loads(source_manifest.read_text(encoding="utf-8")),
        })
    with (out_dir / "osm-source-manifest.json").open("x", encoding="utf-8", newline="\n") as output:
        json.dump(manifest, output, ensure_ascii=False, indent=2)
        output.write("\n")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--parking", type=Path, required=True)
    parser.add_argument("--context", type=Path, required=True)
    parser.add_argument("--boundaries", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(package(args.parking, args.context, args.boundaries, args.out_dir), indent=2))


if __name__ == "__main__":
    main()
