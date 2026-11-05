#!/usr/bin/env python3
"""Canonical pyosmium extractor for named NCR visitor destination context.

Only named visitor destinations and commercial/institutional context are retained. Geometry and
source identity are evidence of context, never a parking-facility identity.
"""
import argparse
import datetime
import importlib.util
import json
from pathlib import Path

import osmium


SPEC = importlib.util.spec_from_file_location(
    "ncr_osm", Path(__file__).with_name("extract-ncr-osm.py"))
parking = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(parking)
KINDS = {
    "shop": ("mall", "department_store", "supermarket", "shopping_centre",
             "convenience", "bakery", "books", "electronics", "furniture",
             "hardware", "doityourself", "garden_centre", "variety_store",
             "wholesale", "clothes", "sports", "toys"),
    "amenity": ("hospital", "university", "college", "marketplace", "school",
                "restaurant", "cafe", "food_court", "fast_food", "ice_cream", "pub", "bar",
                "theatre", "cinema", "arts_centre", "library", "clinic",
                "conference_centre", "community_centre", "events_venue"),
    "tourism": ("hotel", "motel", "hostel", "guest_house", "attraction", "museum",
                "gallery", "zoo", "theme_park", "aquarium"),
    "leisure": ("park", "stadium", "sports_centre", "garden", "water_park",
                "fitness_centre", "swimming_pool", "bowling_alley", "golf_course"),
    "historic": ("monument", "memorial", "castle", "fort", "ruins", "archaeological_site"),
    "building": ("commercial", "retail", "office", "hotel", "supermarket", "hospital"),
}


def is_context(tags):
    return bool(tags.get("name", "").strip()) and any(
        tags.get(key) in values for key, values in KINDS.items())


class ContextHandler(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.factory = osmium.geom.GeoJSONFactory()
        self.features = []
        self.errors = []
        self.expected = set()
        self.assembled = set()

    def add(self, obj, kind, make_geometry):
        tags = dict(obj.tags)
        if not is_context(tags):
            return
        identity = obj.orig_id() if kind == "area" else obj.id
        source_type = ("way" if obj.from_way() else "relation") if kind == "area" else kind
        try:
            geometry = json.loads(make_geometry(obj))
            if not parking.intersects_extent(geometry):
                return
        except (RuntimeError, ValueError, IndexError, osmium.InvalidLocationError) as error:
            self.errors.append({"sourceId": f"{source_type}/{identity}", "error": str(error)})
            return
        self.features.append({"type": "Feature", "geometry": geometry, "properties": {
            **tags, "@type": source_type, "@id": identity, "@version": obj.version,
            "@timestamp": obj.timestamp.isoformat().replace("+00:00", "Z"),
        }})

    def node(self, obj):
        self.add(obj, "node", self.factory.create_point)

    def way(self, obj):
        if is_context(dict(obj.tags)) and obj.is_closed() and obj.tags.get("area") != "no":
            self.expected.add(("way", obj.id))
            return
        self.add(obj, "way", self.factory.create_linestring)

    def relation(self, obj):
        if is_context(dict(obj.tags)) and obj.tags.get("type") in ("multipolygon", "boundary"):
            self.expected.add(("relation", obj.id))

    def area(self, obj):
        self.add(obj, "area", self.factory.create_multipolygon)
        self.assembled.add(("way" if obj.from_way() else "relation", obj.orig_id()))


def process_context(source):
    handler = ContextHandler()
    processor = osmium.FileProcessor(str(source)).with_locations("flex_mem").with_areas()
    processor.with_filter(osmium.filter.TagFilter(*[
        (key, value) for key, values in KINDS.items() for value in values]))
    for obj in processor:
        if obj.is_node():
            handler.node(obj)
        elif obj.is_way():
            handler.way(obj)
        elif obj.is_relation():
            handler.relation(obj)
        elif obj.is_area():
            handler.area(obj)
    handler.features.sort(key=lambda f: (f["properties"]["@type"], f["properties"]["@id"]))
    return handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("out", type=Path)
    args = parser.parse_args()
    manifest_path = Path(str(args.out) + ".manifest.json")
    if args.out.exists() or manifest_path.exists():
        parser.error("Refusing to overwrite a context snapshot or manifest.")
    if args.input.resolve() in (args.out.resolve(), manifest_path.resolve()):
        parser.error("Input and outputs must be distinct.")
    handler = process_context(args.input)
    with osmium.io.Reader(str(args.input)) as reader:
        timestamp = reader.header().get("osmosis_replication_timestamp")
    metadata = {
        "provider": "OpenStreetMap / Geofabrik", "license": "ODbL-1.0",
        "attribution": "© OpenStreetMap contributors",
        "licenseUrl": "https://www.openstreetmap.org/copyright",
        "inputSha256": parking.sha256(args.input), "replicationTimestamp": timestamp,
        "extractedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "extentPrefilter": list(parking.BBOX), "namedPropertyKinds": KINDS,
        "policy": "Context only; never use a nearby property name as a parking facility name.",
        "features": len(handler.features), "geometryErrors": handler.errors,
        "unassembledNamedPropertiesInCountry": [f"{kind}/{id}" for kind, id in sorted(handler.expected - handler.assembled)],
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("x", encoding="utf-8", newline="\n") as output:
        json.dump({"type": "FeatureCollection", "sourceMetadata": metadata,
                   "features": handler.features}, output, ensure_ascii=False, separators=(",", ":"))
        output.write("\n")
    metadata["outputSha256"] = parking.sha256(args.out)
    with manifest_path.open("x", encoding="utf-8", newline="\n") as output:
        json.dump(metadata, output, ensure_ascii=False, indent=2)
        output.write("\n")
    print(json.dumps({"features": len(handler.features), "geometryErrors": len(handler.errors)}))


if __name__ == "__main__":
    main()
