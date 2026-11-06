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
