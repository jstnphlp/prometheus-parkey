# A1 discovery consolidation — completed engineering gate

Current acceptance and evidence: [A1 completion report](V1_A1_COMPLETION.md),
[draft PR #24](https://github.com/jstnphlp/prometheus-parkey/pull/24), implementation
`1e8f169` and follow-up `c7fdf42`. All locally executable A1 checks passed.
Production and external merge approval remain separate. The notes below preserve
the earlier increment's scope/results; they are not the current gate status.

Branch: `codex/v1-a1-discovery-consolidation`, based on the completed A0 audit
branch `93d33c6` ([draft PR #23](https://github.com/jstnphlp/prometheus-parkey/pull/23)).
Initial implementation commit: `39feebc`. At that earlier increment A1 was not
passed; the later completion report documents the consolidated result.

## Implemented and verified

- Missing pilot backend configuration settles parking and destination search to
  explicit errors. No request that cannot start leaves a perpetual spinner.
  The results sheet reports the same error rather than pretending it is empty.
- Candidate research controls and connection handlers are development-only and
  disabled for release builds. Existing server access/MFA checks, request gates,
  expiry handling and public/private projections remain intact. A client flag
  never grants reviewer authorization.
- General parking-capacity tiles, rows and chips are removed from legacy details.
  Unknown hours/access, source attribution and reviewed-entrance navigation
  safeguards remain. No inventory, reservations, bookings or payments were added.
- The pilot route title uses discovery wording instead of a separate pilot product
  title. The pilot feature flag remains unchanged.

Verification actually run:

| Check                                                        | Result                                                                                                                                                                                                                  |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile typecheck                                             | Passed.                                                                                                                                                                                                                 |
| ESLint on all six changed implementation/test files          | Passed after adding the explicit Node URL import to the test.                                                                                                                                                           |
| Pilot configuration, pilot client and detail-data unit tests | 24 passed, zero failed/skipped; includes five build-environment combinations for research UI and total-inventory omission.                                                                                              |
| Formatting and diff whitespace                               | Passed.                                                                                                                                                                                                                 |
| Android 15/API 35 emulator, current source at `39feebc`      | Parking/search configuration errors settle; legacy detail card has no Spaces field and still refuses unapproved navigation. Three automated presence/absence assertion pairs passed against captured native UI layouts. |

Native screenshots, UI layouts and assertion receipt are in
[the A1 evidence directory](evidence/v1-a1-api35/receipt.json). The AVD, reused
native development APK and disabled telemetry configuration are documented in
the A0 report. No production-build UI, hosted backend, private reviewer access,
physical device or iOS behavior was verified in this A1 increment.

## Acceptance checklist — completed by the final increment

- [x] Consolidate the consumer map/search/filter/detail/saved/directions navigation
      across both flag states; keep development tools separate from consumer UI.
- [x] Preserve real parking types and unknown facts. Never map unclassified source
      geometry to an invented facility type or merge private candidates into the
      public snapshot, saved metadata or offline cache.
- [x] Verify nearby ranking and distance reference for selected destination,
      foreground location and map center, including clear/reset actions.
- [x] Verify saved-place behavior in the pilot public projection without persisting
      private records or treating saved metadata as current entrance approval.
- [x] Verify loading, empty, offline/retry, denied-location, city/session changes,
      expiry/revocation and late-response behavior after consolidation.
- [x] Re-run focused automated checks and capture current native consolidation
      evidence; create the separate A1 review PR before marking its gate passed.

Native glyph 404s remain an A2 investigation. Physical Android performance and
A4 physical smoke tests remain release gates. D3 is still blocked on deployed D2
evidence and privacy/release approval. No telemetry collection was enabled.
