import { log } from 'node:console'
import process from 'node:process'

if (process.env.PARKEY_RELEASE_BUILD === 'true')
  await import('./check-mobile-release.mjs')
else
  log(
    'Development build: release configuration checks run on release profiles.',
  )
