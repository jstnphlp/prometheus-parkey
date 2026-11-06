import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import type {
  PilotCity,
  PilotMode,
  PilotPage,
  PilotParking,
  PilotDestination,
} from '../../packages/shared-types/src/pilot-discovery'

import { isObject } from '../../apps/mobile/src/discovery/model'

// Deliberately synthetic responses. Actual SQL/RLS and Android use the local DB.
export function parking(city: PilotCity, mode: PilotMode): PilotParking {
  const coordinate: [number, number] =
    city === 'Manila' ? [120.9755, 14.591] : [121.0555, 14.58]
  return {
    id: mode === 'candidate_research' ? `qa-candidate-${city}` : `qa-${city}`,
    sourceObservationId: `qa-source-${city}`,
    name: `Parking near ${city} Test Museum`,
    officialName: null,
    descriptiveLabel: `Parking near ${city} Test Museum`,
    featureType: 'lot',
    geometry: { type: 'Point', coordinates: coordinate },
    representativePoint: coordinate,
    accessClass: mode === 'public' ? 'public_visitors' : 'unknown',
    restrictedAccess: false,
    source: {
      kind: 'osm',
      url: 'https://www.openstreetmap.org/node/1',
      license: 'ODbL-1.0',
      attribution: 'OpenStreetMap contributors — synthetic test fixture',
      updatedAt: '2026-11-05T00:00:00Z',
    },
    evidence: {
      researchStatus: 'synthetic_browser_fixture',
      onlineCorroborated: false,
      operatorConfirmed: false,
      physicallyVerified: false,
      publicationApproved: mode === 'public',
    },
    navigationApproval: null,
    reviewDueAt:
      mode === 'public' ? new Date(Date.now() + 86400000).toISOString() : null,
    fees: null,
    hours: null,
    destinationContext: [],
    warnings: [
      'Synthetic test fixture. Source point is not a verified entrance.',
    ],
  }
}
export function destination(
  city: PilotCity,
  mode: PilotMode,
): PilotDestination {
  return {
    id: `destination-${city}`,
    name: `${city} Test Museum`,
    category: 'museum',
    coordinate: city === 'Manila' ? [120.9755, 14.591] : [121.0555, 14.58],
    source: {
      url: 'https://www.openstreetmap.org/node/2',
      license: 'ODbL-1.0',
      attribution: 'OpenStreetMap contributors — synthetic test fixture',
      updatedAt: null,
    },
    publicationApproved: mode === 'public',
    reviewDueAt:
      mode === 'public' ? new Date(Date.now() + 86400000).toISOString() : null,
    parkingIdentity: false,
    parkingAccessConfirmed: false,
  }
}
export function envelope<T>(
  kind: PilotPage<T>['kind'],
  city: PilotCity,
  mode: PilotMode,
  records: T[],
): PilotPage<T> {
  return {
    schemaVersion: 1,
    kind,
    scopeVersion: 'manila-mandaluyong-v1',
    city,
    mode,
    records,
    nextCursor: null,
    notice: 'Synthetic browser fixture; no actual parking approvals.',
  }
}
export const reviewerToken = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
    'base64url',
  ),
  Buffer.from(
    JSON.stringify({
      role: 'authenticated',
      sub: 'b1b00000-0000-4000-8000-000000000001',
      aal: 'aal2',
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString('base64url'),
  'synthetic-signature-not-valid-for-any-service',
].join('.')

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('https://e2e.parkey.test/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      if (path === '/map-style.json')
        await route.fulfill({
          json: {
            version: 8,
            sources: {},
            layers: [
              {
                id: 'background',
                type: 'background',
                paint: { 'background-color': '#f5f3ef' },
              },
            ],
          },
        })
      else if (path.startsWith('/rest/v1/rpc/')) {
        const body: unknown = route.request().postDataJSON()
        if (!isObject(body)) throw new Error('Expected structured RPC request')
        const parameters = body
        const city: PilotCity =
          parameters.p_city === 'Mandaluyong' ? 'Mandaluyong' : 'Manila'
        const mode: PilotMode =
          parameters.p_mode === 'candidate_research'
            ? 'candidate_research'
            : 'public'
        if (
          mode === 'candidate_research' &&
          route.request().headers().authorization !== `Bearer ${reviewerToken}`
        )
          await route.fulfill({
            status: 403,
            json: { message: 'Synthetic reviewer access denied' },
          })
        else if (path.endsWith('/discover_pilot_destinations'))
          await route.fulfill({
            json: envelope('pilot_destinations', city, mode, [
              destination(city, mode),
            ]),
          })
        else if (path.endsWith('/discover_pilot_parking'))
          await route.fulfill({
            json: envelope('pilot_discovery', city, mode, [
              parking(city, mode),
            ]),
          })
        else
          await route.fulfill({
            status: 403,
            json: { message: 'No current navigation approval' },
          })
      } else await route.abort()
    })
    await use(page)
  },
})
export { expect }
export async function openPilot(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('pilot-screen')).toBeVisible({
    timeout: 30_000,
  })
}
export async function openResults(page: Page) {
  await page.getByTestId('pilot-results').click()
}
export async function closeDetails(page: Page) {
  await page
    .getByRole('button', { name: /^Close Parking (details|observation)$/ })
    .click()
}
