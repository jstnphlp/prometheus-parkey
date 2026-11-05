# Stage A executed gate

Stage A passed before Stage B started. The immutable interim v1 record remains
blocked as originally recorded; [v2](../data/pilot-execution/2026-11-05/stage-a-execution-v2.json)
records the completed checks against code commit `372c6c7`.

Draft integration PR: https://github.com/jstnphlp/prometheus-parkey/pull/18.
The integration audit covers exact heads of PRs #13, #15, #16 and #17 in
[the dependency report](pilot-integration-audit.md). No branch was merged.

Frozen installation, lint, typecheck, formatting, unit tests, data audit and web
build passed. Exact-head CI completed validate, database and 52 browser E2E tests:
https://github.com/jstnphlp/prometheus-parkey/actions/runs/42051201841.
The duplicate PR run was cancelled; it does not replace this successful push run.
Local database tests passed 251 assertions across five files, including an actual
JavaScript-to-Postgres-to-mobile-parser publication round trip. The independent
[review](pilot-stage-a-review.md) has no unresolved implementation finding.

The [Android execution record](../data/pilot-execution/2026-11-05/stage-a-android.json)
contains 13 executed passing cases, artifact hashes, device configuration and
individual screenshot/log references. A fresh debug development APK was built,
installed and checked against the installed APK hash:
`1b973776ff94b67977f0f112d26e74cd1aa129bdf7fdf36c9624f50ebd5879e9`.
The APK and raw evidence remain under `output/ncr/integration-stage-a/`;
the historical November 3 APK was preserved and excluded from this result.

Pixel 10 Pro, Android 17/API 37.2 x86_64 passed with host GPU rendering. Default
SwiftShader corrupted map text; its failed evidence is retained. Resource and
partial Gradle cache failures were resolved without changing dependencies.
Permission denial and unavailable-location recovery were tested. A successful
physical GPS fix, physical Android device, full internet outage and iOS execution
were not tested. iOS has no local Apple host; this remains an iOS validation
blocker. Unverified parking entrances remained unavailable for navigation.

The additive, private reviewer pipeline enforces immutable source identity,
explicit human decisions, rejection/correction, expiry and revocation. No evidence
submission, source match or destination description creates publication approval.
Unknown facility types remain private. All historical NCR archives, five Poblacion
source hashes, phase decisions and human decisions remain intact. Actual public
NCR publication approvals and physical verifications remain zero.

Stage A passing authorizes Stage B engineering under the execution policy. It
does not authorize distribution, hosted migration, deployment or publication.
`PILOT_RELEASE_AUTHORIZED` remains false; 1E and 1G remain deferred to the pilot.
