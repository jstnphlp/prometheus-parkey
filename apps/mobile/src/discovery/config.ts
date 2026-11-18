const releaseBuild =
  process.env.NODE_ENV === 'production' ||
  process.env.PARKEY_RELEASE_BUILD === 'true'

export const config = {
  // Collection is locked off until the canonical privacy/release gates pass.
  // Keep the existing adapters separate; configuration alone is not consent.
  analyticsEndpoint: '',
  analyticsDomain: '',
  sentryDsn: '',
  mapStyle:
    process.env.EXPO_PUBLIC_MAP_STYLE_URL ||
    'https://tiles.openfreemap.org/styles/positron',
  nightMapStyle:
    process.env.EXPO_PUBLIC_NIGHT_MAP_STYLE_URL ||
    'https://tiles.openfreemap.org/styles/dark',
  routingUrl:
    process.env.EXPO_PUBLIC_OSRM_URL ||
    (!releaseBuild && process.env.NODE_ENV === 'development'
      ? 'https://router.project-osrm.org'
      : ''),
  placeSearchEnabled: process.env.EXPO_PUBLIC_PLACE_SEARCH_ENABLED === 'true',
  geocoder:
    process.env.EXPO_PUBLIC_PHOTON_URL ||
    (releaseBuild ? '' : 'https://photon.komoot.io/api/'),
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
  ncrResearchUrl:
    !releaseBuild && process.env.NODE_ENV === 'development'
      ? process.env.EXPO_PUBLIC_NCR_RESEARCH_URL || 'http://127.0.0.1:8090'
      : '',
}
export const hasDiscoveryBackend = Boolean(
  config.supabaseUrl && config.supabaseKey,
)
