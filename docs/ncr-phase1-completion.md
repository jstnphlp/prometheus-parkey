# Phase 1 autonomous completion and human handoff

The feature branch implements the automatable research, data-quality controls,
local Metro Manila map preview and fieldwork workflow. **Phase 1 is not complete
for a public launch.** Current human field verification and publication approvals
remain zero. The [machine-readable gates](../data/ncr-research/phase1-gates.json)
are the acceptance record; passing engineering tests does not satisfy missing
commercial, legal, access or physical evidence.

## Completed automatically

- Preserved the frozen 17-LGU geography and 5,427 OSM/Overture observations,
  original source/license IDs, per-city/type/grid statistics and original
  Poblacion decisions. All four archive hashes and reproduced coverage match.
- Investigated all 70 suggested duplicate pairs, ten provider-location conflicts
  and all 1,668 child/street features. The [quality report](ncr-data-quality.md)
  explains 5,507 persistent issues and their assigned human review queues. None
  of the 70 ambiguous pairs was merged on proximity or containment alone.
- Retrieved the official Foursquare NOTICE and official licensing guidance.
  [Server controls](ncr-licensing-publication.md) enforce separate evidence and
  publication states, restricted-access exclusions, source revision binding,
  field scope, rejection/revocation and review expiry. Invalid/tampered ledgers
  fail closed. Approval events cannot manufacture physical evidence badges.
- Implemented the [Expo development preview](ncr-development-preview.md), with
  a full-screen map, complete-snapshot loading, local clusters, category filters, original geometry, attribution,
  access/evidence labels and unknown facts. Actual public NCR output is empty;
  no candidate has a driving action based on a centroid or research anchor.
- Extended the [11-area hotspot comparison](ncr-hotspot-comparison.md) with 51
  additional public-source retrieval attempts, including official operator and
  ordinance evidence. All commercial scores remain unranked. Poblacion is the
  continuity priority; Cubao has the strongest retrieved operator-portfolio
  lead; BGC provides an estate comparison; Tomas Morato needs scoped rule checks.
- Produced [field instructions and candidate map links](ncr-fieldwork.md), a
  complete 5,427-ID queue, 66 route candidates in 12 pockets and a 24-stop first
  wave. The private local form accepts actual observations and optional locally
  sanitized photographs. Its importer archives evidence with atomic, serialized,
  retryable writes and creates unreviewed receipts only.
- Fixed the pilot's map-padding viewport feedback, updated E2E expectations for
  the current UI and supplied fresh deterministic navigation sensor fixtures.
  Production arrival/stale-fix guards remain intact. Updated vulnerable
  transitive dependencies and patched deepmerge with an installed-artifact
  exploit regression; no security assertion/advisory was disabled.

The subsequent map review changed the display requirement: all source records
load once into the explicit private preview, with information/details in modal
sheets. This replaces viewport-triggered client fetching. The API still bounds
and validates each page and enforces public eligibility. Visible-scrollbar
testing reproduced the former 15-pixel layout oscillation; full-screen map
sizing removes the results-page scrollbar from the map layout. Moving, zooming
and filtering no longer cause data requests or clear/recreate the map.

Actual commands, results and log hashes are in
[phase1-verification.json](../data/ncr-research/phase1-verification.json).
The historical verification.json is retained as the earlier baseline.
[phase1-security-report.json](../data/ncr-research/phase1-security-report.json)
records the remaining low-severity version-only deepmerge audit finding and the
tested mitigation. Moderate/high/critical production advisories are zero.
GitHub execution status must be read from the referenced runs or PR checks;
local passing tests do not imply that remote CI has already passed.

## Needs physical verification

Begin with the six preserved Poblacion owner tasks, then the nearby first-wave
Cubao, BGC and Tomas Morato pockets in the checklist. Confirm existence, current
operation, visitor entitlement, posted restrictions/rates/hours, actual vehicle
entrances, accessible approaches and potential host/operator contacts. Record
observations at the suggested periods and leave unseen facts unknown. Route
order is geometric planning, not a verified safe pedestrian/driving route.

Current occupancy, search-time samples, driver interviews and willingness to pay
are missing. The source inventory and operator marketing cannot supply them.
On-site submissions require accountable reconciliation before physical evidence
is accepted. No actual visit or interview was performed by an agent.

## Needs accountable human approval

Confirm source-combination/distribution and notice policy, actual visitor rights,
operator/owner permissions and permitted field scope before any display approval.
Decide final hotspot selection after the missing commercial evidence. Publication,
deployment and merging to main require explicit authorization. There is no HTTP
approval endpoint and no automated promotion from a field-form submission.

## Technical and evidence limits

Docker is absent locally. The new disposable runner-local database job passed
all 186 SQL assertions across four files in both CI runs; no hosted database was
contacted. The first implementation commit passed validation and all 42 browser
tests remotely with no retries. Exact commits/run references are in the
execution record; PR checks show subsequent-head status.

Android native smoke testing also ran on the existing Pixel 10 Pro Android 17
AVD, using the installed development client and current Metro JavaScript. It
covered private overview/BGC details, explicit unknown/unverified labels, public
clearing and return to the pilot. It caught a missing cluster font: the default
font stack returned 404. Both maps now use Noto Sans Bold, checked in the native
reload and a browser regression for actual font requests. No new native APK was
built, no iOS device/simulator ran, and no physical location or real navigation
sensor evidence was collected.

Some official pages were unavailable, redirected, or did not publish current
parking rates/conditions. Retrieval statuses and limits remain in the evidence
ledger. Current rate cards, occupancy, demand, supply sufficiency, partner
interest, WTP and current ordinance implementation remain unknown where no
applicable evidence was obtained. No community complaints, interview answers,
commercial winners or facility verification were invented. Google links use
permitted source coordinates for navigation/search only; no Google place data
was copied.
