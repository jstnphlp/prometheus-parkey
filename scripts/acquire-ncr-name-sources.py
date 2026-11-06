#!/usr/bin/env python3
"""Acquire a separately versioned official Geofabrik source; never overwrite."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import re
import urllib.request


SOURCE_URL = "https://download.geofabrik.de/asia/philippines-latest.osm.pbf"


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--baseline-manifest", type=Path,
                        default=Path("data/ncr-research/osm-acquisition.json"))
    args = parser.parse_args()
    paths = [args.out_dir / name for name in (
        "philippines.osm.pbf", "philippines.partial.osm.pbf", "acquisition.json")]
    if any(path.exists() for path in paths):
        parser.error("Refusing to overwrite source acquisition files.")
    args.out_dir.mkdir(parents=True, exist_ok=True)
    source, partial, manifest_path = paths
    baseline = json.loads(args.baseline_manifest.read_text(encoding="utf-8"))
    started = now()
    sha256, md5 = hashlib.sha256(), hashlib.md5()
    total = 0
    with urllib.request.urlopen(SOURCE_URL, timeout=120) as response:
        resolved = response.url
        if not re.fullmatch(r"https://download\.geofabrik\.de/asia/philippines-\d{6}\.osm\.pbf", resolved):
            raise ValueError("Unexpected Geofabrik redirect; inspect source provenance before acquisition")
        headers = dict(response.headers)
        with partial.open("xb") as output:
            while block := response.read(1024 * 1024):
                output.write(block)
                sha256.update(block)
                md5.update(block)
                total += len(block)
    if total != int(headers["Content-Length"]):
        raise ValueError("Source download length mismatch")
    with urllib.request.urlopen(resolved + ".md5", timeout=120) as response:
        publisher_checksum = response.read().decode("ascii").strip()
        checksum_headers = dict(response.headers)
    if publisher_checksum.split()[0] != md5.hexdigest():
        raise ValueError("Geofabrik publisher checksum mismatch")
    partial.rename(source)
    manifest = {
        "schemaVersion": 1, "requestedUrl": SOURCE_URL, "resolvedUrl": resolved,
        "downloadStartedAt": started, "downloadCompletedAt": now(),
        "responseHeaders": headers, "bytes": total,
        "sha256": sha256.hexdigest(), "md5": md5.hexdigest(),
        "publisherChecksumUrl": resolved + ".md5", "publisherMd5": publisher_checksum,
        "checksumResponseHeaders": checksum_headers, "publisherChecksumMatched": True,
        "baselinePbfSha256": baseline["sourceMetadata"]["inputSha256"],
        "sameBytesAsFrozenSnapshot": sha256.hexdigest() == baseline["sourceMetadata"]["inputSha256"],
        "license": "ODbL-1.0", "attribution": "© OpenStreetMap contributors",
        "licenseUrl": "https://www.openstreetmap.org/copyright",
        "policy": "Independent retrieval, not necessarily a newer OSM editing date. No publication approval.",
    }
    with manifest_path.open("x", encoding="utf-8", newline="\n") as output:
        json.dump(manifest, output, ensure_ascii=False, indent=2)
        output.write("\n")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
