"""Regression tests for the real geoBoundaries Manila district representation."""
import importlib.util
from pathlib import Path
import unittest


SPEC = importlib.util.spec_from_file_location("ncr_boundaries", Path(__file__).with_name("download-ncr-boundaries.py"))
boundaries = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(boundaries)


def feature(name, index=0):
    x = 121 + index * 0.001
    return {
        "type": "Feature",
        "properties": {"shapeName": name, "shapeID": "source-" + name},
        "geometry": {"type": "Polygon", "coordinates": [
            [[x, 14.5], [x + 0.001, 14.5], [x + 0.001, 14.501], [x, 14.501], [x, 14.5]]
        ]},
    }


class NcrBoundaryTests(unittest.TestCase):
    def source(self, include_districts=True):
        features = [feature(name) for name in boundaries.NAMES if name != "Manila"]
        if include_districts:
            features.extend(feature(name, i) for i, name in enumerate(boundaries.MANILA_DISTRICTS))
        return {"type": "FeatureCollection", "features": features}

    @unittest.skipUnless(importlib.util.find_spec("shapely"), "Install optional shapely dependency to test district dissolve")
    def test_complete_districts_dissolve_with_source_ids(self):
        result = boundaries.select_ncr(self.source(), {"boundaryCanonical": "Municipalities"})
        self.assertEqual(len(result["features"]), 17)
        manila = next(f for f in result["features"] if f["properties"]["lgu"] == "Manila")
        self.assertEqual(len(manila["properties"]["sourceIds"]), 14)
        self.assertEqual(manila["properties"]["sourceDistricts"], list(boundaries.MANILA_DISTRICTS))
        self.assertIn(manila["geometry"]["type"], ("Polygon", "MultiPolygon"))

    def test_missing_district_refuses_partial_manila(self):
        source = self.source()
        source["features"].pop()
        with self.assertRaisesRegex(ValueError, "Incomplete Manila district coverage"):
            boundaries.select_ncr(source, {"boundaryCanonical": "Municipalities"})

    def test_duplicate_district_rejected(self):
        source = self.source()
        source["features"].append(feature("Binondo"))
        with self.assertRaisesRegex(ValueError, "duplicate Manila district"):
            boundaries.select_ncr(source, {"boundaryCanonical": "Municipalities"})

    def test_direct_manila_and_wrong_administrative_level(self):
        source = self.source(include_districts=False)
        source["features"].append(feature("City of Manila"))
        result = boundaries.select_ncr(source, {"boundaryCanonical": "Municipalities"})
        self.assertEqual(len(result["features"]), 17)
        with self.assertRaisesRegex(ValueError, "NOT ADM2"):
            boundaries.select_ncr(source, {"boundaryCanonical": "Provinces"})

    def test_same_name_outside_study_extent_is_not_ncr(self):
        source = self.source(include_districts=False)
        outside = feature("Manila")
        outside["geometry"]["coordinates"] = [[[130, 10], [131, 10], [131, 11], [130, 10]]]
        source["features"].append(outside)
        with self.assertRaisesRegex(ValueError, "Missing NCR LGUs.*Manila"):
            boundaries.select_ncr(source, {"boundaryCanonical": "Municipalities"})


if __name__ == "__main__":
    unittest.main()
