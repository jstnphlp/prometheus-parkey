# Profile vehicle artwork

Source: `UaU1KMJV2tMlwGB7Y1Co1g`, Interactive Architecture screen 9,
Light + Magenta `249:2053` / Dark + Magenta `249:5485`.

| Asset      | Figma artwork node      |
| ---------- | ----------------------- |
| motorcycle | `249:2063` / `317:3518` |
| sedan      | `249:2071` / `317:3541` |
| suv        | `249:2083` / `317:3562` |
| pickup     | `249:2095` / `317:3584` |
| van        | `249:2107` / `317:3605` |
| other      | `249:2119` / `317:3627` |

The files in `source/` are the original unmodified SVG assets returned by Figma
MCP design context. The transparent PNG families compose those original layers
at the source frame's documented offsets, preserving each SVG's intrinsic
dimensions and artwork. They are rendered at 112 × 64, 224 × 128, and 336 × 192
for Metro's 1x/2x/3x selection. No runtime remote URLs or SVG transformer is used.

The initial whole-frame PNG exports included an opaque white canvas. The
transparent families preserve the actual source artwork on both theme surfaces.
