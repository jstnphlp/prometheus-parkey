# NCR licensing and publication controls

Reviewed 5 November 2026 against the frozen PR #13 research snapshot. **No NCR
candidate has public app approval.** Source availability, license declarations,
online corroboration, operator confirmation, physical evidence and permission to
publish are independent facts. An agent does not clear outstanding legal or
commercial questions by implementing these controls.

## Actual source and notice evidence

| Source                                                          | Evidence retained                                                                                                                                   | Technical disposition                                                                                                                                                                                                                      |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OpenStreetMap / Geofabrik, including the 17 municipal relations | Source IDs/tags, original geometry, dated source and SHA-256; ODbL 1.0 agreement and attribution notice                                             | Retain © OpenStreetMap contributors and copyright/license link. The research derivative database and rights offer remain available with the source archives. Current visitor rights and legal boundary authority are not supplied by ODbL. |
| Overture Places release `2026-10-21.0`                          | Original provider/license/update-time arrays and source snapshot; CDLA-Permissive-2.0 and Apache-2.0 texts                                          | Provider terms stay attached per record. The frozen extract declares Meta/Microsoft/Overture CDLA and Foursquare Apache. Missing or unrecognized licenses fail the public gate even when another provider has a known license.             |
| Foursquare                                                      | Official NOTICE retrieved HTTP 200 from the URL linked by Overture's official attribution page; visible notice wording and provenance/hash retained | The previous missing-notice retrieval blocker is resolved. Preserve the full notice and Apache license and carry Parkey's modification notice. This does not resolve every legal question about combining or publishing the database.      |
| Historical geoBoundaries ADM3                                   | NAMRIA/PSA/OCHA attribution, 2020 caveat, source IDs/hash and CC BY 3.0 IGO text                                                                    | Retained comparison evidence. Current primary city counts use dated OSM municipal polygons, not an assertion of official current legal boundaries.                                                                                         |

Sources consulted directly, with HTTP results, retrieval times and document hashes
in [guidance-evidence.json](../data/ncr-research/licenses/guidance-evidence.json):

