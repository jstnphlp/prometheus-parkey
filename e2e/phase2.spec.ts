import { test, expect, openMap, expandResults } from './fixtures'
import type { DiscoveryParking } from '../packages/shared-types/src/index'

test.setTimeout(120_000)

// Entirely synthetic provider fixtures. No actual parking is approved or uploaded.
const fixture: DiscoveryParking = {
  id: 'e3000000-0000-4000-8000-000000000001',
  name: 'SYNTHETIC approved API fixture',
  kind: 'lot',
  side: 'unknown',
  geometry: { type: 'Point', coordinates: [121.0304, 14.5645] },
  address: null,
  fees: null,
  hours: null,
  regulations: [],
  sourceKind: 'parkey',
  sourceLabel: 'Fictional browser test only',
  sourceUrl: 'https://example.org/synthetic',
  license: 'CC0-1.0',
  sourceUpdatedAt: null,
  verification: 'verified',
  verifiedAt: '2026-11-01T00:00:00Z',
}
const hosted = process.env.PARKEY_E2E_DISCOVERY_MODE === 'hosted'
const rpc = 'https://phase2.parkey.test/rest/v1/rpc/discover_approved_parking'
const response = (records: DiscoveryParking[]) => ({
  contractVersion: 1,
  records,
  truncated: false,
})

test('synthetic mode is prominently labeled and never requests discovery', async ({
  page,
}) => {
  test.skip(hosted)
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/rest/v1/')) requests.push(request.url())
  })
  await openMap(page)
  await expect(
    page.getByText('SAMPLE PARKING · Not real parking locations', {
      exact: true,
    }),
  ).toBeVisible()
  await expandResults(page)
  await expect(page.getByTestId('parking-row-sample-lot')).toBeVisible()
  expect(requests).toEqual([])
})

test('hosted records support details and search without the bundled pilot', async ({
  page,
}) => {
  test.skip(!hosted)
  await page.route(rpc, (route) => route.fulfill({ json: response([fixture]) }))
  await openMap(page)
  await page.getByTestId('destination-query').fill('Poblacion')
  await expect(page.getByTestId('destination-result-0')).toContainText(
    'Poblacion Test Cafe',
  )
  await page.getByTestId('destination-result-0').click()
  // Destination selection opens the medium sheet; one activation expands it.
  await page.getByTestId('parking-sheet-handle').click()
  const row = page.getByTestId(`parking-row-${fixture.id}`)
  await expect(row).toBeVisible()
  await expect(page.getByTestId(/^parking-row-osm/)).toHaveCount(0)
  await row.click()
  await expect(page.getByTestId('parking-detail-title')).toHaveText(
    fixture.name,
  )
})

test('cold backend failure stays empty and Retry recovers without pilot fallback', async ({
  page,
}) => {
  test.skip(!hosted)
  let fail = true
  await page.route(rpc, (route) =>
    fail
      ? route.abort('internetdisconnected')
      : route.fulfill({ json: response([fixture]) }),
  )
  await openMap(page)
  await expandResults(page)
  await expect(
    page
      .getByText(/Couldn’t update parking information/)
      .filter({ visible: true }),
  ).toBeVisible()
  await expect(page.getByTestId(/^parking-row-/)).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Retry', exact: true })
    .filter({ visible: true })
    .first()
    .click()
  // Retry debounces the request. Recover only after the gesture so a settling
  // viewport cannot remove the Retry button through an earlier automatic load.
  fail = false
  await expect(page.getByTestId(`parking-row-${fixture.id}`)).toBeVisible()
})

test('denied location does not block hosted map discovery or search', async ({
  page,
  context,
}) => {
  test.skip(!hosted)
  await context.clearPermissions()
  await context.grantPermissions([], { origin: 'http://localhost:8088' })
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_success, error) =>
      error?.({
        code: 1,
        message: 'Denied',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      })
  })
  await page.route(rpc, (route) => route.fulfill({ json: response([fixture]) }))
  await openMap(page)
  await page
    .getByRole('button', { name: 'Center on my location', exact: true })
    .first()
    .click()
  await page.getByTestId('destination-query').fill('Poblacion')
  await expect(page.getByTestId('destination-result-0')).toBeVisible()
  await page.getByTestId('destination-result-0').click()
  await page.getByTestId('parking-sheet-handle').click()
  await expect(page.getByTestId(`parking-row-${fixture.id}`)).toBeVisible()
})
