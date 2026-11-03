import { spawnSync } from 'node:child_process'
import { exit, platform } from 'node:process'

const result = spawnSync(
  platform === 'win32' ? 'python' : 'python3',
  ['scripts/test-osm-extract.py'],
  { stdio: 'inherit' },
)
if (result.error) throw result.error
exit(result.status ?? 1)
