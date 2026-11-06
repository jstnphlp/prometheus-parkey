#!/usr/bin/env bash
# Extract names of nearby OSM commercial/institutional features from an already
# downloaded NCR OSM snapshot. These are contextual clues, NOT parking names.
set -euo pipefail
if [[ $# -ne 2 ]]; then
  printf 'Usage: bash scripts/extract-ncr-name-context.sh output/ncr/ncr-area.osm.pbf output/ncr/osm-name-context.geojson\n' >&2
  exit 2
fi
input=$1
out=$2
if [[ ! -f "$input" ]]; then echo "Missing source snapshot: $input" >&2; exit 2; fi
if [[ -e "$out" ]]; then echo "Refusing to overwrite existing context file: $out" >&2; exit 2; fi
# Windows and other hosts can use the already-pinned pyosmium dependency.
if ! command -v osmium >/dev/null; then
  exec python "$(dirname "$0")/extract-ncr-name-context.py" "$input" "$out"
fi
mkdir -p "$(dirname "$out")"
tmp="$out.tmp.osm.pbf"
if [[ -e "$tmp" ]]; then echo "Stale temporary file: $tmp" >&2; exit 2; fi
# A named property is not a named parking lot; NEVER auto-rename from context.
osmium tags-filter "$input" \
  nwr/shop=mall,department_store,supermarket,shopping_centre \
  nwr/amenity=hospital,university,college,marketplace,school \
  nwr/tourism=hotel,motel \
  nwr/building=commercial,retail,office,hotel,supermarket,hospital \
  -o "$tmp"
osmium export "$tmp" -a type,id,timestamp -f geojson -o "$out"
rm "$tmp"
printf 'Created contextual OSM GeoJSON (research only): %s\n' "$out"
printf 'Record source snapshot date/hash and OSM ODbL attribution separately.\n'
