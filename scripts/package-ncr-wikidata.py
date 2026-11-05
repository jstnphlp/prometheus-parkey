#!/usr/bin/env python3
"""Reproduce optional CC0 destination evidence from the archived WDQS response.

This independent source is retained for research corroboration only. The parking
description matcher does not consume these points or infer facility ownership.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import re

from shapely.geometry import Point, mapping, shape
from shapely.ops import unary_union


POLICY = (
    "Corroboration-only independent destination evidence; not used to assign parking names or destination descriptions. "
    "No item editing timestamp was returned by this query; retrieval time is not an item modification timestamp."
)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def build(response_path, acquisition_path, boundary_path):
    acquisition = json.loads(acquisition_path.read_text(encoding="utf-8"))
    response_bytes = response_path.read_bytes()
    raw_response = gzip.decompress(response_bytes)
    if (digest(response_bytes) != acquisition["sha256"]
            or digest(raw_response) != acquisition["uncompressedSha256"]):
        raise ValueError("Wikidata response hashes do not match the acquisition manifest")
    response = json.loads(raw_response)
    boundary_bytes = boundary_path.read_bytes()
    boundaries = json.loads(gzip.decompress(boundary_bytes))
    if len(boundaries["features"]) != 17:
        raise ValueError("Expected frozen 17-LGU NCR boundaries")
    region = unary_union([shape(feature["geometry"]) for feature in boundaries["features"]])
    destinations, outside, unnamed = {}, set(), set()
    for row in response["results"]["bindings"]:
        identity = row["item"]["value"]
        coords = re.fullmatch(r"Point\(([-\d.]+) ([-\d.]+)\)", row["coord"]["value"])
        if not coords:
            raise ValueError("Unrecognized Wikidata coordinate: " + row["coord"]["value"])
        point = Point(float(coords[1]), float(coords[2]))
        if not region.covers(point):
            outside.add(identity)
            continue
        name = row["itemLabel"]["value"]
        if re.fullmatch(r"Q\d+", name):
            unnamed.add(identity)
            continue
        key = (identity, point.x, point.y)
        if key not in destinations:
            destinations[key] = {
                "type": "Feature", "geometry": mapping(point),
                "properties": {
                    "sourceId": identity.rsplit("/", 1)[1],
                    "sourceRecordUrl": identity.replace("http:", "https:"),
                    "name": name, "classes": [], "license": "CC0-1.0", "source": "Wikidata",
                },
            }
        category = row["class"]["value"]
        if category not in destinations[key]["properties"]["classes"]:
            destinations[key]["properties"]["classes"].append(category)
    features = sorted(destinations.values(), key=lambda feature: (
        feature["properties"]["sourceId"], feature["geometry"]["coordinates"]))
    for feature in features:
        feature["properties"]["classes"].sort()
    metadata = {
        "provider": "Wikidata", "license": "CC0-1.0", "attribution": "Wikidata contributors",
        "retrievedAt": acquisition["retrievedAt"],
        "sourceResponseSha256": acquisition["uncompressedSha256"],
        "boundaryFile": boundary_path.as_posix(), "boundarySha256": digest(boundary_bytes),
        "geographyPolicy": "Original source points covered by frozen 17-LGU NCR polygon union.",
        "policy": POLICY,
    }
    raw = (json.dumps({"type": "FeatureCollection", "sourceMetadata": metadata, "features": features},
                      ensure_ascii=False, separators=(",", ":")) + "\n").encode()
    compressed = gzip.compress(raw, mtime=0)
    summary = {
        "schemaVersion": 1, **metadata, "filename": "ncr-destinations.geojson.gz",
        "features": len(features),
        "uniqueItems": len({feature["properties"]["sourceId"] for feature in features}),
        "responseBindings": len(response["results"]["bindings"]),
        "outsideNcrItems": len(outside), "unnamedItems": len(unnamed),
        "sha256": digest(compressed), "uncompressedSha256": digest(raw),
    }
    return raw, compressed, summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--response", type=Path, required=True)
    parser.add_argument("--acquisition", type=Path, required=True)
    parser.add_argument("--boundaries", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    raw, compressed, summary = build(args.response, args.acquisition, args.boundaries)
    geojson_path = args.out_dir / "ncr-destinations.geojson.gz"
    manifest_path = args.out_dir / "derivative-manifest.json"
    if args.check:
        recorded = json.loads(manifest_path.read_text(encoding="utf-8"))
        existing = geojson_path.read_bytes()
        # gzip's OS header can differ between Python versions; verify preserved
        # compressed evidence against its own hash and reproduce exact JSON bytes.
        if (digest(existing) != recorded["sha256"] or gzip.decompress(existing) != raw
                or {key: value for key, value in recorded.items() if key != "sha256"}
                != {key: value for key, value in summary.items() if key != "sha256"}):
            raise ValueError("Wikidata derivative does not reproduce")
    else:
        if geojson_path.exists() or manifest_path.exists():
            parser.error("Refusing to overwrite Wikidata source derivatives")
        args.out_dir.mkdir(parents=True, exist_ok=True)
        with geojson_path.open("xb") as output:
            output.write(compressed)
        with manifest_path.open("x", encoding="utf-8", newline="\n") as output:
            json.dump(summary, output, ensure_ascii=False, indent=2)
            output.write("\n")
    print(json.dumps({key: summary[key] for key in (
        "features", "uniqueItems", "responseBindings", "outsideNcrItems", "unnamedItems")}))


if __name__ == "__main__":
    main()
