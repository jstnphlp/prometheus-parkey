# Local evidence review and publication

Stage A provides an operator-controlled local workflow. It imports one original
parking observation and its inspection evidence into private database tables.
It does not import the NCR archive, open an upload endpoint, provision reviewers,
or approve any real record. No hosted execution is authorized by this workflow.

The service-only RPCs use the same trust boundary as `moderate_discovery`:
an authorized local database operator establishes the accountable human's
identity and supplies that person's existing Auth UUID. Every request checks
`parkey_private.discovery_reviewers`; publication and revocation additionally
require `can_publish`. A supplied UUID or generated SQL file is not human
authentication or approval. Anonymous and authenticated client roles cannot
invoke these RPCs, inspect private evidence, or appoint reviewers. Future hosted
access would need the existing Edge token validation and MFA checks first.

## Prepare one source observation

Use an actual privacy-reviewed, archived field submission previously reconciled
by `ncr-fieldwork-submit.mjs`. Keep artifacts in an access-controlled local
directory under the gitignored `output/ncr/`; packages and SQL contain private
notes and possibly photos. Supply an existing reviewer UUID established by the
operator, not an observer reference or destination ID.

```powershell
node scripts/ncr-reviewer.mjs prepare data/ncr-research output/ncr/field-submissions/SUBMISSION_HASH.json REVIEWER_UUID output/ncr/reviewer/RECORD_IMPORT
```

This writes a new `.json` package and `.sql` import request and refuses to
overwrite either file. Research archive hashes, original candidate ID/content,
source-provider IDs, issue definitions, submission hash and reconciliation event
remain attached. A descriptive label cannot replace the parking source ID.

The operator reviews and executes generated SQL against the existing local
database only. Use UTF-8 input: hashes bind the exact bytes. For the existing
Podman database this avoids PowerShell's native-pipe encoding conversion:

```powershell
python -c "import pathlib,subprocess,sys; subprocess.run(['podman','exec','-i','supabase_db_prometheus-parkey-cross-platform','psql','-X','-q','-A','-t','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],input=pathlib.Path(sys.argv[1]).read_bytes(),check=True)" output/ncr/reviewer/RECORD_IMPORT.sql
```

Import returns `imported_unreviewed` and `publicationApproved: false`. Identical
imports are idempotent. A new revision invalidates old public approval; previous
evidence and human decisions remain append-only. Original research archives and
field/review ledgers are not rewritten.

## Make an accountable human decision

First export the current database publication ledger to a new private file:

```powershell
node scripts/ncr-reviewer.mjs export REVIEWER_UUID output/ncr/reviewer/export-ledger.sql
```

Execute it through the same local UTF-8 operator connection and save its JSON
result as `output/ncr/reviewer/db-publication-ledger.json`. Preserve historical
source ledgers separately. Export uses NCR publication-ledger v1, including
sequence, previous hash, actor, evidence references and expiry.

The human authors a private decision JSON in that original event format.
`recordId` must be the original candidate ID and `actorId` the registered reviewer
UUID. Cite `internal:field-submission/SUBMISSION_HASH` in `evidenceReferences`.
Publication requires the existing approval fields plus these explicit decisions
under `reviewDecisions`, each with nonempty `evidenceReferences`:

| Field                | Required decision                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `identity`           | `decision: confirmed_original_source`                                                              |
| `access`             | `decision: public_visitors`                                                                        |
| `entrance`           | `decision: safe_visitor_entrance_confirmed`, coordinates equal to the separately observed entrance |
| `operatorPermission` | `decision: confirmed`, `scope: unverified_discovery_only`                                          |
| `license`            | `decision: approved`, `scope: public_discovery_display`, actual `publicAttribution`                |
| `label`              | `kind: official_name` or `descriptive_label`, and evidence-supported `text`                        |

`operatorPermission.visitorNavigationAuthorized` is a separate boolean decision.
Only explicit `true` grants navigation to the reviewed entrance. Missing or false
permits discovery publication with navigation disabled. Publication does not grant
reservation, payment, operational control, or a verification badge.

Resolve every blocking imported issue in `issueResolutions` with `issueId`,
`outcome: human_resolved`, `reason` and `evidenceReferences`. Submitted facts must
establish existence, observed operation, public visitors, an entrance coordinate
and operator evidence. Restricted, closed, prohibited, unsafe, unresolved-license,
entrance/bay child and street observations remain blocked by source policy.
Public facility types are limited to original source classifications `lot` and
`garage`. A `facility_unspecified` observation can be imported privately but
cannot be published as a lot or garage. Its original type remains immutable;
supporting a reviewed reclassification requires a separate design.
Do not edit source facts to bypass a block.

```powershell
node scripts/ncr-reviewer.mjs decision output/ncr/reviewer/RECORD_IMPORT.json output/ncr/reviewer/db-publication-ledger.json output/ncr/reviewer/human-decision.json output/ncr/reviewer/decision-request.sql
```

This writes a request; it does not approve or execute it. The operator executes
it only after establishing the human's decision. Database checks cover current
role, source/submission hashes, chain head, explicit decisions and expiry in one
transaction. Stale requests require a fresh export and human review. Export the
ledger again after a successful action.

For rejection use `action: reject`, `outcome: rejected`. For a correction request
use `action: reject`, `outcome: correction_requested`. State reason and evidence.
A correction adds evidence/decision history; it never overwrites an archived
submission or source identity. Revocation uses `action: revoke_publication`.
Rejection, correction requests and revocation remove any linked public record
immediately. Historical decisions remain in the private export. Renewing an
expired record requires another explicit approval.

## Public behavior and verification

Approved entries retain `source_record_id = source_observation_id`, separate
`official_name`/`descriptive_label`, and remain `unverified`. Public table RLS and
the existing invoker discovery RPC enforce expiry. Regulations inherit parent
visibility. Navigation uses only the explicitly authorized observed entrance
and the same expiry. Legacy records have no inferred navigation grant. Private
photos and decision notes never enter discovery output.

```powershell
pnpm exec supabase test db supabase/tests/database/reviewer_evidence.test.sql
node --test scripts/ncr-reviewer.test.mjs
$env:PARKEY_REVIEWER_LOCAL_DB = '1'
node --test scripts/ncr-reviewer.test.mjs
```

The optional integration test uses the existing local Podman database and rolls
back synthetic reviewers, evidence and approvals. It checks JS-generated SQL,
the exported ledger's original JS validator, and the actual discovery response
against the existing mobile parser. Tests approve no real source observation.
Stage B and hosted rollout remain gated separately.
