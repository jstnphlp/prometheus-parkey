# Six UX Psychology Principles — Applied Design Notes

This is an original operational interpretation of the six topics in uxpeak's video, not a verbatim transcript or a scientific meta-analysis.

- Video: https://www.youtube.com/watch?v=2TlIg3VokY8
- Transcript reference: https://youtube2text.diguardia.org/v/the-ux-psychology-behind-apps-people-can-t-stop-using-2TlIg3VokY8
- Video published: July 2, 2026; duration approximately 11:34.

The video's comparisons and numerical claims are teaching examples. Treat measured effects as contingent on the actual product and audience; do not reuse headline percentages as promised outcomes.

## 1. Smart defaults — around 00:22–01:45

**Mechanism:** Excessive choices and blank states increase work; a sensible starting point changes the job from constructing to confirming.

**When appropriate:** Booking dates, non-sensitive filters, commonly used countries or units, previously selected preferences, standardized setup forms.

**Implementation:**
- Derive choices from user-provided values or a reliable app rule, with visible provenance when useful (e.g., "Near your selected destination").
- Keep every suggestion changeable. Distinguish a suggested default from the user's saved preference.
- Reduce irrelevant alternatives with progressive disclosure, but preserve discoverability and manual search.
- Prefer a truthful CTA outcome ("Show nearby parking") to a vague action ("Continue"). If results are unknown, do not claim an exact count.

**Anti-pattern:** Pre-select a paid plan, opt a user into marketing, or assume location permission. Never default to data disclosure.

**Quality check:** Can a user immediately see the choice, change it, and understand its consequence?

## 2. Goal gradient / endowed progress — around 01:45–03:13

**Mechanism:** People can find a visible finish line motivating, especially when previous legitimate effort is reflected.

**When appropriate:** Onboarding checklists, account setup, booking stages, migration tasks, profile completion.

**Implementation:**
- Model completed work as real state; compute `completed_required_steps / total_required_steps` only when each step is genuinely a requirement.
- Count already accomplished steps (for instance, a verified email or destination selected earlier) without duplicating tasks.
- Show the next small action, optional steps separately, and a clear finish condition.
- Avoid misleading progress when steps differ substantially in effort; prefer "2 of 4 steps" or stage labels to spurious precision.

**Anti-pattern:** Showing 20% before the user has done anything, assigning fake completed steps, or indefinitely adding tasks.

**Quality check:** Does progress decrease appropriately if the user undoes a completed step? Does completion mean something real?

## 3. Reciprocity / give value first — around 03:49–05:37

**Mechanism:** Demonstrated usefulness can earn trust before asking for commitment.

**When appropriate:** First-run flows, discovery products, reports, demos, productivity tools, trial activation.

**Implementation:**
- Identify the smallest useful proof of value: one search, real example, non-sensitive preview, meaningful insight, or guest interaction.
- Ask for an account at a logical preservation or synchronization moment ("Save your route"), not merely to hide what was already computed.
- Clearly label preview vs full capability, data age, and saved vs unsaved state.
- If authentication must precede access because of sensitive data, security, business rules, or abuse prevention, provide a legitimate demo or explain the requirement without bypassing it.

**Anti-pattern:** Blurring an already-calculated user report until signup; fabricating preview output; exposing private content for conversion.

**Quality check:** Has the user seen a meaningful, accurate benefit before being asked for something that costs time, money, or data?

## 4. IKEA effect / endowment — around 05:38–07:15

**Mechanism:** Relevant personal choices can increase perceived ownership of a product experience.

**When appropriate:** Custom dashboard, trip planning, profile building, project creation, personal settings.

**Implementation:**
- Offer 1–2 decisions that tangibly improve the result, like naming a draft, choosing destinations, or selecting a display preference.
- Show the resulting preview immediately. If the user later signs up, explain precisely what saving/syncing adds.
- Preserve draft state when technically feasible; do not use work loss as a manufactured threat.
- Keep creation skippable where customization is not essential.

**Anti-pattern:** Making users invest effort purely to pressure them into creating an account.

**Quality check:** Would that customization remain useful even if it did not increase signup conversion?

## 5. Loss aversion — around 08:19–09:36

**Mechanism:** Consequences can be clearer when expressed as impact on existing user work rather than abstract feature gains.

**When appropriate:** Actual expiring access, upcoming data retention changes, unsaved work, consequential permission or backup decisions.

**Implementation:**
- Describe only the verified consequence (what, when, for whom) and provide a neutral remedy and decline option.
- Prioritize reversibility and recovery; show what will remain safe, not only what might be lost.
- If there's no genuine consequence to not upgrading, don't invent one. Regular feature upsells should simply explain benefits.

**Anti-pattern:** Fabricated deletion deadlines, guilt text like "I'll risk losing everything," scary counts, or hard-to-dismiss notices. The video's threat-based example is an explanation of the mechanism, **not a recommended default pattern**.

**Quality check:** Could an independent auditor verify the consequence and deadline from app policy and system behavior?

## 6. Contrast / anchoring — around 09:36–11:02

**Mechanism:** People naturally interpret numbers and offers relative to surrounding context.

**When appropriate:** Price comparisons, plan tables, service tiers, time and effort comparisons.

**Implementation:**
- Show relevant alternatives in comparable units, with complete totals and billing cadence.
- Use a meaningful baseline: a previous confirmed price, the user's existing plan, or what a feature costs relative to an actual purchase when mathematically appropriate.
- Distinguish one-time costs from subscriptions. If a protection service is $50/month, it cannot truthfully be presented as just 2.6% of a $1,900 one-time purchase without also prominently explaining the repeated cost.
- Allow people to compare and decline without deceptive emphasis.

**Anti-pattern:** Inflated reference prices, decoy tiers designed only to mislead, hidden renewals, mismatched timeframes.

**Quality check:** Do both the numerator and denominator have compatible units and relevant context?

## Example: parking-discovery mobile app

These are illustrative design ideas, **not claims about any existing app's current capabilities**.

- **Value first:** Show a functional map, destination search, and parking details before asking for an account, *if* data access and product policy permit. When auth is mandatory, use a clearly labeled sample exploration instead.
- **Smart defaults:** If the user selected a destination, open nearby parking results centered on that destination and let them adjust search radius and parking types.
- **Honest progress:** If onboarding includes destination choice, count that completed choice in a setup indicator only when it is part of the same actual required workflow.
- **Endowment:** Let users create a useful draft route or parking shortlist and offer to save/sync it after demonstrating value.
- **Truthful stakes:** Warn only when a genuine unsaved draft would otherwise disappear; preferably offer recovery.
- **Contrast:** If parking rates are known, display comparable hourly or daily prices alongside locations; if rates are unknown, label them as unknown rather than inventing estimates.

Keep a parking-discovery app's primary user goal — finding parking — ahead of conversion gimmicks. Respect any explicitly selected registration-first policy until the product owner authorizes changing it.
