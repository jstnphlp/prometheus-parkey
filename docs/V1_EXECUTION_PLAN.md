# Parkey V1 — execution gates (canonical)

Status date: 2026-11-06. This is the **only canonical scope and gate checklist**. **Parkey V1 is discovery-only. No reservation or booking prototype belongs in V1.** Figma board: https://www.figma.com/board/xuQAYAk51QnEQot4Cx92mp/PARKEY-EXTREME-MARKET-RESEARCH. Admin app: https://github.com/jstnphlp/parkey-research-console.

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
- **A1 (TODO):** Consolidate confusing legacy vs pilot UX into map-first discovery; preserve flags and private candidate security. Filters, destination search, details, saved locations, directions, loading/empty/errors
- **A2 (TODO):** Fast and robust map: viewport caching, source deduplication, response cancellation, stable markers, low-memory rendering; measured P50/P95 cold/warm behavior on real Android device
- **A3 (TODO):** Truthful parking detail cards: fees/hours/entrance/access not guessed; no navigation to unapproved source anchor; photo license and image fallback verified
- **A4 (TODO):** Typecheck, lint, unit, browser integration and physical device smoke test; accessibility, offline, denied GPS and regression gates documented

Release gate A: A0–A4 verified, approved records only.

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
