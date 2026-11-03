import importlib.util
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location('extract', Path(__file__).with_name('extract-osm-parking.py'))
extractor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extractor)

class ImportTests(unittest.TestCase):
    def test_only_explicit_supported_streets(self):
        root = ET.fromstring('''<osm>
        <node id="1" lon="121.03" lat="14.56"/><node id="2" lon="121.031" lat="14.561"/>
        <way id="3"><nd ref="1"/><nd ref="2"/><tag k="highway" v="residential"/><tag k="parking:both" v="lane"/></way>
        <way id="4"><nd ref="1"/><nd ref="2"/><tag k="highway" v="residential"/><tag k="parking:both" v="no"/></way>
        <way id="5"><nd ref="1"/><nd ref="2"/><tag k="highway" v="residential"/></way>
        <way id="6"><nd ref="1"/><nd ref="2"/><tag k="highway" v="residential"/><tag k="parking:lane:left" v="marked @ (Mo-Fr)"/></way>
        <node id="7" lon="121.03" lat="14.56"><tag k="amenity" v="parking"/><tag k="parking" v="street_side"/></node>
        <node id="8" lon="121.03" lat="14.56"><tag k="amenity" v="parking"/><tag k="access" v="private"/></node>
        </osm>''')
        records = extractor.extract(root, '2026-10-28T00:00:00Z')
        self.assertEqual([r['id'] for r in records], ['osm:node/8', 'osm:way/3'])
        self.assertEqual(records[1]['side'], 'both')
        self.assertIsNone(records[0]['fees'])
        self.assertIsNone(records[0]['hours'])
        self.assertEqual(records[0]['verification'], 'unverified')

    def test_source_tags_timestamp_and_explicit_entrance_membership(self):
        root = ET.fromstring('''<osm>
        <node id="1" lon="121.03" lat="14.56"><tag k="amenity" v="parking_entrance"/></node>
        <node id="2" lon="121.031" lat="14.561"/>
        <node id="9" lon="121.0301" lat="14.56"><tag k="amenity" v="parking_entrance"/></node>
        <way id="3" timestamp="2020-01-01T00:00:00Z"><nd ref="1"/><nd ref="2"/><nd ref="1"/>
        <tag k="amenity" v="parking"/><tag k="operator" v="Real operator"/><tag k="capacity" v="120"/>
        <tag k="payment:cash" v="yes"/><tag k="addr:postcode" v="1200"/><tag k="image" v="https://example.org/photo.jpg"/>
        </way></osm>''')
        record = extractor.extract(root, '2026-11-02T00:00:00Z')[0]
        self.assertEqual(record['osmEditedAt'], '2020-01-01T00:00:00Z')
        self.assertEqual(record['osmTags']['payment:cash'], 'yes')
        self.assertEqual(record['osmTags']['addr:postcode'], '1200')
        self.assertEqual(record['entrances'], [[121.03, 14.56]])


    def test_bad_coordinates_and_duplicate_identity_fail_closed(self):
        for lon, lat in [('nan', '14.56'), ('121.03', 'inf'), ('181', '14.56'), ('121.03', '90')]:
            root = ET.fromstring(f'<osm><node id="1" lon="{lon}" lat="{lat}"><tag k="amenity" v="parking"/></node></osm>')
            with self.assertRaises(ValueError):
                extractor.extract(root, '2026-11-02T00:00:00Z')
        with self.assertRaises(ValueError):
            extractor.extract(ET.fromstring('<osm><node id="1" lon="121.03" lat="14.56"/><node id="1" lon="121.03" lat="14.56"/></osm>'), '2026-11-02T00:00:00Z')

    def test_crossing_streets_preserve_full_extent_but_disjoint_lines_are_excluded(self):
        root = ET.fromstring('''<osm>
        <node id="1" lon="121.02" lat="14.565"/><node id="2" lon="121.05" lat="14.565"/>
        <way id="3"><nd ref="1"/><nd ref="2"/><tag k="highway" v="residential"/><tag k="parking:both" v="lane"/></way>
        <way id="4"><nd ref="1"/><nd ref="99"/><nd ref="2"/><tag k="highway" v="residential"/><tag k="parking:both" v="lane"/></way>
        <way id="5"><nd ref="1"/><nd ref="1"/><tag k="highway" v="residential"/><tag k="parking:both" v="lane"/></way>
        </osm>''')
        records = extractor.extract(root, '2026-11-02T00:00:00Z')
        self.assertEqual([r['id'] for r in records], ['osm:way/3'])
        self.assertEqual(records[0]['geometry']['coordinates'], [[121.02, 14.565], [121.05, 14.565]])
        self.assertEqual(records[0]['osmTags']['parking:both'], 'lane')
        self.assertFalse(extractor.intersects_pilot({'type': 'LineString', 'coordinates': [[121.023, 14.573], [121.0245, 14.573], [121.023, 14.5715]]}))

    def test_generic_restrictions_and_conflicting_side_prohibitions(self):
        root = ET.fromstring('''<osm>
        <node id="1" lon="121.03" lat="14.56"><tag k="amenity" v="parking"/><tag k="restriction" v="permit_only"/></node>
        <node id="2" lon="121.031" lat="14.561"/>
        <way id="3"><nd ref="1"/><nd ref="2"/><tag k="highway" v="residential"/><tag k="parking:both" v="lane"/><tag k="parking:right:restriction" v="no_parking"/></way>
        <way id="4"><nd ref="1"/><nd ref="2"/><tag k="highway" v="residential"/><tag k="parking:lane:both" v="parallel"/><tag k="parking:condition:both" v="no_stopping"/></way>
        </osm>''')
        records = extractor.extract(root, '2026-11-02T00:00:00Z')
        self.assertEqual([r['id'] for r in records], ['osm:node/1'])
        self.assertIn('permit only', records[0]['regulations'][0]['description'])
        self.assertEqual(records[0]['osmTags']['restriction'], 'permit_only')

    def test_dates_require_timezone_and_reject_future_or_post_snapshot_edits(self):
        root = ET.fromstring('<osm><node id="1" lon="121.03" lat="14.56" timestamp="2026-11-02T00:00:00Z"><tag k="amenity" v="parking"/></node></osm>')
        for observed in ['2026-11-01T00:00:00Z', '2026-11-02', '2099-01-01T00:00:00Z']:
            with self.assertRaises(ValueError):
                extractor.extract(root, observed)

    def test_cli_reproducible_output_and_hash_manifest(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            source = folder / 'input.osm'
            output = folder / 'snapshot.json'
            source.write_text('<osm><node id="1" lon="121.03" lat="14.56"><tag k="amenity" v="parking"/></node></osm>', encoding='utf-8')
            command = [sys.executable, str(Path(__file__).with_name('extract-osm-parking.py')), str(source), str(output), '--observed-at', '2026-11-02T00:00:00Z', '--source-url', 'https://www.openstreetmap.org/api/0.6/map?bbox=121.024,14.558,121.041,14.572']
            subprocess.run(command, check=True, capture_output=True)
            first = output.read_bytes()
            first_manifest = Path(str(output) + '.manifest.json').read_bytes()
            subprocess.run(command, check=True, capture_output=True)
            self.assertEqual(output.read_bytes(), first)
            self.assertEqual(Path(str(output) + '.manifest.json').read_bytes(), first_manifest)
            manifest = json.loads(first_manifest)
            self.assertEqual(manifest['inputSha256'], hashlib.sha256(source.read_bytes()).hexdigest())
            self.assertEqual(manifest['outputSha256'], hashlib.sha256(first).hexdigest())
            self.assertEqual(manifest['attribution'], '\u00a9 OpenStreetMap contributors')
            self.assertEqual(manifest['verification'], 'unverified')
            self.assertEqual(manifest['recordCount'], 1)


    def test_cli_invalid_metadata_does_not_overwrite_existing_output(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            source = folder / 'input.osm'
            output = folder / 'snapshot.json'
            manifest = Path(str(output) + '.manifest.json')
            source.write_text('<osm><node id="1" lon="121.03" lat="14.56"><tag k="amenity" v="parking"/></node></osm>', encoding='utf-8')
            output.write_text('existing snapshot', encoding='utf-8')
            manifest.write_text('existing manifest', encoding='utf-8')
            base = [sys.executable, str(Path(__file__).with_name('extract-osm-parking.py')), str(source), str(output)]
            for extra in [
                ['--observed-at', '2099-01-01T00:00:00Z', '--source-url', 'https://www.openstreetmap.org/'],
                ['--observed-at', '2026-11-02', '--source-url', 'https://www.openstreetmap.org/'],
                ['--observed-at', '2026-11-02T00:00:00Z', '--source-url', 'http://example.org/'],
                ['--observed-at', '2026-11-02T00:00:00Z', '--source-url', 'https://user:password@example.org/'],
                ['--observed-at', '2026-11-02T00:00:00Z', '--source-url', 'https://www.openstreetmap.org/', '--manifest', str(output)],
            ]:
                result = subprocess.run(base + extra, capture_output=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(output.read_text(encoding='utf-8'), 'existing snapshot')
                self.assertEqual(manifest.read_text(encoding='utf-8'), 'existing manifest')


    def test_timestamp_format_and_offset_agree_with_snapshot_validator(self):
        for value in [
            '2026-02-30T00:00:00Z', '2025-02-29T00:00:00Z',
            '2026-11-02T24:00:00Z', '2026-11-02T00:60:00Z', '2026-11-02T00:00:60Z',
            '2026-11-02T00:00:00', '2026-11-02T00:00:00+08',
            '2026-11-02T00:00:00+14:01', '2026-11-02T00:00:00-15:00',
            '2026-11-02T00:00:00+08:60', '2026-11-02 00:00:00Z',
            '20261102T000000Z', '2026-11-02T00:00:00Z ',
        ]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                extractor.observed_date(value)
        for value in [
            '2024-02-29T00:00:00Z', '2026-11-02T00:00:00+14:00',
            '2026-11-02T00:00:00-14:00', '2026-11-02T00:00:00.123456+08:00',
            '2026-11-02T00:00:00-03:30',
        ]:
            with self.subTest(value=value):
                self.assertIsNotNone(extractor.observed_date(value).tzinfo)

if __name__ == '__main__':
    unittest.main()
