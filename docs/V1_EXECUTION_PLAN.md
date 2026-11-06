# Parkey V1 — execution gates (canonical)

Status date: 2026-11-06. This is the **only canonical scope and gate checklist**. Figma board: https://www.figma.com/board/xuQAYAk51QnEQot4Cx92mp/PARKEY-EXTREME-MARKET-RESEARCH. Admin app: https://github.com/jstnphlp/parkey-research-console.

## Ownership
- **A / Codex / Expo mobile:** discovery UX and native reliability.
- **C / Codex / Expo mobile:** strictly mock-only reservation prototype and transactional backend RFC.
- **D / ChatGPT / separate admin console:** analytics dashboard, restricted read API and event ingestion. Codex may instrument mobile according to the published event contract after D2.
- **Field researchers:** verified parking evidence. No source import is physical verification.

## Non-negotiable rules
- Never publish research-only observations to the consumer app or infer real-time parking vacancy.
- Booking confirmed, arrived and actually occupying the correct stall are different states.
- No production booking, checkout, payment or operator inventory without explicit authorization and real operator agreements.
- All sensitive authorization, inventory and reservation transitions must be server enforced. Keep the legacy ADI-173 schema untouched until a reviewed migration.
- Analytics collects no raw IP, coordinates, search strings, plates, names, photos, emails, parking addresses or free text. Off by default pending disclosure/opt-in. No synthetic results portrayed as real.
- Run checks and record PR + SHA + tests + device evidence for each passing gate. Stop at blockers rather than skipping gates.

## Track A — Discovery (Codex)
| Gate | Must pass before next | Status |
|---|---|---|
| A0 | Read existing architecture; record baseline tests, routes, screenshots and risks | TODO |
| A1 | Consolidate confusing legacy vs pilot UX into map-first discovery; preserve flags and private candidate security. Filters, destination search, details, saved locations, directions, loading/empty/errors | TODO |
| A2 | Fast and robust map: viewport caching, source deduplication, response cancellation, stable markers, low-memory rendering; measured P50/P95 cold/warm behavior on real Android device | TODO |
| A3 | Truthful parking detail cards: fees/hours/entrance/access not guessed; no navigation to unapproved source anchor; photo license and image fallback verified | TODO |
| A4 | Typecheck, lint, unit, browser integration and physical device smoke test; accessibility, offline, denied GPS and regression gates documented | TODO |
Release gate A: A0–A4 verified, approved records only.

## Track C — Reservation prototype (Codex)
| Gate | Must pass before next | Status |
|---|---|---|
| C0 | Architecture RFC for inventory, atomic holds, expiry/TTL, idempotency, state machine, audit, RLS, cancellation/no-show, operator roles and privacy | TODO |
| C1 | Feature-flagged OFF, mock-only driver selection, time picker, confirmation and cancellation; prominent NON-LIVE labels; no public reservation claims | TODO |
| C2 | Mock attendant QR workflow with one-time codes; distinct held/confirmed/arrived/departed/expired/no_show states; no manual client-only availability update | TODO |
| C3 | Tests for concurrency/double booking, expired holds, scan replay, permissions, time zones and disconnects; PostgreSQL integration where applicable | TODO |
| C4 | Production activation requires contracted operator capacity, legal/refund/privacy reviews, server-side real inventory/payment approval and founder release signoff | BLOCKED |
Prototype gate C: C0–C3 verified; C4 must remain BLOCKED.

## Track D — Admin analytics (ChatGPT)
| Gate | Must pass before next | Status |
|---|---|---|
| D0 | Event contract and privacy definitions documented | IN PROGRESS |
| D1 | Reviewer-protected analytics dashboard with daily trends, selection windows, metrics, funnel, empty/error/loading states | IN PROGRESS |
| D2 | Private Supabase event intake and aggregate RPC; allowed events only, throttling and per-role access checks | IN PROGRESS |
| D3 | Mobile event instrumentation, consent disabled by default; Codex implements only after D2 is deployed and documented | BLOCKED ON D2 |
| D4 | End-to-end real device event verification + privacy review; report measured rather than assumed retention | BLOCKED ON D3 |

**Metrics:** Distinct anonymous installation UUIDs are approximate active installs, NOT unique persons or registered users. Session UUIDs estimate sessions. Event counts measure usage and intent. Never report real churn, true availability, bookings or revenue from client events. Use server-authoritative data for paid bookings and money.

Contract: docs/V1_ANALYTICS_CONTRACT.md

## Discipline
Each gate receives a separate branch/PR (or clearly scoped grouped PR), acceptance evidence, and only then status PASS. Work may proceed in parallel on independent tracks; dependent gates cannot be skipped. Keep the two repositories separate and do not edit the admin dashboard from Codex.
