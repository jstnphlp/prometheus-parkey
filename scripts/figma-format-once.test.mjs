import { Buffer } from 'node:buffer'
import console from 'node:console'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { resolve } from 'node:path'
import test from 'node:test'
import prettier from 'prettier'

test('print formatted snapshot files for one-time validation', async () => {
  const files = [
    'scripts/figma-snapshot.mjs',
    'scripts/figma-snapshot.test.mjs',
    'design-reference/manifest.json',
    'design-reference/tokens/figma-tokens.json',
    'design-reference/flows/navigation.json',
    'design-reference/assets/selection.json',
    'design-reference/README.md',
    'design-reference/CODEX_IMPLEMENTATION_PROMPT.md',
    'docs/FIGMA_MAGENTA_SCREEN_INDEX.md',
    'docs/FIGMA_MAGENTA_CODEX_PLAN.md',
    'AGENTS.md',
    'README.md'
  ]
  for (const path of files) {
    const full = resolve(process.cwd(), path)
    const original = await readFile(full, 'utf8')
    const options = (await prettier.resolveConfig(full)) || {}
    const formatted = await prettier.format(original, { ...options, filepath: full })
    const encoded = Buffer.from(formatted, 'utf8').toString('base64')
    console.log('FIGMA_FORMAT_BEGIN:' + path + ':' + encoded + ':FIGMA_FORMAT_END')
  }
})
