import type { config } from './src/discovery/config.ts'
import {
  publicEndpointProblem,
  publicSupabaseProblem,
} from './src/discovery/pilot-config.ts'

export interface ReleaseReview {
  pilotFlag?: string | undefined
  privateResearchUrl?: string | undefined
  mapProviderReviewed?: string | undefined
  searchProviderReviewed?: string | undefined
  routingProviderReviewed?: string | undefined
}

export function releaseConfigurationProblems(
  values: typeof config,
  review: ReleaseReview,
): string[] {
  const problems: string[] = []
  if (review.pilotFlag && !['true', 'false'].includes(review.pilotFlag))
    problems.push('Pilot discovery flag must be true or false.')
  if (review.privateResearchUrl)
    problems.push(
      'The development-only NCR research endpoint must be unset in release builds.',
    )
  if (review.pilotFlag === 'true' || values.supabaseUrl || values.supabaseKey) {
    const problem = publicSupabaseProblem(
      values.supabaseUrl,
      values.supabaseKey,
      true,
    )
    if (problem) problems.push(problem)
  }
  if (values.placeSearchEnabled && (!values.supabaseUrl || !values.supabaseKey))
    problems.push('Place search requires the public Supabase connection.')
  if (values.placeSearchEnabled && review.searchProviderReviewed !== 'true')
    problems.push(
      'Place search requires a recorded provider review before release.',
    )
  for (const [name, value] of [
    ['Map style', values.mapStyle],
    ['Night map style', values.nightMapStyle],
    ['Search', values.geocoder],
    ['Routing', values.routingUrl],
    ['Analytics', values.analyticsEndpoint],
  ]) {
    if (!value) continue
    const problem = publicEndpointProblem(value, true)
    if (problem) {
      problems.push(`${name}: ${problem}`)
      continue
    }
    const url = new URL(value)
    if (
      (name === 'Map style' || name === 'Night map style') &&
      url.hostname !== 'tiles.openfreemap.org' &&
      review.mapProviderReviewed !== 'true'
    )
      problems.push(
        'Custom map providers require a recorded provider review before release.',
      )
    if (name === 'Search') {
      if (url.hostname === 'photon.komoot.io')
        problems.push(
          'The Photon development demo is not a release search provider.',
        )
      else if (review.searchProviderReviewed !== 'true')
        problems.push(
          'Configured search requires a recorded provider review before release.',
        )
    }
    if (name === 'Routing') {
      if (url.hostname === 'router.project-osrm.org')
        problems.push(
          'The OSRM development demo is prohibited in release builds.',
        )
      else if (review.routingProviderReviewed !== 'true')
        problems.push(
          'Configured routing requires a recorded provider review before release.',
        )
    }
  }
  if (values.sentryDsn) {
    try {
      const dsn = new URL(values.sentryDsn)
      if (!/^[a-f0-9]{32}$/i.test(dsn.username) || dsn.password)
        problems.push('Sentry requires a public DSN key without a password.')
      dsn.username = ''
      dsn.password = ''
      const problem = publicEndpointProblem(dsn.toString(), true)
      if (problem) problems.push(`Sentry: ${problem}`)
    } catch {
      problems.push('Sentry public DSN is invalid.')
    }
  }
  return problems
}
