# Parkey mobile analytics v1 — canonical protocol

**V1 SCOPE: DISCOVERY ONLY. No bookings, QR reservations or payment features.**

The admin dashboard and event intake are owned by the separate repository: https://github.com/jstnphlp/parkey-research-console. Codex may only instrument the mobile app after D2 backend completion.

**Endpoint**: POST https://nuepweyzpkqfihjsbsik.supabase.co/functions/v1/mobile-analytics. Header: Content-Type application/json and project's PUBLIC publishable key in apikey (never a service-role secret). No account token, cookies or review credentials.

Strict JSON object with EXACTLY these keys:

- schema_version: integer 1
- event_id: randomly generated UUID v4, unique per event, for deduplication
- installation_id: random UUID v4 stored only with analytics opt-in; never derive from device identifiers; clear on opt-out
- session_id: random UUID v4 per foreground session
- name: one of app_open, parking_viewed, directions_tapped, filter_used, search_completed, favorite_added, parked_spot_saved, contribution_saved
- platform: android, ios or web
- app_version: 1-32 ASCII alphanumeric, periods, hyphens or underscores

No arbitrary properties, coordinates, plate numbers, queries, URLs, parking IDs, account IDs, personal identifiers, precise location, crash text, photos, names, IPs or free text may be sent or stored. Server supplies timestamp. No analytics is sent until consent/privacy disclosures are in place. If telemetry is disabled, the discovery map and navigation still work.

The existing optional Plausible instrumentation is separate; do not silently redirect it to the new endpoint because its request shape differs. Add an explicit consent-aware adapter and validate each JSON event with tests.

Analytics are approximate: active installs = distinct anonymous installation IDs; sessions = distinct session IDs; event types = raw usage actions. No reservation, inventory, checkout, QR or payment events are allowed for discovery-only V1. Usage statistics must not be interpreted as guaranteed availability or financial performance. Anonymous analytics can be falsified; validate, throttle, and avoid treating results as authoritative.
