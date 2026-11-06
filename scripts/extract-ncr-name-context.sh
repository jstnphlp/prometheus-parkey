#!/usr/bin/env bash
# Extract named OSM visitor destinations from a separately acquired snapshot.
# These are contextual clues, NOT official parking names.
set -euo pipefail
if [[ $# -ne 2 ]]; then
  printf 'Usage: bash scripts/extract-ncr-name-context.sh output/ncr/ncr-area.osm.pbf output/ncr/osm-name-context.geojson\n' >&2
  exit 2
fi
input=$1
out=$2
if [[ ! -f "$input" ]]; then echo "Missing source snapshot: $input" >&2; exit 2; fi
if [[ -e "$out" ]]; then echo "Refusing to overwrite existing context file: $out" >&2; exit 2; fi
# Use the same category filters, name requirement, area assembly and source/hash
# manifest on every host, including those that also have the osmium CLI installed.
exec python "$(dirname "$0")/extract-ncr-name-context.py" "$input" "$out"