- [Overture attribution and licensing](https://docs.overturemaps.org/attribution/).
- [Overture Places guide](https://docs.overturemaps.org/guides/places/), which
  expressly notes that joining CDLA data to OSM is permitted but may create a
  derivative database subject to ODbL.
- [OSMF attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines).
- [OSMF legal FAQ](https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ).
- [Official Foursquare OS Places NOTICE](https://opensource.foursquare.com/places-notice-txt/).

The Foursquare page is HTML. Its full visible main notice text was retained with
HTML entities decoded and paragraph whitespace normalized; its wording was not
rewritten. CSS, scripts and global website navigation are not part of the notice.
[foursquare-notice-source.json](../data/ncr-research/licenses/foursquare-notice-source.json)
records the source HTML and retained text hashes. Parkey's changes are described
separately in [PARKEY-MODIFICATIONS.txt](../data/ncr-research/licenses/PARKEY-MODIFICATIONS.txt).
No hypothetical copyright statement or unavailable upstream file was invented.

## Publication policy implemented

The frozen input's `publicationApproved` or `verification` values cannot authorize
API output. A separate [publication-ledger.json](../data/ncr-research/publication-ledger.json)
contains **zero approval events**. Its append-only hash chain validates reviewer,
timestamp, evidence references, reason, source-record hash and field scope. The
append helper requires an explicit accountable-human authorization context;
there is no HTTP approval or write endpoint. The local service reloads ledgers
for every request rather than retaining stale approval decisions.

An approval must cover name, geometry, source, evidence and access, explicitly
record license/access/safety decisions, and set a review deadline within 90 days.
It is bound to the exact source record: any source revision invalidates it.
Expiry, rejection and revocation block output before pagination and clustering.
Changing the client query, source booleans or preview flag cannot override it.
Changing review state changes the cursor/data version; stale cursors fail closed.

Hard exclusions apply even to an otherwise valid synthetic approval:

- Private, prohibited, permit/resident/emergency/delivery/destination/designated
  or customer-only access; restricted flags; closed, disused or construction
  status; unsafe/prohibited or prior human exclusion flags.
- Missing or unknown source/provider licenses, and unresolved blocking issues
  from the [research review ledger](../data/ncr-research/review-ledger.json).
- Street segments pending legal/time/side review and child entrances/bays that
  have not been linked to an independently reviewed facility. These may be
  investigated privately but are not independent public parking results.

The source-level conservative exclusions must be corrected through reviewed,
traceable evidence before reconsideration. A warning does not make a known
restricted place publicly usable. The implementation does not reinterpret a
field submission or automatic identity match as a publication decision.

`record_evidence` audit events distinguish online, operator and physical facts.
They do not approve publication or undo a rejection/revocation. Historical field
evidence is not a guarantee of present availability; public display still needs
current approval. All actual records remain physically unverified. Prices,
hours, capacity and vacancy stay null, and navigation is disabled for all NCR
source anchors, including features tagged as entrances.

## Executable API and private preview

Run locally from the repository root:

```powershell
node scripts/ncr-preview-server.mjs --development-preview --port 8090
```

The service verifies the research gzip against its manifest and listens only on
127.0.0.1. No Supabase resource, production database or deployment is involved;
NCR records are not copied into the existing public discovery tables. Existing
Poblacion pilot and its SELECT-only published-record API remain unchanged.

`GET /api/ncr/discovery` is the approved projection. The actual snapshot returns
zero records and zero clusters. `GET /api/ncr/research-preview` is separate:
explicit CLI opt-in, non-production runtime, loopback client/Host, permitted
loopback HTTP Origin and `X-Parkey-Research-Preview: local-development` are
required. This header is an explicit local mode selector, not a production
authentication mechanism; the local preview must not be reverse-proxied or
exposed as a public service. No private review notes are projected.

Both routes accept one each of `bbox=west,south,east,north`, `zoom`, optional
`category`, `limit` and opaque `cursor`. Bounds must intersect NCR and be at most
0.6 by 0.7 degrees; detail limits are 1–500. At zoom below 14 the response contains
clusters, distinguishing source observations from facility groups and excluding
bays/entrances from facility counts. At higher zoom it returns capped original
source geometries, separate feature types and explicit continuation/truncation.
Geometry intersection retains crossing streets and respects polygon holes.
All responses use `Cache-Control: no-store` and reject unsupported query fields.

The type-only response contract is in packages/shared-types/src/ncr-discovery.ts.
It preserves nulls and separates evidence/access from approval. It never calls a
polygon representative point a confirmed driving entrance. Mobile code fetches
the local development API; raw research archives are not bundled in the app.

## Remaining accountable human/legal decisions

1. Confirm the derivative-versus-collective database analysis and appropriate
   ODbL rights offer for the exact planned public product/API and data export.
   Source lineage and the original provider copyrights must remain distinguishable.
2. Review proposed display scope/fields, visible attribution, retained NOTICE,
   modification notice and corresponding database availability in the actual
   release artifact. Current official notice text may evolve; refreshes need
   dated source-specific review rather than treating today's retrieval as a
   permanent waiver of provider obligations.
3. Confirm site access/operation, streets, entrances and time restrictions using
   accountable evidence. Municipality polygons are community mapping, not legal
   rulings on disputed boundaries or local jurisdiction.
4. Resolve blocking data issues, choose the hotspot and authorize any publication,
   deployment, operator outreach or merge separately. No approval is supplied by
   this report, local preview, test fixture or generated research review entry.

## Executed verification

`node --test scripts/ncr-publication.test.mjs scripts/ncr-preview-server.test.mjs`
tests approval expiry/revision/revocation, hard source restrictions, separate
evidence states, hash-chain tampering, actual frozen-data denial, HTTP Origin/Host
and mode guards, bounded paging/clusters, role separation and unknown-value
preservation. Targeted ESLint, shared-types typecheck and the frozen archive
reproduction checker also pass. The final Phase 1 gate report records aggregate
run results; tests establish software behavior, not legal or physical approval.

## Foursquare NOTICE for API consumers

The following is the full retained visible notice text, also provided as a
standalone [Foursquare-NOTICE.txt](../data/ncr-research/licenses/Foursquare-NOTICE.txt).
Retain it with the Apache agreement and Parkey modification notice when
redistributing the applicable data or API documentation.

```text
Foursquare OS Places Notice

© 2026 Foursquare Labs, Inc. All rights reserved.

The Foursquare OS Places dataset (the “Data”) is licensed under the Apache License, Version 2.0 (the “License”). You may not use, modify, or distribute the Data except in compliance with the License.

As set forth more fully in the License, if you use, modify, or distribute the Data, you must:

– provide recipients with a copy of the License.

– if applicable, include prominent notices to the extent you’ve changed the Data.

– preserve attribution to Foursquare, including preserving the full content of this NOTICE.txt file.

To ensure appropriate attribution to Foursquare, we recommend the following:

– if using/distributing the Data in flat file form as-is or after making changes/modifications: include this NOTICE.txt file, which may be modified to include an additional notice of your changes/modifications, if any.

– if using/distributing the Data in API form as-is or after making changes/modifications: include a copy of the content from this NOTICE.txt file prominently in your developer documentation for such API, which may be modified to include an additional notice of your changes/modifications, if any.

You may obtain a copy of the License at: http://www.apache.org/licenses/LICENSE-2.0. Unless required by applicable law or agreed to in writing, the Data distributed under the License is distributed on an “AS IS” BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

See the License for the specific language governing permissions and limitations under the License.

We also encourage you to join our Placemaker community where you can contribute and provide suggestions to improve the accuracy of the Data for future releases for yourself and others.
```
