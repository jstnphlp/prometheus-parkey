import { log } from 'node:console'
import process from 'node:process'
import { URL } from 'node:url'

import { config } from '../apps/mobile/src/discovery/config.ts'

if (process.env.NODE_ENV !== 'production')
  throw new Error(
    'Run with NODE_ENV=production to check production configuration.',
  )
const problems = []
if (config.routingUrl) {
  const url = new URL(config.routingUrl)
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.hostname === 'router.project-osrm.org'
  )
    problems.push(
      'Routing must use an owned/licensed public HTTPS endpoint without credentials or the development demo.',
    )
} else {
  log('Production routing is disabled, as requested.')
}
if (Boolean(config.supabaseUrl) !== Boolean(config.supabaseKey))
  problems.push('Configure both public Supabase values or neither.')
if (problems.length) throw new Error(problems.join('\n'))
log(
  'Public configuration check passed. Provider licensing, signing, device behavior and store distribution require separate verification.',
)
