---
name: ux-psychology
description: Audit, redesign, or implement onboarding, signup, booking, form, pricing, checkout, and upgrade flows using ethical UX psychology. Apply when users ask to reduce friction, abandonment, decision fatigue, or improve task completion and trust. Do not invoke for purely decorative styling or to create deceptive, coercive, or addictive dark patterns.
---

# UX Psychology for Product Flows

Apply six decision-making principles from uxpeak's *The UX Psychology Behind Apps People Can't Stop Using* as **design hypotheses**, not guaranteed conversion hacks. The purpose is to make the next useful action easy to understand, worth doing, and safe to decline.

Source: https://www.youtube.com/watch?v=2TlIg3VokY8 (uxpeak, July 2, 2026). See [principles and examples](references/principles.md) when selecting patterns; see [audit template](references/audit-template.md) when asked for an assessment.

## When to use

Use for product flows where a person must understand options, complete setup, make a commitment, or decide whether to pay: onboarding, first-run experiences, account creation, booking, filters, multi-step forms, pricing, checkout, upgrade, and trial-expiry notices.

Do **not** force all six onto every screen. For maps, dashboards, settings, accessibility, or other non-conversion interfaces, apply a principle only when it removes a genuine obstacle. Preserve the product's existing branding, platform conventions, scope, and stated constraints.

## Workflow

1. **Understand the actual job.** Inspect provided screens, repository files, prototypes, or design context, as available. Identify the user's goal, screen sequence, friction point, prerequisites, existing state, and what the app can truthfully offer. Do not invent unseen states, results, business rules, research findings, or functionality.
2. **Diagnose friction.** Note unnecessary blank inputs, repeated decisions, unearned progress, early signup walls, missing previews, meaningless customization, pressure-heavy warnings, or unclear price comparisons. Distinguish a usability issue from a technical bug, business requirement, privacy requirement, or accessibility need.
3. **Choose relevant principles.** Apply the smallest useful set from the matrix below. For competing choices, prioritize accessibility, truthfulness, consent, and task success over conversion.
4. **Design a specific before → after change.** Identify screen/component, current friction, new behavior and copy, source of any default or metric, failure/empty states, escape route, and impact on the rest of the flow. Say explicitly when the proposal depends on product data or policy not yet verified.
5. **Implement only when requested or within the assigned scope.** Use the existing design system and interaction architecture. Keep states real, defaults editable, feedback accessible, and navigation predictable. Do not silently change backend, pricing, consent, data retention, or registration policy.
6. **Evaluate.** Check both effectiveness (task completion, abandonment, time-to-value, errors) and trust (opt-outs, complaints, unintended charges, user comprehension). Label metric targets as hypotheses until measured. Prefer a focused usability test or A/B test over claims that a principle guarantees an uplift.

## Six-principle decision matrix

| Principle | Use when | Design move | Non-negotiable boundary |
| --- | --- | --- | --- |
| **Smart defaults / decision fatigue** | Users face many blank, repetitive choices | Populate safe, contextually justified choices; offer scan-and-adjust rather than fill-from-zero | No prechecked marketing consent, paid add-ons, or silent data sharing |
| **Goal gradient / endowed progress** | A legitimate multi-step task feels long | Show accurate completed steps and distance to finish; count work already completed | Never fabricate progress or mark undone tasks complete |
| **Reciprocity / value first** | Signup or payment precedes any product value | Show a useful preview, result, sample, or limited guest experience first where safe | Do not reveal protected/private data or misrepresent preview limits |
| **IKEA / endowment effect** | Users benefit from creating something personal | Let them make a small, meaningful, persistable choice before asking to save it | No needless work, artificial sunk costs, or hostage-like signup gates |
| **Loss aversion** | Inaction has a genuine, material consequence | State the specific consequence, effective date, and a reversible next step when possible | No fake countdowns, inflated threats, or guilt-laden decline copy |
| **Contrast / anchoring** | Users compare costs, plans, or alternatives | Put genuinely comparable options in context, with complete units and totals | No misleading anchors, hidden fees, or mixing monthly and one-time prices |

## Response contract

For a **review**, return: primary user goal; prioritized friction findings; selected principle(s); proposed before → after changes; ethical/accessibility caveats; and how to validate them. Use [audit template](references/audit-template.md) for substantial reviews.

For a **design task**, give or create concrete screen states, hierarchy, labels, CTA copy, entry/exit rules, loading/error/empty states, and how progress is computed. Preserve the requested style; psychology is a layer on the design, not a replacement for the visual source of truth.

For an **implementation task**, connect the redesign to actual components and state, verify critical flows and non-regression, and report what changed plus what remains unverified. Avoid proposing a hypothetical feature as if it is already deployed.

## Trust, safety, and accessibility checks

- All defaults must be reversible and based on real known data or a clearly explained suggestion.
- Progress must represent actual steps completed; show 0% when that is the truth.
- Consent, privacy, permissions, billing, account deletion, and cancellation stay explicit and easy to control.
- Any shown totals, percentages, counts, scarcity, urgency, deadlines, and "most popular" claims require real evidence.
- Upgrade and renewal information must show the actual billing cadence, material conditions, and how to decline without shame.
- Avoid coercion, compulsive engagement loops, artificially costly exits, bait-and-switch previews, and unnecessary onboarding steps.
- Preserve logical reading order, labels, focus, keyboard/screen-reader support, text scaling, motion-reduction preferences, and sufficient contrast.
- Do not treat the video's illustrative numerical examples as verified universally applicable effects.

A good result helps people reach a goal faster **and** understand what they are consenting to.
