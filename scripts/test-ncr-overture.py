"""Regression checks for actual Azure/GDAL Overture export shapes."""
import importlib.util
import pathlib
import unittest

SPEC = importlib.util.spec_from_file_location(
    "ncr_overture", pathlib.Path(__file__).with_name("download-ncr-overture.py")
)
overture = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(overture)


class OvertureExportTests(unittest.TestCase):
    def test_preserves_gdal_native_source_array_and_provider_licenses(self):
        sources = [{"dataset": "Foursquare", "license": "Apache-2.0",
                    "record_id": "original-id", "update_time": "2026-10-12"}]
        collection = {"type": "FeatureCollection", "features": [
            {"properties": {"name": None, "sources": sources,
                            "names": None, "taxonomy": {"primary": "parking"}}}
        ]}
        metadata = overture.enrich_snapshot(collection, "2026-10-21.0", "2026-11-05T00:00:00Z")
        self.assertIs(collection["features"][0]["properties"]["sources"], sources)
        self.assertEqual(metadata["declaredLicenseSourceCounts"], {"Apache-2.0": 1})
        self.assertEqual(metadata["providerSourceCounts"], {"Foursquare": 1})
        self.assertEqual(sources[0]["record_id"], "original-id")

    def test_handles_gdal_encoded_json_and_empty_sources_without_guessing_license(self):
        collection = {"features": [{"properties": {
            "names": '{"primary":null}', "taxonomy": '{"primary":"parking"}',
            "sources": '[{"dataset":"new-provider"}]'
        }}]}
        metadata = overture.enrich_snapshot(collection, "2026-10-21.0", "2026-11-05T00:00:00Z")
        self.assertEqual(collection["features"][0]["properties"]["names"], {"primary": None})
        self.assertEqual(metadata["declaredLicenseSourceCounts"], {"unknown": 1})

    def test_release_rejects_paths_and_sql_injection(self):
        for value in ("", "2026-10-21", "2026-10-21.0/other", "2026-10-21.0'; DROP TABLE x; --"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                overture.source_path(value)

    def test_filters_exact_parking_categories_without_dropping_unnamed_places(self):
        query = overture.build_query(overture.source_path("2026-10-21.0"), "a'b.geojson")
        self.assertIn("IN ('parking', 'parking_lot', 'parking_garage'", query)
        self.assertNotIn("regexp_matches", query)
        self.assertNotIn("names.primary IS NOT NULL", query)
        self.assertNotIn("'garage'", query)
        self.assertNotIn("'garage_door_service'", query)
        self.assertIn("a''b.geojson", query)
        self.assertIn("operating_status", query)

    def test_query_against_real_duckdb_excludes_service_and_retains_unnamed_parking(self):
        try:
            import duckdb
        except ImportError:
            self.skipTest("duckdb is an optional acquisition dependency")
        db = duckdb.connect()
        try:
            db.execute("""
                CREATE TABLE places AS SELECT row_number() OVER () AS id,
                    {'primary': name} AS names, {'primary': category} AS taxonomy,
                    category AS basic_category, 0.5 AS confidence,
                    'open' AS operating_status, 1 AS version, [] AS sources,
                    'fixture-geometry' AS geometry,
                    {'xmin': 121.0, 'xmax': 121.0, 'ymin': 14.5, 'ymax': 14.5} AS bbox
                FROM (VALUES ('parking', 'Alpha'), ('garage_door_service', 'Beta'),
                    ('parking_lot', NULL), ('garage', 'Auto repair'),
                    ('parking_entrance', 'Gate')) AS fixture(category, name)
            """)
            query = overture.build_query("fixture", "unused.geojson")
            select = query.split("COPY (", 1)[1].rsplit(") TO", 1)[0]
            select = select.replace("read_parquet('fixture')", "places")
            rows = db.execute(select).fetchall()
            self.assertEqual(len(rows), 3)
            self.assertEqual({row[3] for row in rows}, {"parking", "parking_lot", "parking_entrance"})
            self.assertIn(None, [row[1] for row in rows])
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
