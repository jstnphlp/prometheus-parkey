# Manila and Mandaluyong pilot builds

The feature flag defaults to off. The pilot is parking discovery, not booking,
payment, live occupancy, permission to enter, or a guaranteed parking offer.
Candidates and approved public facts are separate server projections. An empty
public result is expected until independently reviewed facts are published; it
does not mean that no parking exists.

## Configuration and access

`EXPO_PUBLIC_PILOT_DISCOVERY_ENABLED=true` selects the new main flow. Only Manila
and Mandaluyong are allowed. Both public Supabase values are required:
`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Use a
publishable `sb_publishable_` key or a legacy JWT whose role is `anon`. The app
rejects secret/service-role keys and reviewer/user-session JWTs as public config.
This is syntax/role screening; Supabase still verifies signatures and permissions.

Public mode requires no account. Candidate research requires an authenticated,
unexpired AAL2 reviewer session, `discovery_reviewers.can_candidate_research`, and
the city's server flag. Reviewer sessions remain in memory and must never be put
in public environment variables, source, logs, screenshots or persistent storage.
The client feature flag and provider-review flags grant no authorization.

The RPCs are `discover_pilot_parking`, `get_pilot_parking`, and
`discover_pilot_destinations`, using an explicit city and projection mode.
Candidate input is real source evidence and remains unpublished. The configuration
does not import data, grant reviewer access, enable uploads, or create approvals.

The old `/ncr-research` route is development-only. Its URL is empty outside
development and release validation rejects a configured
`EXPO_PUBLIC_NCR_RESEARCH_URL`. It is not the new pilot's data source.

## Release checks and providers

Run `pnpm --filter @parkey/mobile check:release` with the intended public values.
This cross-platform command explicitly selects production policy. EAS release
profiles also set `PARKEY_RELEASE_BUILD=true`; the build hook and dynamic Expo
config enforce validation before packaging. For manual local release commands,
set that variable too rather than relying on a preceding optional check.

Release endpoints require HTTPS and a public DNS name. Loopback, private IP,
development/test names, credentials in URLs, query credentials and fragments are
rejected. A Supabase URL must be the base origin, without `/rest/v1` or another
API path. Development builds alone may reach an explicit local HTTP backend.

OpenFreeMap/OpenMapTiles styles retain OpenStreetMap attribution. A custom map
provider requires `PARKEY_MAP_PROVIDER_REVIEWED=true` after the operator records
applicable terms, permitted use and attribution. These are build-only review
assertions, not proof that a review occurred. No such review is invented here.

The pilot searches the server destination catalogue. Optional legacy Photon
search defaults to disabled in release. A configured owned/licensed service
requires `PARKEY_SEARCH_PROVIDER_REVIEWED=true`; the Photon demo is rejected.
Routing defaults to disabled in release. A configured owned/licensed endpoint
requires `PARKEY_ROUTING_PROVIDER_REVIEWED=true`; the OSRM demo is always rejected.
Development demo use is not a production license or availability commitment.

## Profiles and local builds

All profiles are configuration only. No EAS project, hosted resource, paid cloud
build, signing account, submission or store release is created by this change.

| Profile               | Purpose                                       | Pilot flag                     |
| --------------------- | --------------------------------------------- | ------------------------------ |
| `development`         | Native development client                     | Off unless explicitly supplied |
| `preview`             | Internal Android APK / iOS device build       | Off                            |
| `pilot-internal`      | Internal pilot Android APK / iOS device build | On; validated backend required |
| `pilot-ios-simulator` | Pilot iOS simulator artifact                  | On; validated backend required |
| `production`          | Store-oriented Android AAB / iOS build        | Off                            |
| `pilot-production`    | Store-oriented pilot build configuration      | On; validated backend required |

Version remains `0.1.0`; the checked-in Android version code and iOS build number
are `2`. Increment before a later distributable build; verify the artifact's
actual version and signing identity rather than assuming a profile proves them.

Local development against the authorized disposable stack can use the existing
gateway at `http://127.0.0.1:55431`. Obtain only its public key through the owned
setup; do not print the stack's service-role/admin credentials. Do not reset or
stop another project. Native Android needs an adb reverse for the gateway and
the chosen Metro port. This is a development build, not a release build using a
private production endpoint.

After native configuration changes, run the following from the repository root
with the intended public environment values already supplied:

```powershell
pnpm --filter @parkey/mobile exec expo prebuild --platform android --no-install
pnpm --filter @parkey/mobile exec expo run:android --variant debug
```

For a local release-mode Android build, supply an owned/licensed public HTTPS
backend, select the flag deliberately, set `PARKEY_RELEASE_BUILD=true`, and run
the release check before `expo run:android --variant release`. Generated local
release signing may still use a development key; this does not establish store
signing or distribution readiness. Never commit keystores or `credentials.json`.

iOS local compilation requires macOS and Xcode. Use the simulator profile for a
simulator, or owned signing/provisioning for a physical device. No iOS build or
device execution can be claimed from this Windows host. EAS local tooling may
still require service authentication; no EAS command is needed for the direct
Expo/Gradle/Xcode development workflow described here.

Android emulator validation must use a healthy graphics backend. The existing
Pixel 10 Pro API 37 image renders MapLibre glyphs incorrectly with its default
SwiftShader backend. The verified local configuration is a cold boot with
`-gpu host -no-snapshot` on the NVIDIA host GPU. Keep the failure evidence and
record the actual renderer in each execution report.

## Privacy and permissions

Only foreground location is requested, with an explanation and a manual search
alternative. Background location, camera and microphone permissions are blocked
on Android. Existing optional photo selection uses the system gallery for a local
draft, not an upload. Do not enable background tracking or public submissions.
Location denial/unavailability must remain recoverable without creating a route.

Unverified parking anchors are not vehicle entrances. Navigation remains blocked
without reviewed entrance, visitor access and operator authorization. Source
coordinate references do not import Google/Waze place content. Search, provider
requests and external links share their relevant query/coordinate with those
providers; retain attribution and the in-app disclosure. Analytics and crash
reporting remain off unless deliberately configured under their existing privacy
controls. Store privacy declarations need separate review of the final binary.

## Rollback

Rebuild with `EXPO_PUBLIC_PILOT_DISCOVERY_ENABLED=false` to restore the legacy
main flow. A bundled flag cannot revoke an already installed reviewer's access.
An authorized database administrator must disable candidate research and public
destination flags for both cities and revoke candidate-reviewer permission to
stop those projections immediately. Preserve imported evidence, hashes,
publication/decision history and audit rows; do not delete data to roll back UI.

`pilot_activation.active=false` deliberately restores legacy server scope. It
must not be an automatic first rollback step because it relaxes the active
pilot's restrictions on legacy paths. Disable candidate/destination flags and
reviewer permissions first, then separately decide whether to restore that scope.
After rollback, verify anonymous/public reads, denied candidate reads, revoked
reviewer access, and empty private UI after mode change/restart. Hosted changes
and publication still require their own explicit authorization.
