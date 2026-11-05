#!/usr/bin/env python3
"""Extract full OSM parking geometries from a Geofabrik PBF, without publishing.

Install osmium separately. The coarse extent is only a download/extraction filter;
the Node importer applies actual NCR municipal polygons. Original PBF and output
hashes, source identities, tags, timestamps, and geometry failures are retained.
"""
import argparse
from collections import Counter
import datetime
import hashlib
import json
from pathlib import Path
import re
import unicodedata
from urllib.parse import urlparse

import osmium


BBOX = (120.85, 14.30, 121.27, 14.86)
AMENITIES = {"parking", "parking_space", "parking_entrance"}
STREET_POSITIONS = ("yes", "lane", "street_side", "on_kerb", "half_on_kerb",
                    "shoulder", "on_street", "parallel", "diagonal", "perpendicular", "marked")
STREET_KEYS = ("parking:left", "parking:right", "parking:both",
               "parking:lane:left", "parking:lane:right", "parking:lane:both")
NATIVE_TAGS = ([('amenity', value) for value in sorted(AMENITIES)]
               + [('building', 'parking'), ('admin_level', '6')]
               + [(key, value) for key in STREET_KEYS for value in STREET_POSITIONS])
LGUS = ("Caloocan", "Las Piñas", "Makati", "Malabon", "Mandaluyong", "Manila",
        "Marikina", "Muntinlupa", "Navotas", "Parañaque", "Pasay", "Pasig",
        "Pateros", "Quezon City", "San Juan", "Taguig", "Valenzuela")


def canonical_lgu(tags):
    def normalize(value):
        value = unicodedata.normalize("NFKD", value)
        value = "".join(c for c in value if not unicodedata.combining(c)).lower()
        value = re.sub(r"\b(city of|municipality of|city|municipality)\b", "", value)
        return re.sub(r"[^a-z]+", " ", value).strip()

    lookup = {normalize(name): name for name in LGUS}
    for key in ("name:en", "name", "official_name:en", "official_name"):
        if normalize(tags.get(key, "")) in lookup:
            return lookup[normalize(tags[key])]
    return None


def parking_tags(tags):
    return parking_area(tags) or (
        tags.get("highway") and any(key.startswith("parking:") for key in tags)
    )


def parking_area(tags):
    return tags.get("amenity") in AMENITIES or tags.get("building") == "parking"


def intersects_extent(geometry):
    def vertices(coords):
        if isinstance(coords[0], (int, float)):
            yield coords[:2]
        else:
            for part in coords:
                yield from vertices(part)

    points = list(vertices(geometry["coordinates"]))
    west, south, east, north = BBOX
    return bool(points) and (
        min(p[0] for p in points) <= east
        and max(p[0] for p in points) >= west
        and min(p[1] for p in points) <= north
        and max(p[1] for p in points) >= south
    )


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


