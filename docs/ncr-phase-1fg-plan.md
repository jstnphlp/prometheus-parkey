# Phase 1F/G: implementation and fieldwork specification

Prepared 5 November 2026. This is an actionable specification; no app integration,
database migration, deployment, operator contact or physical visit is performed
by this research work. Read the [coverage report](../data/ncr-research/coverage.json),
[evidence gaps](ncr-evidence-gaps.md) and
[hotspot assessment](ncr-hotspot-assessment.md) before selecting launch areas.
The coverage and gap-report paths identify pipeline deliverables; confirm that
they have been generated and inspect their recorded provenance and limitations.
This specification alone does not establish that source acquisition or import
has completed.

## Evidence and publication states

Keep evidence state, access and publication approval as independent facts. A
source refresh cannot advance a human review or reset an exclusion.

| State                | Required evidence                                                                                                             | What it permits                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Researched           | Traceable licensed source ID, source snapshot and observation time                                                            | Private research queue only by default.                                                           |
| Online corroborated  | Dated reference, checked fact, method, reviewer and limitations                                                               | Stronger research evidence; no field-verification badge or access claim.                          |
| Physically verified  | Dated visit with evidence of exact feature, entrance, access conditions and observed operation                                | Field-observation badge for the checked facts and date; no guarantee of future access or vacancy. |
| Publication approved | Separate recorded reviewer decision, permitted fields, license/attribution review, access/safety review and approved geometry | Display only the approved facts in the approved context. It does not upgrade evidence state.      |

An operator confirmation has its own method, respondent role, observation date,
permission and checked facts. It may corroborate access or rates but is not a
Parkey physical visit. Unknown values remain null. Source edits, imports and
website retrieval dates are never field-observation dates.

