# V1 A0 mobile discovery baseline

Recorded 2026-11-06 on branch `codex/v1-a0-discovery-baseline`, based on remote
`main` commit `febd41941e722f0f1e85829176679f1ff88cc7f6`. Mobile tree:
`35e2860f492c79c91b27bcb66ad66f4abfa496b3`.

Review: [draft PR #23](https://github.com/jstnphlp/prometheus-parkey/pull/23),
emulator evidence commit `fffda45`. PR creation was explicitly approved by the
user; no merge, deployment or release is authorized by that approval.

**A0 baseline inventory is complete with emulator evidence.** Architecture,
routes, automated baseline results, current screenshots and risks are recorded.
This is a baseline audit pass, not a claim that every smoke outcome or release
gate passed. Product defects found below remain open for A1/A2. Physical-device
verification remains a separate A2/A4/release gate, as the user explicitly directed.
No product behavior, dependencies, backend or admin code changed.

## Scope and authoritative inputs

Read `AGENTS.md`, [execution plan](V1_EXECUTION_PLAN.md) and
[analytics contract](V1_ANALYTICS_CONTRACT.md) from freshly fetched `origin/main`
before changes. The initial local `main` was stale at `4e08882` and lacked both
V1 documents. Also read the existing architecture, discovery documentation and
Stage B execution/review records; inspected the mobile route entries and relevant
data, publication, navigation, photo, offline and telemetry implementations.

V1 is parking discovery only. No reservation, booking, payment, QR, inventory or
vacancy guarantee work is authorized, including prototypes. Existing ADI-173
schema is historical and untouched. Research records must remain private.

## Architecture and route baseline

The pnpm monorepo has independent Expo mobile and TanStack web apps, type-only
shared contracts, and Supabase/PostGIS server authorization. Mobile uses Expo
58, React 19.3, React Native 0.88 and Expo Router under `src/app`, with native
StyleSheet. MapLibre Native 11.5 needs a development build; the web renderer uses
MapLibre GL JS 6.16. Expo Go cannot establish native map correctness.

| Entry                     | Current behavior / boundary                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/app/_layout.tsx`     | Loads fonts and initializes optional telemetry on mount; headerless Stack.                                   |
| `/` (`src/app/index.tsx`) | Pilot flag false: `Explore`. Flag true: `PilotDiscovery`; development alone can switch to legacy and return. |
| `/ncr-research`           | Research Console move notice and optional external link; no research dataset rendered by this route.         |

Search, parking details, saved places and directions are component state/sheets,
not separate file routes. There are no booking routes in this route tree.

### Discovery implementations

| Concern          | Legacy `Explore`                                                                                                                      | `PilotDiscovery`                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Data             | Bundled OSM snapshot plus optional public viewport RPC via `use-parking.ts` / `data.ts`.                                              | City-scoped Manila/Mandaluyong public or authenticated candidate RPCs through `pilot-client.ts`.            |
| Search / filters | Photon destination search; kind/fee filters; nearby ranking.                                                                          | Debounced city destination search; scoped categories and pagination.                                        |
| Requests         | Debounce, timeout/cancellation, retained last result; source-URL deduplication with backend preference.                               | Request gates, scope keys, aborts, pagination and expiry checks; clears records on a new request/error.     |
| Saved / offline  | Local saved places, recents, parked spot and contribution drafts; network listener; bundled data and session-retained remote results. | No equivalent persistent discovery cache demonstrated; public/private scope clearing must remain mandatory. |
| Directions       | Routing and external handoffs; `reviewedParkingEntrance` guards parking destinations.                                                 | Fresh detail read plus `pilotNavigationEntrance`; research anchors cannot authorize navigation.             |
| Photos           | Empty curated catalog exists, but details also use dynamic `spot-photo.ts` resolution.                                                | Evidence-rich details; no verified photo catalog established by this audit.                                 |

Candidate tokens are memory-only; candidate RPC requires authentication. Public
records must satisfy publication/access/review-expiry guards and omit research
destination context. Frontend checks supplement server enforcement; this static
audit does not reverify deployed RLS or RPC authorization. Preserve city, mode,
session, expiry and revocation isolation during consolidation. Do not feed private
observations into legacy snapshot merging, saved metadata or offline caches.

## Executed baseline checks

Environment: Windows PowerShell, Node `v24.22.2`, pnpm `11.25.0`. Dependencies were
already installed. Used `pnpm.cmd` because execution policy blocks `pnpm.ps1`.

| Command / check                                                        | Observed result                                                                                    |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `pnpm.cmd --filter @parkey/mobile typecheck`                           | PASS, exit 0.                                                                                      |
| `pnpm.cmd exec eslint apps/mobile/src --max-warnings 0`                | PASS, exit 0, no warnings.                                                                         |
| `node --test --test-reporter=dot apps/mobile/src/discovery/*.test.mjs` | PASS, exit 0; 170 passing test dots.                                                               |
| Existing screenshot manifest verification using Node `fs` and SHA-256  | PASS; all seven file sizes and hashes match the committed manifest. No image inspection performed. |

The unit scope includes pilot parsing/access/navigation/request guards, legacy
discovery, retained results, map data, filters, routing, local storage, hours,
photos and telemetry helpers. Passing pure-function tests does not establish
native rendering, network delivery, accessibility or physical GPS behavior.

These automated checks preceded the emulator follow-up below. Browser,
physical-device, live backend, analytics delivery and database checks were not
run. No native recompilation or deployment occurred. Workspace-wide checks are
unnecessary for this documentation-only change.

## Screenshot and prior-execution inventory

Existing [screenshot index](evidence/pilot-2026-11-06/README.md) and
[manifest](evidence/pilot-2026-11-06/manifest.json) reference seven actual Stage B
Android emulator captures: public empty Manila map, Manila detail top/bottom,
museum destination focus, Mandaluyong detail top/bottom, and reviewer revocation
clearing the private view. Keep research-detail captures as engineering evidence;
they do not authorize consumer publication or reuse as product imagery.

Their source commit is `da05ae2c98f7b3fd7ad0cd6c280f8a6fa5cc628d`. The
[historical native receipt](../data/pilot-execution/2026-11-06/stage-b-android.json)
records mobile tree `a4384e807ebe5f1fb8bc27c82f76bd1ea0eb6cec`, which differs
from this baseline. It reports 17 emulator checks, not physical-device execution.
The [Stage B execution record](pilot-stage-b-execution.md) also reports prior CI
and API tests; those results are historical, not rerun for A0. Neither artifact
establishes current A0 device results, successful physical GPS, iOS readiness or
real Android P50/P95 performance.

## Risks and acceptance criteria for subsequent gates

| Risk / observed limitation                                                                                                                                                                           | Gate and required evidence                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Two flag-selected experiences expose different discovery controls and recovery behavior; older architecture prose describes a single legacy workspace.                                               | A1: one clear map-first flow; tests for flag behavior and search/filter/details/saved/directions/loading/empty/error parity. Retain private/public isolation regressions.                                                                                                                                    |
| Legacy retains results while pilot clears them on refresh; no bounded persistent viewport cache established.                                                                                         | A2: scope-safe caching, cancellation, deduplication, stable markers and bounded memory tests. Never persist candidate results. Measure cold/warm P50/P95 on a named physical Android device with build, dataset, sample count and method recorded.                                                           |
| Curated photo catalog is empty; runtime resolver can use Commons metadata or nearby Mapillary imagery, which does not prove location identity or approved reuse.                                     | A3: verify location match and license/credit for each presented parking photo; missing/unapproved/failed images need truthful fallbacks. Do not describe existing lookup as verified parking imagery.                                                                                                        |
| Source hours/fees/access can be missing; source anchors are not authorized entrances.                                                                                                                | A3: tests for unknown/conflicting facts, expired/revoked approvals and navigation denial. No inferred access, fees, hours or vacancy.                                                                                                                                                                        |
| Unit tests cannot validate map gestures, font scaling, screen readers, OS permission prompts, persistence through process death or external navigation handoffs.                                     | A4: executed browser integration and physical-device smoke evidence for accessibility, offline/reconnect, denied GPS, saved state, app lifecycle and regressions. No synthetic data presented as real.                                                                                                       |
| Existing Maestro flow targets the legacy Poblacion experience; prior pilot evidence used a local debug environment.                                                                                  | A4: reconcile native smoke coverage with the consolidated flag-selected flow and actual approved environment; old flows alone cannot prove pilot parity.                                                                                                                                                     |
| Optional Plausible and JS Sentry activate from public configuration at layout startup; no user opt-in check is present there. Blank examples disable them but do not enforce a release consent gate. | Privacy/release blocker: keep these values unset; require an enforced consent/release policy and negative network tests before collection. This audit does not inspect actual `.env` values or assert deployed telemetry is disabled.                                                                        |
| Canonical D2 remains IN PROGRESS; an endpoint in the contract is not completion evidence.                                                                                                            | D3 blocked: require documented deployed D2 evidence before adding the mobile adapter. Do not repoint Plausible; future adapter must test exact keys, allowlisted events, UUID lifecycle, opt-out deletion and silence without consent/release approval. D4 requires real-device delivery and privacy review. |

## Executed API 35 emulator follow-up

The user explicitly authorized emulator setup and smoke testing, and separated
physical-device release gates from A0. Restored ADB by terminating the hung
snapshot-instrumentation client, enumeration client and ADB server, then starting
a fresh server. ADB responded immediately. Stopped the old API 37 emulator and
installed Google APIs API 35 x86_64 revision 9 in a separate `Parkey_A0_API35` AVD.

Configuration: Pixel 7 profile, Android 15/API 35/x86_64, emulator binary
37.2.12.0 (the emulator binary version is not the guest API), WHPX acceleration,
SwiftShader GPU, two CPU cores, `-memory 2048`, no snapshots, no audio. Initial
display was 1080×2400/420 dpi; final display was reduced to 720×1600/280 dpi and
system animation scales set to zero. A host-GPU comparison booted but showed a
blank app screen and was not counted as passing evidence. Windows memory pressure
caused System UI ANRs after reboots; reducing test-server concurrency, resolution
and animations restored interactive testing. No emulator performance claim follows.

Installed the existing native development APK successfully. Its SHA-256 is
`d44de93e814045e42232de704d317d7556902031213ae68fe7c371dcd1149d47`;
version `0.1.0`, Android code `2`. Native dependencies and app configuration are
unchanged from its original build. Current mobile source was served by isolated
Metro on port 8096 over ADB reverse. This is a reused native shell with current
JavaScript, not a newly compiled or signed release. Both pilot flag values were
tested in separate server sessions; the final Metro configuration uses one worker.
`EXPO_NO_DOTENV=1` and unset analytics/Sentry values kept optional telemetry
disabled for this run. No new analytics adapter, account, private reviewer token,
backend data or mock provider response was used.

See the [current screenshots and receipt](evidence/v1-a0-api35/README.md).
The receipt records artifact sizes/hashes, actual observations and limits.

| Emulator check                     | Result and practical limit                                                                                                                                                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Map                                | Actual basemap and bundled parking rendered. Initial tile loading was delayed; native glyph 404 diagnostics remain an open defect.                                                                                                       |
| Destination search                 | Real Photon results returned for Poblacion Makati; selected the first result.                                                                                                                                                            |
| Filters                            | Garage selection showed an honest empty/filter state; Show all spots restored records.                                                                                                                                                   |
| Parking details / directions guard | Missing hours/entrance stayed unknown, customers-only warning visible, Go disabled without reviewed access/entrance approval. No successful parking route claimed.                                                                       |
| Permissions                        | Actual foreground prompt displayed and denial selected. Later explicit emulator permission grants plus a simulated GPS fix allowed parked-spot saving. Denial-message visibility while details are open still needs regression coverage. |
| Saved places                       | Saved a real bundled record; favorite persisted after emulator/app restart.                                                                                                                                                              |
| Walking directions                 | Explicit Walk back opened Google Maps. Google Maps onboarding appeared; no completed walking route or physical navigation claimed.                                                                                                       |
| Offline / retry                    | Disabling emulator Wi-Fi and mobile data produced Search couldn't connect; reconnecting and Retry search returned real results.                                                                                                          |
| Pilot / city / access              | Both city controls and filter sheet exercised with no backend configured. Honest configuration error shown, but loading never settles (defect). Blank reviewer token rejected; no private records exposed.                               |

### Newly observed risks carried to implementation

- Pilot missing-configuration paths retain a loading state indefinitely. A1 must
  settle to a recoverable error and keep search/filter empty states truthful.
- Native map requests for the default Open Sans/Arial Unicode glyph stack return 404. Diagnostic overlays can obstruct development UI. A2 must investigate the
  font/style lifecycle and verify readable markers; do not merely suppress logs.
- Legacy details contain a Spaces field despite V1's discovery-only scope. A1
  should remove inventory-oriented presentation without adding occupancy claims.
- Candidate research and legacy navigation controls remain prominent in the
  development pilot experience. A1 must consolidate consumer navigation while
  preserving flags and server-side private/public isolation.

## A0 acceptance and next gate

All canonical A0 baseline requirements have evidence: architecture and routes
reviewed, baseline automated tests passed, current emulator screenshots captured
and visually reviewed, and risks recorded. Known smoke defects are explicitly
open rather than being reported as passing product behavior. A1 can proceed on
an independent branch to address consolidation and these UX defects.

No authenticated pilot integration was tested: that requires a separately
authorized backend/reviewer environment. No physical GPS, Android P50/P95,
physical-device smoke, iOS, native crash, analytics delivery or release gate has
passed. A2/A4 physical-device requirements stay open. D3 stays blocked on D2 and
privacy/release approval. No permission for publication or deployment is implied.
