# Parking source and mobile trust audit

Reference time: **2026-11-03T00:00:00Z**. Scope: the checked-in
`apps/mobile/src/discovery/osm-pilot.json`, its extraction path, discovery
presentation, source-photo resolution and existing database provenance boundary.
This is a repository audit, not a survey of physical parking or a legal
assessment of any street. No production database was queried or modified.

## Exact baseline and resulting dataset

The original snapshot remains unchanged by this work. These are before and after
metrics for the distributed discovery dataset; research candidates and the review
queue are separate artifacts and do not increase discovery coverage.

| Metric                                                       |        Before |         After |
| ------------------------------------------------------------ | ------------: | ------------: |
| Records                                                      |            43 |            43 |
| Lots / garages / street segments                             |    35 / 2 / 6 |    35 / 2 / 6 |
| Independently field verified                                 |             0 |             0 |
| Missing address                                              |            35 |            35 |
| Missing fees                                                 |            41 |            41 |
| Missing hours                                                |            43 |            43 |
| Unnamed records                                              |            24 |            24 |
| Facilities without mapped entrances                          |      36 of 37 |      36 of 37 |
| Missing source URL / license / snapshot date / OSM edit date | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Missing OSM `check_date`                                     |            43 |            43 |
| OSM edits older than 365 days                                |            34 |            34 |
| OSM edits older than 730 days                                |            25 |            25 |
| Import snapshots older than 30 days                          |             0 |             0 |
| Private / customers / unknown access                         |    3 / 7 / 33 |    3 / 7 / 33 |
| Duplicate source identities / exact geometries               |         0 / 0 |         0 / 0 |
| Facility pairs less than 30 m apart                          |             0 |             0 |

Both recorded fees say **Fee applies; amount unavailable**. Neither record
establishes an actual price. No record establishes free parking or a current
schedule. The one mapped entrance belongs explicitly to `osm:way/29005200`;
there are no inferred nearby entrance associations.

All records carry snapshot time `2026-11-02T03:15:22.149242+00:00`, about
20.74 hours before the audit reference time. OSM edits range from
`2013-02-03T00:33:12Z` to `2026-10-29T11:29:11Z`. An object edit can concern
any tag or geometry; it does not prove that parking facts were observed then.
A new import does not refresh the age of those facts.

## Geographic coverage and duplicate risks

The extraction rectangle is longitude **121.024 to 121.041**, latitude
**14.558 to 14.572**, around Poblacion and adjacent Makati neighborhoods. It is
not an administrative boundary and does not establish complete coverage of
Poblacion. OSM mapping completeness is unknown.

| Geometry group                    |         West |      South |          East |              North |
| --------------------------------- | -----------: | ---------: | ------------: | -----------------: |
| 35 lot points                     | 121.02416465 | 14.5586352 | 121.039644875 | 14.570941499999998 |
| 2 garage points                   |  121.0253195 | 14.5591531 |  121.02654994 |         14.5606658 |
| 48 vertices across 6 street lines |  121.0225241 | 14.5597466 |   121.0303241 |         14.5620495 |

Five street vertices extend west of the rectangle: two on
`osm:way/1067286270` (L. P. Leviste Street) and three on `osm:way/97081380`
(Tordesillas Street). These lines intersect the pilot; preserving their full
source extent avoids inventing a clipped street or changing left/right
semantics. Every facility point is inside the rectangle. A facility polygon's
representative point is not guaranteed to lie at the entrance, or even inside a
concave source polygon. Missing multipolygon assembly and street-side point
exclusion are documented coverage limitations.

The closest facility pair is `osm:node/11801472766` and `osm:node/7082724750`,
about **39.16 m** apart by great-circle distance. Proximity does not establish
a duplicate. Three lots are named Metro Parking:
`osm:way/35024619`, `osm:way/35024629`, and `osm:way/35462242`; the first two
are about **51.62 m** apart. Keep all three pending operator/site review rather
than merging by brand. The two Jupiter Street lines, `osm:way/4083253` and
`osm:way/699945508`, share an endpoint and describe adjacent source segments.
They are not duplicate records. Facility footprints are lost during conversion
to points, so node-in-polygon and overlapping-footprint duplicates cannot be
ruled out from this artifact alone.