Preserve the existing Poblacion source files and human ledger, including excluded
records and missing reasons. Consult
[the preservation manifest](../data/ncr-research/poblacion-preservation.json) and
[PR #4](https://github.com/jstnphlp/prometheus-parkey/pull/4) for its three
owner-supplied navigation references and six visit-required candidates. PR #4's
references do not establish verified entrances; Riki's prior online
corroboration and its visit requirement must coexist. Do not fetch, scrape or
derive Parkey coordinates from those map URLs. New records retain their open
source coordinates and immutable IDs. Identity matching produces review links,
never a silent overwrite or deletion.

## Phase 1F work packages

1. **Freeze and review the research snapshot.** Retain input hashes, extraction
   manifest, actual release dates, boundaries, OSM/Overture source IDs, provider
   attribution and license decisions. Review invalid geometry, restricted
   access, stale/contradictory tags, likely duplicates and mall membership.
   Keep OSM and Overture lineages distinguishable. Record human facility groups
   separately from source features so entrances/bays are not counted as lots.
   Exit: a reproducible local snapshot with no inherited approvals, a preserved
   Poblacion ledger and an explicit list of records eligible for display review.
2. **Add reviewed display contracts.** Extend the existing shared type-only
   contracts and discovery adapter; reuse the current viewport/data-fetching
   path. A future server-side import accepts only reviewed artifacts and remains
   separate from the source normalizer. Design and test database/RLS changes
   locally before requesting any environment-specific deployment or migration.
   Exit: API contract tests demonstrate that denied records and unapproved facts
   cannot reach a public response, even if the client omits filters.
3. **Implement NCR viewport retrieval and rendering.** Preserve original polygon
   and street-line geometry. At overview zoom render aggregate source/facility
   counts as explicitly different measures; show individual facilities at useful
   zoom, with bays/entrances attached to a reviewed parent or hidden as separate
   parking results. Keep source details accessible. Exit: capped, cancellable
   viewport queries and deterministic clusters work across all 17 LGUs without
   changing the existing pilot fallback or saved identities.
4. **Add honest warnings and actions.** Public research candidates need an
   explicit display approval and prominent unverified/access labels. Known
   private, permit-only, closed, prohibited or unsafe features stay out of public
   usable-parking results; warnings do not override this exclusion. Routing needs
   a separately confirmed vehicle entrance and usable-access evidence. Fees,
   hours, capacity and availability remain absent until supported by dated,
   approved evidence. Exit: every displayed label/action is backed by its own
   approved fact, with empty/error/offline states that do not imply no parking.
5. **Moderate, audit and release only after review.** Implement an append-only
   review ledger with reviewer, reason, evidence references, approved fields,
   scope, decision date, review-due date and revocation. Source refreshes create
   change proposals; source absence does not delete saved places or decisions.
   Exit: targeted tests, local checks and a reviewable release artifact. Production
   publication/deployment requires its own authorized action.

### Proposed viewport contract

These fields are a proposed contract for Phase 1F, not a claim that they already
exist in the app or database.

- Request: WGS84 `bbox=[west,south,east,north]`, `zoom`, optional opaque `cursor`
  and `limit` (maximum 500 detail records). Validate finite coordinates, ordered
  bounds, NCR intersection and query size server-side. Clip to the study area.
  Overview queries return aggregates rather than an unbounded NCR detail dump.
- Response envelope: `schemaVersion`, `dataVersion` (snapshot hash), `generatedAt`,
  `coverage` (boundary version, source dates, known missing sources), `items`,
  `clusters`, `nextCursor` and `truncated`. A truncated viewport must visibly say
  more results exist. Do not return legacy/excluded review notes publicly.
- Source-feature identity: stable `id`, `sourceKind`, `sourceId`, `sourceRelease`,
  `sourceRecordUrl`, `sourceObservedAt`, `sourceEditedAt`, `sourceLicense`,
  `sourceAttribution`, provider source IDs and input hash. One physical facility
  can link multiple source features; possible duplicates remain marked pending
  review. Overture provider overlap is not independent corroboration.
- Geometry and category: `featureType` (`lot`, `garage`, `facility_unspecified`,
  `street_segment`, `space` or `entrance`), optional separately evidenced
  `mallAssociation`, original geometry, `representativePoint`,
  `pointIsVehicleEntrance`, `lgus`, and optional
  reviewed `facilityId`/`entranceId`. A point created from a polygon cannot be
  used for arrival guidance. Crossing-city geometry can have multiple LGUs;
  cross-LGU counts must not be summed as distinct facilities. A generic Overture
  `parking` category stays `facility_unspecified`; neither a lot/garage subtype
  nor mall membership can be inferred from its name or category alone.
- Evidence and access: `researchStatus`, optional `onlineCorroboration`, optional
  `fieldVerification`, optional `operatorConfirmation`, `accessClass`,
  `accessConfirmedAt`, `conditions`, `streetLegalReview` and `warnings`. A street
  permission requires side, line extent, sign/time rules and relevant ordinance
  review; a mapped tag alone is insufficient.
- Publication: a public projection contains only facts covered by current
  server-side publication approval. Keep reviewer identity and confidential
  operator/interview evidence in the restricted ledger. Include public
  `lastReviewedAt`, `reviewDueAt` and an expiry/revocation state.

Preserve nulls: an unknown fee is not zero, unknown capacity does not establish
availability, and unknown access is not public access. Cached/offline records
retain their source/review dates and approval version; revoked or expired records
cannot be presented as currently usable merely because they were saved.

### UI content and rules

- Research layer notice: **Mapped parking research. Coverage is incomplete;
  records may be out of date.**
- Candidate detail notice: **Unverified parking candidate. Visitor access,
  operating hours, fees and legal use have not been confirmed. This point may
  not be a vehicle entrance.** Show the caveat relevant to each feature.
- Online label: **Checked online on [date] — no site visit recorded.** List the
  checked fact and source; never reuse a physical-verification icon.
- Field label: **Visited on [date]. Conditions may have changed.** Display
  fact-level scope and stale-review status. A closed/private observation blocks
  usable-parking display immediately, regardless of the visit badge.
- Cluster label: **N mapped facility candidates**, with a separate research
  feature count when needed. Never label source-feature clusters “N available
  parking spaces.” Streets, entrances and individual bays do not inflate it.
- Keep a browsable source/license panel and visible map attribution. A Google
  base map, if independently used by the app, does not license its place content
  for import. No scraping or copied ratings, photos, coordinates or reviews.

### Targeted acceptance checks

Cover all 17 LGUs, geometry crossing LGUs and viewport edges, repeat refreshes,
same-source duplicates, different entrances to one garage, a mall with no proven
parking association, absent provider licenses, access unknown/private/customers/
permit, closed/construction tags, contradictory street restrictions, conditional
hours, revoked approvals and stale offline caches. The server must reject
invalid/oversized queries and enforce display gates before pagination.

Verify low-zoom aggregate/detail transitions, cancellation of stale requests,
result caps, no false empty result when truncated, unknown versus zero, retained
Poblacion saved IDs and the six legacy visit requirements. Add tests to existing
discovery/moderation contracts and relevant unit suites. Run typecheck, lint and
formatting for changed packages. Browser/device/E2E validation belongs to the
later UI implementation task and must be reported only when actually run.

## Phase 1G fieldwork

### Selection and sampling

No hotspot is ranked for launch yet. Use the
[assessment matrix](ncr-hotspot-assessment.md) to choose an initial learning
sample, then compare areas using collected evidence. An efficient first wave is
Poblacion (retained owner requests), Cubao (operator parking guide), BGC (explicit
parking inquiry channel) and Tomas Morato (time-dependent legality risk). This
is a logistics/evidence-readiness proposal, not a demand or commercial ranking.
The second wave covers Binondo, Makati CBD, Ortigas and MOA. North EDSA,
Alabang/Filinvest and Maginhawa are optional comparison strata.

For each selected hotspot, choose six distinct physical facility candidates
after identity review: two mapped lots, two garages/mall facilities where
present, one unknown-access candidate and one suspected duplicate/missing-entrance
case. Adapt to actual source coverage and record substitutions; do not invent
street parking to fill a quota. Separately audit at least two street blocks
where curb parking is mapped or plausibly missing, with no assumption of legal
parking. Individual bays and entrances are observations attached to facilities.
Keep all six Poblacion legacy visit tasks even if some fall outside a newly
drawn hotspot polygon; reconcile overlaps by stable ID and preserve every task.

Observe each facility in at least two predeclared periods: one ordinary weekday
and one relevant evening/weekend/event period. Suggested windows are weekday
08:00–10:00/17:00–19:00 for CBDs, Friday/Saturday 19:00–22:00 for dining districts,
and a normal weekend plus a separately identified event session for MOA/Cubao.
These are sampling proposals; verify opening hours, permissions and researcher
safety first. For Tomas Morato, inspect the ordinance-defined Sunday closure
separately and confirm current implementation/signage. Record weather, event,
road works, school/holiday context and failed/inaccessible observations. Four
areas × six facilities × two periods produces 48 planned facility observations,
plus street audits and any nonoverlapping legacy tasks; none have been performed.

### Site-visit record

Create a local, append-only record with `visitId`, source/physical-facility IDs,
observer, actual start/end timestamps with timezone, self-collected coordinate
and accuracy, geometry/entrance method, method of legal access, evidence IDs,
consent/photography restrictions, observed signs, operator role if interviewed,
fact-level confidence and follow-up requirements. Keep personal contact details
and identifiable imagery outside public research exports.

Check the entrance from a safe lawful position; compare footprint and duplicate
features; record vehicle direction, clearance/height and pedestrian safety.
Record public/customer/resident/permit access, vehicle classes, hours,
restrictions and refusal reasons. Ask permission before entering private areas
or photographing signs. Capture rate signage only where permitted, with full
conditions, date and relevant validation rules. Count occupancy only from a
permitted, repeatable observation with a known denominator; otherwise record
`not_measurable`. Queues and turning-away observations need a fixed interval and
counts, not impressions. Never store a single observation as live vacancy.

For streets, record exact block/side, sign positions, schedules, loading/fire
lanes, obstruction and applicable city rules; unresolved conflict means no public
usable-street-parking approval. Lack of a sign in a photo is not permission.
Record an unsuccessful visit as such rather than upgrading verification.

### Driver interviews and willingness to pay

Target ten consenting drivers per selected hotspot across both periods as an
exploratory convenience sample; explicitly report recruitment, nonresponse and
car ownership bias. Ask trip purpose, arrival period, actual search duration,
alternatives considered, amount actually paid for that trip, tolerable walk,
accessibility/safety needs and experience of being refused. Separate actual
payment from hypothetical willingness to pay. Test clearly described booking/
information concepts at randomized price scenarios only after stating that no
space is offered. Do not turn these small, nonrandom samples into NCR population
estimates, market size or a conversion forecast. Collect no unnecessary personal
identifiers. Obtain consent and store raw notes in restricted research storage.

### Operator/partner interviews

Request a conversation through published official channels or an in-person
authorized representative; this plan sends no messages. Confirm authority,
public/customer access, entrance, lawful operation, fee/hours terms, capacity
denominator, peak/off-peak pattern, current discovery channels, ability to honor
reservations and whether any inventory could be offered. Ask about accounting,
reconciliation, support and change notification. Record actual interest and
conditions; “potential partner” remains a lead until a dated authorized response.
Do not promise exclusivity, inventory, contracts, publication or revenue shares.

### Field exit and decision gates

Require reviewed entrance/access evidence, unresolved-issue closure, permitted
source/photo use and dated operator/field facts before an eligible record is
proposed for publication. A different reviewer approves the specific public
facts. Private/prohibited/closed outcomes remain excluded and auditable. Propose
rechecks after 90 days for ordinary facilities, 30 days for volatile street or
event rules, and immediately on credible closure/access reports; these intervals
are an editorial proposal for approval, not guarantees of freshness.

Only after all five metrics have defensible dated evidence and the scorer's
confidence threshold is met should Phase 1E produce a provisional opportunity
score. Preserve missing metrics as missing. Supply gap requires usable supply
and observed demand in comparable periods; OSM/Overture feature counts cannot
supply either side alone. Launch selection additionally needs authorized partner
terms, legal/access review, operational support and an explicit publication
decision. Publish the sampling limitations alongside any preliminary ranking.
