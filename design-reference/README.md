# Parkey design-reference — offline Figma snapshot

**Purpose:** make the editable Figma design portable into this repository so Codex can implement and visually compare Parkey without repeatedly consuming Figma MCP calls. The editable Figma file remains the ultimate **design** source; `AGENTS.md` and `docs/V1_EXECUTION_PLAN.md` remain the **product/security** source of truth.

Design: https://www.figma.com/design/UaU1KMJV2tMlwGB7Y1Co1g/Parkey-Initial-Design?node-id=244-2804

## Snapshot status (2026-11-16)

| Artifact | Status |
|---|---|
| `manifest.json` | **Included** — 60 verified Figma screen pairs / 120 node IDs |
| `tokens/figma-tokens.json` | **Included** — 19 inspected semantic color roles, metrics and Outfit examples |
| `flows/navigation.json` | **Included** — manually curated product-aware transition graph |
| `scripts/figma-snapshot.mjs` | **Included** — executable Figma **REST** exporter |
| `screens/{light-magenta,dark-magenta}/*.png` | **Not exported yet** — requires running the exporter with a locally held Figma token |
| `layouts/{light-magenta,dark-magenta}/*.json` | **Not exported yet** — requires the same token |
| `assets/exported/*` and `assets/fills/*` | **Not exported yet** — selected reusable assets / image fills are opt-in |
| `export-index.json` | Generated **only after a successful export**; includes SHA-256 provenance and completeness checks |

Do not confuse these seeded manifests with exported screenshots. No screenshots/assets have been fabricated or embedded from a rendered mockup. The file is ready for Codex but **the complete local visual reference requires the export step**.

## One-time setup — local machine only

Use Node **24 LTS** and generate a Figma **personal access token** under *Figma account Settings → Security → Personal access tokens*, with the minimum `file_content:read` scope and access to this file. The token is **not** your MCP connection: the REST API is separately rate-limited. Token expiration may require renewal. Read [Figma's official token guide](https://developers.figma.com/docs/rest-api/personal-access-tokens/) and [REST rate limits](https://developers.figma.com/docs/rest-api/rate-limits/).

**Never paste tokens into ChatGPT/Codex, GitHub issues, shell command history, app source, or `EXPO_PUBLIC_*` variables.** The exporter reads only the ephemeral `FIGMA_ACCESS_TOKEN` process environment variable and sends it in the Figma REST `X-Figma-Token` request header.

For Windows PowerShell, set a per-terminal secret without typing it as a literal command:

```powershell
$secret = Read-Host "Paste Figma token (hidden)" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
  $env:FIGMA_ACCESS_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
Remove-Variable secret, pointer
```

For macOS/Linux:

```sh
read -rs FIGMA_ACCESS_TOKEN
export FIGMA_ACCESS_TOKEN
```

## CLI workflow

From the repo root:

```sh
# Public, offline, no token or Figma access needed:
node scripts/figma-snapshot.mjs --plan
node --test scripts/figma-snapshot.test.mjs

# First export a small, high-priority slice (two modes):
node scripts/figma-snapshot.mjs --screens=21,22,22A,22B,22C,23,24,25 --theme=both

# Or export the full 120-screen paired reference, sequentially:
node scripts/figma-snapshot.mjs --all --theme=both

# Only layout trees, faster and cheaper; still REST calls:
node scripts/figma-snapshot.mjs --screens=16,16A --no-images

# Optional: selected icons/vectors (see assets/selection.json):
node scripts/figma-snapshot.mjs --assets

# Optional: download referenced Figma image fills only for chosen screens:
node scripts/figma-snapshot.mjs --screens=1,1B,2,3,4 --fills

# Integrity/completeness for ALL 120 screens, no network required:
node scripts/figma-snapshot.mjs --check
```

**The script enforces a minimum 8-second delay between Figma REST calls**, batches up to five screen node IDs, handles 429 `Retry-After` and transient errors, and writes each successful batch to disk. The REST quota depends on account, file plan, and endpoint; it is **not unlimited**. Figma can still return plan-based limits or 403. Increase `--delay-ms=12000` if throttled. With `--all`, expect a large local export; check file sizes and asset licenses before committing to a public repo.

Do not script multiple concurrent exports against the same `export-index.json`. Re-running the same `--screens` selection overwrites only that selection. Partial export after a failure is safe to retry; only **verify** a complete snapshot after all 120 frames have been fetched.

### Output

- `screens/light-magenta/22.png`, `screens/dark-magenta/22.png`: high-fidelity reference images, **not production app assets**.
- `layouts/light-magenta/22.json`, `layouts/dark-magenta/22.json`: per-node hierarchy, sizes/positions, text, fills, effects, component refs, and Figma prototype reactions where available. Vector geometry is not included: export chosen reusable vectors separately as SVG.
- `assets/selection.json`: you choose reusable Figma nodes by verified node IDs and safe filenames; exports land in `assets/exported/`.
- `assets/fills/`: optional actual image-fill files, keyed to the Figma imageRef via the export index; **do not** repurpose illustrative parking imagery as real parking evidence.
- `export-index.json`: relative file paths, source file versions, SHA-256 integrity hashes, last download time. No bearer tokens or expiring CDN download URLs are written there.

Example optional asset selection (replace the illustrative node ID with an **actual** node ID from the layout JSON or Figma inspector):

```json
{
  "schemaVersion": 1,
  "assets": [
    { "name": "approved-brand-mark", "nodeId": "123:456", "format": "svg" }
  ]
}
```

Use the existing licensing policy before putting vectors, fonts, or photography into production. **Exported screen PNGs are comparison references, not UI implementations.**

## How Codex should use the snapshot

1. Read `AGENTS.md`, `docs/V1_EXECUTION_PLAN.md`, and the four `docs/FIGMA_MAGENTA_*.md` handoff files.
2. Inspect `manifest.json`, `tokens/figma-tokens.json`, `flows/navigation.json` and `export-index.json` (if present). Never claim 120 screenshots exist just because the screen IDs are present.
3. Prefer matching local `screens/<theme>/<id>.png` and `layouts/<theme>/<id>.json` for each active screen. Use Figma MCP only for genuinely missing or stale information; if REST is available locally, update just the changed nodes.
4. Implement **React Native + native StyleSheet**, functional interactions, persistent dual-magenta theme, Outfit typography and real MapLibre discovery. Never ship the reference images themselves as screens or map data.
5. Preserve anonymous discovery, provider and consent limitations, no booking/live vacancy/fake account flows. Treat manually curated flow edges as guidance, not proof that Figma prototype click-through or real backend is working.
6. Capture before/after screenshots from the running app and report device/browser tests. Include source node IDs and comparison evidence in the PR.
7. When the Figma design changes, refresh only the affected screen IDs and commit the updated snapshot together with the app change after reviewing diff/size/privacy.

For the technical basis: Figma [file-node and image REST endpoints](https://developers.figma.com/docs/rest-api/file-endpoints/) and [rate limits](https://developers.figma.com/docs/rest-api/rate-limits/).

### Troubleshooting

- `--check` fails before the first export: expected. The manifests/tokens are present, but screen images/layouts have not been fetched.
- HTTP 403: confirm PAT access, `file_content:read` scope, matching Figma file permissions and API plan restrictions.
- HTTP 429: retry later or increase `--delay-ms`. The tool respects `Retry-After` but cannot increase your quota.
- `--no-images` does not create PNGs; the completeness check will report missing screenshots.
- Some Figma nodes are non-renderable. The exporter fails visibly rather than inventing a screenshot.
