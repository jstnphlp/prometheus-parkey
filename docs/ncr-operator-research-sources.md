# Parkey NCR operator-owned name sources to investigate

This is a **source prospect list only**, not an imported parking directory, a reuse license, or a verification record. No facility names, rates or operator assertions from these sites have been added to Parkey's research dataset.

| Operator or publisher                 | Official / primary source                                            | Research value                                                                                                                    | Permission status                                                               |
| ------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Ayala Property Management Corporation | https://www.ayalaproperty.com.ph/what-we-manage/estates-and-carparks | Named estate-managed carpark directory with site descriptions; useful for BGC and Makati identity/entrance questions              | Not obtained — ask about structured, commercially reusable naming/entry details |
| UPark Parking Management              | https://www.upark.ph/parking-facility/                               | Operator-maintained facility directory spanning malls, hotels, office buildings and open spaces                                   | Not obtained — seek explicit name/address/data-sharing permission               |
| UPark monthly parking                 | https://www.upark.ph/monthly-parking/                                | Operator-managed parking and location contact opportunities; confirm visitor eligibility and whether service is subscription-only | Not obtained — do not infer public hourly availability                          |
| Metro Parking Management Philippines  | https://metro-parking.com.ph/contact.php                             | Operator outreach for owned/managed inventory, locations and permitted listing data                                               | Not obtained — ask for authorized data/feed or direct entry                     |

## Research completed on 5 November 2026

Read the official directories, linked privacy notices and selected facility detail
pages. The versioned [retrieval and permission register](../data/ncr-enrichment/2026-11-05/operator-research.json)
records request timestamps, final URLs, response hashes, availability and research
limitations. Raw HTML is retained locally under
`output/ncr/operator-2026-11-05/`; it is excluded from the published dataset.

**Result: no commercial database reuse permission was established.** Robots
allowances concern crawling, and privacy notices concern personal information;
neither grants permission to republish a parking directory. Operator research
contributes zero reusable facility-name proposals in this pass. No operator
facility listing was imported, and no operator was contacted.

| Operator      | Findings from inspected official pages                                                                                                                                                                                                                                                                                                                                                                                                                                    | Remaining identity/access question                                                                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APMC          | The estates/carparks page distinguishes property categories and regions and supplies address descriptions. It mixes estates, individual garages and separately named parking sections. The linked privacy notice covers inquiries and personal information; no directory reuse grant was found on these inspected pages.                                                                                                                                                  | Ask for distinct facility identifiers, active section boundaries and vehicle entrances; an estate address or administration office must not become a parking entrance. The page's contact email text and mail link differ, so use its official contact form or confirm the recipient. |
| UPark         | The directory distinguishes open spaces, hotels, hospitals, offices and shopping malls. The monthly service requires application/verification and payment; its FAQ says facility hours differ. Selected detail pages show that one directory article can describe multiple parking sites. The footer reserves copyright, and the linked privacy policy supplies no commercial directory reuse grant.                                                                      | Ask for current site IDs and separate entrances, daily visitor eligibility versus monthly-only eligibility, and confirmation of stale opening/promotion language on the BGC detail page. Avoid merging two sites merely because they share one article.                               |
| Metro Parking | The old `contactus.html` URL returns HTTP 404. The live home page links `contact.php`, `clients.php` and `aboutus.php`. The client list describes partnerships across several property categories; it is not a geocoded list of publicly accessible parking facilities. The contact page separates business development from monthly parking inquiries. No reuse grant was found on the inspected pages; no terms/privacy link was present in their extracted navigation. | Request an authorized inventory and current management scope. A client company or hotel relationship does not establish a particular garage, current visitor access, or authority to grant rights over a client's material.                                                           |

Selected detail references, for permission and identity research only:

- [UPark BGC detail](https://www.upark.ph/parking-facility/open-space/parking-at-bgc-taguig/): opening and promotional language requires current confirmation; neither rates nor current operation were imported.
- [UPark Jade Drive detail](https://www.upark.ph/parking-facility/open-space/parking-in-jade-drive/): multiple sites appear on one page; an exact site-to-OSM match remains unconfirmed.
- [APMC privacy notice](https://www.ayalaproperty.com.ph/data-privacy-notice) and [UPark privacy policy](https://www.upark.ph/privacy-policy/): inspected for scope, not treated as listing licenses.
- [Metro clients](https://metro-parking.com.ph/clients.php) and [current contact page](https://metro-parking.com.ph/contact.php): partnership context and a route to request authorization.

Prepared [operator outreach drafts](ncr-operator-outreach.md) request both data
rights and facility identity/access clarification. They remain unsent and require
the owner's authorization to send.

An additional prospect, `https://www.secureparking.com.ph/`, was checked: the
homepage TLS handshake timed out and its returned robots file disallowed all
crawling. No further crawl was attempted, no official operator identity was
confirmed from page content, and no facility information or reuse rights were
inferred. Its failed retrieval and robots response hash are in the register.

## Agent workflow

1. Read these **primary operator sources** and record the date, publisher and URL. Do not bulk copy names into a permanent commercial database without confirming applicable terms or obtaining operator permission.
2. Match possible operator-owned properties to the `output/ncr/name-leads-*.csv` queue using permitted first-party/OSM geometry. Flag conflicts for human review; do not overwrite source IDs.
3. Draft a simple Parkey partnership inquiry requesting permission to use facility names, public visitor access conditions, rates, hours and entrance coordinates. **Do not send messages or claim permission without explicit human approval.**
4. Record operator replies and authorization scope in a separate evidence ledger. Keep exact dates and expiry/review requirements; do not infer an operator verified all properties.
5. Feed only authorized, attributed, scope-compliant name evidence into a human-approved display workflow. An operator name does not by itself establish booking rights or live vacancy.

Google Maps and Waze links in the research queue remain **manual coordinate inspection tools**, not database sources.
