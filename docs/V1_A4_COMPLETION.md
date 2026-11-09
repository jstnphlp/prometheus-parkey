# A4 release-quality validation

**PASS for locally executable engineering checks. Production release is blocked.** Branch
`codex/v1-a4-release-validation`, [draft PR #27](https://github.com/jstnphlp/prometheus-parkey/pull/27).
Application source `c38f130`, native compatibility configuration `be2366d`.
Depends on unmerged A0-A3 PRs #23-#26. No production approval is granted.

## Implemented during validation

- Reproduced Android Back exiting selected details in a standalone API35 release
  APK. RN0.88's predictive dispatcher workaround requires runtime/target API36+;
  API35 skipped it. Disabled predictive Back through Expo configuration, rebuilt
  and verified details return to discovery. No framework upgrade or native patch.
- Disabled Android backup for device-local drafts/saved state and removed unused
  overlay/external-write permissions. Background location, camera and audio
  recording remain blocked. Foreground location and image-picker read access remain.
- Missing release search configuration now shows an honest unavailable state with
  Back to map. It cannot send queries/coordinates or claim transmission to Photon.
  Configured-provider error/retry and search history remain verified.
- Integrated the independently reviewed A3 cancellation fixes. Late consent,
  approval and GPS results cannot restart canceled directions; refreshed entrances
  update the navigation target. No research-only release controls were enabled.

## Executed verification

| Check                                    | Actual result                                                                                                                                                                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace TypeScript                     | Passed: shared types, mobile, web, E2E and Edge Functions                                                                                                                                                 |
| ESLint / Prettier / production web build | Passed                                                                                                                                                                                                    |
| Final main JS tests                      | 247 passed: 243 mobile plus four web                                                                                                                                                                      |
| Operations/Edge/moderation tests         | 169 passed; one conditional local-DB test skipped locally                                                                                                                                                 |
| Python tests                             | 23 passed; 15 existing conditional tests skipped, not counted as passed                                                                                                                                   |
| Browser integration                      | 72 legacy and36 pilot cases passed without retries in follow-up CI; initial retry history is retained below                                                                                               |
| Final configured-search regression       | Four passed, desktop/mobile                                                                                                                                                                               |
| Navigation fixture stability             | 20 passed with two workers, repeat2 and retries0 after setup correction                                                                                                                                   |
| Supabase SQL                             | Disposable CI PostgreSQL tests passed; no production database touched                                                                                                                                     |
| Android local release builds             | Passed, x86_64; original21m50s, Back fix7m37s, final search repack1m14s. These are build times, not startup metrics                                                                                       |
| Native API35 acceptance                  | Back, details/restrictions, missing photos, filters, saved/car persistence, permission denial/recovery, offline/reconnection, external Maps, TalkBack, larger text and controlled-crash recovery verified |

Implementation `c38f130` passed validate/database/E2E in both
[push run42624495305](https://github.com/jstnphlp/prometheus-parkey/actions/runs/42624495305)
and [PR run42624501796](https://github.com/jstnphlp/prometheus-parkey/actions/runs/42624501796).
Local Docker is unavailable; actual SQL execution is CI evidence, not a local claim.
The test-fixture follow-up keeps every safety assertion. [CI run42629625893](https://github.com/jstnphlp/prometheus-parkey/actions/runs/42629625893), source `5852a27` (application `c38f130`, tests `8ccdc62`), passed validate/database/E2E with72 legacy and36 pilot cases and zero retries. The matching push run42629616800 also passed.

## Native artifact and evidence

Windows11; `Parkey_A0_API35`, Android15/API35/google APIs x86_64, emulator-5556,
host NVIDIA RTX2050 GPU/WHPX, two cores/2048MiB. Physical display1080x2400 is
intentionally overridden to720x1600/280dpi. No physical Android or iOS was tested.

Final version0.1.0/code2 APK is a **non-debuggable release variant signed with the
local development key**, not a production-signed/store build. Archived and pulled
installed APKs match SHA256
`ec9f3f374d90465973fdca148580c9b527ab23bb95b1bb16652cc33639c0d08f`.
Local artifact: `output/ncr/v1-a4/app-release-final.apk` (excluded from Git).
No deployment or hosted-resource change occurred.

The [receipt](evidence/v1-a4-validation/receipt.json) binds canonical Git artifact bytes and source. The evidence directory contains before/after Back screenshots, final native
layouts/screenshots, APK/manifest audits, installed identity and test logs.
Native source is `c38f130`; the OS permission prompt, GPS-settings decline,
source-credit view and initial filter/accessibility diagnostics were first
verified on `be2366d`, whose affected components are unchanged in the final APK.
Final Back, search, denied permission, offline/reconnection, saved state, Maps
handoff, TalkBack and crash recovery were checked again on the final APK.

The real archive remains unverified and its parking Go controls remain blocked.
Positive reviewed parking-navigation cases use explicit browser/native-component
QA fixtures; no real operator/entrance approval or photograph was invented.
The approved photo catalog remains empty. The native positive external handoff
used the explicitly saved simulated car point and launched Google Maps.

Both emulator radios were disabled for offline testing, then restored; cached map
and saved/car reminders remained usable and the offline banner cleared. Android's
actual location prompt was denied; the GPS-enable prompt was declined separately.
The app retained manual browsing and used map-center distance labels until a fix
was available. Saved/car data survived APK replacement, force-stop and an explicit
`am crash` shell-induced crash. Its expected fatal stack is retained separately;
the post-recovery AndroidRuntime error stream is empty.

TalkBack was actually bound with spoken feedback and touch exploration enabled.
Emulator kernel mouse input moved focus to controls/cards and activated Saved at
1.3x font scale. Ordinary ADB pointer injection bypassed touch exploration; it was
not counted as a screen-reader pass. Hardware coordinates account for the1.5x
physical/override scale. TalkBack's own notification prompt was dismissed before
validating Parkey. Audible output quality, exhaustive human usability and VoiceOver
remain unverified. Font scale1.0, TalkBack off, granted location and online radios
were restored afterward.

## Failures investigated, not hidden

Initial CI completed with70 direct legacy passes plus two retry recoveries.
Both were new race-test setup issues: a late CDP response-body read after a request
was canceled, and assuming one Back from a hydrated deep link always removed
selection. Fixtures now serve an explicit validated synthetic record and select
parking through the actual map UI, preserving all route/handoff/privacy assertions.
The final warm-compiler run passed20 executions with two workers and zero retries.
The retained initial standalone stress run had28 passes and two cold development
compiler timeouts at the Bundling shell, before map/race assertions. No app timeout
or assertion was increased. This is a Windows development-tool startup limitation,
not a production cold-start benchmark or an ignored consumer failure.

A development-client resume/manifest-switch experiment also hit RN's native
inspector WebSocket exception. Force-stop before changing manifests avoids that
setup failure. The standalone release acceptance has no development inspector;
this does not claim the upstream development-client defect is fixed.

## Publication, privacy and production blockers

The actual release manifest has backup/predictive callbacks disabled and excludes
background location, camera, recording, overlay and external-write permissions.
Sentry auto-init is false. The embedded JS excludes the isolated QA entry, its
synthetic image URL, private research-package paths and service-role markers.
These are bounded artifact checks, not an exhaustive secret-audit claim. Git tracks
only four environment templates, no actual environment or signing credential files.
The benchmark string remains in bytecode but release guards prevent emission and
are tested. Analytics, Plausible and Sentry collection remain locked off; D3 remains
blocked on the canonical D2 gate. No admin-repository work was performed.

**Production release remains blocked:** physical Android performance/smoke and
human accessibility review, iOS/VoiceOver verification, external PR review,
approved production provider/privacy configuration, production signing/store
validation and required field/operator publication evidence. This test APK uses
known default configuration with no production search/backend credentials supplied;
search's unavailable state is intentional. Emulator results establish no physical
performance or parking availability guarantee. OSM/Overture attribution and
RLS/publication protections remain intact. V1 remains discovery-only.

## Reproduce locally

Use the pinned Node24/pnpm11.25.0 dependencies, Android Studio SDK and the existing API35 AVD. The build used Android Studio JBR25 and the generated local development signing key. Native Android code is generated; Expo prebuild regenerates that directory. No production configuration, service-role key or provider-review override is needed for this offline-safe test variant.

```powershell
$env:EXPO_NO_DOTENV = '1'
$env:NODE_ENV = 'production'
$env:PARKEY_RELEASE_BUILD = 'true'
$env:EXPO_PUBLIC_PILOT_DISCOVERY_ENABLED = 'false'
# From apps/mobile:
pnpm exec expo prebuild --platform android --no-install
# From apps/mobile/android, with JAVA_HOME set to Android Studio's jbr:
./gradlew.bat :app:assembleRelease -PreactNativeArchitectures=x86_64 --max-workers=1 --console=plain -I ../../../docs/evidence/v1-a4-validation/limit-metro.gradle
```

The actual rebuild also used `--offline` after dependencies had been cached and `CMAKE_BUILD_PARALLEL_LEVEL=1`. Install the resulting APK with `adb -s emulator-5556 install -r`, then launch `com.parkey.discovery/.MainActivity`; Metro is not required. Verify the merged manifest and installed APK identity rather than assuming a successful build means the expected artifact is running.

For TalkBack, enable the emulator's installed service and touch exploration, select1.3x text, dismiss the service's own notification prompt, and use emulator kernel input (`adb emu event mouse`) for exploration/double-tap. Ordinary `adb shell input swipe` bypassed touch exploration. Physical emulator coordinates scale1.5x from the720x1600 override. Restore original settings afterward. These are emulator checks; they do not establish audible quality or physical-device usability.
