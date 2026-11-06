# A1 discovery consolidation — engineering acceptance

**PASS for locally executable A1 engineering checks.** Production release and
external PR approval are separate and remain unapproved. Branch
`codex/v1-a1-discovery-consolidation`, [draft PR #24](https://github.com/jstnphlp/prometheus-parkey/pull/24).
Implementation: `1e8f169`; final native-discovered distance correction: `c7fdf42`.
Earlier A1 commits `39feebc` and `ba1e58c` were preserved.

## Resulting discovery behavior

- Both flag-selected experiences use the Map/Saved/You navigation component.
  Source-specific renderers/contracts remain separate: unknown facilities,
  entrances, spaces and polygon geometry are never coerced into lots or garages.
- Pilot search, type/fee filters and results share destination → current usable
  GPS → actual map-center ranking. Ties are stable; unknown fees are explicitly
  excluded/count-labelled under known-fee filters, never interpreted as free.
  Legacy cards and rows now use the same distance reference as their ranking and
  explicitly say straight-line. Legacy source-supported filters remain intact.
- Pilot favorites persist at most 50 public metadata reminders. Validation rejects
  candidate, expired, restricted and contradictory records; no private record body,
  token or navigation approval is persisted. Selecting a saved reminder clears
  private mode and loads the public saved area for current facts.
- Parked-car state is shared on-device with the existing experience. Saving needs
  an explicit current-location request. Maps handoff is an explicit action; source
  points and saved metadata never substitute for authorized entrances.
- Loading/error/empty states are distinct, configuration failures stop spinning,
  and both results/search panels provide scoped retries. Storage failures preserve
  state and offer retry/explicit recovery. Offline and denied-location states
  retain recovery paths. Stale denied/error GPS points cannot label distances as
  coming from the user's current location.
- Candidate research is development-only, guarded in both controls and connection
  handler. Existing MFA/server authorization, city/session clearing, expiry,
  cancellation and fresh pilot entrance lookup remain. Development legacy switching
  is tucked into Map information rather than the consumer map controls.
- General capacity presentation was removed. Telemetry is locked off even when
  provider environment values are supplied; no Track D adapter was added.
- The old NCR route only hands off to an explicitly configured safe external URL.
  Credentials/query/session fragments are rejected. Browser regressions replace
  the obsolete internal-research-map assertions without weakening isolation.

## Executed checks

| Check                         | Actual result                                                                                                                                                                                                                                                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node / pnpm                   | Node 24.22.2 / pnpm 11.25.0.                                                                                                                                                                                                                                                                                           |
| Mobile unit suite             | 187 passed, zero failures; includes saved metadata/storage failures, original classifications, ranking/fee unknowns, release controls, telemetry lock and safe external target tests.                                                                                                                                  |
| Pilot browser E2E             | 28/28 passed across desktop Chromium and Pixel 7 browser emulation, 2.0 minutes. Covers public/private isolation, saved persistence, retry/corruption recovery, price/ranking, expiry/revocation and fresh approved-entrance handoff.                                                                                  |
| Legacy browser E2E, final run | 48/48 passed, 10.7 minutes; includes the native-discovered destination-reference regression and six external Console regressions.                                                                                                                                                                                      |
| Workspace checks              | `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build:web` passed. After the final distance-only correction, mobile typecheck, scoped lint/format, full mobile units and the full legacy browser suite passed again.                                                                                         |
| Independent code review       | Reported stale GPS, parked-store recovery and in-panel retry gaps were fixed; final review found no introduced A1 security/privacy blocker. Distance-reference follow-up also reviewed.                                                                                                                                |
| Native API 35                 | Live basemap, Map/Saved/You, persisted parked pin, price/type controls, scoped retry, actual offline/reconnect behavior, real Photon search, distance labels, truthful unknown details, refused unapproved navigation and actual Google Maps walking handoff observed. Eleven captured-layout assertion groups passed. |

The first legacy run was interrupted for 13,021 seconds and had one timeout;
it is not counted as a passing run. The unchanged interrupted case passed in a
fresh session, followed by the complete final 48/48 run. An initial format scan
was sandbox-denied in an ignored local output directory; the normal workspace
format check passed outside the sandbox. No assertions were weakened or skipped.

## Native evidence and limits

[Screenshots, UI layouts and receipt](evidence/v1-a1-completion/README.md) identify
the exact source per capture. Pixel 7 AVD `Parkey_A0_API35`, Android 15/API 35
x86_64, WHPX, SwiftShader, two cores, `-memory 2048`, no snapshots,
720×1600/280 dpi. A suspended emulator network was recovered by cold restart
with explicit public DNS; saved data survived. Current committed JavaScript ran
through single-worker Metro port 8096 in the existing native development APK
`0.1.0`/code `2`, SHA-256
`d44de93e814045e42232de704d317d7556902031213ae68fe7c371dcd1149d47`.
No native dependencies changed; this is not a newly signed release artifact.

Native pilot data was deliberately unconfigured: its honest error, saved state
and controls were exercised without granting reviewer access or substituting
research observations. Positive pilot data/navigation permutations used explicitly
synthetic browser/unit fixtures. Legacy native search used real Photon results
and the actual attributed bundled snapshot. Google Maps reached its onboarding
activity; completed walking/driving and physical movement are not claimed.

MapLibre default-font glyph 404s remain an A2 issue. They were retained in logs
and some captures; developer overlays were dismissed for the actual disabled-Go
test, never suppressed in source. A stale Fast Refresh component-prop error
during the distance-contract edit was cleared by cold process reload; the final
current-source native flow then passed. No cold-start/performance pass follows
from this functional smoke test.

Production/non-development startup correctly refused missing approved backend
configuration. No release guard was bypassed. Release-build runtime UI,
provider/data publication approvals, physical Android, iOS, signing and production
distribution remain unverified. Existing fee/hour/access/photo contradictions
identified by read-only research are explicit A3 remediation work, not a release
approval hidden behind A1 acceptance.

## Review and progression

The isolated stale-research-test fix (`d7c0cec`) was backported to A0 as
`b494ff3`. [PR #23](https://github.com/jstnphlp/prometheus-parkey/pull/23) now has
passing validation, database and E2E checks in runs
[42201803534](https://github.com/jstnphlp/prometheus-parkey/actions/runs/42201803534)
and [42201811783](https://github.com/jstnphlp/prometheus-parkey/actions/runs/42201811783).
It remains unreviewed/unmerged. A1's separate PR remains draft; its remote checks
and external review are tracked there and must not be represented as merge approval.

Locally verified A1 engineering acceptance permits A2 implementation. Physical
Android P50/P95 and final physical smoke remain production release blockers under
the user's explicit Windows/emulator-only engineering policy. No PR was merged,
no hosted data/deployment changed and analytics collection remains disabled.
