#!/usr/bin/env python3
"""Record current official Overture releases and recent reusable OSM changes."""
import argparse
import datetime
import gzip
import hashlib
import json
from pathlib import Path
import urllib.parse
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args()
    if args.out_dir.exists():
        parser.error("Probe output directory exists; use a new version.")
    args.out_dir.mkdir(parents=True)
    query = ('[out:json][timeout:60];('
             'nwr["amenity"~"^parking(_space|_entrance)?$"](newer:"2026-11-03T00:00:00Z")(14.30,120.85,14.86,121.27);'
             'nwr["building"="parking"](newer:"2026-11-03T00:00:00Z")(14.30,120.85,14.86,121.27););out meta center;')
    probes = [
        ("overture-catalog", "https://stac.overturemaps.org/catalog.json", None),
        ("overture-places-licensing", "https://docs.overturemaps.org/guides/places/", None),
        ("osm-parking-delta", "https://overpass-api.de/api/interpreter",
         urllib.parse.urlencode({"data": query}).encode()),
    ]
    results = []
    for name, url, data in probes:
        result = {"id": name, "requestedUrl": url,
                  "retrievedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()}
        try:
            request = urllib.request.Request(url, data=data, headers={"User-Agent": "Parkey-NCR-source-research/1.0"})
            with urllib.request.urlopen(request, timeout=100) as response:
                raw = response.read()
                result.update({"resolvedUrl": response.url, "status": response.status,
                               "sha256": hashlib.sha256(raw).hexdigest()})
            if name != "overture-places-licensing":
                filename = name + ".json.gz"
                (args.out_dir / filename).write_bytes(gzip.compress(raw, mtime=0))
                result["artifact"] = filename
                obj = json.loads(raw)
                if name == "overture-catalog":
                    result["latestRelease"] = obj["latest"]
                else:
                    result.update({"query": query, "osmBase": obj.get("osm3s"),
                                   "elements": len(obj.get("elements", [])),
                                   "namedElements": sum(bool(e.get("tags", {}).get("name")) for e in obj.get("elements", [])),
                                   "license": "ODbL-1.0", "attribution": "© OpenStreetMap contributors",
                                   "policy": "Source update audit; Overpass centers are review anchors, not vehicle entrances."})
            else:
                result["reviewReference"] = "Record-level sources[].license and attribution must be retained. Review source-dependent Places licensing and ODbL obligations for OSM derivatives."
        except Exception as error:
            result["error"] = str(error)
        results.append(result)
    with (args.out_dir / "source-probes.json").open("x", encoding="utf-8", newline="\n") as output:
        json.dump({"schemaVersion": 1, "probes": results}, output, ensure_ascii=False, indent=2)
        output.write("\n")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
