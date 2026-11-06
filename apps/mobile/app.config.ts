import type { ConfigContext, ExpoConfig } from 'expo/config'

import { releaseConfigurationProblems } from './release-policy.ts'
import { config as publicConfig } from './src/discovery/config.ts'

export default function appConfig({ config }: ConfigContext): ExpoConfig {
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.PARKEY_RELEASE_BUILD === 'true'
  ) {
    const problems = releaseConfigurationProblems(publicConfig, {
      pilotFlag: process.env.EXPO_PUBLIC_PILOT_DISCOVERY_ENABLED,
      privateResearchUrl: process.env.EXPO_PUBLIC_NCR_RESEARCH_URL,
      mapProviderReviewed: process.env.PARKEY_MAP_PROVIDER_REVIEWED,
      searchProviderReviewed: process.env.PARKEY_SEARCH_PROVIDER_REVIEWED,
      routingProviderReviewed: process.env.PARKEY_ROUTING_PROVIDER_REVIEWED,
    })
    if (problems.length) throw new Error(problems.join('\n'))
  }
  return { ...config, name: 'Parkey', slug: 'parkey' }
}
