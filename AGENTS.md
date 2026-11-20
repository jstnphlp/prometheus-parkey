# Parkey project instructions

## Scope and architecture

- Work only on the assigned Linear issue. ADI-172 establishes the foundation;
  schema and reservation design belong to ADI-173.
- Do not implement unrelated product features without explicit authorization.
- Use one pnpm monorepo and a modular monolith. Keep frontend apps independent;
  avoid premature services, orchestration layers, and speculative abstractions.
- `apps/mobile`: Expo, React Native, Expo Router, native StyleSheet. Routes live
  in the official SDK 58 starter's `src/app` convention.
- `apps/web`: React, TanStack Start/Router, Vite, Tailwind. Routes live in
  `src/routes`; preserve official file conventions. No Next.js or experimental RSC.
- `packages/shared-types`: type-only contracts imported using `import type` and
  `workspace:*`. Do not put runtime helpers or a speculative domain model here.
- `supabase`: generated CLI config, future migrations and Edge Functions.
  PostgreSQL is the future source of truth; concurrency belongs in transactions
  and database constraints, with sensitive operations validated server-side.

## Coding and TypeScript

- Keep changes small, explicit, and scoped. Read relevant files first; use targeted
  searches. Do not recursively inspect unrelated files or reread unchanged files.
- Ignore dependencies, generated files, caches, build output, and large data
  unless needed to diagnose the assigned task.
- Use functional components and clear names. Add shared abstractions only when
  there is a demonstrated need. Keep frontend business rules out of the apps.
- Keep strict TypeScript enabled. Avoid `any`, unchecked assertions, and suppressed
  compiler errors. Use explicit public types and type-only imports where useful.
- Extend `tsconfig.base.json` for non-Expo packages. Mobile extends Expo's base
  and explicitly enables the same strict checks to preserve Metro compatibility.
- Use workspace ESLint and Prettier configuration. Keep third-party imports
  together, then local imports separated by a blank line.
- Do not manually edit `apps/web/src/routeTree.gen.ts`; the Router CLI owns it.
- Do not add Metro overrides unless official Expo guidance requires them.

## Security

- Never commit credentials or actual `.env` files. Only `.env.example` templates
  are tracked. Do not print credentials in logs, examples, or CI output.
- Only public configuration can use `EXPO_PUBLIC_` or `VITE_`. Never expose
  Supabase secret/service-role keys, database administrator credentials, or
  PayMongo secret keys to clients. Restrict Maps keys to intended apps/domains.
- Use least privilege and server-side validation. Future exposed database tables
  require RLS and reviewed policies. Do not add production auth bypasses.
- Do not fabricate integration responses or present sample metrics as live data.
- No hosted resources, deployments, production migrations, or external messages
  without authorization for that action.

## Dependencies and verification

- Use Node 24 LTS and the pnpm version pinned in `package.json`. Commit the pnpm
  lockfile; use `pnpm install --frozen-lockfile` in CI. Never add another lockfile.
- Check current official compatibility guidance before framework upgrades. Use
  Expo-supported React/React Native versions; keep React aligned across apps.
- Prefer framework-native capabilities. Do not add Query, state/form/UI libraries,
  Turborepo/Nx, or infrastructure until a task demonstrates the need.
- Review and explicitly allow any dependency build scripts in
  `pnpm-workspace.yaml`. Never broadly allow all dependency scripts.
- Run the smallest relevant check: targeted typecheck, then lint, then meaningful
  unit tests where behavior warrants them. Do not add tests mirroring low-impact
  changes or run full suites/E2E by default. Fix relevant failures before rerunning.
- For workspace/configuration changes, run `pnpm lint`, `pnpm typecheck`,
  `pnpm format:check`, and `pnpm build:web`. Stop after appropriate checks pass.
- Do not start dev servers, run browser/E2E tools, or use web/docs tools unless
  the task requests them or local evidence is insufficient. Do not spawn agents
  for ordinary single-scope tasks.
- Report actual checks and limitations. Never claim an emulator, Docker stack,
  browser flow, or integration was verified without running it.
- Final responses state what changed, touched files, verification, and any
  remaining issue. Do not fix unrelated issues opportunistically.

