# Parkey Google and Facebook sign-in

Phase 3, stacked on Phase 2. Sign-in remains optional; guest discovery and its
storage are unchanged. No tables, policies or migrations are added.

## Dashboard setup and observed state

The owner created Google and Meta apps and copied credentials directly into
Supabase. On 2026-11-14, a read-only hosted public Auth settings request verified
`external.google: true`, `external.facebook: true` and email confirmation still
required. Enabled providers do not establish successful consent or production approval.

For both providers, the external OAuth callback is:

`https://nuepweyzpkqfihjsbsik.supabase.co/auth/v1/callback`

- Google Auth Platform: create a **Web application** client. This browser/Supabase
  integration does not need an Android package/SHA-1 entry. Authorized JavaScript
  origin: `https://parkey.promths.com`. Add the callback above as an authorized
  redirect URI. Copy the client ID/secret into Supabase's Google provider and
  keep Skip nonce checks off. For a Testing audience, add the intended testers.
  Production publication, branding, domain/policy requirements and any Google
  review remain owner gates.
- Meta: Parkey is a developer app, separate from the owner's personal account
  and any Facebook Page. Configure Facebook Login with strict redirect matching
  and the callback above in Valid OAuth Redirect URIs. Copy app ID/secret into
  Supabase. Development mode permits applicable app-role accounts; ordinary users
  need public eligibility/review. Public privacy policy, data-deletion
  instructions/callback, business verification and permission approval must be
  completed where Meta requires them. No Page management permissions are requested.
  Only the email scope is added. An account without a provider-confirmed email
  cannot pass Parkey's existing confirmed-email guard; use email sign-in if the
  provider cannot supply it.
- Supabase URL Configuration: the owner reports adding exact
  `parkey://auth/oauth` while retaining `parkey://auth/callback` for email/recovery.
  OAuth returns to the installed native app. This is not the callback entered in
  Google/Meta. No wildcard is needed. The allowlist was not independently reread
  in this continuation.

Credentials stay in provider/Supabase dashboards. Never put client secrets,
SMTP credentials, privileged keys or account tokens in the mobile bundle or evidence.

## Native flow and display gates

`expo-web-browser` opens the system browser/auth session. The existing Supabase
client generates S256 PKCE. The app validates the exact project authorization
origin, provider, redirect and challenge method before opening it. It accepts
one authorization code on its native callback, rejecting fragments, token
injection, duplicate codes and foreign hosts.

One pending auth purpose is active at a time. SecureStore holds a 15-minute
OAuth request containing provider and the SDK's exact verifier slot ID. Exchange
selects that slot explicitly and rejects recovery proofs before calling
Supabase. Cancellation removes the request's indexed slot and matching
compatibility key without clearing another request. Only a real exchanged
session followed by the existing fresh server user/expiry check opens the main discovery app.
The provider busy guard serializes native callback and browser-result handling.
Cold callback delivery can finish the securely stored pending request.

Login honors Remember me. Unchecked Login and registration keep sessions in
memory; checked Login uses SecureStore. Passwords are never stored. Browser
cookies are controlled by the provider/browser; Parkey sign-out does not claim
to sign out Google/Facebook globally. Existing email accounts follow Supabase's
configured identity-linking behavior; no account-merge bypass is added.

Buttons require both hosted provider enablement and the public build flag:

```env
EXPO_PUBLIC_GOOGLE_LOGIN_ENABLED=true
EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED=true
```

The checked-in template defaults to false. Internal test builds may enable them
for owner verification. Keep untested/publicly unavailable providers disabled
in public builds. A settings network failure omits buttons without blocking
email login or discovery. Settings are queried once per initialized auth runtime;
a cold relaunch retries an unavailable lookup. Expo Go/mobile web are unsupported
auth targets here; install the APK or an appropriate iOS native build.

Login/Register reuse native accessible white buttons, bundled provider marks,
Outfit and Parkey spacing/radii. Google's official multicolor G differs from
Figma's monochrome G. Login's redundant About Remember me button is removed;
the checkbox retains its secure-storage accessibility hint. Browser consent
and provider errors remain controlled by Google/Meta. Parkey errors use popups.

## Verification and remaining acceptance

Focused tests exercise the installed Supabase SDK's PKCE generation/exchange
against explicit network fixtures, callback rejection, provider gates,
cancel/dismiss, indexed-slot cleanup, recovery separation and restart restoration.
These do not establish successful hosted provider consent. Phase 3 evidence
records workspace checks, native build and owner acceptance separately.
iOS/physical-device flows and public provider eligibility remain unverified.

Owner acceptance for each provider: choose it from Login, authenticate privately
in the browser, consent and verify return to the main discovery app. Sign out, repeat with
Remember me, relaunch and verify persistence. Cancel with Android Back, retry
and check discovery/saved data. Never share passwords, callback URLs or tokens.
