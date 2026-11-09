import type { Page } from '@playwright/test'
import type { DiscoveryParking } from '../packages/shared-types/src/index'
import { readFileSync } from 'node:fs'

import { isParking } from '../apps/mobile/src/discovery/data'

import { test, expect, openMap, spot, spotPath } from './fixtures'

const parkingRpc = 'https://e2e.parkey.test/rest/v1/rpc/discover_parking'

// Every fact and authorization below is a synthetic browser fixture. It does
// not publish source records or establish real parking access/verification.
function parkingFixture(
  patch: Partial<DiscoveryParking> = {},
): DiscoveryParking {
  const archive: unknown = JSON.parse(
    readFileSync(
      new URL('../apps/mobile/src/discovery/osm-pilot.json', import.meta.url),
      'utf8',
    ),
  )
  if (!Array.isArray(archive) || !archive.every(isParking))
    throw new Error('Invalid bundled parking fixture')
  const original = archive.find((record) => record.id === spot.id)
  if (!original) throw new Error('Expected bundled parking fixture')
  return {
    ...original,
    name: 'Synthetic reviewed garage',
    kind: 'garage',
    fees: 'PHP 40/hr',
    hours: '24/7',
    osmTags: { fee: 'yes', charge: 'PHP 40/hr', access: 'public' },
    regulations: [],
    entrances: [[spot.longitude, spot.latitude]],
    navigationApproval: {
      entrance: [spot.longitude, spot.latitude],
      entranceConfirmed: true,
      visitorAccessConfirmed: true,
      operatorAuthorized: true,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
    ...patch,
  }
}

async function openFixture(page: Page, record: DiscoveryParking) {
  await page.route(parkingRpc, (route) =>
    route.fulfill({ json: { records: [record], truncated: false } }),
  )
  const loaded = page.waitForResponse(parkingRpc)
  await openMap(page, spotPath)
  await loaded
  const handle = page.getByTestId('parking-sheet-handle')
  await expect(page.getByTestId('parking-detail-title')).toHaveText(
    record.name.startsWith('Unnamed') ? 'Garage' : record.name,
  )
  if (!(await handle.getAttribute('aria-label'))?.includes('full'))
    await handle.click()
  await expect(page.getByTestId('parking-details-expanded')).toBeVisible()
  return page.getByTestId('parking-details-expanded')
}

test('known garage facts and unnamed classification retain source trust without invented photos', async ({
  page,
}) => {
  const details = await openFixture(
    page,
    parkingFixture({ name: 'Unnamed parking · OpenStreetMap' }),
  )
  await expect(page.getByTestId('parking-detail-title')).toHaveText('Garage')
  await expect(details).toContainText('PHP 40/hr')
  await expect(details).toContainText('Open 24h')
  await expect(details).toContainText('Reviewed vehicle entrance')
  await expect(details).toContainText('No photos yet')
  await expect(details).toContainText(
    'Source dates do not confirm current fees',
  )
  await expect(
    details.getByRole('link', { name: 'View source record' }),
  ).toBeVisible()
  await expect(page.getByTestId('parking-get-directions')).toBeEnabled()
  await expect(page.getByTestId('parking-verification')).toHaveText(
    'Not field verified. No live availability',
  )
})

test('missing facts remain unknown and cannot authorize directions or substitute photos', async ({
  page,
}) => {
  const photoReads: string[] = []
  page.on('request', (request) => {
    if (/mapillary|wikimedia|images\.example/.test(request.url()))
      photoReads.push(request.url())
  })
  const details = await openFixture(
    page,
    parkingFixture({
      fees: null,
      hours: null,
      entrances: [],
      navigationApproval: null,
      osmTags: {
        image: 'https://images.example/unapproved-parking.jpg',
        mapillary: '12345',
        wikimedia_commons: 'File:Unapproved parking.jpg',
      },
    }),
  )
  await expect(details).toContainText('Fee unknown')
  await expect(details).toContainText('Not recorded')
  await expect(details).toContainText('Entrance not mapped')
  await expect(details).toContainText('No photos yet')
  await expect(details.getByText(/Open now|Closed ·|Open 24h/)).toHaveCount(0)
  await expect(page.getByTestId('parking-get-directions')).toBeDisabled()
  expect(photoReads).toEqual([])
})

test('contradictory fee and opening schedules retain raw sources without Free or computed Open claims', async ({
  page,
}) => {
  const details = await openFixture(
    page,
    parkingFixture({
      fees: 'PHP 40/hr',
      hours: 'Mo-Fr 08:00-18:00',
      osmTags: {
        fee: 'no',
        charge: 'PHP 60/hr',
        opening_hours: '24/7',
        access: 'public',
      },
    }),
  )
  await expect(details.getByRole('alert')).toContainText('Fee sources conflict')
  await expect(details.getByRole('alert')).toContainText(
    'Hours sources conflict',
  )
  await expect(details).toContainText('Fee unknown')
  for (const raw of ['PHP 40/hr', 'PHP 60/hr', '24/7', 'Mo-Fr 08:00-18:00'])
    await expect(details.getByText(raw, { exact: true })).toBeVisible()
  await expect(
    details.getByText(/^(Free|Recorded no fee|Open 24h|Open now.*|Closed.*)$/),
  ).toHaveCount(0)
})

for (const state of ['restricted', 'expired'] as const) {
  test(`${state} parking authorization cannot enable a route`, async ({
    page,
  }) => {
    const record = parkingFixture()
    if (state === 'restricted')
      record.osmTags = { access: 'private', fee: 'yes' }
    else if (record.navigationApproval)
      record.navigationApproval.expiresAt = new Date(
        Date.now() - 60000,
      ).toISOString()
    const routeReads: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/route/v1/driving/'))
        routeReads.push(request.url())
    })
    const details = await openFixture(page, record)
    await expect(page.getByTestId('parking-get-directions')).toBeDisabled()
    await expect(page.getByTestId('parking-navigation-warning')).toContainText(
      'operator authorization',
    )
    if (state === 'restricted')
      await expect(details.getByRole('alert')).toContainText('Private parking')
    await expect(page.getByTestId('route-panel')).toHaveCount(0)
    expect(routeReads).toEqual([])
  })
}

