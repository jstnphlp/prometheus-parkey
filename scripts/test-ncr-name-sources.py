"""Exact-LGU selection and immutable versioned-source regression checks."""
import importlib.util
import gzip
import json
from pathlib import Path
import tempfile
import unittest


HAS_SHAPELY = importlib.util.find_spec("shapely") is not None
if HAS_SHAPELY:
    SPEC = importlib.util.spec_from_file_location(
        "ncr_name_sources", Path(__file__).with_name("package-ncr-name-sources.py"))
    sources = importlib.util.module_from_spec(SPEC)
    SPEC.loader.exec_module(sources)


@unittest.skipUnless(HAS_SHAPELY, "Install optional shapely to test exact-LGU packaging")
class PackageTests(unittest.TestCase):
    def test_intersection_retains_whole_geometry_and_refuses_existing_version(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            geometry = {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]}
            boundary = root / "boundaries.geojson"
            boundary.write_text(json.dumps({"features": [{"geometry": geometry}] * 17}))
            crossing = {"type": "Feature", "properties": {"@type": "way", "@id": 1},
                        "geometry": {"type": "LineString", "coordinates": [[-1, 0.5], [2, 0.5]]}}
            outside = {"type": "Feature", "properties": {"@type": "node", "@id": 2},
                       "geometry": {"type": "Point", "coordinates": [2, 2]}}
            paths = [root / "parking.geojson", root / "context.geojson"]
            for path in paths:
                path.write_text(json.dumps({"features": [crossing, outside]}))
                Path(str(path) + ".manifest.json").write_text('{}')
            destination = root / "new-version"
            manifest = sources.package(*paths, boundary, destination)
            self.assertEqual([a["features"] for a in manifest["artifacts"]], [1, 1])
            compressed = (destination / "ncr-osm-parking.geojson.gz").read_bytes()
            self.assertEqual(json.loads(gzip.decompress(compressed))["features"], [crossing])
            self.assertEqual(manifest["artifacts"][0]["sha256"], sources.digest(compressed))
            with self.assertRaises(FileExistsError):
                sources.package(*paths, boundary, destination)
            self.assertEqual((destination / "ncr-osm-parking.geojson.gz").read_bytes(), compressed)


if __name__ == "__main__":
    unittest.main()
