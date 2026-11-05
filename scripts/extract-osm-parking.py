"""Extract an attributed pilot snapshot from an OSM API .osm export. No network requests.
Usage: python3 scripts/extract-osm-parking.py export.osm snapshot.json --observed-at ISO8601 --source-url HTTPS_URL
Only explicit parking tags are imported. Nodes tagged as lane/street_side are
excluded: their point geometry cannot describe a street extent. Relations are
excluded until polygon/member assembly is implemented. All records are unverified.
"""
import argparse
import datetime
import hashlib
import json
import math
import re
from pathlib import Path
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

WEST, SOUTH, EAST, NORTH = 121.024, 14.558, 121.041, 14.572
ALLOWED = {'lane', 'street_side', 'parallel', 'diagonal', 'perpendicular', 'marked', 'on_street', 'yes'}

def restriction_text(key, value):
    if key == 'access':
        return 'Access recorded by OpenStreetMap: ' + value.replace('_', ' ')
    if key == 'ownership':
        return 'Road ownership recorded by OpenStreetMap: ' + value.replace('_', ' ')
    if key == 'maxstay':
        return 'Maximum stay: ' + value
    if key == 'restriction':
        return 'Restriction recorded by OpenStreetMap: ' + value.replace('_', ' ')
    parts = key.split(':')
    legacy = len(parts) > 1 and parts[1] in ('lane', 'condition')
    side_index = 2 if legacy else 1
    side = {'left': 'left side', 'right': 'right side', 'both': 'both sides'}.get(parts[side_index] if len(parts) > side_index else '', 'side unknown')
    field = ':'.join(parts[side_index + 1:])
    label = {'orientation': 'Parking orientation', 'restriction': 'Restriction', 'maxstay': 'Maximum stay', 'time_interval': 'Restriction times (source notation)'}.get(field)
    if label is None:
        label = 'Restriction' if legacy and parts[1] == 'condition' else 'Mapped parking arrangement'
    return label + ' (' + side + '): ' + value.replace('_', ' ')

def observed_date(value):
    # Enforce the shared contract before Python's ISO parser: newer Python
    # versions accept 24:00:00 and normalize it into the following calendar day.
    pattern = r'[0-9]{4}-[0-9]{2}-[0-9]{2}T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\.[0-9]+)?(?:Z|[+-]([0-9]{2}):([0-9]{2}))'
    match = re.fullmatch(pattern, value) if isinstance(value, str) else None
    if not match:
        raise ValueError('Observation date must be an ISO 8601 timestamp with explicit timezone')
    offset_hours, offset_minutes = (int(part or 0) for part in match.groups())
    if offset_hours > 14 or offset_minutes > 59 or (offset_hours == 14 and offset_minutes != 0):
        raise ValueError('Observation date UTC offset must be between -14:00 and +14:00')
    try:
        parsed = datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError as error:
        raise ValueError('Observation date contains invalid calendar or time components') from error
    if parsed > datetime.datetime.now(datetime.timezone.utc):
        raise ValueError('Observation date must not be in the future')
    return parsed


def coordinate(node):
    try:
        point = [float(node.get('lon')), float(node.get('lat'))]
    except (TypeError, ValueError) as error:
        raise ValueError('Invalid OSM coordinate for node ' + str(node.get('id'))) from error
    if not all(math.isfinite(v) for v in point) or not (-180 <= point[0] <= 180 and -85.051129 <= point[1] <= 85.051129):
        raise ValueError('Out-of-range OSM coordinate for node ' + str(node.get('id')))
    return point


def intersects_pilot(geometry):
    def inside(point):
        return WEST <= point[0] <= EAST and SOUTH <= point[1] <= NORTH
    if geometry['type'] == 'Point':
        return inside(geometry['coordinates'])
    points = geometry['coordinates']
    if any(inside(point) for point in points):
        return True
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        dx, dy = x2 - x1, y2 - y1
        low, high = 0, 1
        for p, q in ((-dx, x1-WEST), (dx, EAST-x1), (-dy, y1-SOUTH), (dy, NORTH-y1)):
            if p == 0:
                if q < 0:
                    break
            elif p < 0:
                low = max(low, q/p)
            else:
                high = min(high, q/p)
            if low > high:
                break
        else:
            return True
    return False


