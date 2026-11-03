# Discovery operations readiness

This is local implementation, not evidence of a hosted deployment. Keep production
routing disabled until an owned/licensed endpoint is supplied. No hosted resource,
store release or migration has been performed.

## Android and release

`node scripts/check-android.mjs` checks for exactly one authorized
device and the installed Parkey app without clearing app data. The Android x86_64
debug build passed using the local SDK after downloading missing Gradle dependencies:
`gradlew.bat :app:assembleDebug -PreactNativeArchitectures=x86_64 --max-workers=2`.
No physical device was connected. Disposable `ParkeyValidation37` and
`ParkeyValidation37p2` AVDs were created from the installed Android 37/37.2 x86_64
images. The APK installed successfully on the first image, but attempted UI
validation was blocked by `com.android.systemui` ANRs and repeated EROFS read
errors (`-117`). The second image did not finish booting and repeatedly crashed
`vendor.uwb_hal`. These are emulator observations, not evidence of a Parkey crash.
No map, GPS, permissions, search or routing flow is claimed as verified.

Maestro is not installed. Callstack's agent-device CLI was obtained through pnpm's
temporary cache without adding application dependencies. Its test session was
retired; cleanup reported that its IME resource could not be restored on the first
disposable AVD. Both test emulators and the isolated Metro server on port 8091 were
stopped. The AVD configurations remain available for investigation. Use a healthy
system image or physical Android device for the next native validation attempt.
Use the existing `apps/mobile/.maestro/README.md` smoke and real-device checklist
after connecting a device; record Android version, build and provider configuration.
Do not treat APK existence or this prerequisite check as a passing native test.

The mobile EAS profiles describe development, internal preview and production
builds. They do not create an EAS project or signing credentials. Before any cloud
build, configure the owned EAS project, Android/iOS signing, store accounts and
privacy disclosures. On PowerShell, check production public configuration with:

```powershell
$env:NODE_ENV = 'production'
node scripts/check-release.mjs
Remove-Item Env:NODE_ENV
```

Blank routing is an intentional supported state. This check never tests provider
licensing, reachability, GPS or store acceptance.

## Parking data maintenance

Run `pnpm audit:data` to check validated provenance and generated audit, review
queue, local seed and database-test consistency. Read the exact baseline and
coverage in [parking data preparation](parking-data-quality.md) and
[the source audit](parking-source-audit.md). `node scripts/audit-parking.mjs`
prints metrics. The present snapshot has 43 records and six street segments;
none are independently verified. Import freshness is not field verification.

For a refresh, obtain a licensed OSM export and retain its retrieval date and
attribution. Extract to an unpublished candidate with explicit provenance:

```sh
python scripts/extract-osm-parking.py export.osm candidate.json \
  --observed-at ACTUAL_EXPORT_TIME_ISO8601 \
  --source-url 'https://api.openstreetmap.org/api/0.6/map?bbox=121.024,14.558,121.041,14.572'
node scripts/audit-parking.mjs candidate.json --as-of ACTUAL_AUDIT_TIME_ISO8601
```

Review additions, omissions, identities, geometry, restrictions and license.
After approval, replace the bundled JSON together with its matching manifest,
update `data/parking-audit-config.json` to the actual audit timestamp at or after
the export observation, and run `pnpm data:refresh` and `pnpm audit:data`.
Changed or new snapshots require a valid manifest. Preserve extractor bytes;
formatting and checkout rules keep hashes stable across platforms.

The local-only seed accepts identical replay and aborts on existing record,
verification/publication, source or regulation drift for human reconciliation.
It never updates/deletes existing records or imports the research queue. A hosted
refresh needs a separately reviewed transactional process preserving human edits.

## Private moderation

Apply the new additive migration only to an authorized local disposable Supabase
database, then run `supabase test db --local`. Existing migrations are preserved.
The new pgTAP tests cover RPC/table grants, reviewer/publisher separation, acceptance,
provenance, unverified publication, auditing and duplicate publication prevention.
Database execution is pending a running PostgreSQL/PostGIS/Supabase environment.

The `discovery-moderation` Edge Function requires `SUPABASE_URL`, the server-only
`SUPABASE_SERVICE_ROLE_KEY`, and `MODERATION_ORIGIN` set to the exact workspace
origin, with no trailing slash. Never expose the service-role key to either app.
Only the function may call the moderation RPC; regular authenticated users cannot.
The function validates the Auth token with Supabase, requires `aal2`, then uses a
private reviewer allowlist. No client-editable role metadata is trusted.

Create reviewer accounts through the authorized Supabase administration process.
An administrator must insert their Auth UUID into
`parkey_private.discovery_reviewers`; set `can_publish=true` only for publishers.
There is no self-service reviewer signup. TOTP enrollment and verification are
enabled in local config; configure the equivalent setting explicitly in any
future hosted project. Configure only public Supabase URL/key in `apps/web`.
Tokens and authenticator setup secrets stay in component memory, never storage.

The workspace at `/` signs in reviewers, enrolls/verifies a TOTP authenticator,
loads paginated pending/accepted queues (100 private reports per page), and accepts/rejects with an audited reason.
Publishers separately supply a public source URL, approved license and attribution.
Only accepted new-location reports with an observation date can publish, and the
result remains unverified. Report acceptance never publishes automatically.
Corrections can be reviewed but require a separate provenance-preserving merge;
this implementation does not silently overwrite OSM records. Private photos and
audit reasons are never included in the public discovery API.

## Submissions and launch gates

Supabase Edge Functions/Auth/private Storage and Cloudflare Turnstile are the
selected architecture. Public uploads remain disabled; mobile drafts remain
local, including old drafts. There is no public submission endpoint or photo
bucket in this change. Never enable submissions merely because moderation exists.

Before enabling uploads, implement and validate the preparation/finalization
contract in `contribution-submissions-design.md`: accessible Android challenge,
server verification of hostname/action/token replay, durable atomic rate limits,
idempotency, bounded media decode/re-encode and EXIF removal, private storage,
deletion capabilities, retention/reconciliation, privacy disclosure and cleanup
alerts. Obtain public challenge site configuration and store all secrets server-side.
Retention proposals in that document are not implemented cleanup jobs.

The moderation UI and Edge Function have static/type/unit coverage; live Auth/MFA,
database behavior, deployed CORS and provider/device flows require integration
verification before any deployment. The migration must not ship until its pgTAP
tests and permission checks have passed in a real local stack.
