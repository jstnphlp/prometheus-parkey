# A2 performance and reliability — local engineering acceptance

**PASS for locally executable A2 checks.** Branch
`codex/v1-a2-discovery-performance`, [draft PR #25](https://github.com/jstnphlp/prometheus-parkey/pull/25).
Implementation `8f59cb3`, revocation follow-up `194fe3e`, final measured commit
`c0d0ab1`. Depends on A1 PR #24; neither PR is merged or externally approved.

## Implemented

- Public display caching is isolated by backend origin and exact normalized city/
  viewport. At most six LRU entries, 1,000 total records, 1 MiB UTF-8 and five
  minutes/current review expiry are retained. Private candidates, tokens and
  arbitrary properties are rejected; navigation approvals are stripped.
- Empty authoritative responses replace old cache entries. Network success wins
  over late hydration. Corruption/I/O failures are cache misses, not discovery
  crashes. Public authorization refusal clears current records, selected details
  and cache, fencing late hydration across initial/paginated/navigation reads.
- Cached details keep their saved-copy provenance and expiry when the viewport
  moves. They never authorize directions; current targeted entrance lookup is
  still required and never participates in request coalescing.
- Only identical initial public/null-token viewport reads share an in-flight
  parsed response. Each subscriber owns cancellation; the last cancellation
  aborts transport. Completion/failure removes entries. Search, pagination,
  candidate sessions and targeted entrance rechecks remain independent; existing
  15-second request timeout and scope/late-response checks remain.
- Source observations deduplicate by canonical OSM identity or exact original
  source identity, never proximity or shared labels. Paging keeps its cap/cursor
  guards. Clock ticks reuse exact unchanged record references; changed facts and
  expiry are still observed. Geometry, ranking and renderer updates are memoized
  independently, removing clock-only GeoJSON serialization/reclustering work.
- Font stacks use valid native literal expressions and the formerly implicit
  parked-label font is explicit. API35 software backends received valid glyphs
  but rendered blank text; the same AVD with host GPU renders parking/road/car
  text correctly. No provider was replaced and no error logging was suppressed.
- Added an opt-in development-only local map benchmark and a reproducible Python
  harness. It emits no coordinates, identifiers or network telemetry. Release
  builds and normal sessions are silent.

## Executed verification

| Check                                         | Result                                                                                                                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mobile unit suite                             | 220 passed, zero failures. Cache size/TTL/LRU/origin/candidate/approval/corruption/concurrency tests; request coalescing/cancel/timeout/bypass tests; source identity and expression validation included.                |
| Benchmark statistics                          | Three Python tests passed, including nearest-rank P50/P95 and missing/invalid data.                                                                                                                                      |
| Mobile/E2E TypeScript; scoped ESLint/Prettier | Passed. One sandbox dependency-read denial was rerun with normal tool access; no assertions changed.                                                                                                                     |
| Pilot browser regression                      | 36/36 passed on desktop and Pixel7 browser emulation, 3.4 minutes. Includes cache/network race, saved-copy navigation denial, initial/paginated public refusal, offline private-session clearing and all A1 regressions. |
| Independent review                            | Cache provenance and public-denial findings were fixed and reverified. Final review found no remaining A2 blocker; fresh navigation remains unshared.                                                                    |
| Native renderer                               | Actual API35 screenshots visually verify readable road/parking/parked text on host GPU. Unsupported default-font glyph404s were absent in diagnostic and final samples.                                                  |
| Native measurement/memory                     | 20 cold-process and 20 warm-resume samples completed, zero failed samples/renderer errors. Every cold PSS reading is present.                                                                                            |

## Reproducible emulator measurements

Raw samples, statistics, APK identity and screenshots are in
[the evidence receipt](evidence/v1-a2-api35/receipt.json).

| Metric, milliseconds                           | P50   | P95    | Meaning                                                                                                |
| ---------------------------------------------- | ----- | ------ | ------------------------------------------------------------------------------------------------------ |
| Cold process → observed fully rendered basemap | 7,110 | 17,234 | Includes debug/Metro/bridge/poll overhead; warm app/assets/tile caches preserved.                      |
| Map mount → first fully rendered event         | 1,331 | 3,211  | Basemap phase; remote RPC records/marker readiness and interaction TTI are not measured by this event. |
| Warm activity command wall time                | 328   | 406    | Activity resume command completion with unchanged process, not GPU frame readiness.                    |

Nearest-rank statistics use all 20 raw observations; no slow result was dropped.
Peak cold PSS was 458,831 KiB. Before/after 20 warm resumes: 434,386 → 454,152 KiB
(19,766 KiB growth). The pre-existing harness limits of 512 MiB PSS and 64 MiB
growth passed. This is a bounded stress observation, not proof of zero leaks or
acceptable behavior on low-memory physical devices.

AVD `Parkey_A0_API35`: Android15/API35, Google APIs x86_64 revision9, emulator
37.2.12.0, WHPX, two cores, `-memory 2048`, 720×1600/280dpi, no snapshots, host
NVIDIA RTX2050 / OpenGL ES translator driver581.08. Single-worker Metro8096,
development bundle, pilot flag false, GPS denied, actual bundled OSM Poblacion
discovery and persisted simulated parked pin; no configured remote parking API.
Dataset description is operator supplied; the event does not count loaded records.

Command (repository root, local benchmark flag enabled in development Metro):

```powershell
python scripts/benchmark_android_map.py --samples 20 --timeout 60 --dataset 'Bundled OSM Poblacion discovery; GPS denied; no remote backend; preserved parked pin; warm asset/tile caches; host GPU' --apk output/ncr/pilot-stage-b/fresh-stage-b-app-debug.apk --out output/ncr/v1-a2/benchmark-c0d0ab1-host.json
```

Installed and archived native APK SHA-256 were independently compared and match
`d44de93e814045e42232de704d317d7556902031213ae68fe7c371dcd1149d47`.
This remains the reused development shell with current committed JavaScript,
not a new signed release binary. Temporary glyph observer/static text probes
forwarded real provider bytes for diagnosis only; the final run used the
unmodified real OpenFreeMap provider. SwiftShader/swangle blank text remains a
documented emulator-backend limitation, not silently counted as a pass.

## Remaining release conditions

Physical Android performance/memory/GPS and A4 smoke, iOS, production-provider
licensing/configuration and signed distribution remain open. No matched physical
or release before/after comparison was collected, so no speedup percentage or
production launch SLA is claimed. Approved public data and photo supply still
require their normal evidence workflow. A3 trust work can now proceed under
the user's separate local-engineering policy; no publication, merge, deployment
or analytics enablement is authorized by this gate.
