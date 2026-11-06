"""Independent destination evidence preserves coordinates and rejects altered input."""
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


HAS_SHAPELY = importlib.util.find_spec("shapely") is not None
if HAS_SHAPELY:
    SPEC = importlib.util.spec_from_file_location(
        "ncr_wikidata", Path(__file__).with_name("package-ncr-wikidata.py"))
    wikidata = importlib.util.module_from_spec(SPEC)
    SPEC.loader.exec_module(wikidata)


@unittest.skipUnless(HAS_SHAPELY, "Install pinned shapely for exact NCR evidence selection")
class WikidataTests(unittest.TestCase):
    def fixture(self, root):
        def binding(identity, name, coord, category):
            return {key: {"value": value} for key, value in (
                ("item", "http://www.wikidata.org/entity/" + identity),
                ("itemLabel", name), ("coord", coord), ("class", category))}
        response = {"results": {"bindings": [
            binding("Q1", "Museum", "Point(0.5 0.5)", "museum"),
            binding("Q1", "Museum", "Point(0.5 0.5)", "attraction"),
            binding("Q1", "Museum", "Point(0.6 0.6)", "museum"),
            binding("Q2", "Outside", "Point(2 2)", "museum"),
            binding("Q3", "Q3", "Point(0.5 0.5)", "museum"),
            binding("Q4", "Boundary Park", "Point(0 0)", "park"),
        ]}}
        raw = json.dumps(response).encode()
        compressed = gzip.compress(raw)
        response_path = root / "response.json.gz"
        response_path.write_bytes(compressed)
        acquisition_path = root / "acquisition.json"
        acquisition_path.write_text(json.dumps({
            "sha256": hashlib.sha256(compressed).hexdigest(),
            "uncompressedSha256": hashlib.sha256(raw).hexdigest(),
            "retrievedAt": "2026-11-05T13:06:45Z",
        }))
        polygon = {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]}
        boundary_path = root / "boundary.geojson.gz"
        boundary_path.write_bytes(gzip.compress(json.dumps({
            "features": [{"geometry": polygon}] * 17}).encode()))
        return response_path, acquisition_path, boundary_path

    def test_exact_geography_deduplicates_classes_preserves_alternative_coordinates(self):
        with tempfile.TemporaryDirectory() as temp:
            raw, _, summary = wikidata.build(*self.fixture(Path(temp)))
            features = json.loads(raw)["features"]
            self.assertEqual(summary["features"], 3)
            self.assertEqual(summary["uniqueItems"], 2)
            self.assertEqual(summary["outsideNcrItems"], 1)
            self.assertEqual(summary["unnamedItems"], 1)
            museum = next(feature for feature in features
                          if feature["geometry"]["coordinates"] == [0.5, 0.5])
            self.assertEqual(museum["properties"]["classes"], ["attraction", "museum"])
            self.assertEqual(museum["properties"]["sourceRecordUrl"], "https://www.wikidata.org/entity/Q1")

    def test_tampered_response_rejected_before_selection(self):
        with tempfile.TemporaryDirectory() as temp:
            paths = self.fixture(Path(temp))
            paths[0].write_bytes(gzip.compress(b'{"results":{"bindings":[]}}'))
            with self.assertRaisesRegex(ValueError, "response hashes"):
                wikidata.build(*paths)

    def test_archived_independent_source_reproduces_exact_features(self):
        directory = Path("data/ncr-destinations/2026-11-05/wikidata")
        raw, _, summary = wikidata.build(
            directory / "response.json.gz", directory / "acquisition.json",
            Path("data/ncr-research/ncr-lgus-osm.geojson.gz"))
        self.assertEqual((summary["features"], summary["uniqueItems"]), (776, 710))
        self.assertEqual(gzip.decompress((directory / "ncr-destinations.geojson.gz").read_bytes()), raw)
        manifest = json.loads((directory / "derivative-manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["uncompressedSha256"], hashlib.sha256(raw).hexdigest())


if __name__ == "__main__":
    unittest.main()
