# Manila and Mandaluyong engineering execution

The founder selected **City of Manila** and **Mandaluyong City** as controlled
pilot areas. This is a geographic directive based on preliminary land-area and
population research. It does not establish parking scarcity, demand, willingness
to pay, operator participation or permission to publish a parking record.

The versioned plan is
[`plan-v1.json`](../data/pilot-execution/2026-11-05/plan-v1.json). It references the
original frozen phase-gate report by SHA-256 and preserves all historical gate
decisions. Current execution policy is separate:

| Phase                           | Engineering milestone policy |
| ------------------------------- | ---------------------------- |
| 1E commercial validation        | `DEFERRED_TO_PILOT`          |
| 1F mobile discovery engineering | `IN_PROGRESS`                |
| 1G physical verification        | `DEFERRED_TO_PILOT`          |

Deferred means work is postponed, not completed or approved. Neither 1E nor 1G
blocks implementation of 1F. Their absence does not permit public parking claims,
reservations, verified-access badges or navigation to research centroids.

## Sequential gates

Stage A integrates PRs #13, #15, #16 and #17, verifies the contracts and original
Poblacion behavior, builds a fresh native Android development APK, executes the
device smoke flow and connects private evidence/review controls to publication
safeguards. Frozen sources and human decisions remain intact. A new draft
integration PR targets PR #17's branch; no merge to main is authorized.

Stage B remains unstarted until every Stage A technical check passes, including
fresh native build and successful Android smoke evidence. Recording a platform
blocker leaves native readiness and the Stage A gate blocked. A web build or old
installed APK cannot substitute for this evidence.

Only after Stage A passes may Stage B implement the trusted server city allowlist,
integrated discovery modes, approved/research separation, bounded backend queries,
release validation and native pilot flow for Manila and Mandaluyong. Complete NCR
archives remain available to authorized development research. City of Manila is
not the entire Metro Manila region.

`scripts/pilot-execution.mjs` evaluates recorded technical checks. A passing
check requires an executed and satisfied result with evidence references. It
rejects duplicate check identities, unexecuted passes, changed historical evidence,
fabricated commercial validation and Stage B execution before Stage A passes.

## Independent release decisions

`1F_ENGINEERING_READY` requires both technical stages to pass. It does not change
the historical full 1F public-display gate and does not authorize deployment.
`PILOT_RELEASE_AUTHORIZED` remains false. No public evidence upload endpoint,
hosted migration, production write, app-store submission or paid cloud build is
authorized by this plan.

Before a controlled internal release, the founder must approve distribution and
candidate-data access, provider licensing, safety/privacy disclosures and the
specific environment. Public publication is a separate record-by-record approval.
Identity, visitor access, safe vehicle entrance, operator authorization and review
expiry/revocation remain distinct reviewed facts. Evidence submissions and nearby
destination matches grant none of these approvals.