for (const freshState of ['revoked', 'expired'] as const) {
  test(`fresh ${freshState} approval after selection and consent prevents all navigation`, async ({
    page,
  }) => {
    const original = parkingFixture()
    await openFixture(page, original)
    const routeReads: string[] = []
    const externalHandoffs: string[] = []
    await page.exposeFunction('recordTrustTestHandoff', (url: string) => {
      externalHandoffs.push(url)
    })
    await page.evaluate(() => {
      window.open = (url) => {
        void (
          window as typeof window & {
            recordTrustTestHandoff: (value: string) => Promise<void>
          }
        ).recordTrustTestHandoff(String(url))
        return null
      }
    })
    page.on('request', (request) => {
      if (request.url().includes('/route/v1/driving/'))
        routeReads.push(request.url())
    })
    await page.getByTestId('parking-get-directions').click()
    const consent = page.getByRole('alertdialog', {
      name: 'Directions privacy',
    })
    await expect(consent).toBeVisible()
    expect(routeReads).toEqual([])

    const fresh = parkingFixture({
      navigationApproval:
        freshState === 'revoked'
          ? null
          : original.navigationApproval
            ? {
                ...original.navigationApproval,
                expiresAt: new Date(Date.now() - 60000).toISOString(),
              }
            : null,
    })
    let currentApprovalReads = 0
    await page.route(parkingRpc, async (route) => {
      currentApprovalReads++
      await route.fulfill({ json: { records: [fresh], truncated: false } })
    })
    await consent.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByTestId('parking-entrance-check')).toContainText(
      'Parking entrance approval was revoked, expired or could not be confirmed. No route was started.',
    )
    expect(currentApprovalReads).toBeGreaterThanOrEqual(1)
    await expect(page.getByTestId('route-panel')).toHaveCount(0)
    await expect(page.getByTestId('navigation-banner')).toHaveCount(0)
    await expect(consent).toHaveCount(0)
    expect(routeReads).toEqual([])
    expect(externalHandoffs).toEqual([])
    await page.getByRole('button', { name: 'Dismiss entrance notice' }).click()
    await expect(page.getByTestId('parking-entrance-check')).toHaveCount(0)
  })
}
