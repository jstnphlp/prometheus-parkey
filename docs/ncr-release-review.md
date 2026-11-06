# NCR research — data quality and licensing release review

Review date: 2026-11-05. Scope: PR #13 research snapshot and application-publication suitability.

## Decision

**KEEP RESEARCH-ONLY. NOT APPROVED FOR PUBLIC PARKING RESULTS, NAVIGATION OR BOOKING.** A source license declaration is not a street-parking authorization, right to enter a private facility, verified entrance, or approval to distribute a combined database. No parking was published or verified by this review.

## Independently reconciled source counts

- Manifest and coverage agree on 12,463 filtered-source observations: 5,427 within NCR and 7,036 outside selected LGU boundaries.
- 5,427 observations = 5,085 OSM + 342 Overture; also equals the sum of all six recorded feature types.
- 3,759 candidate facility observations = 3,744 provisional groups + 15 repeated explicit identity entries collapsed.
- 70 unresolved potential-duplicate pairs (12 same-name near matches, 58 Overture points inside OSM footprints). These are suggestions, **not** reviewed merges.
- 10 repeated-provider groups have location conflicts greater than 100 metres. Resolve these before approving individual entities for public display.
- 541 restricted-access, 821 customer-only, 3,845 unknown-access observations. These categories must not be treated as confirmed visitor parking.
- 515 street segments have unconfirmed legal parking conditions. On-street parking cannot be published as legal simply because of OSM curb tags.
- 822 grid cells, of which 392 have no mapped observations. Mapping gaps are not evidence of zero supply or parking demand.
- Source snapshots do not establish parking capacity, vacancy, entrance, price, current operation, or operator permission.

## Publication blockers and owners

| Gate                                         | Status                                                                               | Resolution required                                                                                                                                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source identity and reproducibility          | Technical evidence present                                                           | Keep reproducible archives, hashes, source record URLs, release date, and tests green.                                                                                                                                                                                          |
| OSM ODbL 1.0                                 | Not cleared for app use                                                              | Display © OpenStreetMap contributors, link license/copyright, make the applicable derivative database and rights offer available as required. Document derivative vs collective handling.                                                                                       |
| Overture Places                              | Provider licenses recorded; publication review pending                               | Preserve provider-level licenses, attribution, release date; independently confirm allowed fields and notices. Overture itself warns OSM+Places joins may create an ODbL derivative database.                                                                                   |
| Foursquare Apache-2.0 data                   | Official NOTICE retrieved; no legal app clearance                                    | Official visible NOTICE wording, source hash and separate Parkey modification notice are now bundled in data/ncr-research/licenses. See ncr-licensing-publication.md; legal product/distribution approval remains human-owned.                                                  |
| Historical geoBoundaries                     | Research only                                                                        | Keep its CC BY 3.0 IGO attribution/year; OSM municipal polygons (rather than historical geoBoundaries) were selected for the actual research classification. BGC/EMBO and other disputed areas need legal-authoritative current boundary review before city-specific decisions. |
| Duplicate identity                           | 70 pairs + 10 conflicts unresolved                                                   | Human-reviewed separate/same facility decisions with source references. No proximity-only merge and no one-facility-per-entrance inflation.                                                                                                                                     |
| Facility visitor access                      | Not measured                                                                         | Exclude private, permit-only, prohibited, closed or otherwise unsafe candidates. Unknown access must not be represented as public. Confirm rights and restrictions before access-related claims.                                                                                |
| Street legality                              | Not measured                                                                         | Review street side/direction, signage, hours, ordinances, enforcement and changes. Mapped curb tags alone are not proof.                                                                                                                                                        |
| Real-world verification                      | Zero                                                                                 | Record dated operator/field evidence for factual claims, approved fields, audit trail and review-due/expiry logic.                                                                                                                                                              |
| Data display approval and server enforcement | Zero approvals; server controls implemented                                          | Use strict server-side field-scoped publication decisions and tested public projections before any app release. A UI warning does not override denial.                                                                                                                          |
| Metro-wide app integration                   | Local development preview and reviewed projection implemented; not publicly released | Existing Expo architecture now fetches a bounded loopback research API with categories, clusters, evidence/access warnings and null facts. Public NCR output remains empty pending approval. No raw research archive is bundled in mobile.                                      |

## Source references reviewed

- OSM legal FAQ and attribution guidelines: https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ and https://osmfoundation.org/wiki/Licence/Attribution_Guidelines
- OSM collective-database policy: https://osmfoundation.org/wiki/Licence/Community_Guidelines and https://wiki.openstreetmap.org/wiki/Collective_Database_Guideline (the latter is historical; use approved OSMF guidance).
- Overture Places documentation: https://docs.overturemaps.org/guides/places/ and https://docs.overturemaps.org/attribution/ . The October 2026 Places records follow CDLA Permissive and Apache 2.0 as appropriate.
- Official Foursquare NOTICE: https://opensource.foursquare.com/places-notice-txt/ . This is an explicit release obligation for its Apache-2.0 contributions.
- geoBoundaries Philippines ADM3 source metadata: https://www.geoboundaries.org/api/current/gbOpen/PHL/ADM3/

## Operating decisions

Research artifacts and a locally generated aggregate heatmap are allowed for the internal research team. The aggregate preview must show **mapped observations, not available spaces**, avoid individual candidate directions/fees, and remain local/offline.

Do not enable a public NCR discovery feed solely by turning on a client feature flag. The implemented local server gates output using a separate hash-chained, field-scoped publication ledger; it currently has zero approvals. Continue Phase 1E interviews, parking pressure sampling and outreach; missing demand/WTP metrics remain null.

The original `data/ncr-research/verification.json` remains the earlier baseline.
The continuation's actual commands, results and log hashes are recorded in
`data/ncr-research/phase1-verification.json`; release blockers and each mandatory
criterion are in `phase1-gates.json`. The original E2E failures were investigated
and the current UI assertions, map-padding feedback and stale emulated GPS fixes
were corrected. Check PR #13's latest head checks for remote CI status; a local
passing run is not evidence of a remote run. No assertion was weakened to grant
publication or physical verification.

## Autonomous completion continuation

The missing Foursquare NOTICE was retrieved from its official page and retained
with the Apache agreement and a separate research-modification notice. The
[licensing/publication report](ncr-licensing-publication.md) records exact source
evidence, remaining human/legal decisions and the implemented controls.

The local Metro Manila preview and approved projection now exist. HTTP tests
exercise loopback/Origin/mode restrictions and prove unapproved actual NCR data
stays out of the public projection. Runtime approval checks cover expiry,
revocation, source revisions, restricted access and unresolved research issues.
This implementation does not supply legal, field, access or publication approval.
Both first-implementation CI runs passed validation, 42 browser tests and 186
SQL assertions. Android native smoke testing additionally caught and verified a
cluster-font correction, covered by a new browser assertion. Use the execution
record for exact tested commits and PR checks for the newest head status.
Release gates remain blocked on actual human evidence and authorization.
