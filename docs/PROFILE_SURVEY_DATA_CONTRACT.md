# Parkey — Profile Survey Data Contract (Implementation and Research Boundary)

**Date:** 2026-11-18 · **Owner intent:** keep answers to the profile questionnaire to support research, **remove age question**. This is a specification for future code work, not evidence of data collection, consent, deployment or analytics.

## Baseline (inspect before changing)

- Current profile model/validation: `apps/mobile/src/onboarding/profile.ts` with full name, ageRange, vehicleTypes, occupation, residence city, driving purpose, driving frequency, parking duration and preferences.
- Current signed-in account setup: `account-setup-screen.tsx` / `profile-setup-form.tsx` with five required steps and Supabase auth-user metadata saves.
- Current persistence: `auth/profile-save.ts` writes confirmed signed-in responses through `supabase.auth.updateUser({data:{ full_name, parkey_profile }})` and verifies returned user; personal info edits merge `parkey_profile`.
- Current V1: app discovery is anonymous and data/trust/analytics contracts forbid treating profile responses as public information or automatically available admin research data.

## Active survey schema (v2)

All values below are user-provided and stored only after a supported signed-in save; existing option labels are retained unless an independent product decision changes them.

| Key | Format | Survey role / validation |
| --- | --- | --- |
| `fullName` | string | Account profile identity, preferably already supplied at registration; valid name required for a *completed signed-in profile*, never a survey question to repeat |
| `vehicleTypes` | string[] | 1+ existing recognized vehicle types, multi-select, no fabricated defaults |
| `work` / `workOther` | string / string | Occupation, required for completed survey, non-empty valid 2–100-char `Other` when chosen |
| `city` / `cityOther` | string / string | City of residence (NOT GPS), required for completed survey, valid `Other` handling |
| `drivingPurpose` / `drivingPurposeOther` | string / string | Travel purpose, required for completed survey, valid `Other` handling |
| `drivingFrequency` | string | Required recognized selection to complete survey |
| `parkingDuration` | string | Required recognized selection to complete survey |
| `parkingPreferences` | string[] | At least one recognized selection for completed survey |

**Do not include `ageRange` in the active `ProfileDraft`, active `profileChoices`, account setup, personal info page, completion validation, `profileMetadata` writes or new export/report fields.** Retire legacy age-data validators and update dependent tests/fixtures. Do not collect birth dates as a substitute.

## Completion vs account access

- `completed survey` means *all* active v2 answers validated and verified saved to the matching signed-in account, not merely navigating to step 4.
- `incomplete survey` (including opted out, skipped, in-progress, partial legacy data or failed save) **does not** block guest exploration, signed-in map/search, saved places, directions, or app use.
- Never label skipped survey as complete or count it as a usable completed research response. For partially populated profiles, maintain a private, appropriately gated resume path with truthful progress.
- The ability to use Parkey does not constitute research consent. Choosing `Explore without setup` must not submit questionnaire responses.

## Data minimization, consent and research

This is personal/account data, potentially including city and work. Distinguish **account profile persistence** from **research analytics/exports**.

1. Explain in plain language what responses are collected, why, where stored, who can see them, retention/deletion rules, and how they can be changed or removed. Link the app's real Privacy & Data controls; do not invent a functioning policy/support/export endpoint.
2. For collection of optional questionnaire answers, get a clear affirmative action on `Save profile` following an accurate data-use disclosure. Because V1 discovery works without it, skipping must remain possible.
3. Any **separate research analysis, aggregate reporting, admin export or data transmission** needs a separately reviewed purpose, lawful basis/appropriate consent where required, access restrictions, retention period and deletion process. No research consent checkbox should be prechecked; decline must not block Parkey discovery. Do not quietly add research ingestion/telemetry or a public endpoint as part of this UI PR.
4. If a research-use consent control is implemented, it must be backed by real persistence, an identifiable policy/version, reversible consent management, and a reliable enforcement path before labeling it working. Otherwise keep research processing disabled and document the integration gap. Display no false `we are using your answers to personalize results` claim unless real app functionality is verified.
5. Use least privilege, service-side authorization/RLS where appropriate, and avoid email, city, occupation or answers in client logs, analytics events, bug reports, screenshots of real user records, crash breadcrumbs, URLs or map/search requests.
6. **Do not automatically show personal responses in public profiles, parking records, admin moderation, or the Research Console.** Research export (if later approved) should prefer de-identified or aggregated data with disclosure of small-group re-identification risk.
7. Do not silently deploy Supabase migrations or change production retention policies. Escalate any data-policy or backend changes needed for bona fide research use.

## Legacy `ageRange` field handling

Existing `user_metadata.parkey_profile.ageRange` may exist. Implement **forward-safe removal**:

- On reads: tolerate legacy key without throwing, displaying it, using it as progress, or requiring it.
- On full v2 survey save: serialize only approved v2 keys and avoid reintroducing `ageRange`; after a successful verified save, the old profile object should no longer include it.
- On partial personal-info edits: do not spread legacy age into a new profile payload; use a sanitizer/allowlist while carefully preserving unrelated valid established survey answers. Don't delete unrelated unknown metadata or change auth/session state.
- Do not claim historical age data was purged everywhere: old backups, logs, and existing server records need an approved retention/deletion and possibly migration process. **No bulk production migration or mass deletion without separate approval.**
- A previously complete v1 survey remains complete under v2 **only if every remaining v2 answer is valid**, independent of age. Missing new survey values should not be guessed.

## Save, correction and interruption rules

- Only attempt write for a signed-in, server-verified, confirmed, unexpired user; preserve existing `saveAccountProfile` identity and server confirmation rules.
- Saving a completed profile must not overwrite an already valid registration name with an empty/untrusted value; a valid existing name is reused. When missing, collect and validate.
- Trim and normalize free text, deduplicate multi-select choices, clear stale `*Other` hidden fields when not selected, reject unknown enum values and 101+ character input.
- While incomplete, avoid silently sending research responses. Maintain an editable draft through step navigation and failed retries. If drafts persist across app restart, secure their storage, namespace to user and clear on sign-out, account change or explicit discard.
- For `Other` values, retain the entered text when toggling away/back during an unsaved editing session, but do not persist hidden values on completed save.
- Personal Info edit must preserve the **latest verified** survey answers rather than overwriting them with stale local state; avoid unsafe concurrent writes.
- Show `Saved` only after a verified, confirmed server response. On network failure show a friendly retry that keeps the existing draft, never a false completed state.

## Minimum tests / release gates

- v1 metadata read with `ageRange` works; active model has no age; v2 write omits `ageRange`.
- All remaining survey fields required for `profileComplete` and `profileMetadata`, but *never* required to explore the app.
- Valid `Other`, invalid `Other`, unknown choices, duplicate arrays, blank name, existing verified registered name, OAuth missing-name path.
- Signed-in verified, unverified/expired, changed-account, interrupted/network failure and retry cases; no partial/fake success.
- Saved profile → personal-info edit → saved profile leaves unrelated v2 fields intact and strips legacy age from new payload.
- Guest and signed-in incomplete users can reach discovery without any research submission; no unapproved analytics/network exports.
- If consent UI is added: test unchecked default, explicit opt-in, revoke/decline, enforcement and data-use disclosures.
- Privacy review must be recorded in PR; explicitly list any pending policy/consent/Research Console integration and do not claim research pipeline is live until verified.

**Reference implementation brief:** [UX_PSYCHOLOGY_PROFILE_SETUP_CODEX_BRIEF.md](UX_PSYCHOLOGY_PROFILE_SETUP_CODEX_BRIEF.md).
