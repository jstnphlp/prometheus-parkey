# Phase 1E — hotspot field evidence collection

**Data state on 2026-11-05:** 11 preliminary research areas, **0 rankable**. The 5,427 NCR source observations are not a driver-demand or occupancy study. This is the next collection protocol, not a record of completed visits or interviews.

## First observation wave

Proposed sequence for field logistics (not a validated commercial ranking): **Poblacion, BGC, Binondo, Makati CBD, Ortigas, MOA, Cubao, Tomas Morato**, then contrast with **Alabang, North EDSA, Maginhawa**. Use identical observation methods across areas. Don't score any area until at least one normal weekday and one contrasting evening/weekend or event period have been sampled. Record the actual time, day, weather, and event conditions—never backfill missing measurements with source feature counts.

## Data to record

| Research dimension | Direct evidence | What is *not* sufficient |
| --- | --- | --- |
| Demand (30%) | Sample of arrivals, search times, queue/refusal incidents, vehicle trip reasons, peak-period distinctions | Number of mall locations or mapped lots |
| Usable supply gap (25%) | Independently confirmed *visitor-usable* entrances, access hours, time-matched occupancy or refusals and legal curb segments | Counts of parking POIs, bay geometries or unknown-access records |
| Willingness to pay (20%) | Actual amounts drivers paid and responses to fixed price/guaranteed-parking scenarios with sample sizes | Advertised parking prices or interviewer guesses |
| Partner potential (15%) | Named operator role, permission to contact, dated response about listing spare capacity and conditions | An operator's public contact page |
| Launch feasibility (10%) | Dated regulatory/signage checks, route safety, operator authorization, enforcement and operational cost estimates | General impressions of neighborhood safety or crowding |

## Repeatable sampling, privacy, ethics

Choose fixed observation windows before inspecting results (for example weekday 08:00–10:00 and 18:00–21:00, weekend 18:00–21:00 where relevant; adjust for actual area use and record all changes). Sample at least two distinct locations per neighborhood before drawing within-area conclusions. These are starting logistics, **not statistical sufficiency claims**. Don't put observers on roads or dangerous shoulders. Observe only from lawfully accessible places; don't enter private facilities without permission.

Interview scripts should ask open-ended questions about *recent actual trips* first: 'Where were you going? Where did you first try to park? How long did the search take? What was the final price? What did you do if full?' Ask the same fixed-payment scenario separately and label it stated intent, not revealed preference. Do not collect names, plates, phone numbers, identifiable images, live GPS trails or personal secrets in the research ledger. For optional photos of signs, obtain permission when needed, remove identifying details and EXIF before storage.

## Recording schema and provenance

Use the blank CSV template `data/ncr-research/hotspot-fieldwork-template.csv` for human observations. One row per dated observer/location/time window, with stable area ID and a non-personal evidence reference. Don't create fake sample rows or assume zero when observations are missing.

Every normalized scored metric must include **area ID**, numerical 0–5 score, 0–1 confidence, dated source type (`field_survey`, `interview`, `first_party`, `licensed_public`) and evidence reference. Track sample size, methods, missingness, counterevidence and decision rationale in accompanying audit notes. Codex's scorer refuses a published rank for incomplete/low-confidence metrics. Area boundaries must be reviewed before comparing samples; Ortigas spans multiple cities.

## Sample coverage schedule (proposed, not executed)

| Area | Contrasting times to investigate | Operational/legal focus |
| --- | --- | --- |
| Poblacion | Weeknight and Friday/Saturday evening | Visitor lots, access, local street restrictions, safety |
| BGC | Weekday office arrivals and evening restaurant hours | Operator/estate permission, independently usable capacity |
| Binondo | Midday errands and busy weekend | Loading vs parking, small-lot entrances, legal access |
| Makati CBD | Weekday office peak and retail evening | Garage eligibility, price sensitivity, events |
| Ortigas | Weekday office peak and weekend mall period | Across-city boundaries, mall/office parking rules |
| MOA | Normal retail and a documented event session | Event spillover, entrances, operator policy |
| Cubao | Normal retail and Coliseum event | Existing estate parking directory, queues and actual issues |
| Tomas Morato | Weeknight dining and a Sunday | Relevant closures, current curbside rules |
| North EDSA | Office/commuter and retail peak | Transport transfer context, visitor rights |
| Alabang | Weekday office and weekend retail | Southern NCR comparison; authorized operators |
| Maginhawa | Weeknight/weekend dining | Residents and legal curb access, smaller hosts |

## Exit from Phase 1E

At least the selected launch hotspot and one control area have comparable dated evidence across the five metrics, independent legal/access checks, and an auditable uncertainty statement. Do **not** force every area into a numeric ranking when evidence is missing. Site/host visits can continue into Phase 1G. Until then there is no evidence-backed hotspot winner.
