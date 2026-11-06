"""Regression tests for optional pyosmium NCR geometry extraction."""
import importlib.util
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


HAS_OSMIUM = importlib.util.find_spec("osmium") is not None
if HAS_OSMIUM:
    SPEC = importlib.util.spec_from_file_location("ncr_osm", Path(__file__).with_name("extract-ncr-osm.py"))
    extractor = importlib.util.module_from_spec(SPEC)
    SPEC.loader.exec_module(extractor)


@unittest.skipUnless(HAS_OSMIUM, "Install optional osmium dependency to test PBF extraction")
class NcrOsmTests(unittest.TestCase):
    def extract(self, body, buildings_only=False):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "input.osm"
            source.write_text('<osm version="0.6">' + body + '</osm>', encoding="utf-8")
            handler = extractor.ParkingHandler()
            extractor.process_source(handler, source, buildings_only=buildings_only)
            return handler

    def test_polygon_identity_tags_and_no_duplicate_line(self):
        handler = self.extract('''
          <node id="1" lat="14.56" lon="121.03"/>
          <node id="2" lat="14.56" lon="121.031"/>
          <node id="3" lat="14.561" lon="121.031"/>
          <way id="4" version="2" timestamp="2026-01-01T00:00:00Z">
            <nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/>
            <tag k="amenity" v="parking"/><tag k="access" v="private"/>
          </way>''')
        self.assertEqual(len(handler.features), 1)
        feature = handler.features[0]
        self.assertEqual(feature["geometry"]["type"], "MultiPolygon")
        self.assertEqual(feature["properties"]["@type"], "way")
        self.assertEqual(feature["properties"]["@id"], 4)
        self.assertEqual(feature["properties"]["@timestamp"], "2026-01-01T00:00:00Z")
        self.assertEqual(feature["properties"]["access"], "private")

    def test_entrances_spaces_streets_and_outside_geometry(self):
        handler = self.extract('''
          <node id="1" lat="14.56" lon="121.03"><tag k="amenity" v="parking_entrance"/></node>
          <node id="2" lat="14.561" lon="121.031"><tag k="amenity" v="parking_space"/></node>
          <node id="3" lat="15.0" lon="122.0"><tag k="amenity" v="parking"/></node>
          <way id="4"><nd ref="1"/><nd ref="2"/><tag k="highway" v="residential"/>
             <tag k="parking:lane:both" v="parallel"/><tag k="parking:right:restriction" v="no_parking"/>
          </way>''')
        self.assertEqual(len(handler.features), 3)
        self.assertEqual(handler.rejected_outside_extent, 1)
        street = next(f for f in handler.features if f["properties"]["@type"] == "way")
        self.assertEqual(street["geometry"]["type"], "LineString")
        self.assertEqual(street["properties"]["parking:right:restriction"], "no_parking")

    def test_relation_assembles_outer_ring_preserves_identity(self):
        handler = self.extract('''
          <node id="1" lat="14.56" lon="121.03"/>
          <node id="2" lat="14.56" lon="121.031"/>
          <node id="3" lat="14.561" lon="121.031"/>
          <way id="4"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/></way>
          <relation id="5" timestamp="2026-01-01T00:00:00Z">
            <member type="way" ref="4" role="outer"/>
            <tag k="type" v="multipolygon"/><tag k="amenity" v="parking"/>
          </relation>''')
        self.assertEqual(len(handler.features), 1)
        self.assertEqual(handler.features[0]["properties"]["@type"], "relation")
        self.assertEqual(handler.features[0]["properties"]["@id"], 5)
        # FileProcessor may yield the assembled area before the raw relation.
        # Compare completed sets after traversal, not callback-order discards.
        self.assertEqual(handler.expected_area_relations - handler.assembled_area_relations, set())

    def test_native_filter_preserves_tagless_inner_ring_geometry(self):
        handler = self.extract('''
          <node id="1" lat="14.56" lon="121.03"/>
          <node id="2" lat="14.56" lon="121.04"/>
          <node id="3" lat="14.57" lon="121.04"/>
          <node id="4" lat="14.57" lon="121.03"/>
          <node id="5" lat="14.562" lon="121.032"/>
          <node id="6" lat="14.562" lon="121.034"/>
          <node id="7" lat="14.564" lon="121.034"/>
          <node id="8" lat="14.564" lon="121.032"/>
          <way id="9"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/></way>
          <way id="10"><nd ref="5"/><nd ref="6"/><nd ref="7"/><nd ref="8"/><nd ref="5"/></way>
          <relation id="11">
            <member type="way" ref="9" role="outer"/><member type="way" ref="10" role="inner"/>
            <tag k="type" v="multipolygon"/><tag k="amenity" v="parking"/>
          </relation>''')
        self.assertEqual(len(handler.features), 1)
        self.assertEqual(len(handler.features[0]["geometry"]["coordinates"][0]), 2)

    def test_missing_geometry_is_audited_without_inventing_a_line(self):
        handler = self.extract('''
          <node id="1" lat="14.56" lon="121.03"/>
          <way id="2"><nd ref="1"/><nd ref="999"/><tag k="highway" v="residential"/>
            <tag k="parking:both" v="lane"/>
          </way>''')
        self.assertEqual(handler.features, [])
        self.assertEqual(len(handler.geometry_errors), 1)
        self.assertEqual(handler.geometry_errors[0]["sourceId"], "way/2")

    def test_intersection_keeps_enclosing_geometry(self):
        geometry = {"type": "LineString", "coordinates": [[120.5, 14.5], [121.5, 14.5]]}
        self.assertTrue(extractor.intersects_extent(geometry))
        self.assertFalse(extractor.intersects_extent({"type": "Point", "coordinates": [122, 15]}))

    def test_current_city_boundaries_keep_relation_and_tag_provenance(self):
        handler = self.extract('''
          <node id="1" lat="14.56" lon="121.03"/>
          <node id="2" lat="14.56" lon="121.031"/>
          <node id="3" lat="14.561" lon="121.031"/>
          <way id="4"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/></way>
          <relation id="5" timestamp="2026-01-01T00:00:00Z">
            <member type="way" ref="4" role="outer"/>
            <tag k="type" v="boundary"/><tag k="boundary" v="administrative"/>
            <tag k="admin_level" v="6"/><tag k="name" v="City of Taguig"/>
          </relation>''')
        self.assertEqual(handler.features, [])
        self.assertEqual(len(handler.boundaries), 1)
        self.assertEqual(handler.boundaries[0]["properties"]["lgu"], "Taguig")
        self.assertEqual(handler.boundaries[0]["properties"]["sourceId"], "relation/5")
        self.assertEqual(handler.boundaries[0]["properties"]["sourceTags"]["admin_level"], "6")

    def test_explicit_parking_buildings_include_full_geometry_without_mall_inference(self):
        body = '''
          <node id="1" lat="14.56" lon="121.03"/>
          <node id="2" lat="14.56" lon="121.031"/>
          <node id="3" lat="14.561" lon="121.031"/>
          <node id="4" lat="14.56" lon="121.03"><tag k="amenity" v="parking"/></node>
          <node id="5" lat="14.56" lon="121.03"><tag k="shop" v="mall"/></node>
          <way id="6"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/>
            <tag k="building" v="parking"/><tag k="access" v="private"/>
          </way>'''
        full = self.extract(body)
        self.assertEqual(len(full.features), 2)
        supplement = self.extract(body, buildings_only=True)
        self.assertEqual(len(supplement.features), 1)
        self.assertEqual(supplement.features[0]["properties"]["@id"], 6)
        self.assertEqual(supplement.features[0]["properties"]["access"], "private")
        self.assertEqual(supplement.features[0]["geometry"]["type"], "MultiPolygon")

    def test_native_union_keeps_all_current_legacy_positions_and_conflicting_tags(self):
        ways = []
        identity = 10
        for key in extractor.STREET_KEYS:
            for position in extractor.STREET_POSITIONS:
                ways.append(f'<way id="{identity}"><nd ref="1"/><nd ref="2"/><tag k="highway" v="residential"/><tag k="{key}" v="{position}"/><tag k="parking:left:restriction" v="no_parking"/></way>')
                identity += 1
        body = '<node id="1" lat="14.56" lon="121.03"/><node id="2" lat="14.561" lon="121.031"/>' + ''.join(ways)
        handler = self.extract(body)
        self.assertEqual(len(handler.features), len(extractor.STREET_KEYS) * len(extractor.STREET_POSITIONS))
        self.assertTrue(all(f["properties"]["parking:left:restriction"] == "no_parking" for f in handler.features))

    def test_cli_hashes_and_refuses_to_replace_source_snapshot(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "input.osm"
            output = Path(temp) / "parking.geojson"
            source.write_text('<osm version="0.6"><node id="1" lat="14.56" lon="121.03"><tag k="amenity" v="parking"/></node></osm>', encoding="utf-8")
            command = [sys.executable, str(Path(__file__).with_name("extract-ncr-osm.py")),
                       "--input", str(source), "--out", str(output),
                       "--source-url", "https://download.geofabrik.de/asia/philippines-261103.osm.pbf"]
            subprocess.run(command, check=True, capture_output=True)
            original = output.read_bytes()
            manifest = json.loads(Path(str(output) + ".manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["inputSha256"], hashlib.sha256(source.read_bytes()).hexdigest())
            self.assertEqual(manifest["outputSha256"], hashlib.sha256(original).hexdigest())
            self.assertEqual(manifest["license"], "ODbL-1.0")
            self.assertNotEqual(subprocess.run(command, capture_output=True).returncode, 0)
            self.assertEqual(output.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
