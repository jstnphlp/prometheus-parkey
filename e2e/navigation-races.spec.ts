import type { Page } from '@playwright/test'

import { isParking } from '../apps/mobile/src/discovery/data'

import {
  test,
  expect,
  installNavigationSensor,
  openSpot,
  spot,
} from './fixtures'

test.use({ reviewedNavigation: true })
const parkingRpc = 'https://e2e.parkey.test/rest/v1/rpc/discover_parking'

function routingRequests(page: Page) {
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/route/v1/driving/'))
      requests.push(request.url())
  })
  return requests
}

async function interceptHandoffs(page: Page) {
  await page.evaluate(() => {
    const handoffs: string[] = []
    Object.defineProperty(window, 'parkeyRaceHandoffs', { value: handoffs })
    window.open = (url) => {
      handoffs.push(String(url))
      return null
    }
  })
}

async function acceptDirections(page: Page) {
  await page.getByTestId('parking-get-directions').click()
  await page
    .getByRole('alertdialog', { name: 'Directions privacy' })
    .getByRole('button', { name: 'Continue', exact: true })
    .click()
}

test('Back cancels a delayed external entrance refresh even when the same parking stays selected', async ({
  page,
}) => {
  const requests = routingRequests(page)
  await installNavigationSensor(page)
  const originalResponse = page.waitForResponse(parkingRpc)
  await openSpot(page)
  const currentParking: unknown = await (await originalResponse).json()
  // External Maps is an explicit recovery action when the routing provider
  // fails; it is intentionally not offered over an active driving banner.
  await page.route('https://e2e.parkey.test/route/v1/driving/**', (route) =>
    route.fulfill({ status: 503, body: 'Synthetic routing outage' }),
  )
  await acceptDirections(page)
  await expect(page.getByTestId('route-panel').getByRole('alert')).toBeVisible()
  const baselineRoutes = requests.length
  await interceptHandoffs(page)
  let release = () => {}
  let completed = () => {}
  const waitForRelease = new Promise<void>((resolve) => {
    release = resolve
  })
  const finished = new Promise<void>((resolve) => {
    completed = resolve
  })
  let refreshStarted = false
  await page.route(parkingRpc, async (route) => {
    refreshStarted = true
    await waitForRelease
    // Aborted browser requests may still allow a synthetic late server reply.
    try {
      await route.fulfill({ json: currentParking })
    } finally {
      completed()
    }
  })
  await page
    .getByRole('button', { name: 'Open in Google Maps', exact: true })
    .click()
  await expect.poll(() => refreshStarted).toBe(true)
  await page.goBack()
  await expect(page.getByTestId('route-panel')).toHaveCount(0)
  await expect(page.getByTestId('parking-detail-title')).toHaveText(spot.name)
  expect(new URL(page.url()).searchParams.get('spot')).toBe(spot.id)
  release()
  await finished
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  expect(
    await page.evaluate(() => Reflect.get(window, 'parkeyRaceHandoffs')),
  ).toEqual([])
  expect(requests).toHaveLength(baselineRoutes)
  await expect(page.getByTestId('navigation-banner')).toHaveCount(0)
})

test('late GPS after Back cannot start or rearm navigation, and a new explicit request still works', async ({
  page,
}) => {
  const requests = routingRequests(page)
  await installNavigationSensor(page)
  await openSpot(page)
  await page.evaluate(() => {
    const original = navigator.geolocation.getCurrentPosition.bind(
      navigator.geolocation,
    )
    let delay = true
    navigator.geolocation.getCurrentPosition = (success, error, options) => {
      if (!delay) return original(success, error, options)
      delay = false
      Object.defineProperty(window, 'parkeyRaceGpsWaiting', {
        value: true,
        configurable: true,
      })
      window.addEventListener(
        'parkey-release-race-gps',
        () => {
          original(
            (position) => {
              success(position)
              Object.defineProperty(window, 'parkeyRaceGpsDelivered', {
                value: true,
              })
            },
            error,
            options,
          )
        },
        { once: true },
      )
    }
  })
  await acceptDirections(page)
  await expect
    .poll(() =>
      page.evaluate(() => Reflect.get(window, 'parkeyRaceGpsWaiting')),
    )
    .toBe(true)
  await expect(page.getByTestId('route-panel')).toBeVisible()
  expect(requests).toEqual([])
  await page.goBack()
  await expect(page.getByTestId('route-panel')).toHaveCount(0)
  await expect(page.getByTestId('parking-detail-title')).toHaveText(spot.name)
  await page.evaluate(() =>
    window.dispatchEvent(new Event('parkey-release-race-gps')),
  )
  await expect
    .poll(() =>
      page.evaluate(() => Reflect.get(window, 'parkeyRaceGpsDelivered')),
    )
    .toBe(true)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  expect(requests).toEqual([])
  await expect(page.getByTestId('route-panel')).toHaveCount(0)
  await expect(page.getByTestId('navigation-banner')).toHaveCount(0)
  await page.getByTestId('parking-get-directions').click()
  await expect(page.getByTestId('navigation-banner')).toBeVisible()
  expect(requests).toHaveLength(1)
})