## Active V1 Tracks A/D: mandatory phase-gate instructions

Read [docs/V1_EXECUTION_PLAN.md](docs/V1_EXECUTION_PLAN.md) and [docs/V1_ANALYTICS_CONTRACT.md](docs/V1_ANALYTICS_CONTRACT.md) before implementing V1 tasks. The plan is the sole canonical scope/phase truth. Codex owns Track A discovery only; Track D admin analytics UI, read API and ingestion are owned by ChatGPT in the separate jstnphlp/parkey-research-console repo. Only add mobile instrumentation after backend D2 is deployed. V1 is strictly discovery-only. Do not implement any booking, reservation, reservation mock, QR check-in/out, payment, operator inventory, public vacancy claim or private record publication. Historical schema and Figma booking ideas are out of V1 scope. Do not advance a gate without its stated tests and evidence. Update the plan only when an acceptance gate has truly passed, and cite branch/PR, tests, and device results.

## Figma magenta UI implementation handoff (2026-11-16)

When working on the Parkey Interactive Architecture design, read
[docs/FIGMA_MAGENTA_INTERACTIVE_ARCHITECTURE.md](docs/FIGMA_MAGENTA_INTERACTIVE_ARCHITECTURE.md),
[docs/FIGMA_MAGENTA_SCREEN_INDEX.md](docs/FIGMA_MAGENTA_SCREEN_INDEX.md),
[docs/FIGMA_MAGENTA_DESIGN_TOKENS.md](docs/FIGMA_MAGENTA_DESIGN_TOKENS.md), and
[docs/FIGMA_MAGENTA_CODEX_PLAN.md](docs/FIGMA_MAGENTA_CODEX_PLAN.md) before editing UI.
The Figma page's magenta Light/Dark variants are the visual target; use the connected
Figma MCP and exact paired node IDs rather than guessing. The canonical V1 execution
plan and the preceding security/discovery-only instructions still override any
unapproved prototype feature: keep anonymous exploration, truthful parking data,
no booking/live vacancy, no fake account/provider success and no silent deployments.

## Offline Figma reference workflow

For Parkey Interactive Architecture UI work, prefer the checked-in offline reference
in [design-reference/README.md](design-reference/README.md): `manifest.json` for
60 light/dark-magenta pairs, verified `tokens/figma-tokens.json`, and
`flows/navigation.json`. Screenshot PNGs and per-screen layout JSONs become
available **only after** a real Figma REST export via
`scripts/figma-snapshot.mjs`; do not claim they exist from the manifest alone.
Use a locally configured read-only `FIGMA_ACCESS_TOKEN`, never commit or print
that credential, and use small `--screens=` exports before any full run. Inspect
existing exports before requesting live Figma MCP. Reserve MCP calls for specific
ambiguities or stale snapshots; do not repeatedly fetch the entire canvas.
Treat exported Figma mock content as a design reference, never as trustworthy
parking data or permission to bypass V1 scope, auth/data/privacy gates, or the
existing native/web discovery integrations.

## Exact Figma UI implementation directive (2026-11-17)

For any follow-on Parkey magenta UI parity work, read
[docs/FIGMA_EXACT_UI_CODEX_BRIEF.md](docs/FIGMA_EXACT_UI_CODEX_BRIEF.md)
before editing. The user requires the **actual paired Figma layouts and
interactive journey** (Light + Magenta / Dark + Magenta), not the existing UI
with its colors changed. Use live Figma MCP on the specific source nodes,
capture screenshots, and replace conflicting discovery/list/settings screen
composition while retaining the canonical V1 data, auth and safety contract.
Do not label an expanded legacy map sheet as Figma's dedicated List or Map
screen, and never claim pixel parity without app-vs-Figma image evidence.


## Mandatory UX psychology review for product experiences (2026-11-18)

For **every new or modified user-facing feature, screen, flow, copy, interaction,
or product design**, read
[.agents/skills/ux-psychology/SKILL.md](.agents/skills/ux-psychology/SKILL.md)
before proposing, designing, or implementing the change. Consult
[the six principles](.agents/skills/ux-psychology/references/principles.md)
when choosing UX patterns and
[the audit template](.agents/skills/ux-psychology/references/audit-template.md)
for substantial reviews. Explicitly check which principles actually help the
user complete the task; do not force all six onto every screen.