def extract(root, observed):
    snapshot_date = observed_date(observed)
    if root.tag != 'osm':
        raise ValueError('Expected an OSM XML export')
    identities = set()
    for item in root:
        if item.tag in ('node', 'way', 'relation'):
            identity = (item.tag, item.get('id'))
            if not (item.get('id') or '').isdigit() or int(item.get('id')) <= 0 or identity in identities:
                raise ValueError('Invalid or duplicate OSM identity: ' + str(identity))
            identities.add(identity)
    nodes = {n.get('id'): coordinate(n) for n in root.findall('node')}
    records = []
    for item in root:
        tags = {tag.get('k'): tag.get('v') for tag in item.findall('tag')}
        point = nodes.get(item.get('id')) if item.tag == 'node' else None
        coords = [nodes[n.get('ref')] for n in item.findall('nd') if n.get('ref') in nodes]
        # Never build a line across missing nodes.
        if item.tag == 'way' and len(coords) != len(item.findall('nd')):
            continue
        kind, side, geometry = None, 'unknown', None
        if tags.get('amenity') == 'parking' and item.tag in ('node', 'way'):
            if tags.get('parking') in ('street_side', 'lane') or tags.get('building') == 'construction':
                continue
            if point is None and coords:
                # Facility polygons are represented by a point; this is NOT a mapped entrance.
                unique = coords[:-1] if coords[0] == coords[-1] else coords
                point = [sum(p[i] for p in unique) / len(unique) for i in (0, 1)]
            if point is None:
                continue
            kind = 'garage' if tags.get('parking') in ('multi-storey', 'underground') or tags.get('building') == 'parking' else 'lot'
            geometry = {'type': 'Point', 'coordinates': point}
        elif item.tag == 'way' and tags.get('highway') and 2 <= len(coords) <= 500:
            if len({tuple(p) for p in coords}) < 2:
                continue
            # Conflicting side-wide/legacy prohibitions require human interpretation.
            if any(v in ('no_parking', 'no_stopping') for k, v in tags.items() if k.startswith(('parking:', 'parking:condition:'))):
                continue
            sides = []
            for direction in ('both', 'left', 'right'):
                value = tags.get('parking:' + direction, tags.get('parking:lane:' + direction, ''))
                # Conditional values need reviewed interpretation; retain them as rules only
                # on otherwise supported records, never infer permission from them.
                restriction = tags.get('parking:' + direction + ':restriction', '')
                if value in ALLOWED and restriction not in ('no_parking', 'no_stopping'):
                    sides.append(direction)
            if not sides:
                continue
            kind = 'street'
            side = 'both' if 'both' in sides or {'left', 'right'}.issubset(sides) else sides[0]
            geometry = {'type': 'LineString', 'coordinates': coords}
            point = coords[len(coords) // 2]
        if not kind or not point or not intersects_pilot(geometry):
            continue
        url = 'https://www.openstreetmap.org/' + item.tag + '/' + item.get('id')
        rules = {k: v for k, v in tags.items() if k in ('access', 'maxstay', 'restriction', 'ownership') or k.startswith('parking:')}
        regulations = [{'description': restriction_text(k, v), 'sourceLabel': 'OpenStreetMap tags (not independently verified)', 'sourceUrl': url, 'observedAt': observed} for k, v in sorted(rules.items())]
        if geometry['type'] == 'Point':
            regulations.append({'description': 'Map point may be a facility centroid, not an entrance. Confirm access on arrival.', 'sourceLabel': 'Parkey import geometry note', 'sourceUrl': url, 'observedAt': observed})
        fees = tags.get('charge') or ('Fee applies; amount unavailable' if tags.get('fee') == 'yes' else 'OSM records no fee; check posted signs' if tags.get('fee') == 'no' else None)
        address = ', '.join(tags[k] for k in ('addr:housenumber', 'addr:street', 'addr:city') if tags.get(k)) or None
        records.append({'id': 'osm:' + item.tag + '/' + item.get('id'), 'name': tags.get('name') or (tags.get('addr:street') + ' parking' if tags.get('addr:street') else 'Unnamed parking · OpenStreetMap') if kind != 'street' else tags.get('name', 'Unnamed street'), 'kind': kind, 'geometry': geometry, 'address': address, 'side': side, 'fees': fees, 'hours': tags.get('opening_hours'), 'regulations': regulations, 'sourceKind': 'osm', 'sourceLabel': '© OpenStreetMap contributors · pilot snapshot', 'sourceUrl': url, 'license': 'Open Database License (ODbL) 1.0', 'sourceUpdatedAt': observed, 'verification': 'unverified', 'verifiedAt': None})
        record = records[-1]
        keep = {'name', 'operator', 'access', 'fee', 'charge', 'capacity', 'capacity:disabled', 'capacity:charging', 'opening_hours', 'maxstay', 'maxheight', 'parking', 'covered', 'lit', 'surface', 'supervised', 'motorcar', 'motorcycle', 'phone', 'website', 'wheelchair', 'image', 'wikimedia_commons', 'mapillary', 'check_date'}
        record['osmTags'] = {k: v for k, v in tags.items() if k in keep or k in ('restriction', 'ownership') or k.startswith(('payment:', 'addr:', 'parking:'))}
        if item.get('timestamp'):
            if observed_date(item.get('timestamp')) > snapshot_date:
                raise ValueError('OSM edit date follows observation date: ' + record['id'])
            record['osmEditedAt'] = item.get('timestamp')
        # Membership is explicit: entrance nodes referenced by the facility way.
        # Never associate unrelated nearby entrances by distance alone.
        members = {n.get('ref') for n in item.findall('nd')}
        record['entrances'] = [nodes[n.get('id')] for n in root.findall('node') if n.get('id') in members and any(t.get('k') == 'amenity' and t.get('v') == 'parking_entrance' for t in n.findall('tag'))]
    return sorted(records, key=lambda r: r['id'])

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--observed-at', required=True, help='Actual export observation time, ISO 8601 with timezone')
    parser.add_argument('--source-url', required=True, help='Public HTTPS URL identifying the licensed export source')
    parser.add_argument('--manifest', type=Path, help='Defaults to OUTPUT.manifest.json')
    args = parser.parse_args()
    manifest_path = args.manifest or Path(str(args.output) + '.manifest.json')
    if len({args.input.resolve(), args.output.resolve(), manifest_path.resolve()}) != 3:
        parser.error('Input, output and manifest paths must be distinct')
    source = urlparse(args.source_url)
    if source.scheme != 'https' or not source.hostname or source.username or source.password:
        parser.error('--source-url must be a public HTTPS URL without credentials')
    raw = args.input.read_bytes()
    root = ET.fromstring(raw)
    records = extract(root, args.observed_at)
    if not records:
        parser.error('No supported parking records intersect pilot coverage; output was not written')
    rendered = json.dumps(records, ensure_ascii=False, indent=2, sort_keys=True) + '\n'
    manifest = {
        'schemaVersion': 1,
        'sourceUrl': args.source_url,
        'license': 'ODbL-1.0',
        'attribution': '\u00a9 OpenStreetMap contributors',
        'observedAt': args.observed_at,
        'inputSha256': hashlib.sha256(raw).hexdigest(),
        'outputSha256': hashlib.sha256(rendered.encode('utf-8')).hexdigest(),
        'bounds': [WEST, SOUTH, EAST, NORTH],
        'coveragePolicy': 'Facilities inside; streets intersect pilot box; full geometry retained',
        'recordCount': len(records),
        'streetSegments': sum(r['kind'] == 'street' for r in records),
        'verification': 'unverified',
    }
    args.output.write_text(rendered, encoding='utf-8', newline='\n')
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + '\n', encoding='utf-8', newline='\n')
    print('Extracted', len(records), 'unverified records;', manifest['streetSegments'], 'street segments; manifest:', manifest_path)
