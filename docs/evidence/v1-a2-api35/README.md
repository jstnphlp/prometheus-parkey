# A2 Android 15 performance evidence

- [Raw 20 cold/20 warm samples](benchmark.json), nearest-rank P50/P95 and complete PSS readings.
- [Installed APK equality](apk-identity.json).
- [Host-GPU readable street, parking and parked text](host-glyphs.png).
- [Software-renderer blank-glyph limitation](software-glyph-limitation.png).
- [Configuration, tests and artifact hashes](receipt.json).

Actual API35 native captures were visually reviewed. Provider observations are
attributed OSM/OpenFreeMap data, not approved parking availability. The software
comparison is a known limitation, not passing rendering evidence. Cold timing is
first rendered basemap with warm asset/tile caches; warm timing is activity command
completion. Neither metric represents loaded remote parking, physical Android or
production release performance. See [the phase report](../../V1_A2_COMPLETION.md).
