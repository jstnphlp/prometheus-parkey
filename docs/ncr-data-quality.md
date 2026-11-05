# NCR data-quality investigation

All 5,427 original source observations and their raw geometry, IDs, licenses and
prior human decisions remain in the immutable source archive. No new source
record was deleted, renamed, physically verified or approved for publication.

The persistent [review ledger](../data/ncr-research/review-ledger.json) contains
**5,507 immutable versioned issue definitions** and **zero human decision events**.
It investigates **each of the 70 possible duplicate pairs**, **each of the ten
conflicting provider identity groups**, and every candidate's access/operation
uncertainty. All 70 pairs remain unresolved: nearby names and point containment
do not establish identical physical facilities. The previous 15 explicit provider
identity collapses remain provisional source-identity groups; ten location
conflicts are separately assigned to a human data reviewer. A provider page can
be relocated or represent a branch/business rather than one parking facility.

Every issue includes source snapshot, source IDs, reasons, evidence references,
blocking status, severity and assigned human role. Pair/conflict entries retain
the compared names, full coordinates, provider identities, distance/containment
basis and group IDs. Source and owner decisions remain authoritative. Each issue
catalog and audit event is hashed; regeneration retains earlier issue versions
and append-only events. A hash chain detects accidental/tampered bytes; it is not
cryptographic proof that an actor is authorized. Ledgers remain trusted private
server/operator inputs, never client-supplied public authority.

## Concrete findings

| Finding / research limitation                                   | Observations or issues |
| --------------------------------------------------------------- | ---------------------: |
| child feature not an independent facility                       |                   1153 |
| conditional access or parking rules need review                 |                     15 |
| conflicting locations must not be averaged or silently chosen   |                     10 |
| current operation and visitor rights unconfirmed                |                   5427 |
| customer access conditions need confirmation                    |                    821 |
| mapped restricted or purpose limited access                     |                    625 |
| name suggests possible nonparking or business category mismatch |                      7 |
| no physical verification                                        |                   5427 |
| old source edit requires freshness check not proof of closure   |                   3801 |
| prior owner exclusion preserved                                 |                      2 |
| prior owner site visit required                                 |                      6 |
| proximity or containment does not prove identity                |                     70 |
| public access unknown                                           |                   3845 |
| representative point outside source footprint                   |                    125 |
| shared source identity is not a confirmed physical facility     |                     10 |
| street legality side extent and schedule unconfirmed            |                    515 |
| structural facility subtype not established                     |                   2325 |

The 125 representative points outside their footprints are bbox centers of valid
geometries, not invalid source polygons. They cannot be used as driving entrances.
The seven name/category mismatches are **suspicion flags**, not a finding that the
places do not exist. Age is an object edit-date signal, not proof of closure.
The 625 restricted/purpose-limited flags are broader than the original 541
restricted-access count because delivery/destination/PSV conditions are included.
There is no defensible currently public/usable facility count in this snapshot.

## Facilities and child features

[relationship-review.json](../data/ncr-research/relationship-review.json) analyzes
all **1,668** entrances, bays and street segments. Containment or nearby geometry
proposes a possible parent; no proposal asserts physical ownership. Streets
retain separate legal/side/extent questions. **Zero physical parent relationships
are confirmed.** Bays and entrances do not inflate facility inventory or live
space availability. Generic structural types remain unspecified. Mall/commercial
associations require signs, operator facts or a precise independently supported
match; a mall name or nearby building alone is insufficient.

Online operator facts and sampled source-tag leads are retained in the
[hotspot comparison](ncr-hotspot-comparison.md) and its machine-readable evidence.
They support visits and identity questions, not blanket verification. Every
unresolved record appears in the [fieldwork checklist](ncr-fieldwork.md) or its
complete machine queue. Existing Poblacion exclusions, missing reasons, eight
online corroborations, six visits and three owner navigation references survive.

## Reproduction and acceptance

```powershell
node scripts/ncr-quality-review.mjs data/ncr-research --check
node scripts/ncr-fieldwork.mjs data/ncr-research --check
node scripts/check-ncr-package.mjs data/ncr-research
node --test scripts/ncr-quality-review.test.mjs scripts/ncr-fieldwork.test.mjs
```

The generated catalogs must match their source-derived definitions, preserve
human events on refresh, and reject changed definitions or event hashes. Tests
also cover explicit source identity versus proximity-only matches, child-parent
proposals, source refreshes, navigation links, empty/future/unattested field
submissions and the rule that a submission receipt never grants verification or
publication. Executed final outcomes are recorded in the Phase 1 gate report.
