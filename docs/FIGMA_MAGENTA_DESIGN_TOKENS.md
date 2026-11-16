# Parkey — Figma Light + Magenta and Dark + Magenta design tokens

Source: Figma `Parkey / Semantic Colors` collection `VariableCollectionId:138:72`, modes `212:0` (Light + Magenta) and `212:1` (Dark + Magenta). Retrieved from live Figma node values on 2026-11-16; do not substitute visually estimated colors. Variable names below are verbatim. Other Figma modes (teal) are not part of this implementation.

| Semantic token | Light + Magenta | Dark + Magenta |
|---|---|---|
| background/canvas | `#FFFFFF` | `#20162E` |
| background/surface | `#FBF7FA` | `#291D35` |
| background/card | `#FFFFFF` | `#30243D` |
| text/primary | `#20162E` | `#FFFFFF` |
| text/secondary | `#655A6D` | `#D9CFDE` |
| border/default | `#EDE1EA` | `#58405A` |
| action/primary | `#840561` | `#840561` |
| action/brand | `#840561` | `#840561` |
| map/canvas | `#F9F0F6` | `#271D30` |
| map/block | `#ECDDE8` | `#382D41` |
| map/road | `#FFFFFF` | `#554A5E` |
| status/pending | `#840561` | `#E460AA` |
| status/verified | `#007F80` | `#00A6A7` |
| background/accent-soft | `#F7E6F0` | `#41243A` |
| text/on-action | `#FFFFFF` | `#FFFFFF` |
| map/marker | `#840561` | `#840561` |
| navigation/active | `#840561` | `#FFFFFF` |
| navigation/inactive | `#716A77` | `#D9CFDE` |
| navigation/back | `#00A6A7` | `#00A6A7` |

The Figma reference `ARCHITECTURE / FOUR THEME REFERENCE` (node `283:3284`) confirms white/light canvas and `#20162E` dark canvas; **official logo colors stay unchanged across modes**. The Figma frame `16A Appearance` depicts four modes, but this handoff implements **exactly two**: Light + Magenta and Dark + Magenta.

Metrics come from `Parkey / Metrics` collection `VariableCollectionId:212:2779`: `space/8 = 8`, `space/12 = 12`, `space/16 = 16`, `space/24 = 24`, `radius/12 = 12`, `radius/16 = 16`, `radius/24 = 24`. Use node-specific values when geometry differs. Example Figma sign-up heading uses **Outfit ExtraBold 31 px, ~120% line height**, body **Outfit Medium 15 px**, labels **Outfit SemiBold 13 px**, inputs **Outfit Medium 14 px**. The UI currently loads **Nunito** via `apps/mobile/src/discovery/typography.ts`; migrate thoughtfully to licensed/available Outfit assets rather than silently falling back or loading a remote font. Match responsive layout, accessibility text scaling and system status bar on Android/iOS; don't hardcode iOS status bars in RN.

## Runtime integration

- Implement a single semantic `light-magenta | dark-magenta` theme model and typed tokens, consuming it in shared UI primitives, StyleSheets, map markers, directions, overlays, modals, loading/empty/error states, navigation and splash/onboarding as applicable. No scattered hex values or superficial color inversion.
- Persist a user's theme preference locally (reuse the established storage convention; no user account required); initialize without a glaring wrong-theme flash, update status bar appropriately and keep accessibility color contrast. Explicit selection takes precedence over system preference; document system default/fallback and corrupted-storage behavior.
- Existing `discovery/palette.ts` is a **static** map/UI palette using different magenta/teal values; `discovery/ui.tsx` and other screens import it. Refactor carefully, including native and web MapLibre layers (some map style props need a style refresh). Never globally replace a color string without understanding its semantic role.
- V1 maps are real MapLibre maps. The Figma `map/canvas/block/road` roles describe **illustrative prototype map artwork**; do not replace real basemap tiles with the Figma concept image. Preserve required attribution, approved sources and route/marker legibility. Basemap style switching is optional unless approved data/provider compatibility exists.
- Check white text on `#840561`, muted text against dark cards, errors/success on both backgrounds, pressed/focused/disabled controls, and non-color distinction. Preserve official asset color despite global theme.
- Figma design-context output may include temporary asset URLs and Tailwind code for a mock; convert to React Native native StyleSheet and download usable assets into repo as directed. Never ship temporary Figma URLs or screenshots as app screens.
