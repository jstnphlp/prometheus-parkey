# Metro Manila hotspot assessment — preliminary evidence

Research date: **5 November 2026**. Eleven areas were considered: the eight
requested hotspots plus North EDSA, Alabang/Filinvest and Maginhawa. **None is
ranked for launch.** The retrieved sources establish destination context,
operator leads and a specific street-legality risk; they do not establish a
comparable usable-supply gap, willingness to pay or partner commitment.

[The source register](../data/ncr-research/hotspot-source-evidence.json) records
27 attempted public-page reads, actual retrieval timestamps, HTTP outcomes,
redirects, response hashes and the limited fact supported by each. It retains
failures and HTTP-200 pages with no substantive parking text. Raw responses are
local research artifacts under ignored `output/ncr/hotspot-sources/`; they are
not copied into the parking dataset. This report uses attributed factual
summaries, without assuming a general license to reuse site copy, photos, maps
or rate tables. No Google Maps/Places content was scraped or imported, and no
operators were contacted.

## How to interpret the evidence

Once generated, use [city/type/grid coverage](../data/ncr-research/coverage.json)
and [the data-quality report](ncr-evidence-gaps.md) for mapped supply, checking
their input provenance and execution limitations. These paths identify pipeline
deliverables; this assessment does not itself establish that import completed.
A mapped lot,
garage, bay, entrance or street segment is a **source feature**, not necessarily
a distinct physical facility or legally usable space. An empty cell is a
coverage question. OSM and Overture may share upstream sources. Two matching
records are not independent evidence of demand, operation or legal access.

This assessment distinguishes:

- **Supported context:** a directly inspected first-party page or an existing
  preserved research record, with the fact and limitation stated below.
- **Hypothesis to test:** a plausible trip pattern, supply mismatch, partner
  approach or commercial opportunity. It is not an observation or score.
- **Missing evidence:** time-matched usable supply and demand, actual driver
  payment/price sensitivity, authorized partner response and operating costs.

No driver interviews, systematic peak-hour parking observations, current fee
survey or physical site visits were performed. Online contextual research does
not upgrade candidate records to physically verified or publication approved.
[The machine-readable hotspot evidence](../data/ncr-research/hotspot-evidence.json)
contains all eleven areas with empty scoring metrics. Running the existing
evidence-gated scorer should therefore produce no ranked areas, rather than
numeric scores inferred from map density or neighborhood reputation.

## Required hotspots