test('closing a selected spot while persisted consent is pending cannot authorize a fresh route', async ({
  page,
}) => {
  const requests = routingRequests(page)
  await openSpot(page)
  await page.evaluate(() => {
    const original = Storage.prototype.getItem
    // A deferred storage result models native AsyncStorage latency. The web
    // adapter adopts this promise; unrelated stored values keep normal behavior.
    Object.defineProperty(Storage.prototype, 'getItem', {
      configurable: true,
      value: function (this: Storage, key: string) {
        if (key !== 'parkey.discovery.routing-consent.v1')
          return original.call(this, key)
        Object.defineProperty(window, 'parkeyRaceConsentWaiting', {
          value: true,
        })
        return new Promise<string>((resolve) => {
          window.addEventListener(
            'parkey-release-race-consent',
            () => resolve('accepted'),
            { once: true },
          )
        })
      },
    })
  })
  let entranceReads = 0
  page.on('request', (request) => {
    if (request.url() !== parkingRpc) return
    const body: unknown = request.postDataJSON()
    if (
      body &&
      typeof body === 'object' &&
      'west' in body &&
      'east' in body &&
      typeof body.west === 'number' &&
      typeof body.east === 'number' &&
      body.east - body.west < 0.001
    )
      entranceReads++
  })
  await page.getByTestId('parking-get-directions').click()
  await expect
    .poll(() =>
      page.evaluate(() => Reflect.get(window, 'parkeyRaceConsentWaiting')),
    )
    .toBe(true)
  await page.goBack()
  await expect(page.getByTestId('parking-detail-title')).toHaveCount(0)
  await page.evaluate(() =>
    window.dispatchEvent(new Event('parkey-release-race-consent')),
  )
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  expect(entranceReads).toBe(0)
  expect(requests).toEqual([])
  await expect(page.getByTestId('route-panel')).toHaveCount(0)
  await expect(
    page.getByRole('alertdialog', { name: 'Directions privacy' }),
  ).toHaveCount(0)
})

test('external Maps uses the newly approved entrance instead of the earlier route destination', async ({
  page,
}) => {
  await installNavigationSensor(page)
  const originalResponse = page.waitForResponse(parkingRpc)
  await openSpot(page)
  const payload: unknown = await (await originalResponse).json()
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('records' in payload) ||
    !Array.isArray(payload.records)
  )
    throw new Error('Expected the reviewed synthetic parking response')
  const record = payload.records.find(isParking)
  if (!record || !record.navigationApproval)
    throw new Error('Expected an authorized synthetic entrance')
  await page.route('https://e2e.parkey.test/route/v1/driving/**', (route) =>
    route.fulfill({ status: 503, body: 'Synthetic routing outage' }),
  )
  await acceptDirections(page)
  await expect(page.getByTestId('route-panel').getByRole('alert')).toBeVisible()
  await interceptHandoffs(page)
  const longitude = spot.longitude + 0.0001
  const latitude = spot.latitude + 0.0001
  await page.route(parkingRpc, (route) =>
    route.fulfill({
      json: {
        records: [
          {
            ...record,
            entrances: [[longitude, latitude]],
            navigationApproval: {
              ...record.navigationApproval,
              entrance: [longitude, latitude],
            },
          },
        ],
        truncated: false,
      },
    }),
  )
  await page
    .getByRole('button', { name: 'Open in Google Maps', exact: true })
    .click()
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, 'parkeyRaceHandoffs')))
    .toEqual([
      `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`,
    ])
})

test('Back during a pending consent save prevents the completed write from starting directions', async ({
  page,
}) => {
  const requests = routingRequests(page)
  await openSpot(page)
  let entranceReads = 0
  page.on('request', (request) => {
    if (request.url() !== parkingRpc) return
    const body: unknown = request.postDataJSON()
    if (
      body &&
      typeof body === 'object' &&
      'west' in body &&
      'east' in body &&
      typeof body.west === 'number' &&
      typeof body.east === 'number' &&
      body.east - body.west < 0.001
    )
      entranceReads++
  })
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Object.defineProperty(Storage.prototype, 'setItem', {
      configurable: true,
      value: function (this: Storage, key: string, value: string) {
        if (key !== 'parkey.discovery.routing-consent.v1')
          return original.call(this, key, value)
        Object.defineProperty(window, 'parkeyRaceConsentSaving', {
          value: true,
        })
        return new Promise<void>((resolve) => {
          window.addEventListener(
            'parkey-release-race-consent-write',
            () => {
              original.call(this, key, value)
              resolve()
            },
            { once: true },
          )
        })
      },
    })
  })
  await page.getByTestId('parking-get-directions').click()
  const consent = page.getByRole('alertdialog', { name: 'Directions privacy' })
  await expect(consent).toBeVisible()
  await consent.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(() => Reflect.get(window, 'parkeyRaceConsentSaving')),
    )
    .toBe(true)
  await page.goBack()
  await expect(consent).toHaveCount(0)
  await expect(page.getByTestId('parking-detail-title')).toHaveText(spot.name)
  await page.evaluate(() =>
    window.dispatchEvent(new Event('parkey-release-race-consent-write')),
  )
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem('parkey.discovery.routing-consent.v1'),
      ),
    )
    .toBe('accepted')
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  expect(entranceReads).toBe(0)
  expect(requests).toEqual([])
  await expect(page.getByTestId('route-panel')).toHaveCount(0)
  await expect(page.getByTestId('navigation-banner')).toHaveCount(0)
  await expect(consent).toHaveCount(0)
})
