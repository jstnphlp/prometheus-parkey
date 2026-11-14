# Parkey confirmation email

`confirmation.html` is the reviewable source for the hosted **Confirm sign up**
template. Subject: **Confirm your email for Parkey**.

It uses Parkey's plum, teal, cyan and dark palette, concise copy, bold typography
and rounded controls. Outfit is preferred when available, with Arial/Helvetica
fallback because many email clients do not support custom fonts. The text
wordmark remains visible with images blocked; it is not a replacement drawing
of the original logo. No hosted images, tracking pixels, scripts or external
font downloads are required. Table layout and inline styles support common
email clients; older Outlook versions may omit rounded corners.

## Confirm from any device

Both links target:

```text
https://parkey.promths.com/auth/confirm#token_hash={{ .TokenHash }}
```

Supabase expands `TokenHash` into a one-time verification secret. It stays in
the URL fragment so page requests, server access logs and referrers do not
contain it. The confirmation page removes the fragment before making an HTTPS
POST to the project's Auth `/verify` endpoint with `type: email` and that hash.
It shows success only when Supabase returns a user with a verified email.
Failed, expired and already-used links are never presented as success.

The browser does not use the mobile PKCE verifier, create an SDK session, set
cookies or persist returned credentials. A successful email confirmation does
not grant a browser account session. The user logs into Parkey normally on any
device. Mobile password recovery keeps its existing PKCE callback and template;
it is not changed by this signup-confirmation flow.

Never replace this with a raw access/refresh token, place the hash in an issue,
log or chat, or add a success-only page that skips actual verification. Existing
emails retain their old links; only newly sent emails use a saved new template.
GET prefetches of this public page do not consume the token. JavaScript-capable
email scanners may still follow action links, as with other automatic email
confirmation flows; expired/used-link feedback offers normal login/retry.

## Public auth-only hosting

The same React confirmation component is available as `/auth/confirm` in the
existing web router and as a standalone static site. The latter publishes only
the confirmation page, original logo, fonts and client code; it excludes the
moderation workspace and server bundle.

Set the existing public build configuration in the build environment:

```text
VITE_SUPABASE_URL=https://nuepweyzpkqfihjsbsik.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<project publishable or anonymous key>
```

Never use a service-role key or secret. Then run:

```text
pnpm --filter @parkey/web build:confirmation
```

The build fails without the correct project origin and a public key. Its static
output is `apps/web/dist/confirmation`; publish that directory only. It includes
Cloudflare Pages redirects and headers with no-store, no-referrer, clickjacking
protection and a CSP limited to same-origin assets and this Supabase endpoint.

Deployment order, after explicit review/owner authorization:

1. Publish the auth-only static bundle to a dedicated Cloudflare Pages project.
2. Attach `parkey.promths.com` in the Cloudflare account managing `promths.com`.
   Check for existing records before adding the required Pages CNAME; do not
   replace another site's records. Wait for DNS, TLS and the route to work.
3. Verify the live missing/invalid-link page, response headers and static bundle.
4. Back up the hosted Confirm sign up subject/body privately. Save the reviewed
   subject and `confirmation.html` in Supabase Authentication > Emails. Do not
   change confirmation requirements, SMTP credentials or the recovery template.
5. Send a fresh owner-controlled signup email. Open it on a different device,
   verify real confirmation success, and log into Parkey on the emulator/phone.
   Check Supabase's actual confirmation status. Do not log tokens or user data.

No template/config file here deploys itself, alters local Supabase email
settings, creates migrations or changes database access policies. UI/browser
fixtures are local verification, not successful hosted-account evidence.