| Area                                           | Supported context and source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Opportunity hypothesis and partner lead                                                                                                                                                                                           | Main evidence gap / launch constraint                                                                                                                                                                                                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Poblacion, Makati**                          | [Century City Mall's About page](https://www.centurycitymall.com.ph/about/) identifies Poblacion and shopping/dining/leisure uses. Its [2023 promotion](https://www.centurycitymall.com.ph/shopaholic-2023/) historically names mall parking/valet. Existing open-source candidates and owner reviews are preserved separately.                                                                                                                                                                                                                                           | Test evening dining-trip search friction and whether authorized lots have off-peak space. Investigate Century City Mall management and existing named-lot leads; no partner interest inferred.                                    | No current entrance/access/fee confirmation from the mall page; historical parking references do not prove current operation. Legacy online checks remain distinct from the six pending visit tasks in PR #4. Duplicate entrances and street-point geometry need resolution.                                  |
| **BGC, Taguig**                                | [The district developer](https://bgc.com.ph/about-us/) describes mixed office/retail uses. Its dedicated [parking inquiry page](https://bgc.com.ph/contact-us-parking/) is accessible; the guessed `/parking/` page returned 404.                                                                                                                                                                                                                                                                                                                                         | Compare weekday office-arrival and evening retail trips; ask estate/parking management about permitted inventory and existing discovery tools. A central inquiry channel may reduce research coordination effort.                 | No measured search time, capacity, occupancy or willingness to pay obtained. Estate access and individual-facility terms require confirmation. A contact form establishes neither a partnership nor inventory.                                                                                                |
| **Binondo, Manila**                            | First-party location-specific parking evidence was not obtained. The attempted Lucky Chinatown mall site exposed a minimal shell; the corporate URL redirected to a matching path but showed generic navigation. Manila government's Binondo search returned 403; it was not bypassed.                                                                                                                                                                                                                                                                                    | Investigate shopping/errand and delivery-trip patterns, walkable alternatives and small-lot operators. Lucky Chinatown management is an unconfirmed contact lead.                                                                 | Demand, legal loading/parking distinctions, usable supply, current operation and partner authority all need local evidence. Narrow streets or assumed shopping activity cannot justify a scarcity claim. No online parking fact is asserted from the failed pages.                                            |
| **Makati CBD, Makati**                         | [Make It Makati](https://makeitmakati.com/) identifies an Ayala Land estate and work/shopping/event uses. Direct Glorietta/Greenbelt pages returned the same generic application shell, without substantive static parking facts.                                                                                                                                                                                                                                                                                                                                         | Test weekday commuter/meeting trips versus evening/weekend retail demand; approach estate management and licensed independent operators about excess capacity by period.                                                          | No comparable occupancy or search-duration sample, price sensitivity or authorized supply offer. Review the broader NCR candidates independently of older Poblacion-scope rejections; an old out-of-pilot rejection is not evidence of illegal parking.                                                       |
| **Ortigas, Pasig / Mandaluyong / Quezon City** | [SM Megamall's operator page](https://www.smsupermalls.com/mall-directory/sm-megamall/information) identifies the mall in the Ortigas business district at EDSA/Julia Vargas in Mandaluyong.                                                                                                                                                                                                                                                                                                                                                                              | Compare office-arrival and retail/event periods, pedestrian walking cost and cross-estate routing. Investigate mall/estate operators and office visitor parking with authorization.                                               | District naming crosses LGUs; do not assign all Ortigas supply to Pasig or count cross-border features twice. Current public access, parking entrances, office restrictions and inter-facility substitutability are unmeasured.                                                                               |
| **MOA area, Pasay**                            | [SM Mall of Asia's directory](https://www.smsupermalls.com/mall-directory/sm-mall-of-asia/information) identifies Pasay and lists north/south parking buildings among mall locations. The directory supplies a real parking-structure lead.                                                                                                                                                                                                                                                                                                                               | Compare ordinary retail periods with separately identified convention/arena event sessions; investigate operator coordination, walking connections and event change notifications.                                                | No observed event-day spillover, current rates, capacity, usable entrance or partner commitment. Directory floor/building names are not independent lots or live inventory. Large mapped footprints cannot be converted to spaces.                                                                            |
| **Cubao / Araneta City, Quezon City**          | The estate's [parking guide](https://aranetacity.com/parking) names eight parking locations and states weekends, paydays and Coliseum event nights are busy. This is a first-party operational claim, without an independent sample. Its [main site](https://aranetacity.com/) lists retail/entertainment destinations.                                                                                                                                                                                                                                                   | A well-defined operator portfolio is useful for field sampling and a potential estate conversation. Compare normal days with documented events and test whether better entrance/condition information solves a real user problem. | The guide's transient slot figures were not imported or treated as current availability. Check whether its names correspond to one facility/multiple entrances, what existing information already solves, and whether an authorized operator wants integration. Published supply does not prove unmet demand. |
| **Tomas Morato / Timog, Quezon City**          | Official QC notices identify a tourism district under [SP-2946 S-2020](https://quezoncity.gov.ph/public-notice/sp-2946-s-2020-an-ordinance-declaring-the-tomas-morato-timog-avenue-area-also-known-as-the-lifesytle-district-as-tourism-district-of-quezon-city/) and a Sunday vehicular-closure measure under [SP-3345 S-2024](https://quezoncity.gov.ph/public-notice/sp-3345-s-2024-an-ordinance-declaring-sunday-car-free-carefree-tomas-morato-by-regulating-the-use-and-closing-a-portion-of-tomas-morato-from-scout-rallos-to-don-a-roces-avenue-to-vehicular-t/). | Test evening dining/visit trips and off-street operator participation; consult city/barangay traffic authorities about applicable street rules before any curb-parking proposal.                                                  | The closure notice names Scout Rallos to Don A. Roces Avenue. Only the official notice/title was reviewed, not full ordinance text, current hours/exceptions or implementation. Mapped street tags cannot establish Sunday parking rights. Demand and willingness to pay remain unknown.                      |

The eight areas are a research shortlist, not a statement that parking is scarce,
expensive, legally accessible or commercially attractive there. Land use is a
trip-purpose proxy, not proof that visitors arrive by private car. Operator
marketing statements require independent corroboration before demand scoring.

## Additional areas worth investigating

| Area                                     | Evidence supporting further investigation                                                                                                                                                                                                                                                                                        | Hypothesis / potential partner                                                                                                                                                                                    | What would make it actionable                                                                                                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **North EDSA, Quezon City**              | [SM City North EDSA's operator directory](https://www.smsupermalls.com/mall-directory/sm-city-north-edsa/information) supplies a concrete destination/management lead. TriNoma's retrieved page supplied no static parking evidence.                                                                                             | Compare ordinary mall and commuting/transfer-related visits; investigate mall management and nearby authorized facilities. Treat the transfer pattern as a question to ask, not observed parking demand.          | Time-matched observations, driver trip-purpose/price interviews, entrance/access checks and operator response. Avoid counting mall floors, entrances and nearby source points as separate facilities. |
| **Alabang / Filinvest City, Muntinlupa** | [Filinvest City's official site](https://filinvestcity.com/) identifies the Alabang business district and Muntinlupa office address. Festival Mall's attempted page failed TLS closure; no parking facts were obtained from it.                                                                                                  | Compare office and retail periods as a southern-NCR contrast to the central hotspots. Investigate estate and mall management if public access and usable inventory can be established.                            | Current supply/occupancy, walking/access conditions, driver price sensitivity and authorized partner terms. No demand claim follows from the estate's CBD description.                                |
| **Maginhawa, Quezon City**               | The city's [SP-2559 S-2017 notice](https://quezoncity.gov.ph/public-notice/sp-2559-s-2017-an-ordinance-amending-ordinance-no-sp-2439-s-2015-declaring-maginhawa-street-and-its-adjacent-streets-as-a-tourism-district-of-quezon-city-to-be-known-as-the-maginhawa-art-and-food/) concerns the Art and Food Hub tourism district. | A comparison area for small dining operators and shared off-street supply, subject to lawful access and resident impacts. Investigate business associations, city/barangay authorities and authorized lot owners. | Current rules/signs, block-level street audit, peak-period trip/parking observations and willing operators. Tourism-district designation establishes neither legal parking nor a supply gap.          |

These additions broaden the learning sample geographically and by operating
model. They have not outscored the original eight. Other NCR LGUs remain covered
by source research even when no hotspot is proposed here; limited contextual
research must not become a claim that they lack opportunity.

## Commercial questions and evidence required

| Dimension          | Evidence available in this pass                                                     | Next evidence needed before scoring                                                                                                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parking demand     | Destination/land-use context; Araneta operator's qualitative busy-period statement. | Dated observations of arrivals, search/queue/refusal intervals, event context, recruited-driver trip purposes and uncertainty. Destination popularity alone is insufficient.                                                                   |
| Usable supply gap  | Source-feature coverage and duplicate/access flags in the NCR report.               | De-duplicated physical facilities, permitted capacity and legal access, with occupancy measured in the same area and periods as demand. A zero-mapped grid cell is not zero supply.                                                            |
| Willingness to pay | None measured. This research did not validate current rate cards.                   | Separate actual paid trip amounts from stated price tolerance; compare clearly described product/price scenarios and alternatives. Even an official posted parking rate would be an offered price, not proof of willingness to pay for Parkey. |
| Partner potential  | Published mall/estate identities and BGC's parking inquiry channel.                 | Dated response from an authorized representative, authority to offer inventory, conditions, integration needs and actual interest. An operator name or contact form does not satisfy this metric.                                              |
| Launch feasibility | Known source/geometry/access gaps; explicit Tomas Morato temporal-closure risk.     | Reviewed legal/access/licensing status, confirmed entrances, support and change procedures, partner terms, operational costs, safety and approved display scope.                                                                               |

The existing scorer requires all five scored metrics with dated references and
confidence at least 0.6. Do not assign low-confidence numbers simply to fill the
file. A researcher should document how each metric is derived, its sample size,
counterevidence and limits, then request review before calling an area rankable.
The same five metrics apply to all areas; comparison periods and study boundaries
must be declared before looking for a preferred winner.

Ortigas is currently labeled Pasig only to satisfy the existing scorer's
single-LGU area field. That label does not define its study boundary or exclude
Mandaluyong/Quezon City. Before scoring, use explicit reviewed subareas or extend
the scorer to a multi-LGU contract with regression tests; do not silently use a
city-wide supply total as a neighborhood measure.

## Next actions

Use [the Phase 1F/G specification](ncr-phase-1fg-plan.md) for concrete map contracts,
display warnings, moderation gates, field samples, driver/operator interview
questions and exit criteria. The proposed first field wave favors retained
Poblacion requests and areas with usable operator/legal research leads. It is a
research logistics choice, not a commercial ranking. Complete the other required
hotspots before making comparative launch claims.

Keep the original Poblacion human decisions and PR #4 navigation references in
[the preservation manifest](../data/ncr-research/poblacion-preservation.json).
Those references are owner-supplied navigation aids, never licensed parking
coordinates, verified entrances or permission to park. No physical visit,
operator commitment, public listing approval or guaranteed usable parking is
claimed by this assessment.
