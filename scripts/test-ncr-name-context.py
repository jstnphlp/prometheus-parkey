"""Exercise named-context extraction without inventing parking identities."""
import importlib.util
from pathlib import Path
import tempfile
import unittest


HAS_OSMIUM = importlib.util.find_spec("osmium") is not None
if HAS_OSMIUM:
    SPEC = importlib.util.spec_from_file_location(
        "ncr_context", Path(__file__).with_name("extract-ncr-name-context.py"))
    context = importlib.util.module_from_spec(SPEC)
    SPEC.loader.exec_module(context)


@unittest.skipUnless(HAS_OSMIUM, "Install optional osmium to test context extraction")
class ContextTests(unittest.TestCase):
    def extract(self, body):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "input.osm"
            source.write_text('<osm version="0.6">' + body + '</osm>', encoding="utf-8")
            return context.process_context(source)

    def test_named_property_filters_and_stable_identity(self):
        handler = self.extract('''
          <node id="1" lat="14.56" lon="121.03" version="3" timestamp="2026-11-03T00:00:00Z">
            <tag k="name" v="Example School"/><tag k="amenity" v="school"/>
          </node>
          <node id="2" lat="14.56" lon="121.03"><tag k="amenity" v="school"/></node>
          <node id="3" lat="14.56" lon="121.03"><tag k="name" v="Parking"/><tag k="amenity" v="parking"/></node>
          <node id="4" lat="16.0" lon="123.0"><tag k="name" v="Outside"/><tag k="shop" v="mall"/></node>
        ''')
        self.assertEqual(len(handler.features), 1)
        p = handler.features[0]["properties"]
        self.assertEqual((p["@type"], p["@id"], p["@version"]), ("node", 1, 3))
        self.assertEqual(p["@timestamp"], "2026-11-03T00:00:00Z")

    def test_named_restaurants_and_attractions_are_context_only(self):
        handler = self.extract('''
          <node id="101" lat="14.56" lon="121.03">
            <tag k="name" v="The Corner Restaurant"/>
            <tag k="amenity" v="restaurant"/>
          </node>
          <node id="102" lat="14.5601" lon="121.0301">
            <tag k="name" v="Local Museum"/>
            <tag k="tourism" v="museum"/>
          </node>
          <node id="103" lat="14.5602" lon="121.0302">
            <tag k="name" v="Community Park"/>
            <tag k="leisure" v="park"/>
          </node>
          <node id="104" lat="14.5603" lon="121.0303">
            <tag k="name" v="Parking"/>
            <tag k="amenity" v="parking"/>
          </node>
        ''')
        self.assertEqual(len(handler.features), 3)
        names = sorted(feature["properties"]["name"] for feature in handler.features)
        self.assertEqual(names, ["Community Park", "Local Museum", "The Corner Restaurant"])

    def test_polygon_preserves_geometry_without_duplicate_line(self):
        handler = self.extract('''
          <node id="1" lat="14.56" lon="121.03"/>
          <node id="2" lat="14.56" lon="121.031"/>
          <node id="3" lat="14.561" lon="121.031"/>
          <way id="4"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/>
            <tag k="name" v="Example Mall"/><tag k="shop" v="mall"/>
          </way>
        ''')
        self.assertEqual(len(handler.features), 1)
        f = handler.features[0]
        self.assertEqual(f["geometry"]["type"], "MultiPolygon")
        self.assertEqual(f["properties"]["@id"], 4)
        self.assertEqual(handler.expected - handler.assembled, set())

    def test_extended_visitor_categories_preserve_all_original_tags(self):
        examples = (("shop", "hardware"), ("amenity", "fast_food"),
                    ("amenity", "food_court"), ("amenity", "library"),
                    ("tourism", "aquarium"), ("tourism", "hostel"),
                    ("leisure", "bowling_alley"), ("historic", "fort"))
        nodes = []
        for identity, (key, value) in enumerate(examples, 1):
            nodes.append(f'''<node id="{identity}" lat="14.56" lon="121.03"
                              version="2" timestamp="2026-11-03T00:00:00Z">
              <tag k="name" v="Destination {identity}"/><tag k="{key}" v="{value}"/>
              <tag k="access" v="private"/><tag k="disused" v="yes"/>
            </node>''')
        handler = self.extract("".join(nodes))
        self.assertEqual(len(handler.features), len(examples))
        for feature in handler.features:
            self.assertEqual(feature["properties"]["access"], "private")
            self.assertEqual(feature["properties"]["disused"], "yes")
            self.assertEqual(feature["properties"]["@version"], 2)

    def test_unnamed_extended_categories_are_excluded(self):
        handler = self.extract('''
          <node id="1" lat="14.56" lon="121.03"><tag k="amenity" v="fast_food"/></node>
          <node id="2" lat="14.56" lon="121.03"><tag k="name" v="  "/><tag k="shop" v="hardware"/></node>
          <node id="3" lat="14.56" lon="121.03"><tag k="name" v="Private House"/><tag k="building" v="house"/></node>
        ''')
        self.assertEqual(handler.features, [])


if __name__ == "__main__":
    unittest.main()
