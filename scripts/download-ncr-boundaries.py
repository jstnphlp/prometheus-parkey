#!/usr/bin/env python3
"""Download an attributed, 17-LGU NCR boundary extract from geoBoundaries ADM3.

The Philippines' geoBoundaries ADM2 is provinces; ADM3 is cities/municipalities.
This data is for research geography, not an official 2026 legal boundary survey.
"""
import argparse
import json
import pathlib
import re
import unicodedata
import urllib.request

API = "https://www.geoboundaries.org/api/current/gbOpen/PHL/ADM3/"
NAMES = (
    "Caloocan", "Las Piñas", "Makati", "Malabon", "Mandaluyong", "Manila",
    "Marikina", "Muntinlupa", "Navotas", "Parañaque", "Pasay", "Pasig",
    "Pateros", "Quezon City", "San Juan", "Taguig", "Valenzuela",
)
STUDY_EXTENT = (120.85, 14.30, 121.27, 14.86)


def simplify_name(name):
    value = unicodedata.normalize("NFKD", str(name))
    value = "".join(c for c in value if not unicodedata.combining(c)).lower()
    value = re.sub(r"\b(city of|municipality of|city|municipality)\b", "", value)
    return re.sub(r"[^a-z]+", " ", value).strip()


LOOKUP = {simplify_name(name): name for name in NAMES}


def vertices(geometry):
    def visit(coords):
        if isinstance(coords, list) and len(coords) >= 2 and all(
            isinstance(v, (int, float)) for v in coords[:2]
        ):
            yield coords[:2]
        elif isinstance(coords, list):
            for part in coords:
                yield from visit(part)

    yield from visit(geometry["coordinates"])


def intersects_study_extent(geometry):
    coords = list(vertices(geometry))
    if not coords:
        return False
    left, bottom, right, top = STUDY_EXTENT
    return (
        min(x for x, _ in coords) <= right
        and max(x for x, _ in coords) >= left
        and min(y for _, y in coords) <= top
        and max(y for _, y in coords) >= bottom
    )


def select_ncr(source, metadata):
    if metadata.get("boundaryCanonical", "").lower() != "municipalities":
        raise ValueError("Expected ADM3 municipalities, NOT ADM2 provinces.")
    if source.get("type") != "FeatureCollection":
        raise ValueError("Expected GeoJSON FeatureCollection.")
    selected = {}
    for item in source.get("features", []):
        props = item.get("properties") or {}
        name = props.get("shapeName") or props.get("name")
        canonical = LOOKUP.get(simplify_name(name))
        if not canonical or not intersects_study_extent(item["geometry"]):
            continue
        if canonical in selected:
            raise ValueError("Ambiguous or duplicate NCR LGU: " + canonical)
        selected[canonical] = {
            "type": "Feature",
            "properties": {
                "lgu": canonical,
                "sourceName": name,
                "sourceId": props.get("shapeID"),
            },
            "geometry": item["geometry"],
        }
    missing = [name for name in NAMES if name not in selected]
    if missing:
        raise ValueError("Missing NCR LGUs in geoBoundaries dataset: " + ", ".join(missing))
    return {
        "type": "FeatureCollection",
        "sourceMetadata": {
            "provider": "geoBoundaries gbOpen",
            "api": API,
            "boundaryID": metadata.get("boundaryID"),
            "boundaryYearRepresented": metadata.get("boundaryYearRepresented"),
            "boundarySource": metadata.get("boundarySource"),
            "boundaryLicense": metadata.get("boundaryLicense"),
            "boundarySourceURL": metadata.get("boundarySourceURL"),
            "rawGeometry": metadata.get("gjDownloadURL"),
        },
        "features": [selected[name] for name in NAMES],
    }


def read_url(url):
    with urllib.request.urlopen(url, timeout=90) as response:
        return json.load(response)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--simplified", action="store_true",
                        help="Smaller/less precise geometry. Prefer full for border checks.")
    parser.add_argument("--metadata", help="Previously saved geoBoundaries ADM3 API JSON")
    parser.add_argument("--input", help="Previously downloaded whole-Philippines ADM3 GeoJSON")
    args = parser.parse_args()
    path = pathlib.Path(args.out)
    if path.exists():
        parser.error("Destination exists; refusing to overwrite reviewed source.")
    meta = json.loads(pathlib.Path(args.metadata).read_text(encoding="utf-8")) \
        if args.metadata else read_url(API)
    key = "simplifiedGeometryGeoJSON" if args.simplified else "gjDownloadURL"
    source = json.loads(pathlib.Path(args.input).read_text(encoding="utf-8")) \
        if args.input else read_url(meta[key])
    result = select_ncr(source, meta)
    if args.simplified:
        result["sourceMetadata"]["geometrySimplified"] = True
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as output:
        json.dump(result, output, ensure_ascii=False, separators=(",", ":"))
        output.write("\n")
    print("Saved 17 boundary polygons:", path)
    print("Source license:", meta.get("boundaryLicense"))
    print("Remember to attribute the boundary source in research derivatives.")


if __name__ == "__main__":
    main()
