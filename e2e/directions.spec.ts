import {
  test,
  expect,
  drivingRoute,
  openSpot,
  spot,
  spotPath,
  useNavigationGps,
} from './fixtures'

test('directions require consent, start navigation, and return to the map', async ({
  page,
  context,
}) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/route/v1/driving/'))
      requests.push(request.url())
  })
  await useNavigationGps(page)
  await openSpot(page)
  await page.getByTestId('parking-get-directions').click()
  const consent = page.getByRole('alertdialog', { name: 'Directions privacy' })
  await expect(consent).toBeVisible()
  await expect(page.getByTestId('route-panel')).toHaveCount(0)
  expect(requests).toHaveLength(0)
  await consent.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(consent).toHaveCount(0)
  expect(requests).toHaveLength(0)
  await page.getByTestId('parking-get-directions').click()
  await consent.getByRole('button', { name: 'Continue', exact: true }).click()
  const panel = page.getByTestId('route-panel')
  await expect(page.getByTestId('navigation-banner')).toBeVisible()
  expect(requests).toHaveLength(1)
  await expect(page.getByTestId('navigation-banner')).toContainText(
    'Turn left onto Test Street',
  )
  await expect(panel).toContainText('3 min')
  await expect(panel).toContainText('650 m')
  await panel.getByRole('button', { name: 'End', exact: true }).click()
  await expect(panel).toHaveCount(0)
  await expect(
    page.getByRole('tab', { name: 'Map', exact: true }),
  ).toBeVisible()
  await page.goto(spotPath)
  await context.setGeolocation({
    longitude: 121.0308,
    latitude: 14.5653,
    accuracy: 5,
  })
  await page.getByTestId('parking-get-directions').click()
  await expect(page.getByTestId('navigation-banner')).toBeVisible()
  await expect(consent).toHaveCount(0)
  await page.reload()
  await expect(panel).toHaveCount(0)
  await expect(page.getByTestId('parking-detail-title')).toHaveText(spot.name)
})

test('routing failure offers external maps and retry recovers', async ({
  page,
}) => {
  await page.route('https://e2e.parkey.test/route/v1/driving/**', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  )
  await useNavigationGps(page)
  await openSpot(page)
  await page.getByTestId('parking-get-directions').click()
  await page
    .getByRole('alertdialog', { name: 'Directions privacy' })
    .getByRole('button', { name: 'Continue', exact: true })
    .click()
  const panel = page.getByTestId('route-panel')
  await expect(panel.getByRole('alert')).toBeVisible()
  for (const provider of ['Google Maps', 'Apple Maps', 'Waze']) {
    await expect(
      panel.getByRole('button', { name: `Open in ${provider}`, exact: true }),
    ).toBeEnabled()
  }
  await page.route('https://e2e.parkey.test/route/v1/driving/**', (route) =>
    route.fulfill({ json: drivingRoute }),
  )
  await panel.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByTestId('navigation-banner')).toBeVisible()
  await expect(panel.getByRole('alert')).toHaveCount(0)
})

test('arriving allows parking confirmation and saves the car location', async ({
  page,
  context,
}) => {
  await useNavigationGps(page)
  await openSpot(page)
  await page.getByTestId('parking-get-directions').click()
  await page
    .getByRole('alertdialog', { name: 'Directions privacy' })
    .getByRole('button', { name: 'Continue', exact: true })
    .click()
  await expect(page.getByTestId('navigation-banner')).toBeVisible()
  const panel = page.getByTestId('route-panel')
  // Arrival still requires multiple fresh accurate fixes across two seconds.
  await expect
    .poll(
      async () => {
        await page.evaluate(
          (point) =>
            window.dispatchEvent(
              new CustomEvent('parkey-test-fix', { detail: point }),
            ),
          [spot.longitude, spot.latitude],
        )
        return panel
          .getByRole('heading', { name: 'You made it!', exact: true })
          .isVisible()
      },
      { intervals: [1000], timeout: 12000 },
    )
    .toBe(true)
  await context.setGeolocation({
    longitude: spot.longitude,
    latitude: spot.latitude,
    accuracy: 5,
  })
  await panel
    .getByRole('button', { name: 'I parked here', exact: true })
    .click()
  await expect(
    panel.getByRole('button', { name: 'Parked here', exact: true }),
  ).toBeVisible()
  await page.goto('/?panel=saved')
  await expect(
    page.getByRole('button', { name: 'Clear parked location', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Show on map', exact: true }).click()
  await expect(page).toHaveURL(
    new RegExp(`lng=${spot.longitude}&lat=${spot.latitude}`),
  )
})