## Access and legal uncertainty

The three explicitly private facilities are:

- `osm:node/11795001390`
- `osm:node/11801472766`
- `osm:node/13112369052`

The seven customers-only facilities are:

- `osm:node/7078132566` (ALCO)
- `osm:way/1312266974`
- `osm:way/208167717`
- `osm:way/309392252`
- `osm:way/35166298` (L. P. Leviste Street parking)
- `osm:way/406692390` (New Solid Building Parking Area)
- `osm:way/700795623`

Four of the six street records include **Road ownership recorded by
OpenStreetMap: private**. Two include a recorded left-side disc restriction and
three-hour maximum stay; one includes `Mo-Sa 07:00-17:00` source restriction
times. These are source assertions, not authoritative permission or current
municipal rules. Road ownership must not be interpreted as parking access.
Thirty-three records have no access assertion; unknown does not mean public.
Keep these flags visible to reviewers. Human review should consult posted signs,
operators, and current local rules, with separate dated evidence for fees,
hours, entrance vehicle suitability, and legal restrictions.

The pre-existing documentation said the extractor excludes private facilities,
while its implementation and snapshot retain three. This mismatch must be
corrected in the ingestion documentation; preserving the snapshot does not
approve these facilities for public parking.

## Mobile changes and checks

The detail preview now states field verification status and absence of live
availability. It explains whether directions use a mapped entrance, facility
point, or approximate point along a street. Source details distinguish the
snapshot import from the OSM edit date, link to the actual source object, and
flag a source snapshot older than 30 days or an OSM edit older than a year.
These age thresholds are editorial review prompts, not real-world verification
or expiry rules. Source dates do not confirm current fees, hours or access.

The fee badge no longer combines a recorded no-fee assertion and a parsed
schedule into the unsupported phrase **Free now**. Detail and status no-fee labels now
say **Recorded no fee**, with a posted-sign caveat in the detail row. Unknown fee/hour states stay
unknown. Corrections and photo additions explicitly save private drafts on the
device; nothing is sent for review or published.

Targeted regression tests cover import/edit/verification separation, missing and
stale dates, and the distinct routing claims of points, entrances and street
extents. No browser, native emulator, physical-device flow or live provider was
verified by this audit. The parent change report records actual commands run.

## Attribution, privacy and production review gates

- The OSM snapshot is an ODbL-derived database. Retain OpenStreetMap contributor
  attribution, source-object URLs, ODbL notice and access to the distributed
  derived data. App, exported JSON, generated SQL, and candidate research must
  retain their provenance. Legal review must establish the appropriate
  attribution, database offer/share-alike and mixed-source distribution process;
  this audit does not certify legal compliance.
- Research based on a public webpage is not a blanket license to copy that
  site's database, photos, or descriptions. Keep minimal factual evidence and
  links, record source terms where known, and require rights review before reuse.
  Do not import proprietary map listings without permission.
- The source-photo resolver accepts an OSM `image` URL before checking reusable
  licensing metadata; an OSM tag is not itself an image license. Its optional
  Mapillary fallback ranks street photos within 40 m using view direction and
  age, which does not prove the photo depicts the facility. These are existing
  production release risks requiring explicit media rights/location review.
  Current bundled records have no approved photo catalog evidence.
- Photo, map, search and routing providers receive network connection metadata.
  Search/routing disclosures exist; optional provider/photo requests should be
  checked against the final privacy notice. Never move private correction
  photos, contact information, or moderator notes into public provenance.
- The public discovery RPC returns verification status/date but currently omits
  the database `verification_url`. There are zero verified records today. Before
  publishing any verified record, expose its public evidence through a reviewed
  contract and ensure the mobile UI can inspect it.
- Discovery RLS remains SELECT-only for public clients, and trusted imports must
  not grant mobile writes, automatically verify research candidates, or overwrite
  human decisions. No production migration or hosted publication is authorized
  by this branch.
