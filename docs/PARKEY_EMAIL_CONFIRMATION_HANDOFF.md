# Parkey email confirmation handoff

The SMTP failure is fixed: Supabase had username `Resend`, but the provider
requires lowercase `resend`. The owner authorized that correction, it was saved
and verified by reloading, and the owner confirmed receiving email afterward.
The SMTP password was not read or changed.

The owner requested confirmation from any device and a branded email. That
implementation is ready locally, with hosting/template activation handed to
the owner. No new site, DNS record or email template was published by this work.

## Files to use

- Upload ZIP: `output/ncr/parkey-confirmation-site.zip` (135,783 bytes).
- ZIP SHA-256: `c105f9722f7ff0a0b890ecb89788c94de0806f0ec104dd0159b3d5de0020b236`.
- Email source: [confirmation.html](../supabase/templates/confirmation.html).
- Email preview: [desktop](evidence/mobile-redesign-phase3/confirmation-email-600.png)
  and [mobile](evidence/mobile-redesign-phase3/confirmation-email-320.png).
- Page preview: [confirmed](evidence/mobile-redesign-phase3/web-confirmation-confirmed.png).
- Design/security and rebuild notes: [template README](../supabase/templates/README.md).

## 1. Publish the page in Cloudflare Pages

1. Sign into the Cloudflare account that manages `promths.com`.
2. Open **Workers & Pages**, create a **Pages** application using **Direct
   Upload**, and name the project (for example `parkey-auth`, if available).
3. Upload `parkey-confirmation-site.zip` and deploy. The ZIP contains the index,
   assets, `_headers` and `_redirects` at its root. Do not upload the repository,
   `.env` files, Android APK, or the separate moderation web build.
4. In the Pages project's **Custom domains**, add `parkey.promths.com`. Follow
   Cloudflare's DNS setup. Check for existing records before adding the Pages
   CNAME; do not overwrite another service. If prompted, its target is the
   project's actual `*.pages.dev` hostname.
5. Wait for domain/TLS activation, then open
   `https://parkey.promths.com/auth/confirm`. With no email token, the expected
   result is **We couldn't verify this link**; it must not show success.

The ZIP is prebuilt with the verified public project configuration. There is no
server, database migration, SDK session or build environment to configure for
this Direct Upload. Its public page is separate from the moderation workspace.

## 2. Apply the email only after the page works

1. In Supabase project `nuepweyzpkqfihjsbsik`, open **Authentication > Emails >
   Templates > Confirm sign up**.
2. Copy the existing subject/source somewhere private as a rollback copy.
3. Set subject to **Confirm your email for Parkey**.
4. Select **source** and replace its HTML with the complete contents of
   `supabase/templates/confirmation.html`. Save.
5. Keep `{{ .TokenHash }}` exactly as written in both links. They point to
   `https://parkey.promths.com/auth/confirm#token_hash={{ .TokenHash }}`.
   Do not paste an actual confirmation token into source, logs or chat.

Keep email confirmation enabled. Do not change the SMTP password, recovery
template, or native `parkey://auth/callback` redirect, which is already
allowlisted. Old emails retain their old link; this change affects new messages.

## 3. Verify the real flow

1. Register through Parkey with a fresh address or supported unused alias.
2. Check that the email arrives and looks like the preview.
3. Open it on a different device (for example the PC instead of the emulator).
   The page automatically sends the one-time hash to Supabase and shows success
   only after a verified response.
4. Check that Supabase Auth Users marks that account's email as confirmed.
5. Return to Parkey on the emulator/phone and log in with the account's
   credentials. Email confirmation works across devices; signing into Parkey
   remains a separate normal credential check.
6. Reopen the used link. It must not create a session or claim a new successful
   verification. Check expired/invalid-link feedback and normal login recovery.

If delivery fails again, inspect Supabase Auth logs and Resend's email status.
If the page says confirmation is unavailable, check hosting/API configuration;
do not disable email confirmation as a workaround. Keep passwords and links
private.

## Verification completed locally

- Workspace lint, TypeScript, formatting and existing web build passed.
- The auth-only static build and six confirmation unit tests passed.
- Operations: 192 passed, one existing skip, zero failures.
- Browser checks with explicit API fixtures: success, invalid/expired/missing or
  unverified token, network retry, one request under React StrictMode, fragment
  removal, no token in page requests/referrers, no cookies/session storage,
  heading focus, 320px layout and 200% zoom.
- Read-only code review found no major issues; its encoding finding was fixed.

These are local checks. Real cross-device confirmation and app login are still
pending the owner's hosting/template activation and real inbox test. Email
client rendering may vary; Outlook can omit rounded corners and custom fonts.
