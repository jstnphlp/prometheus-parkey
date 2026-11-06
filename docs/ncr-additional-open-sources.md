# Additional open-source name audit — 5 November 2026

This completed audit produced **zero additional credible facility-name proposals**.
Its [versioned provenance report](../data/ncr-enrichment/2026-11-05/additional-open-sources.json)
records the exact query, request times, final URLs and SHA-256 response hashes.
Raw responses remain in ignored `output/ncr/additional-open-sources-2026-11-05/`.
No facility names were imported and no publication was approved.

## Wikidata

The [official licensing policy](https://www.wikidata.org/wiki/Wikidata:Licensing)
confirms CC0 for structured entity data. Policy prose has a separate license.
Official search and entity APIs confirmed **Q6501349 = parking area** and
**Q13218805 = parking garage**.

A successful [Wikidata Query Service](https://query.wikidata.org/) request selected
actual instances of those parking classes or their subclasses with coordinates
inside the NCR study bounding box, `120.85,14.30,121.27,14.86`. It returned **zero
rows**. Consequently there were no coordinates to filter against the exact NCR
boundary or match to frozen Parkey facility groups. The report includes the full
reproducible SPARQL query and response hash.

This result describes that class-and-coordinate query, not every possible
Wikidata record or real parking facility. Nearby buildings were not used as
parking identities.

## Foursquare Open Source Places

Read the [official project page](https://opensource.foursquare.com/os-places/),
[NOTICE](https://opensource.foursquare.com/places-notice-txt/),
[access documentation](https://docs.foursquare.com/data-products/docs/access-fsq-os-places),
[schema](https://docs.foursquare.com/data-products/docs/places-os-data-schema) and
[release notes](https://docs.foursquare.com/data-products/docs/fsq-os-places-release-notes).
The latest release documented on the inspected release page is **October 2026**;
an exact release day was not established.

The official linked Hugging Face repository metadata pins its latest configuration
to **15 October 2026**, at revision `49cfbe9515c0756f09143dd1e1fa48929cc5c14b`.

The dataset is licensed under **Apache 2.0**. Reuse requires the license copy,
preserved Foursquare attribution and full NOTICE content, and applicable change
notices. This permission applies to the designated open dataset, not every
Foursquare service or commercial API.

Current access documentation says delivery moved from the legacy public S3
bucket to a Places Portal Iceberg catalog using an account and generated access
token. The official alternatives were also tested anonymously:

- The linked `foursquare/fsq-os-places` Hugging Face metadata is readable, but
  marks the dataset `gated=auto`. Its access prompt asks the requester to represent
  their organization and allow use of its name/logo in partner marketing. Those
  terms were not accepted. Anonymous README, dataset-viewer splits and parquet
  discovery requests returned **HTTP 401**.
- An actual bounded dataset-viewer filter request selected country `PH` and the
  NCR coordinate bounding box, capped at 100 rows. It returned **HTTP 500** with
  no records; no successful result set or parking classification was obtained.
- A bounded HTTP Range probe of the exact PMTiles key documented by Foursquare,
  `s3://fsq-os-places-us-east-1/release/vector-tiles/latest/fsq-os-places.pmtiles`,
  returned **HTTP 404 / NoSuchKey**. The error body and response headers are
  archived and hashed.

No account, token or purchase was created, no gated terms were accepted, and no
restricted download was attempted. **No record-level NCR Foursquare result set
was obtained**, so these are concrete access/query failures, not a claim of zero
NCR parking coverage. The report preserves each attempted URL and outcome.

Any future extract must preserve stable `fsq_place_id`, release/hash, license and
NOTICE; check closed/private/duplicate and other unresolved flags before identity
review. Foursquare data may already underlie Overture records, so matching names
or source IDs would not establish independent corroboration. No names, coordinates,
hours or access assertions from Foursquare were added in this pass.
