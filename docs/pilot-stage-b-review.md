# Stage B integration review

Independent read-only review compared the Stage B implementation against the
passed Stage A baseline `f54f2b5`. It covered the typed API contract, main mobile
flow, cancellation and scope changes, reviewed-entrance navigation, PostGIS
geography, reviewer authorization, pagination and release configuration.

## Resolved access finding

The initial review identified an important gap: the older restriction blacklist
omitted `members` and unexpected explicit access values. A public projection also
replaced the original access value with `public_visitors`, concealing conflicting
source evidence from the client.

The final implementation uses one explicit allowlist for normalized `accessClass`,
raw `sourceTags.access` and raw `sourceTags['parking:access']`. Missing/unknown,
yes, public and permissive values pass this source check; other explicit values
fail closed. Passing this check grants no visitor or publication approval.
The public response preserves the original access fact.

An additive approval trigger rejects unsafe future publication decisions
atomically. The shared read guard excludes unsafe historical states from the
new pilot RPCs and, when pilot activation is enabled, legacy RPC/direct-table
reads. Rejection and revocation remain available. Negative database checks cover
restricted mapped/raw tags, contradictory tags, unsupported values and all three
read paths. Original source records and historical human decisions are retained.

The independent reviewer confirmed the original finding's closure by inspection;
the backend execution owner ran the actual database and cross-runtime tests.
The parking-specific raw tag was added following the reviewer's final caveat.

## Integration regression and limits

The initial browser detail-selection test exposed viewport changes invalidating a
selected record. Selection now binds to city/mode/session and an immutable source
snapshot. A viewport update cannot blank an authorized detail screen; city/mode,
session, expiry, explicit refresh and filter changes still clear selection.
The focused regression and initial 16 pilot browser cases passed.

No other confirmed implementation blocker was found in the reviewed scope.
This review is not native execution evidence or release authorization. The
separate execution record must establish final CI and fresh Android validation.
iOS, physical GPS and physical site verification must not be claimed without
their own executed evidence. Provider-review build flags are assertions for an
operator workflow; they do not establish founder approval or legal permission.
