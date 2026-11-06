import { log } from 'node:console'
import process from 'node:process'

import { config } from '../apps/mobile/src/discovery/config.ts'
import { releaseConfigurationProblems } from '../apps/mobile/release-policy.ts'

if (process.env.NODE_ENV !== 'production')
  throw new Error(
    'Run with NODE_ENV=production to check production configuration.',
  )
const problems = releaseConfigurationProblems(config, {
  pilotFlag: process.env.EXPO_PUBLIC_PILOT_DISCOVERY_ENABLED,
  privateResearchUrl: process.env.EXPO_PUBLIC_NCR_RESEARCH_URL,
  mapProviderReviewed: process.env.PARKEY_MAP_PROVIDER_REVIEWED,
  searchProviderReviewed: process.env.PARKEY_SEARCH_PROVIDER_REVIEWED,
  routingProviderReviewed: process.env.PARKEY_ROUTING_PROVIDER_REVIEWED,
})
if (!config.routingUrl) {
  log('Production routing is disabled, as requested.')
}
if (problems.length) throw new Error(problems.join('\n'))
log(
  'Public configuration check passed. Provider licensing, signing, device behavior and store distribution require separate verification.',
)