Apply these rules to onboarding and transitions, destination search, map and
parking discovery, details, navigation, lists, filters, saved places, account
flows, empty/error/loading states, accessibility, and user-facing wording.
Use useful editable defaults, honest step progress, early meaningful value,
appropriate customization, truthful warnings, and fair comparisons where
relevant. Avoid dark patterns, fake urgency, invented metrics, and unnecessary
friction. Respect reduced-motion preferences.

**Order of authority:** canonical V1 execution plan, security/privacy and actual
product behavior > exact approved Figma visual layouts and design tokens >
UX-psychology recommendations. The skill is an evaluation and interaction
guideline, **not** approval to add features, change authentication or consent,
publish private data, imply live parking availability, or introduce bookings.
Preserve the approved light/dark magenta designs unless a design change is
explicitly requested.

For every relevant change, include a short UX-psychology check in the handoff:
which principles were applied (or intentionally skipped), what friction was
addressed, and what was validated versus still hypothetical.


## Required post-registration profile survey — owner directive (2026-11-18)

For any account, registration, profile, or setup work, **first read**
[docs/UX_PSYCHOLOGY_PROFILE_SETUP_CODEX_BRIEF.md](docs/UX_PSYCHOLOGY_PROFILE_SETUP_CODEX_BRIEF.md)
and [docs/PROFILE_SURVEY_DATA_CONTRACT.md](docs/PROFILE_SURVEY_DATA_CONTRACT.md),
alongside the mandatory `ux-psychology` skill and paired Figma references.

**Newly registered/verified accounts must complete their user-profile survey
before entering signed-in discovery.** Returning signed-in accounts whose survey
is incomplete must resume it; there is no skip/finish-later action *inside* the
registered setup. Keep **anonymous Explore as guest** fully accessible *without
registering* as V1 requires. Use the four required steps vehicle types, about
you (occupation, residence city, driving purpose), driving habits (frequency,
duration), and parking preferences. Remove age from active UI, types, validation
and new saves; safely tolerate legacy age metadata. Reuse registration name.
Save a completed profile only after verified backend confirmation, and do not
silently enable additional research analytics/exports or imply consent to them.
Preserve the exact Figma light/dark-magenta style with smooth accessible motion.
This owner decision supersedes older profile handoffs that described those
steps as optional or deferred, but does **not** authorize deployments, fake
backend behavior, changes to V1 parking discovery rules, or unrelated features.

## Guest discovery access contract — owner directive (2026-11-18)

For any work involving guest access, accounts, the simplified discovery UI, local
saved parking, contribution drafts, or report submission, read
[docs/GUEST_MODE_V1_ACCESS_CONTRACT.md](docs/GUEST_MODE_V1_ACCESS_CONTRACT.md)
and [docs/GUEST_MODE_IMPLEMENTATION_MAP.md](docs/GUEST_MODE_IMPLEMENTATION_MAP.md)
alongside the mandatory survey, security, report, and UX psychology contracts.

**Guest means the existing signed-out local experience**: map, destination search,
published parking details, filters, directions, local favorites/parked-car
position, and local add/correction drafts all remain available without an
account. **Do not** create fake guest identities, arbitrary discovery quotas,
a second map experience, account gates on public discovery, or pretend device
saves are cloud-synced. The simplified UI (PR #41) keeps the shared left
hamburger/search row, collapsible icon-only legend, compact marker details and
account entry pinned to the drawer footer in Light/Dark + Magenta.

Require verified registered identity only for actually account-bound actions,
particularly sending and managing private submitted reports; the existing
report-specific OTP session and backend ownership checks must be audited rather
than bypassed. Local report drafting stays open to guests; live sending stays
disabled when the service is unavailable. After registration, the **four-step
mandatory profile survey** still gates signed-in discovery; explicit sign-out
may return an incomplete registrant to independent guest discovery.
No auto-upload, fake report success, silent analytics, backend deployments, or
cross-device sync is authorized by the guest contract. Use staged PRs on the
current simplified UI stack, and verify real behavior before claiming completion.
