# Contribution submissions design

Update 2026-11-10: the owner selected verified-email, text-only mobile reports.
The [staged implementation and deployment gates](V1_MOBILE_REPORT_SUBMISSIONS.md)
describe that path. The anonymous challenge/media proposal below remains future
work; it does not enable uploads. Existing drafts remain local until explicit send.

Status: proposal for a later implementation. This document creates no endpoint,
migration, storage bucket, hosted resource or mobile submission behavior. The app
continues to save contributions on the device only. Server reads do not enable
uploads, and existing drafts must never be uploaded automatically.

## Existing boundary

The [database access boundary](database.md#access-and-submission-boundary) remains
the starting point. Anonymous and authenticated clients can read published
discovery data but cannot mutate it. `parkey_private.community_reports` has RLS,
no client policies or grants, and no client schema access. Legacy reservation
tables remain outside this work.

The existing private report table already enforces:

- `add` or `correction` intent; additions have no target, while corrections have
  exactly one published-record UUID or supported OSM source URL and a correction
  description.
- A 3–100-character name, optional nonempty text fields of at most 500 characters,
  known parking kinds and street-side values.
- Valid, nonempty, two-dimensional WGS84 geometry with bounded coordinates.
  Facilities are points with unknown side; streets are lines 5 m–1 km long.
  The database geometry helper permits 2–500 line points; the proposed mobile API
  below intentionally accepts only the existing editor's 2–12 points.
- A private photo path, pending/accepted/rejected review states, and review dates
  consistent with creation time. It does not implement abuse protection, upload
  authorization, idempotency or moderation tooling.

## Trusted endpoint and proposed contract

Add a trusted HTTPS submission endpoint, potentially a Supabase Edge Function,
with an explicitly anonymous, challenge-protected submission contract. Discovery
must remain usable without an account. A publishable key, installed app or client
cooldown is not proof of authorization or successful challenge verification.
Execution location and media-decoding support need confirmation before coding.

Keep privileged database and storage credentials server-side. Prefer a dedicated
role limited to the required private operations; any unavoidable broader server
credential requires isolation and review. Do not grant clients direct report
inserts, storage access or a public security-definer write function. Moderator
authorization is separate from this anonymous submission capability.

Proposed API version 1 uses two bounded steps so challenge and rate checks happen
before accepting a photo:

1. `POST /v1/contribution-submissions/prepare`: small JSON containing report
   metadata, optional photo byte count/MIME/SHA-256 declaration, a fresh challenge
   token, disclosure version and a random idempotency key with at least 128 bits
   of entropy. Validate and reserve a durable submission intent. Return an opaque,
   signed, short-lived submission ticket scoped to that intent, API version,
   canonical payload digest and photo limits. This is a submission capability,
   not a login token or permission to read other reports.
2. `POST /v1/contribution-submissions/finalize`: present the ticket and the exact
   metadata and optional photo. Validate ticket, quotas, actual payload digest and
   media before committing one private `pending_review` report. Return a minimal
   receipt acknowledging receipt for review, never publication or verification.

The ticket does not expose database credentials, a public object URL, an arbitrary
storage path or an unrestricted signed upload. Photo bytes go through trusted
bounded ingestion. Do not accept remote photo URLs or fetch submitted evidence
links. Storage object keys are generated on the server.

Proposed responses are `202` for a completed submission, the same stored response
for its successful replay, `409` for changed content under the same idempotency
key or an operation still in progress, `410` for an expired ticket, `413` for size
limits, `415` for unsupported media, `422` for field validation, `429` with
`Retry-After` for limits, and a generic `503` for unavailable prerequisites. Do not
return SQL errors, challenge-provider responses, private evidence or other
submitters' existence. A receipt grants no general report-list/read access.

## Server validation

Treat every field as untrusted, including fields already validated by the app.
Use strict object schemas with bounded nesting, arrays and strings, rejecting
unknown fields. Normalize blank optional text to null and trim names. Reject
invalid Unicode/control characters; store plain text and escape it when displayed.

- Accept only supported intents, kinds and sides. Enforce the existing table
  constraints again at the endpoint, with 2–12 street points. Validate finite
  longitude/latitude numbers in GeoJSON order, two dimensions, allowed bounds,
  distinct points and geography length. Recheck geometry in PostGIS within the
  final transaction; client geometry is not trusted evidence of parking legality.
- For corrections, resolve a UUID against visible published discovery records or
  accept only the existing exact HTTPS OSM node/way/relation URL form. Require
  exactly one target and a nonempty correction description. Do not interpret a
  bundled `osm:way/...` ID as a UUID. Recheck target state at commit; missing or
  changed targets require correction rather than silently becoming additions.
- Require an explicit finite, nonfuture observation date when hours, fees or
  restrictions are claimed. Add private fields for that date and any source
  description through a reviewed migration; the current local draft contract does
  not contain them. Dates and statements remain contributor claims, not verified
  facts. Never fill unknown fees/hours from guesses.
- Never accept client-selected report status, reviewer, verification, publication,
  source ownership, storage path or server timestamps. Prevent mass assignment.
  Public provenance and evidence requirements must also pass when a moderator
  later proposes publication.

## Challenge verification and durable limits

Cloudflare Turnstile is a proposed challenge provider, subject to native-app
integration and accessibility validation. Confirm its current supported flow
before implementation. A public site key can be bundled; its verification secret
must exist only on the server. Verify success, expected app/web origin and action,
expiry and replay protection against the provider on the server. Bind successful
verification to one prepared submission intent. Fail closed on provider failure,
timeout, invalid origin/action or reused token; never ship a production bypass.
Do not retain raw challenge tokens or provider response bodies.

Apply ingress limits before parsing, a durable network-attempt limit before
challenge calls, and new-submission limits after successful verification. Apply
separate finalize, byte, outstanding-ticket and concurrency limits before reading
large bodies. Requests without a trustworthy `Content-Length` still need a strict
streaming byte cap. Proxy IP headers are trusted only from the configured ingress;
clients cannot choose their limiter identity.

Use shared transactional storage for counters and reservations across all endpoint
instances, with atomic increment/check/expiry. Local memory and mobile cooldowns
cannot enforce these limits. Proposed initial budgets are 10 prepare attempts per
10 minutes and 5 new reports per hour/20 per day per network, plus one photo per
intent and 3 finalize attempts per ticket. These are launch-review proposals,
not existing settings. Load tests must establish global byte/concurrency ceilings
and legitimate-user recovery, especially for users sharing a network.

Identify a network only through a keyed HMAC of the server-observed address,
retained briefly. Keep HMAC keys server-side and rotate them; consult active and
previous key epochs when evaluating rolling windows so rotation cannot reset a
limit. Do not store raw IPs in application tables/logs, fingerprint devices or add
an account requirement. Document any infrastructure IP logging and its separate
retention. Return generic retry guidance; fail closed if durable limits cannot be
checked. Expensive rejected/replayed requests still count toward transport budgets.

## Idempotency, replay and commit boundaries

Create a private intent/idempotency table with a unique scoped key hash, canonical
payload digest, ticket expiry, processing lease/owner, report reference and stored
receipt. Scope keys to API version and operation; do not use source parking IDs as
idempotency keys. Treat keys and tickets as private capabilities and exclude them
from analytics, URLs and logs.

The canonical digest covers normalized accepted metadata, observation date,
disclosure version and declared original photo digest, with an explicit canonical
serialization version. Challenge tokens and rotating tickets are not part of the
digest. Recompute the actual photo digest during bounded ingestion and reject a
mismatch. Client hashes are declarations until verified.

- Atomically reserve/check the key and new-report quota at preparation. A fresh
  challenge is required for a preparation retry; challenge tokens are single-use.
  An existing key with the same digest returns the existing state/ticket or stored
  receipt without reserving another report quota. A different digest returns
  `409`. Never overwrite the original request under that key.
- Finalization acquires a bounded lease using an atomic conditional update. Only
  its owner may finalize; concurrent requests cannot both commit. A completed
  intent returns the stored response without creating another report or object.
  An expired lease permits controlled recovery, with ownership checked again in
  the final transaction. Retry count/byte limits still apply.
- Stage a validated/re-encoded image in private storage under a generated key
  owned by the intent. In one database transaction, lock/recheck the intent,
  target, quota reservation and ticket, insert the report, and mark the intent
  complete with its receipt. Database constraints remain the last validation
  boundary. No-photo submissions follow the same idempotency transaction.
- Object storage is not part of the database transaction. If storage succeeds and
  the transaction fails, retain a tracked orphan for reconciliation/deletion,
  never a public object. If storage fails, do not create a report pointing at a
  missing photo. Crash recovery must inspect actual intent/report/object ownership
  before retrying or deleting; completed reports must not lose their evidence.

Proposed tickets expire after 24 hours and completion receipts/idempotency records
after 7 days. Signed expiry remains enforceable after intent cleanup: replaying an
old finalize ticket returns `410`, even when its row has been deleted. New explicit
preparation after expiry requires a fresh challenge and quota reservation; it does
not resurrect the old ticket. Report content similarity can flag review duplicates,
but must not silently merge independent contributors' reports.

## Photos and private storage

Proposed limits: 16 KiB accepted metadata, one original photo of at most 8 MiB,
bounded multipart overhead and at most 12 megapixels decoded. Reject oversized
bodies at ingress and while streaming, including chunked requests; a header or
picker-provided file size is insufficient. Decoder CPU/memory/time limits must
fit the selected runtime before enabling images.

Allow JPEG and PNG only initially. Check extension/declaration, content signatures
and successful full decoding; claimed MIME alone is insufficient. Reject SVG,
animated images, malformed/polyglot content, decompression bombs and unsupported
formats. Re-encode to a bounded safe image, removing EXIF/GPS, thumbnails and other
metadata; revalidate output size/dimensions. Drop the original after processing.
Do not pass filenames or arbitrary EXIF data to logs or public records.

Use a private evidence bucket with no anonymous/authenticated listing, reading,
writing, replacement or delete permissions. Upload tickets authorize only trusted
ingestion for one intent. Moderator evidence access requires an authenticated,
authorized server check; if temporary signed reads are needed, issue them only
after that check with short expiry and no logging. No public signed read links
appear in receipts, discovery RPCs or analytics. Malware/image validation failures
leave no report or accessible original. Reconcile abandoned intents and staged
objects, including after failures of the cleanup job itself.

## Moderation and publication

Provide separate tooling for specifically authorized reviewers, with server-side
role checks, MFA and least privilege. Do not authorize from client-editable user
metadata. Reviewers see only evidence needed for the task; access and decisions
are audited privately. Anonymous submission tickets cannot access this tooling.

Review for location accuracy, misleading restrictions, duplicates, licensing and
privacy issues such as faces and number plates. Moderators may accept, reject or
leave pending, with an audit reason and consistent review timestamp. Model a
publication proposal separately from the report decision. Acceptance alone must
not set `verification='verified'`, establish parking permission, or imply vacancy.

Publication requires an explicit reviewed transaction, current target checks,
appropriate source/observation metadata, and public provenance that contains no
private evidence or contact information. Preserve OSM identity, attribution and
ODbL obligations; contributor text does not erase an existing source's licensing.
Verification is a separate action requiring the existing finite verification date
and approved public evidence URL. A private submission photograph cannot serve as
a public verification link. Publishing photos requires separate reuse permission
and privacy review; this proposal keeps evidence private.

## Retention and privacy disclosure

The following periods are proposed defaults requiring product/privacy approval
and an implemented cleanup schedule before launch:

| Data                                         | Proposed retention and deletion                                           |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| Unfinalized intents and staged/orphan images | Ticket expires at 24 hours; reconcile/delete within the next 24 hours     |
| Idempotency receipt/key digests              | 7 days; expired signed tickets remain unusable                            |
| Network HMAC limiter state                   | At most 48 hours, with key-rotation window handling                       |
| Pending reports and evidence                 | 90 days, then delete if not reviewed; no indefinite pending queue         |
| Rejected reports and evidence                | 30 days after decision                                                    |
| Accepted private report/evidence             | 90 days after decision; retain only justified public provenance afterward |
| Reviewer audit trail                         | 180 days, minimizing free text and excluding original media               |

Specify database, object storage, request-log and backup deletion separately.
Delete active data on schedule and document backup expiry/restoration procedures;
restoration must reapply deletion records before serving data. Alert on cleanup
failures and quarantine overdue evidence. Legal holds require a documented narrow
exception, restricted access and an expiry review, not an unlimited default.

Before explicit submission, explain what leaves the device: submitted geometry,
description/source observations, optional photo, challenge-provider processing and
short-lived network abuse metadata. Explain purpose, private moderation access,
possible reviewed publication, photo reuse limitations, retention, deletion/support
contact and the lack of an account. Disclose provider/infrastructure logging and
cross-border processing after providers are selected. Keep local-save wording
distinct from server-submit wording. Require acknowledgement of the current
disclosure, recorded by version, and a fresh explicit action for each local draft.

Provide a private receipt/deletion capability for an anonymous submitter without
requiring email or phone. Store only its hash, authorize deletion requests on the
server and explain what happens if it is lost. Final deletion behavior for already
published facts and licensed source data needs product/privacy review. Never send
report contents, coordinates, photos, tickets or deletion secrets to analytics.

## Ordered implementation tasks and acceptance gates

1. **Resolve design decisions.** Select trusted runtime, challenge integration,
   reviewer identity/access model and media decoder. Approve budgets, retention,
   disclosure, deletion capability and licensing rules. Validate an accessible
   Android/iOS challenge path. No upload UI is enabled at this stage.
2. **Private migration.** Add intent/idempotency, limiter/quota reservations, media
   ownership, observation/disclosure fields, deletion-capability hashes and audit
   metadata. Preserve existing constraints and deny client grants/policies. Add
   pgTAP tests for isolation, target rules, uniqueness, review transitions and
   atomic concurrent limits. Do not change the legacy schema.
3. **Bounded preparation endpoint.** Implement strict schema/geometry validation,
   server challenge verification, ingress controls, durable limit reservations,
   payload canonicalization and signed intent tickets. Test forged proxy headers,
   token replay, missing provider/limiter, concurrent preparation, key conflicts
   and bounded error responses. Inject provider fakes only in isolated tests.
4. **Private media ingestion/finalization.** Add capped streaming, digest checks,
   decoding/re-encoding, private object ownership and transactional finalization.
   Test false MIME, oversized/chunked bodies, malformed images, pixel bombs,
   EXIF removal, ticket expiry, parallel finalization and crashes on either side
   of object/database writes. Demonstrate that clients cannot read evidence.
5. **Cleanup and operations.** Implement reconciliation, retention/deletion jobs,
   retry leases, private receipts and deletion requests. Test cleanup races,
   failed jobs, backups/restoration, quota release and no deletion of committed
   evidence. Establish alerts and an emergency server submission kill switch.
6. **Mobile wiring.** Add explicit submission next to local save, disclosure,
   observation/source inputs, accessible challenge and optional photo preparation.
   Persist a bounded in-progress key/digest for deliberate retries. Never upload
   old drafts automatically. Test offline/restart/retry/conflict/expiry outcomes,
   unavailable local photo URIs, cancellation and unknown target recovery. Keep
   discovery and local saving usable when server submission is disabled.
7. **Moderation tooling.** Build the least-privilege private queue, authorized
   evidence viewing, decision/audit actions, separate publication and verification
   operations. Test unauthorized access, expired media links, stale targets,
   privacy redaction, attribution and accepted-but-unverified reports.
8. **Launch review and controlled enablement.** Run local database/endpoint tests,
   Android/iOS device flows, challenge accessibility and failure tests, concurrency
   and resource-limit tests, and a privacy/licensing review. Confirm no payload or
   secret leakage into logs/analytics. Obtain separate authorization for hosted
   resources/migrations/deployment, then enable only after moderation coverage and
   cleanup are operational. Keep a rollback path that disables submissions without
   affecting discovery reads or local drafts.

These are future tasks and acceptance criteria, not completed or verified
integrations. This document-only phase does not alter any existing access grant,
schema contract, application behavior or deployed environment.