class ParkingHandler(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.factory = osmium.geom.GeoJSONFactory()
        self.features = []
        self.geometry_errors = []
        self.rejected_outside_extent = 0
        self.boundaries = []
        self.expected_area_ways = set()
        self.expected_area_relations = set()
        self.assembled_area_ways = set()
        self.assembled_area_relations = set()

    def add(self, obj, kind, build_geometry):
        tags = dict(obj.tags)
        if not parking_tags(tags):
            return
        identity = obj.orig_id() if kind == "area" else obj.id
        source_type = ("way" if obj.from_way() else "relation") if kind == "area" else kind
        try:
            geometry = json.loads(build_geometry(obj))
            if not intersects_extent(geometry):
                self.rejected_outside_extent += 1
                return
        except (RuntimeError, ValueError, IndexError, osmium.InvalidLocationError) as error:
            self.geometry_errors.append({
                "sourceId": f"{source_type}/{identity}",
                "error": str(error),
            })
            return
        self.features.append({
            "type": "Feature",
            "properties": {
                **tags,
                "@type": source_type,
                "@id": identity,
                "@version": obj.version,
                "@timestamp": obj.timestamp.isoformat().replace("+00:00", "Z"),
            },
            "geometry": geometry,
        })

    def node(self, node):
        self.add(node, "node", self.factory.create_point)

    def way(self, way):
        tags = dict(way.tags)
        # libosmium's area assembler emits closed facility ways with full polygon
        # geometry; do not double count their equivalent line representation.
        if parking_area(tags) and way.is_closed() and tags.get("area") != "no":
            try:
                if intersects_extent(json.loads(self.factory.create_linestring(way))):
                    self.expected_area_ways.add(way.id)
            except (RuntimeError, ValueError, IndexError, osmium.InvalidLocationError) as error:
                self.geometry_errors.append({"sourceId": f"way/{way.id}", "error": str(error)})
            return
        self.add(way, "way", self.factory.create_linestring)

    def relation(self, relation):
        tags = dict(relation.tags)
        if parking_area(tags) and tags.get("type") in ("multipolygon", "boundary"):
            self.expected_area_relations.add(relation.id)

    def area(self, area):
        tags = dict(area.tags)
        if parking_area(tags):
            self.add(area, "area", self.factory.create_multipolygon)
            if area.from_way():
                self.assembled_area_ways.add(area.orig_id())
            else:
                self.assembled_area_relations.add(area.orig_id())
        if tags.get("boundary") == "administrative" and tags.get("admin_level") == "6":
            lgu = canonical_lgu(tags)
            if not lgu:
                return
            try:
                geometry = json.loads(self.factory.create_multipolygon(area))
                if not intersects_extent(geometry):
                    return
            except (RuntimeError, ValueError, IndexError, osmium.InvalidLocationError) as error:
                self.geometry_errors.append({"sourceId": f"relation/{area.orig_id()}", "error": str(error), "kind": "boundary"})
                return
            self.boundaries.append({
                "type": "Feature",
                "properties": {
                    "lgu": lgu,
                    "sourceName": tags.get("name"),
                    "sourceId": ("way/" if area.from_way() else "relation/") + str(area.orig_id()),
                    "sourceEditedAt": area.timestamp.isoformat().replace("+00:00", "Z"),
                    "sourceVersion": area.version,
                    "sourceTags": tags,
                },
                "geometry": geometry,
            })


def process_source(handler, source, index="flex_mem", buildings_only=False):
    # Native processors retain every coordinate/member before this filter runs.
    # TagFilter ORs the selected pairs, retaining every supported parking
    # position and all other tags (including prohibitions) on the chosen roads.
    # A matching parking position is mapped evidence, never permission to park.
    processor = osmium.FileProcessor(str(source)).with_locations(index).with_areas()
    processor.with_filter(osmium.filter.TagFilter(("building", "parking"))
                          if buildings_only else osmium.filter.TagFilter(*NATIVE_TAGS))
    for obj in processor:
        if obj.is_node():
            handler.node(obj)
        elif obj.is_way():
            handler.way(obj)
        elif obj.is_relation():
            handler.relation(obj)
        elif obj.is_area():
            handler.area(obj)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--index", default="flex_mem", help="libosmium location index")
    parser.add_argument("--boundaries-out", type=Path, help="Also extract complete admin_level=6 NCR boundary coverage")
    parser.add_argument("--parking-buildings-only", action="store_true",
                        help="Supplemental native-filtered pass for explicit building=parking geometries")
    args = parser.parse_args()
    manifest_path = Path(str(args.out) + ".manifest.json")
    if args.out.exists() or manifest_path.exists():
        parser.error("Output or manifest exists; refusing to overwrite a source snapshot.")
    if args.boundaries_out and (args.boundaries_out.exists() or args.boundaries_out.with_suffix(".incomplete.geojson").exists()):
        parser.error("Boundary output exists; refusing to overwrite a source snapshot.")
    output_paths = [args.input.resolve(), args.out.resolve(), manifest_path.resolve()]
    if args.boundaries_out:
        output_paths.extend([args.boundaries_out.resolve(), args.boundaries_out.with_suffix(".incomplete.geojson").resolve()])
    if len(set(output_paths)) != len(output_paths):
        parser.error("Input, output and manifest paths must be distinct.")
    source_url = urlparse(args.source_url)
    if source_url.scheme != "https" or not source_url.hostname or source_url.username or source_url.password:
        parser.error("--source-url must be public HTTPS without embedded credentials.")
    observed_at = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    with osmium.io.Reader(str(args.input)) as reader:
        replication_timestamp = reader.header().get("osmosis_replication_timestamp")
        generator = reader.header().get("generator")
    handler = ParkingHandler()
    process_source(handler, args.input, args.index, args.parking_buildings_only)
    handler.features.sort(key=lambda item: (
        item["properties"]["@type"], item["properties"]["@id"], item["geometry"]["type"]
    ))
    if not handler.features:
        parser.error("No mapped parking features found; no output was written.")
    metadata = {
        "sourceUrl": args.source_url,
        "provider": "Geofabrik / OpenStreetMap",
        "license": "ODbL-1.0",
        "attribution": "\u00a9 OpenStreetMap contributors",
        "copyrightUrl": "https://www.openstreetmap.org/copyright",
        "observedAt": observed_at,
        "replicationTimestamp": replication_timestamp,
        "generator": generator,
        "inputSha256": sha256(args.input),
        "extentPrefilter": list(BBOX),
        "extentPolicy": "Coarse geometry envelope only; actual NCR polygons applied downstream.",
        "verification": "unverified",
        "extractionPolicy": "building=parking only" if args.parking_buildings_only else "parking amenities, explicit parking buildings and supported highway parking positions; all tags preserved on selected objects",
        "streetPositionValues": list(STREET_POSITIONS),
        "streetPositionKeys": list(STREET_KEYS),
    }
    result = {"type": "FeatureCollection", "sourceMetadata": metadata, "features": handler.features}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("x", encoding="utf-8", newline="\n") as output:
        json.dump(result, output, ensure_ascii=False, separators=(",", ":"))
        output.write("\n")
    manifest = {
        **metadata,
        "outputSha256": sha256(args.out),
        "features": len(handler.features),
        "byGeometry": dict(Counter(f["geometry"]["type"] for f in handler.features)),
        "byAmenity": dict(Counter(f["properties"].get("amenity") or ("building=parking" if f["properties"].get("building") == "parking" else "parking_tags_on_highway") for f in handler.features)),
        "rejectedOutsideCoarseExtent": handler.rejected_outside_extent,
        "geometryErrors": handler.geometry_errors,
        "unassembledAreaWaysInExtent": sorted(handler.expected_area_ways - handler.assembled_area_ways),
        "unassembledParkingRelationsInCountry": sorted(handler.expected_area_relations - handler.assembled_area_relations),
    }
    with manifest_path.open("x", encoding="utf-8", newline="\n") as output:
        json.dump(manifest, output, ensure_ascii=False, indent=2)
        output.write("\n")
    if args.boundaries_out:
        counts = Counter(item["properties"]["lgu"] for item in handler.boundaries)
        missing = [name for name in LGUS if counts[name] != 1]
        boundary_metadata = {
            **metadata,
            "boundaryYearRepresented": replication_timestamp,
            "boundaryLicense": "ODbL-1.0",
            "boundarySource": "OpenStreetMap admin_level=6 municipal relations, Geofabrik snapshot",
            "boundaryCaveat": "Community-mapped boundaries, not legal-authoritative. Disputed borders and current LGU assignments require review.",
            "complete17LguCoverage": not missing,
            "missingOrAmbiguousLgus": missing,
        }
        boundary_result = {"type": "FeatureCollection", "sourceMetadata": boundary_metadata,
                           "features": sorted(handler.boundaries, key=lambda item: item["properties"]["lgu"])}
        boundary_out = args.boundaries_out if not missing else args.boundaries_out.with_suffix(".incomplete.geojson")
        boundary_out.parent.mkdir(parents=True, exist_ok=True)
        with boundary_out.open("x", encoding="utf-8", newline="\n") as output:
            json.dump(boundary_result, output, ensure_ascii=False, separators=(",", ":"))
            output.write("\n")
        print("OSM administrative boundaries:", len(handler.boundaries), "Missing/ambiguous:", missing, "Output:", boundary_out)
    print(json.dumps({key: manifest[key] for key in ("features", "byGeometry", "byAmenity", "replicationTimestamp")}))
    print("Geometry errors:", len(handler.geometry_errors), "Manifest:", manifest_path)


if __name__ == "__main__":
    main()
