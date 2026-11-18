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

`place-search` is the public LocationIQ autocomplete proxy. It has no research
catalog access and uses server secrets, bounded input, fixed Philippines scope,
sanitized responses and the service-only shared quota RPC. Deployment, attribution,
client flags and web CORS setup are documented in
[the place discovery guide](../../docs/V1_PLACE_DISCOVERY.md#locationiq-rollout-13-november-2026).
