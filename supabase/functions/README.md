# Edge Functions

`discovery-moderation` implements the private reviewer/publisher boundary. It
validates Supabase Auth sessions, requires MFA, and invokes a service-only RPC
which checks the private reviewer allowlist. See
[operations readiness](../../docs/operations-readiness.md) for configuration,
local tests and integration gates. It has not been deployed.

No public submission endpoint or photo ingestion is implemented. Mobile
contributions remain local drafts. Turnstile and private media handling must pass
the gates in [submission design](../../docs/contribution-submissions-design.md)
before uploads are enabled. Never expose a service-role key to either frontend.
