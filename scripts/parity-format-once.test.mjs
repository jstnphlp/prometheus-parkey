import { Buffer } from 'node:buffer'
import console from 'node:console'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { resolve } from 'node:path'
import test from 'node:test'
import prettier from 'prettier'

test('one-time format audit inputs for PR cleanup', async () => {
  const paths = [
    'apps/mobile/src/discovery/search.tsx',
    'apps/mobile/src/discovery/explore.tsx',
    'apps/mobile/src/components/popup-provider.tsx',
    'e2e/discovery.spec.ts',
    'docs/FIGMA_MAGENTA_DESIGN_TOKENS.md',
    'docs/FIGMA_MAGENTA_INTERACTIVE_ARCHITECTURE.md',
    'docs/FIGMA_MAGENTA_PARITY_AUDIT.md',
  ]
  for (const path of paths) {
    const full = resolve(process.cwd(), path)
    const original = await readFile(full, 'utf8')
    const options = (await prettier.resolveConfig(full)) || {}
    const formatted = await prettier.format(original, { ...options, filepath: full })
    console.log('PARITY_FORMAT_BEGIN:' + path + ':' + Buffer.from(formatted, 'utf8').toString('base64') + ':PARITY_FORMAT_END')
  }
})
