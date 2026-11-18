# UX Psychology Audit — Output Template

Use when the user requests a structured review of a screen, flow, prototype, or codebase. Skip unnecessary sections for quick questions.

## 1. Context

- **Product and target user:** [observed or explicitly provided]
- **Journey / entry point / exit:** [actual flow]
- **User's intended outcome:** [job to be done]
- **Known constraints:** [auth, privacy, billing, tech stack, design system]
- **Evidence inspected:** [files, screens, code paths, analytics, or "not available"]

## 2. Prioritized findings

| Priority | Screen/state | Friction and evidence | Principle | Proposed change | Verification needed |
| --- | --- | --- | --- | --- | --- |
| P0/P1/P2 | ... | ... | ... | ... | ... |

Priority guide:
- **P0** = blocks completion, deceives the user, or produces unsafe behavior.
- **P1** = substantial task friction or missing feedback.
- **P2** = polish / optional experiment.

Use "not observed" rather than treating missing screenshots or analytics as proof of an issue.

## 3. Before → after specification

For each important finding:

1. **Before:** precise interaction or screen state and why it fails the user goal.
2. **After:** precise component/flow behavior, copy, default, conditional states, and CTA.
3. **Evidence dependency:** where default values, counts, deadlines, progress, and prices must come from.
4. **Escape and accessibility:** how to opt out, navigate back, edit, recover, and use assistive technology.
5. **Test:** the minimum observation or event that would verify improvement.

Example (for a generic booking screen):

- Before: five empty fields and a generic "Continue" button.
- After: sensible, editable *non-sensitive* defaults from explicit prior user choices; a summary of the booking parameters; "See available appointments" CTA.
- Constraint: do not show exact slot counts unless confirmed by the scheduling source; never preselect extra paid services.
- Test: completion rate, edit rate, booking errors, and whether users correctly understood the chosen defaults.

## 4. Decision table

| Principle | Relevant? | Honest application | Risk / reason to skip |
| --- | --- | --- | --- |
| Smart defaults | Yes/No | ... | ... |
| Goal gradient | Yes/No | ... | ... |
| Reciprocity | Yes/No | ... | ... |
| IKEA/endowment | Yes/No | ... | ... |
| Loss aversion | Yes/No | ... | ... |
| Contrast | Yes/No | ... | ... |

Don't score a screen lower just because a principle is not applicable.

## 5. Validation and implementation notes

- **Usability questions:** Can the user recognize the next action? Do they understand defaults and consequences? Can they reach value without unexpected demands?
- **Metrics to consider:** start→completion, time-to-value, drop-off by step, correction/error rate, opt-out rate, complaints/refunds where relevant.
- **Fairness / privacy / accessibility:** real consent; readable prices; neutral declines; clear focus and labels; motion reduced when requested.
- **Implementation:** reference real code components and observed product behaviors; if not accessible, label suggestions as conceptual.
- **Experiment hypothesis:** "We expect [change] to improve [metric] for [audience] because [mechanism]." Do not claim an improvement occurred until measured.

### Exit criteria

A recommended change should be removed or revised if testing shows higher confusion, lower user comprehension, unwanted consent, unintended charges, or unsafe pressure, even if click-through rises.
