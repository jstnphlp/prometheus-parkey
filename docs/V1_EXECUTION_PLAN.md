# Parkey V1 — execution gates (canonical)

Status date: 2026-11-09. This is the **only canonical scope and gate checklist**. **Parkey V1 is discovery-only. No reservation or booking prototype belongs in V1.** Figma board: https://www.figma.com/board/xuQAYAk51QnEQot4Cx92mp/PARKEY-EXTREME-MARKET-RESEARCH. Admin app: https://github.com/jstnphlp/parkey-research-console.

## Ownership

- **A / Codex / Expo mobile:** discovery UX and native reliability.
- **D / ChatGPT / separate admin console:** analytics dashboard, restricted read API and event ingestion. Codex may instrument mobile according to the published event contract after D2.
- **Field researchers:** verified parking evidence. No source import is physical verification.

## Non-negotiable rules

- Never publish research-only observations to the consumer app or infer real-time parking vacancy.
- V1 has **no booking, reservation, slot holds, QR entry/exit, operator inventory, payments or guaranteed/live vacancy**, including mock versions. Do not create reservation prototypes, mocks, routes, schemas or QR flows.
- Preserve the legacy ADI-173 schema without new reservation work. Historical board notes about bookings are exploratory and not approved scope.
- Analytics collects no raw IP, coordinates, search strings, plates, names, photos, emails, parking addresses or free text. Off by default pending disclosure/opt-in. No synthetic results portrayed as real.
- Run checks and record PR + SHA + tests + device evidence for each passing gate. Stop at blockers rather than skipping gates.

## Track A — Discovery (Codex)

- **A0 (PASS — baseline audit only):** Architecture, routes, baseline tests, current Android 15/API 35 x86_64 emulator screenshots and risks recorded in [the A0 report](V1_A0_MOBILE_BASELINE.md). Branch `codex/v1-a0-discovery-baseline`, [draft PR #23](https://github.com/jstnphlp/prometheus-parkey/pull/23), evidence commit `fffda45`. Mobile typecheck/lint and 170 unit tests passed; actual emulator observations and open defects are in the [receipt](evidence/v1-a0-api35/receipt.json). This does not mark product defects, physical-device, performance or release checks passed; physical tests remain separate A2/A4 gates per user instruction.
- **A1 (PASS — local engineering):** Map-first navigation, search/ranking, type/price filters, truthful details, public-only saved places and parked-car handoff, permission/offline/error recovery and release research guards verified. Branch `codex/v1-a1-discovery-consolidation`, [draft PR #24](https://github.com/jstnphlp/prometheus-parkey/pull/24), source `1e8f169` / `c7fdf42`. 187 mobile units, 28 pilot and 48 legacy browser cases, workspace checks and 11 native layout assertion groups passed; [report and limitations](V1_A1_COMPLETION.md). External review/merge and production approval remain open.
- **A2 (PASS — local engineering):** Bounded backend-isolated public cache, source/request deduplication, cancellation/timeouts, stable geometry and explicit native fonts verified. Branch `codex/v1-a2-discovery-performance`, [draft PR #25](https://github.com/jstnphlp/prometheus-parkey/pull/25), source `c0d0ab1`. 220 units, 36 browser cases and 20 cold/20 warm API35 host-GPU samples passed; [measurements and limits](V1_A2_COMPLETION.md). Basemap observation P50/P95 7.11/17.234s; warm activity command 328/406ms. Physical Android P50/P95 remains a production blocker; no physical/release speed claim.
- **A3 (PASS ? local engineering):** Truthful classification, conflicting fee/hour/access evidence, fresh entrance authorization across parking navigation and catalog-only licensed photos with bounded image fallback verified. Branch `codex/v1-a3-parking-data-trust`, [draft PR #26](https://github.com/jstnphlp/prometheus-parkey/pull/26), source `4388ada` / `0763bc9`, navigation follow-up `613ab27`. 242 units, 22 trust/directions, 36 pilot and10 navigation-race browser cases, seven API35 native component states passed; [report and limits](V1_A3_COMPLETION.md). Synthetic UI fixtures grant no real parking/photo approval. Physical/production/external review gates remain open.
- **A4 (PASS ? local engineering; production blocked):** Workspace checks, 247 main JS tests (243 mobile), 169 operations tests, 23 Python tests, 72 legacy/36 pilot browser cases and API35 native release-variant checks verified. Conditional skips and initial CI/cold-tooling failures are retained, not counted as passes. Branch `codex/v1-a4-release-validation`, [draft PR #27](https://github.com/jstnphlp/prometheus-parkey/pull/27), app `c38f130`, native config `be2366d`, tests `8ccdc62`; CI `5852a27` passed all jobs with zero browser retries. Actual Back, permissions, offline/reconnection, saved/car persistence, Maps handoff, TalkBack/1.3x text and controlled-crash recovery evidence: [A4 report](V1_A4_COMPLETION.md). Physical Android/iOS, production provider/privacy/signing/data approvals and external PR review remain release blockers.

Release gate A: A0–A4 verified, approved records only.

### Engineering acceptance versus production release

The user explicitly authorized Windows 11 / Android 15 API 35 emulator-only
engineering progression. A2/A4 can pass locally executable engineering gates
with reproducible emulator measurements and native evidence. The original
physical Android P50/P95 and physical smoke requirements remain **production
release blockers**; emulator results never satisfy them or establish iOS support.
PRs remain separate and unmerged pending required review. A local engineering
gate does not grant data publication, provider/privacy approval or deployment.

## Track D — Admin analytics (ChatGPT)

- **D0 (IN PROGRESS):** Event contract and privacy definitions documented
- **D1 (IN PROGRESS):** Reviewer-protected analytics dashboard with daily trends, selection windows, discovery metrics, event sequence caveats, empty/error/loading states
- **D2 (IN PROGRESS):** Private Supabase event intake and aggregate RPC; allowed events only, throttling and per-role access checks
- **D3 (BLOCKED ON D2):** Mobile event instrumentation, consent disabled by default; Codex implements only after D2 is deployed and documented
- **D4 (BLOCKED ON D3):** End-to-end real device event verification + privacy review; report measured rather than assumed retention

**Metrics:** Distinct anonymous installation UUIDs are approximate active installs, NOT unique persons or registered users. Session UUIDs estimate sessions. Event counts measure usage and intent. Never report real churn, parking vacancy, reservations or revenue from client events. The V1 app has no booking system.

Contract: docs/V1_ANALYTICS_CONTRACT.md

## Discipline

Each gate receives a separate branch/PR (or clearly scoped grouped PR), acceptance evidence, and only then status PASS. Tracks A and D may proceed in parallel; dependent gates cannot be skipped. Keep the two repositories separate and do not edit the admin dashboard from Codex.
