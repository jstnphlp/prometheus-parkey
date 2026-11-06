# V1 A0 mobile discovery baseline

Recorded 2026-11-06 on branch `codex/v1-a0-discovery-baseline`, based on remote
`main` commit `febd41941e722f0f1e85829176679f1ff88cc7f6`. Mobile tree:
`35e2860f492c79c91b27bcb66ad66f4abfa496b3`.

**A0 is not PASS.** Static baseline work is complete; current native screenshots
and device review remain unexecuted. No PR has been opened. A1–A4 must not advance
until A0 evidence is reviewed and its gate passes. The canonical plan remains
unchanged. No product behavior, dependencies, backend or admin code changed.

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

Browser, emulator, physical-device, live backend, analytics delivery and database
checks were not run. No dev server, build, deployment or external event was
started. Workspace-wide checks are unnecessary for this documentation-only
change. Documentation formatting is checked separately before handoff.

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

## A0 handoff and stop condition

Follow-up completion attempt: Android platform-tools is installed. Both normal
and elevated `adb devices -l` calls stalled without returning a device list.
Cleanup targeted only those two enumeration clients; termination could not be
confirmed because process cleanup returned an error. Existing ADB server/device
processes were not targeted. No target could be identified, so no app was launched, no data
was cleared and no new screenshot or device result is claimed. Restore a
responsive ADB connection and identify the authorized test target before
continuing native evidence collection. Agent-device is not installed on PATH.

- Static architecture/routes/risks recorded and baseline automated checks passed.
- Historical screenshot integrity verified; current native UI not captured or
  visually reviewed. No physical-device result or performance measurement exists
  from this run.
- Next required evidence: current build identity, named device/OS, build flags
  and public provider configuration (no secrets), screenshots of both flag states
  and key recovery states, and a signed-off baseline review. Candidate access
  checks require an explicitly authorized reviewer environment; never create a
  public candidate dataset for QA.
- Stop here for device verification/approval, as requested. A0 stays unpassed;
  A1–A4 and D3 are not started. Attach branch PR and evidence commit SHA at review;
  update the canonical plan only when the gate truly passes.
