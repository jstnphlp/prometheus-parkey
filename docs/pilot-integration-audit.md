# Pilot integration audit — Stage A1

Recorded 2026-11-05 against integration source commit
`2e91da86b9ba67b13ae057e9ba5e60708d5c0dbf`. This is an independent interface
and regression audit of PRs #13, #15, #16 and #17. It does not authorize public
release, source publication, verified parking claims or Stage B work.

## Result

**Stage A1 technical audit: PASS, with the limits below.** No reproducible
integration defect was found in the reviewed app/API/type, matching,
publication, fieldwork or Poblacion preservation interfaces. Actual frozen
responses from all three supported attachment configurations pass the mobile
runtime contract. The public projection remains empty.

The overall Stage A gate requires the separately recorded fresh Android result
and review workflow; this document does not claim either has passed. Existing
market, field, legal and publication gates remain human-owned.

## Exact PR chain and remote CI

The GitHub API was read at the time recorded in
[`integration-audit.json`](../data/pilot-execution/2026-11-05/integration-audit.json).
All four PRs were open, with no GitHub review decision recorded. The JSON retains
commit-specific successful checks and cancellation counts; PR-rollup status is
not used as proof that every duplicate workflow succeeded.

| PR                                                           | Head SHA                                   | Base branch and current base SHA                                                  |
| ------------------------------------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------- |
| [#13](https://github.com/jstnphlp/prometheus-parkey/pull/13) | `00a9b02be781e783755a27185b65fd8b586aa2ba` | `main` / `d3de5d7d7563f5d3166fa41ae70c16ebe4356b13`                               |
| [#15](https://github.com/jstnphlp/prometheus-parkey/pull/15) | `fb3ec3a3fb5f0d96eae993dd1662b9ba2e562616` | `feat/ncr-research-foundation` / `00a9b02be781e783755a27185b65fd8b586aa2ba`       |
| [#16](https://github.com/jstnphlp/prometheus-parkey/pull/16) | `0e5e325eb33ba89b4fa5e1e742c956e71b8c791d` | `feat/ncr-named-inventory-v2` / `fb3ec3a3fb5f0d96eae993dd1662b9ba2e562616`        |
| [#17](https://github.com/jstnphlp/prometheus-parkey/pull/17) | `2e91da86b9ba67b13ae057e9ba5e60708d5c0dbf` | `feat/ncr-permitted-name-enrichment` / `0e5e325eb33ba89b4fa5e1e742c956e71b8c791d` |

Each of PRs #15, #16 and #17 contains its current base head. PR #13 branches
from `576b1f78b1c4307049f6e46a8b05deb9f2ecf083`, before main's PR #12 merge
commit. That merge base and current main have identical tree
`1d54d380fd2a59856f8071be1db4220bf30e597e`; no main code is missing because of
that commit-graph difference.

Commit-specific successful CI runs:

| PR  | Successful validate/database/e2e run                                                  | Other exact-head runs                                    |
| --- | ------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| #13 | [42010392517](https://github.com/jstnphlp/prometheus-parkey/actions/runs/42010392517) | Additional successful run and cancelled duplicate        |
| #15 | [42012595123](https://github.com/jstnphlp/prometheus-parkey/actions/runs/42012595123) | Additional successful run; later duplicate e2e cancelled |
| #16 | [42027652219](https://github.com/jstnphlp/prometheus-parkey/actions/runs/42027652219) | Additional successful run and cancelled duplicate        |
| #17 | [42035833572](https://github.com/jstnphlp/prometheus-parkey/actions/runs/42035833572) | Additional successful run                                |

Cancelled duplicate checks on #13/#15/#16 explain their `UNSTABLE` PR rollup;
they are retained as cancellations, not silently relabeled successful. #17 was
`CLEAN` when read. CI links describe remote execution; no local database or
browser execution is implied.

## Interface findings

- **App/API/shared types:** `ncr-client.ts` consumes the schema-version-1
  projection from `ncr-preview-server.mjs` using the shared type-only contract.
  Complete loading uses eleven pages of at most 500 records, validates each
  page, rejects inconsistent versions/counts/coverage and duplicate IDs/cursors,
  and preserves the separate source geometry and research anchor.
- **Real attachment compatibility:** the baseline preview, PR #16 name report
  and PR #17 destination report each return all 5,427 distinct observations and
  satisfy `isNcrResponse` on every page. Destination-description observations
  number 0, 811 and 1,099 respectively. These are research descriptions; the
  number 486 in PR #17 is newly assigned groups relative to its previous
  descriptor baseline, not the final total. Original source names remain intact.
- **Matching:** facility groups retain explicit source memberships; streets,
  entrances and individual spaces remain distinct feature roles. Independent
  names within 75 metres are review leads rather than automatic facility merges.
  Conflicting identities, nearby property names and ambiguous destinations do
  not become verified parking names. The destination report records 903 ambiguous
  groups and 330 restricted/unsuitable groups for review.
- **Publication boundary:** private enrichment is bound to frozen source hashes
  and complete group membership; claimed approvals and reproduced-review
  mismatches are rejected. Enrichment never enters public responses or changes
  public data versions. The publication ledger has zero events. Every actual
  public projection checked returned zero observations. Tests exercise human
  review requirements, revision binding, expiry, revocation, restricted access
  and unresolved blocking issues.
- **RLS/backend boundary:** the chain changes no Supabase migrations, Edge
  Functions or web administration code. Existing `discovery_parking` select
  policy remains `using (published)`; private moderation tables remain
  inaccessible to anonymous/authenticated callers and moderation RPC remains
  service-role-only. The NCR Node projection is a separate loopback research
  service; it does not import research into the published SQL tables. RLS is not
  claimed as the authorization mechanism for the private JSON preview.
- **Fieldwork boundary:** submissions are source-version-bound observations
  requiring on-site/privacy attestations. Reconciliation records an unreviewed
  receipt and cannot grant verification or publication approval. The browser
  form/local import pipeline remains separate from app contributions and SQL
  moderation. No actual site visit or operator response was fabricated.
- **Poblacion preservation:** all five baseline canonical JSON hashes in
  `poblacion-preservation.json` still match. The existing offline/data pipeline
  remains separate from NCR preview data. Changes to existing Poblacion UI are
  limited to the development research link, accessible correction label,
  private-draft test identifier and map-padding move-event handling. Native
  Poblacion behavior still requires the separate fresh Android result.
- **Dependencies/imports:** type-only workspace imports remain intact; the
  dependency-security regression test passes. The reviewed lockfile/workspace
  configuration pins advisory fixes and a scoped deepmerge patch, with explicit
  build-script allowlists. No missing import or stale runtime response contract
  was found. Workspace typecheck/build are recorded by the main execution pass.

## Executed verification

The following targeted command exited 0:

```text
node --test --test-reporter=dot apps/mobile/src/discovery/ncr-client.test.mjs scripts/ncr-preview-server.test.mjs scripts/ncr-publication.test.mjs scripts/ncr-name-reconciliation.test.mjs scripts/ncr-destination-labels.test.mjs scripts/ncr-destination-report.test.mjs scripts/ncr-destination-evidence.test.mjs scripts/ncr-fieldwork.test.mjs scripts/ncr-phase-gates.test.mjs scripts/dependency-security.test.mjs
```

`node scripts/check-ncr-package.mjs` exited 0: four archive hashes verified,
5,427 candidates, grid count conservation, zero physical verification and zero
publication approvals.

A direct in-process cross-layer check loaded each actual frozen attachment,
queried all eleven private pages through `queryNcrResearch`, validated every page
with mobile `isNcrResponse`, rejected duplicate IDs, checked each public
projection with `ncrResponseCanDisplay`, and compared all five Poblacion baseline
canonical hashes. Its actual results are in
[`integration-contract-check.json`](../data/pilot-execution/2026-11-05/integration-contract-check.json).
It used no browser, dev server, hosted resource or database mutation. Node emitted
its existing module-type inference warning for the mobile TypeScript import;
assertions passed.

## Remaining issues and limits

- Freshly built Android installation, native map behavior and Poblacion smoke
  results belong to the separate native execution artifact. Historical web or
  emulator results do not satisfy that requirement.
- The preview server and client deliberately require loopback. Android testing
  needs an explicit `adb reverse tcp:8090 tcp:8090` connection (and the app's
  Metro connection as appropriate); setting the API to a LAN hostname or emulator
  gateway violates the preview guard. This is a setup requirement, not a public
  service configuration.
- Human source-license/distribution review, current visitor access, vehicle
  entrances, operator confirmation, physical checks and publication approvals
  remain unresolved. The source snapshots do not establish fees, hours, capacity
  or vacancies. Demand, willingness-to-pay and partnership facts are absent;
  hotspot ranking remains unavailable.
- No new public API deployment, hosted database, production RLS execution,
  schema import, browser flow or iOS run was performed for this audit. Review
  depth followed the changed interfaces and one-hop consumers; it is not an
  exhaustive security review of unchanged application code.

No app/backend changes were needed for this audit. No PR was merged and no
external comment or message was sent by this audit work.
