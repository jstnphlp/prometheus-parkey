# Phase 1 introduction assets

Source: [Parkey Initial Design](https://www.figma.com/design/UaU1KMJV2tMlwGB7Y1Co1g/Parkey-Initial-Design?node-id=0-1), inspected node-by-node with Figma MCP.

| File                        | Source node                                    | Original dimensions                        |
| --------------------------- | ---------------------------------------------- | ------------------------------------------ |
| `splash-logo.svg`           | `39:6` / `41:6`                                | 176 × 192.574                              |
| `welcome-logo.svg`          | `11:68` in `11:16`                             | 96 × 106                                   |
| `account-logo.svg`          | `11:109` in `11:44`, also `11:78` in `11:30`   | 66 × 72.2152                               |
| `discover-illustration.png` | static image `54:83` in `19:2`                 | 1448 × 1086 source; 365 × 274 display slot |
| `compare-preview.svg`       | complete illustration frame `27:2` in `19:32`  | 338 × 274                                  |
| `navigate-preview.svg`      | complete illustration frame `26:77` in `19:60` | 338 × 274                                  |

Logos are the original downloaded vectors. Compare and Navigate frames were exported as
SVG with text outlined, without changing the Figma document. The SVGs retain
their original root dimensions and paths. PNG and `@3x.png` files are exact local
rasterizations using `@resvg/resvg-js` 2.6.2, allowing React Native Image and Metro
to select density without an SVG transformer or runtime remote URL. Discover uses
the unmodified PNG supplied by the current Figma node, clipped to its 17pt corners.

The illustrations are **static previews**, not approved animations or live map
data. The current Welcome node has no animation slot. Replace only the onboarding
illustration slots when approved animation assets are supplied; respect
the platform reduced-motion preference. Native status/navigation bars replace
the Figma phone chrome; no status icons or home indicator are exported.

## Phase 3 current Figma exports

The owner deferred final animations and requested the current Figma artwork.
These PNG renders were exported through Figma MCP with the source layout's
clipping preserved; no replacement artwork was generated.

| File                          | Source node            | Export dimensions |
| ----------------------------- | ---------------------- | ----------------- |
| `phase3-discover.png`         | `70:553` in `70:537`   | 390 × 351         |
| `phase3-compare.png`          | `94:936` in `94:920`   | 390 × 251         |
| `phase3-navigate.png`         | `103:996` in `103:980` | 348 × 348         |
| `phase3-welcome-wordmark.png` | `70:428` in `70:333`   | 175 × 62          |

The compact Welcome lockup combines the existing original logo with the exact
rendered Baloo 2 wordmark glyphs. The three scene exports replace the older
preview slots in the UI; the earlier files remain as Phase 1 source evidence.
These are static illustrations, including illustrative parking signs, and do
not represent live prices or availability. Final loop/animation acceptance is
deferred until approved files are supplied. No remote asset URL is used at runtime.
