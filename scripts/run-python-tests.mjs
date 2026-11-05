import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { exit, platform } from 'node:process'

// unittest discovery ignores hyphenated module names; execute each existing
// script directly so the original extractor tests cannot silently disappear.
for (const file of readdirSync('scripts')
  .filter((name) => /^test-.*\.py$/.test(name))
  .sort()) {
  const result = spawnSync(
    platform === 'win32' ? 'python' : 'python3',
    ['scripts/' + file],
    { stdio: 'inherit' },
  )
  if (result.error) throw result.error
  if (result.status !== 0) exit(result.status ?? 1)
}
