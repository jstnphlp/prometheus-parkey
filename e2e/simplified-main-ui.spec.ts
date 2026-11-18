import { test, expect, openMap, openSpot, spot } from './fixtures'

test('discovery uses a floating search, an icon-only legend, and a guest drawer over one map', async ({
  page,
}) => {
  await openMap(page)
  const map = page.getByTestId('map-interface')
  const canvas = map.locator('canvas').first()
  await expect(canvas).toBeVisible()
  await canvas.evaluate((element) =>
    element.setAttribute('data-original-map', 'true'),
  )
  const menuButton = page.getByRole('button', {
    name: 'Open menu',
    exact: true,
  })
  const searchButton = page.getByRole('button', {
    name: 'Search a place or destination',
    exact: true,
  })
  const menuBounds = await menuButton.boundingBox()
  const searchBounds = await searchButton.boundingBox()
  expect(menuBounds?.y).toBe(searchBounds?.y)
  expect((menuBounds?.x ?? 0) + (menuBounds?.width ?? 0)).toBeLessThan(
    searchBounds?.x ?? 0,
  )
  await expect(page.getByRole('tablist')).toHaveCount(0)

  const legend = page.getByRole('button', { name: 'Map legend', exact: true })
  await expect(legend).toHaveAttribute('aria-expanded', 'false')
  await legend.click()
  await expect(legend).toHaveAttribute('aria-expanded', 'true')
  for (const label of [
    'Parking lot',
    'Parking garage',
    'Street parking',
    'EV charging at parking',
  ]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible()
  }
  await expect(
    page.getByText(/Mapped places, not live\s+parking availability/),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(legend).toHaveAttribute('aria-expanded', 'false')

  const drawer = page.getByTestId('main-navigation-drawer')
  for (const close of [
    () => drawer.getByRole('button', { name: 'Close menu' }).click(),
    () => page.keyboard.press('Escape'),
  ]) {
    await menuButton.click()
    await expect(drawer).toBeVisible()
    await close()
    await expect(drawer).toHaveCount(0)
    await expect(canvas).toHaveAttribute('data-original-map', 'true')
  }

  await menuButton.click()
  await expect(drawer).toBeVisible()
  await expect(
    drawer.getByRole('button', { name: 'Sign In', exact: true }),
  ).toHaveCount(1)
  await drawer.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Sign in with email', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Create an account', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Continue exploring', exact: true })
    .click()
  await expect(menuButton).toBeVisible()
  await expect(canvas).toHaveAttribute('data-original-map', 'true')
})

test('a selected public record opens compact details and still links to the full record', async ({
  page,
}, info) => {
  await openSpot(page, false)
  await expect(page.getByTestId('parking-detail-title')).toHaveText(spot.name)
  await expect(
    page.getByText('Live availability not tracked', { exact: true }),
  ).toBeVisible()
  await info.attach('compact-details', {
    body: await page.screenshot({ scale: 'css' }),
    contentType: 'image/png',
  })
  await page
    .getByRole('button', { name: 'View Parking Details', exact: true })
    .click()
  await expect(page.getByTestId('parking-details-page')).toBeVisible()
})
