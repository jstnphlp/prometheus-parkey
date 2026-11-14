# Parkey native inputs and popups

Implemented by Mobile Redesign Phase 3. Applies to the native account flow;
discovery keeps its existing components and essential parking disclosures.

## Inputs

- Use `FormField`, native `TextInput`, Outfit and the shared palette. White
  fields use `fieldInk` (`#233D49`) and teal vector icons (`#007F88`).
- A field is full width, cannot shrink vertically, and has a 13-point corner
  radius. Its height is `max(50, ceil(18 * fontScale + 28))`; character count
  never determines its width or height.
- The text occupies a separate flex slot with basis zero, minimum width zero,
  shrink enabled and clipped overflow. The input fills that slot. Leading icons
  have a fixed 22-point slot; password controls have a fixed 44-point target.
- Email is single-line with native horizontal scrolling, selection and cursor
  behavior. Keep accessibility scaling enabled. The 254-character email limit
  is a protocol constraint, not a workaround for layout. Do not shrink the font
  or replace the actual value with ellipsized text.
- At 130% text and above, show a persistent label in addition to the native
  accessibility label. Screen containers scroll and avoid the keyboard.
- Use consistent 24-unit SVG geometry with a 2-unit rounded stroke. Use person,
  mail, lock and shield-check for the four registration fields, and eye/eye-off
  for password visibility. Decorative vectors are excluded from accessibility.
- Keep field-specific validation adjacent to the field. Validate on submit,
  then update feedback as the value changes. Focus the first invalid field.
  Server password-strength rejection may also appear against that field.
  Forgot/Reset validation uses a popup with focus returned to the relevant input;
  inline validation is confined to Login and Register.
- Password creation shows a four-item checklist immediately below the Password
  input, before Confirm password. It is always visible on Register and verified
  Reset, and uses the same predicates as validation. Completed rules use a check
  plus an accessible Met label; updates do not announce every keystroke. There
  is no password-requirements button or modal. Login does not apply signup rules
  to existing credentials.

## Popups

Use `usePopup().show()` for authentication, server, network, verification and
storage failures. Never insert raw server text, email links, tokens, passwords
or provider details into a message. `authFeedback` maps structured codes to
safe copy. Do not treat a successful email request as proof of delivery.

Requests contain a tone, concise title and supporting sentence. Use one clear
primary action and at most one secondary action. Preserve retry, resend,
registration restart and recovery actions. Help text belongs behind a named
help button rather than beneath every primary action. The password checklist
above is an explicit exception requested by the owner.

Auth screens have no Explore parking action. Native Back and the existing
onboarding completion route still provide guest access; discovery has no auth
requirement and saved parking is not changed by this presentation choice.

Known transport failures receive connection feedback. HTTP/service and email
delivery failures must not be described as offline. Local signup diagnostics
may contain only an allowlisted failure category/code and numeric HTTP status;
never log the raw error, request/response body, headers, URL or account values.

The shared native modal uses a plum backdrop, white card, 24-point radius and
padding, Outfit, a 56-point status-symbol surface, and a 44-point close target.
Error, warning, information and success have distinct vector symbols and
explicit titles; color is supplementary. Content scrolls within native safe
areas at larger text sizes. Native Android Back and the close button dismiss
the message. Opening dismisses the keyboard; closing restores the originating
input when appropriate. Async callers that already dismissed the keyboard
must pass `returnFocus`. Navigation actions set `restoreFocus: false`.

The title receives screen-reader focus when the modal opens and when a queued
message replaces it. Avoid background interaction through the native modal.
Focus restoration skips unmounted routes and queued messages. Route changes
clear old messages and their actions, including during external deep links.

The popup gate suppresses pending duplicates and overlapping authentication
warnings. Automatic warnings use `onceKey`; only explicit retry clears that
key. A new failed user request may report its failure again. Never call a
system popup from a text-change handler. Reduced motion disables modal fades;
the existing native navigation also honors that preference.

## Verification expectations

Measure input container and icon bounds at short, long and maximum text with
the real keyboard visible, including a small display and large text. Exercise
selection, paste, visibility toggles, modal Back, focus restoration, retry and
deep links. Check accessibility with a screen reader on both platforms before
final device acceptance; this Windows implementation run cannot certify iOS.
