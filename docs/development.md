# Development

Use Node 24 LTS (`.node-version`) and pnpm 11.25.0. Install from the repository root
with `pnpm install --frozen-lockfile`. Public configuration templates are optional;
never commit an actual `.env` or a privileged key.

## Mobile

The workspace uses pnpm's hoisted dependency layout to keep Android CMake/Ninja
paths within Windows' path-length limit. After pulling a dependency-layout change,
run `pnpm install --frozen-lockfile` before rebuilding Android. On Windows, use a
current Ninja build tool with long-path support; the Ninja 1.10.2 bundled with
Android SDK CMake 3.22.1 can still fail on generated React Native object paths.

The Expo SDK 58 app is a map-first discovery app. **Use a development build, not
Expo Go**, because MapLibre is a native dependency. No Google Maps keys are needed.
See [map and routing provider setup](mobile-discovery.md). Xcode/CocoaPods are required
for iOS; Android Studio, a compatible JDK, and the Android SDK for Android.

```sh
pnpm --filter @parkey/mobile ios
pnpm --filter @parkey/mobile android
# Already-installed development client:
pnpm dev:mobile
# Same application in a browser:
pnpm start
```

Explore starts without authentication or configuration. Basemap tiles and search
need internet. The unverified OSM pilot snapshot is bundled, so record inspection
does not require Supabase. Search is an explicit Photon API request. Contributions
are clearly labeled local previews, never server submissions.
See [mobile implementation and provider configuration](mobile-discovery.md).

## Discovery moderation workspace

`pnpm dev:web` starts the TanStack Start workspace at port 3000. Configure its
public Supabase URL/key, run the local migrations and moderation Edge Function,
and provision an authorized reviewer to use the queue. The workspace requires
TOTP MFA and keeps sessions in memory. See [operations readiness](operations-readiness.md).
`pnpm build:web` builds the client and SSR server. No deployment was performed.

## Local database

A Docker-compatible runtime is required for `pnpm supabase:start`. No cloud
project is needed. Inspect CLI `--help` before using pinned-version commands.
Use `pnpm exec supabase migration up --local` to apply additive migrations to an
existing local database. `pnpm exec supabase test db --local` runs rollback-based
pgTAP tests. Database tests require a running local database.

`pnpm exec supabase db reset --local` is **destructive to local data** and intended
only for a disposable database. It recreates migrations and loads the fictional
legacy seed plus the separate unverified OSM discovery seed. Never load development
fixtures into a hosted database. Preserve and audit legacy data before archival.
See [discovery schema](database.md) and [legacy schema](legacy-reservation-schema.md).

If another local Supabase project uses the configured ports, do not stop or reset
it blindly. Use a separate disposable project with different ports, or an isolated
Supabase Postgres container to apply the SQL/test files directly with `psql`.

## Checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm format:check
pnpm build:web
```

CI uses the frozen pnpm lockfile and these checks. It does not start Docker,
deploy, create hosted resources, or run a native build. Expo native directories,
web route trees, build output, local environments, and caches stay untracked.
