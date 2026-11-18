# Android map and drawer performance

PR #43 is stacked on PR #41 (baseline `a5cacbe`). Testing used the isolated Parkey QA package on an Android 15/API 35 x86_64 emulator with an NVIDIA RTX 2050 host GPU.

## Sources of work

- MapLibre sends the viewport from its Android camera-idle listener. Each accepted idle event previously changed React state before the parking request debounce. The pilot screen then replaced its data with an empty collection while the request was pending. Even minor changes could trigger reconciliation, request cancellation and source rebuilds.
- MapLibre React Native 11.5 serializes object-form GeoJSON in the source component's render path. Drawer state previously changed native map accessibility props and inline event handlers, defeating the memoized pilot map on each transition. The legacy renderer also received new callback, padding and empty-array references.
- The full-screen drawer scrim previously mounted and unmounted an opacity-animated wrapper with a zero-distance transform. A retained Android scrim now animates opacity only. The drawer panel keeps its original horizontal animation. Only the open drawer mounts the transparent dismissal target. The accessibility exclusion lives on the map wrapper, outside the native renderer.
- The drawer does not update the basemap style, camera target or React key. The dark basemap hook already shares its pending style request and caches the softened style. A cold dark style can still use the URL fallback while the softened style loads. The stacked branch already uses MapLibre's texture renderer.

The app waits another 120 ms after MapLibre's idle event before committing a materially changed viewport. A new gesture or a blocking overlay cancels pending commits. The existing endpoint debounces still apply. Retention uses the existing public cache lifetime and immediately excludes expired, revoked or out-of-scope records. Previously loaded results are treated as cached for directions, and research results are excluded from retention.

## Measurements and coverage

| Measurement                                                    |                PR #41 |                 PR #43 | Method                                                                                                          |
| -------------------------------------------------------------- | --------------------: | ---------------------: | --------------------------------------------------------------------------------------------------------------- |
| GeoJSON encoding for 500 unrelated renders                     |             120.69 ms |                0.33 ms | Median of 15 runs on Node 24, 250 synthetic point records, two real pilot GeoJSON sources                       |
| Commits from ten distinct idle events inside one settle window |                    10 |                      1 | Old immediate state-update path and the new fake-timer regression; API requests already had a separate debounce |
| First fully rendered map in development                        |                7.71 s |                 4.74 s | Single initialization samples with different cache and host conditions                                          |
| Android HWUI pan P50/P95                                       | 18/101 ms (57 frames) |    18/34 ms (6 frames) | Uncontrolled development samples                                                                                |
| Android HWUI drawer P50/P95                                    | 61/113 ms (96 frames) | 57/600 ms (100 frames) | Uncontrolled development samples with eight open/close cycles                                                   |

The serialization benchmark isolates app JavaScript encoding on the host. The viewport test counts state commits. The Android figures come from `adb shell dumpsys gfxinfo` for the application window. The small pan sample and substantial drawer outliers limit the comparison. Initial runs also shared the host with a native build. The samples do not establish a native FPS improvement, a startup improvement, or sustained 60 FPS.

The app retains TextureView. A temporary SurfaceView trial reached a development runtime shutdown screen before a comparable map run could be recorded. Its frame totals were discarded.

The release APK attempt reached Kotlin compilation errors and was stopped without a usable APK. Connecting to the Hermes inspector succeeded after supplying the local origin. Runtime evaluation did not respond, so device JS callback times, request totals, and React render counts remain unmeasured.

## Regression coverage

- Mobile TypeScript and scoped ESLint and Prettier passed. All 46 focused Node tests passed. They include viewport jitter, crossing the zoom boundary, cancellation and retention of eligible public records.
- Two mobile Chromium regressions passed. They exercise repeated drawer dismissal with the original map canvas still mounted, the guest account round trip, and selected public-record details.
- Android development QA exercised repeated drawer cycles in Light + Magenta and Dark + Magenta, the close button and the backdrop, and live Glorietta search followed by a two-pointer pinch. A 180 ? 200 pixel map crop matched before and after four dark drawer cycles. That focused drawer sample had 80 Android HWUI frames, with P50/P95 of 81/133 ms. The same app process emitted one fully rendered map marker across search, pinch, theme changes, and drawer cycles. This supports camera and mount continuity during the measured sequence.
- The value-first principle applies to immediate guest exploration. Camera continuity and the existing controls reduce friction on returning to discovery from the drawer. The implementation preserves the reduced-motion path and accessibility exclusion.

GitHub validation reached the repository's dependency audit and failed there. The local checks above ran against the performance branch. Physical Android frame timing and visual flicker checks remain unverified.
