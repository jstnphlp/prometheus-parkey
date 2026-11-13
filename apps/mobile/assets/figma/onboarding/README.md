# Phase 1 introduction assets

Source: [Parkey Initial Design](https://www.figma.com/design/UaU1KMJV2tMlwGB7Y1Co1g/Parkey-Initial-Design?node-id=0-1), inspected node-by-node with Figma MCP.

| File                   | Source node                                    | Original dimensions |
| ---------------------- | ---------------------------------------------- | ------------------- |
| `splash-logo.svg`      | `39:6` / `41:6`                                | 176 × 192.574       |
| `welcome-logo.svg`     | `11:68` in `11:16`                             | 96 × 106            |
| `account-logo.svg`     | `11:109` in `11:44`, also `11:78` in `11:30`   | 66 × 72.2152        |
| `discover-preview.svg` | complete illustration frame `26:32` in `19:2`  | 338 × 274           |
| `compare-preview.svg`  | complete illustration frame `27:2` in `19:32`  | 338 × 274           |
| `navigate-preview.svg` | complete illustration frame `26:77` in `19:60` | 338 × 274           |

Logos are the original downloaded vectors. Illustration frames were exported as
SVG with text outlined, without changing the Figma document. The SVGs retain
their original root dimensions and paths. PNG and `@3x.png` files are exact local
rasterizations using `@resvg/resvg-js` 2.6.2, allowing React Native Image and Metro
to select density without an SVG transformer or runtime remote URL.

The illustrations are **static previews**, not approved animations or live map
data. The welcome node's empty white GIF placeholder remains empty. Replace only
these illustration slots when approved animation assets are supplied; respect
the platform reduced-motion preference. Native status/navigation bars replace
the Figma phone chrome; no status icons or home indicator are exported.
