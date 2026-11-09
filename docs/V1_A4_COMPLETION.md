# A4 release-quality validation

**IN PROGRESS: no A4 acceptance or production approval yet.** Branch `codex/v1-a4-release-validation`, based on A3 `e93656a` / implementation `4388ada`. Depends on unmerged draft PRs #23-#26. The canonical tracker remains authoritative.

## Verified so far

| Check                                | Actual result                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Workspace TypeScript                 | Passed: shared types, mobile, web, browser tests and Edge Functions                                  |
| Workspace ESLint                     | Passed, zero warnings                                                                                |
| Workspace Prettier                   | Passed after normalizing seven A3 layout JSON files and rebinding their evidence hashes in `e93656a` |
| Main JS test group                   | 246 passed: 242 mobile plus four web tests                                                           |
| Operations/Edge/web moderation group | 169 passed, one explicitly conditional local-DB test skipped                                         |
| Python groups                        | 23 passed, 15 optional environment-dependent tests skipped                                           |
| Production web build                 | Passed                                                                                               |
| Full legacy browser E2E              | 62 passed, desktop and mobile Chromium                                                               |
| Full pilot browser E2E               | 36 passed on the same application source in A3; see A3 evidence                                      |
| Android production JS/assets export  | Passed with dotenv disabled and release guards enabled; not a signed/native/store release            |
| Native emulator release variant      | Building locally; not yet verified                                                                   |

Actual logs are in [the evidence directory](evidence/v1-a4-validation). Local Docker is unavailable; the disposable GitHub database job on the unchanged A3 database tree passed, including reviewed SQL/event compatibility. No hosted database was touched. Final PR-head CI results will be recorded before acceptance.

## Release configuration and scope

The Android Hermes export excludes the isolated native QA entry and its synthetic image URL. It contains no `service_role` string. This is a bounded artifact inspection, not proof that every conceivable secret is absent. Git tracks only four `.env.example` templates and no actual `.env`, credential JSON, PEM or JKS files. No private source-data package was added to app imports. RLS/publication boundaries retain their unit/browser/SQL checks.

The local benchmark marker remains in bytecode, but production defaults and explicit release guards prevent clock reads/log output; automated tests exercise this. No claim of bytecode-string removal is made. Analytics, Plausible and Sentry configuration remain locked off. Track D backend/instrumentation remains blocked on its canonical D2 gate.

The export uses the default offline-safe release configuration without provider-approval overrides. Configured production search/routing, real parking approvals, licensed photo content, provider/privacy approval, signing/store setup and external PR review remain production requirements. No reservation, payment, QR, inventory, vacancy guarantee or admin-console change belongs to this work.

## Native work still pending

Initial real-source testing confirmed readable map labels, customers-only restrictions, unverified entrance/unknown facts, photo absence and a favorite save. While returning to the app, a native fatal error occurred in React Native development-inspector `CxxInspectorPackagerConnection.didReceiveMessage`; the actual stack is retained. Android Back also appeared to exit from a detail screen and requires reproduction without development tooling before it can pass. No code change is justified by that observation alone.

A local x86_64 release variant is being built with one Gradle worker, default guards, dotenv disabled and the generated local debug signing key. The emulator was stopped to bound RAM use. This will not establish production signing or a store-ready artifact. Native offline/reconnection, permission denial, saved-state restart, Back handling, TalkBack focus, larger fonts and crash/recovery results will be added after execution.

Physical Android performance/smoke, iOS, field/operator review, actual approved photos and production approvals remain separate release blockers. Emulator measurements do not represent physical devices. A4 stays unaccepted until its executable gates pass.
