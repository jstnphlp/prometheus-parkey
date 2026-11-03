# Parkey

A map-first parking discovery app, with parking information around Poblacion, Makati. Open the map,
search a destination, inspect a facility or street segment, and get directions.
Discovery requires no account. Unknown parking rules, fees, hours, and verification
are explicit; Parkey does not promise a vacant space or permission to park.

## Run locally

Install **Node 24 LTS** (this project requires Node 24, not Node 22), then open
a new terminal in this folder. On Windows PowerShell, run:

```powershell
npm.cmd install --global pnpm@11.25.0
pnpm.cmd install --frozen-lockfile
pnpm.cmd start
```

This opens the parking discovery app in your browser. If it does not open
automatically, use the local URL printed by Expo (normally `http://localhost:8081`).
No `.env` file, API keys, account, Docker, or database setup is required.
Internet access is needed for map tiles, destination search, and driving routes.
Stop the app with `Ctrl+C`. On later runs, just use `pnpm.cmd start`.

On macOS/Linux, use `npm` and `pnpm` in place of `npm.cmd` and `pnpm.cmd`.
The `.cmd` suffix avoids Windows PowerShell's script execution policy restriction.
For the separate moderation workspace, run `pnpm.cmd dev:web` and open
`http://localhost:3000`. Native Android/iOS setup is described below.

## Workspace

- `apps/mobile`: Expo 58, React Native, Expo Router, MapLibre Native and GL JS.
- `apps/web`: independent TanStack Start discovery moderation workspace.
- `packages/shared-types`: type-only workspace contracts.
- `supabase`: PostGIS discovery schema, preserved legacy schema, local seeds/tests.

Use Node 24 LTS and pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm --filter @parkey/mobile ios       # Xcode + CocoaPods
pnpm --filter @parkey/mobile android   # Android SDK + JDK
pnpm dev:mobile                       # already-installed development client
pnpm --filter @parkey/mobile web       # browser version of the Expo app
pnpm dev:web                          # separate operator web preview
```

**Expo Go is not supported by the native map.** Build the development client.
No keys are needed for the default basemap, modest development search, or the
unverified OSM pilot snapshot (43 records, 6 street segments). In-app directions
show a driving route, distance, estimated travel time, and written instructions.
Development builds default to the OSRM demo for non-commercial testing only;
production builds require an owned/licensed `EXPO_PUBLIC_OSRM_URL`. See the setup
guide below. The demo has no availability guarantee; live traffic is not included.
Community contributions are **local previews only**, not server submissions.
An optional Supabase public configuration enables published viewport reads.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm format:check
pnpm build:web
```

## Browser regression tests

Playwright covers the Expo app's browser version in desktop and phone-sized
Chromium. It starts and stops its own Expo server on port 8088:

```sh
pnpm exec playwright install chromium  # once after installing dependencies
pnpm test:e2e
pnpm test:e2e --project=mobile-chromium
pnpm test:e2e e2e/search.spec.ts        # run one feature
pnpm exec playwright show-report output/playwright/report
```

The tests cover parking details and browser Back, street/garage/free filters,
destination search and history, saved parking and home addresses, parked-car
location, directions consent, navigation and arrival, and private drafts and corrections.
They also check reload persistence, undo, denied location access, and recovery
from search and routing errors. Each test gets fresh browser storage.

The suite uses the checked-in OSM parking snapshot and intercepts map, search,
and routing requests with test fixtures. Test startup ignores `.env` files and
disables remote parking reads and telemetry. No backend or API keys are needed.
These tests check UI behavior; they do not verify live providers, native iOS or
Android, or the separate operator web preview.

CI runs both browser projects and uploads reports, failure screenshots, and
traces when tests fail. Local artifacts are ignored under `output/playwright/`.

The web workspace now uses Supabase reviewer sign-in/MFA and a private moderation
queue. Public uploads remain gated; mobile drafts stay on-device. See
[operations readiness and remaining launch gates](docs/operations-readiness.md). No hosted resources, migrations, or production
submission service are deployed by this repository.

Read [mobile setup, providers, licensing, and limitations](docs/mobile-discovery.md),
[development](docs/development.md), [architecture](docs/architecture.md),
[discovery database](docs/database.md), and [preserved legacy schema](docs/legacy-reservation-schema.md).

Read the [parking data preparation report](docs/parking-data-quality.md) for exact
audit counts, candidate evidence, the unpublished review queue and validated
offline refresh steps. `pnpm audit:data` checks generated data integrity;
`pnpm data:refresh` regenerates local artifacts after review.
