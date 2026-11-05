import {
  test,
  expect,
  expandResults,
  openMap,
  openSpot,
  spot,
  spotAreaPath,
} from './fixtures'

test('favorites persist, reopen parking, and can be removed and restored', async ({
  page,
}) => {
  await openSpot(page)
  await page.getByRole('button', { name: 'Save parking', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Remove from favorites', exact: true }),
  ).toBeVisible()
  await page.goto('/?panel=saved')
  await page.getByRole('button', { name: 'Favorites', exact: true }).click()
  const favorite = page.getByRole('button', {
    name: `${spot.name}. View parking`,
    exact: true,
  })
  await expect(favorite).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Favorites', exact: true }).click()
  await favorite.click()
  await expect(page.getByTestId('parking-detail-title')).toHaveText(spot.name)
  await page.goto('/?panel=saved')
  await page.getByRole('button', { name: 'Favorites', exact: true }).click()
  await page
    .getByRole('button', {
      name: `Remove ${spot.name} from favorites`,
      exact: true,
    })
    .click()
  await expect(favorite).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Undo last change', exact: true })
    .click()
  await expect(favorite).toBeVisible()
})

test('viewing parking adds it to Recent', async ({ page }) => {
  await openMap(page, spotAreaPath)
  await expandResults(page)
  await page
    .getByRole('button', { name: /^1210\..*Open parking details$/ })
    .click()
  await expect(page.getByTestId('parking-detail-title')).toHaveText(spot.name)
  await page.goto('/?panel=saved')
  await page
    .getByRole('button', { name: 'Recently viewed', exact: true })
    .click()
  await expect(
    page.getByRole('button', {
      name: `${spot.name}. View parking`,
      exact: true,
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Favorites', exact: true }).click()
  await expect(
    page.getByText('Star a parking location to save it here.', { exact: true }),
  ).toBeVisible()
})

test('home address can be searched, saved, and reopened after reload', async ({
  page,
}) => {
  await openMap(page)
  await page.getByRole('tab', { name: 'Saved', exact: true }).click()
  await page
    .getByRole('button', { name: 'Saved addresses', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Home. Set address', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Set home address', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('textbox', { name: 'Search for an address', exact: true })
    .fill('Poblacion')
  await page.getByTestId('destination-result-0').click()
  await expect(
    page.getByRole('button', {
      name: 'Home. Poblacion Test Cafe',
      exact: true,
    }),
  ).toBeVisible()
  await page.reload()
  await page
    .getByRole('button', { name: 'Saved addresses', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Home. Poblacion Test Cafe', exact: true })
    .click()
  await expect(page).not.toHaveURL(/panel=saved/)
  await expect(page).toHaveURL(/lng=121.0308&lat=14.5653/)
  await expect(page.getByRole('tab', { name: 'Map', exact: true })).toHaveText(
    'Map',
  )
})

test('parked location persists, can be cleared, and supports undo', async ({
  page,
}) => {
  await openMap(page)
  await page.getByRole('tab', { name: 'Saved', exact: true }).click()
  await page
    .getByRole('button', { name: 'Save where I parked', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Clear parked location', exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Clear parked location', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Clear parked location', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Clear parked location', exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Undo last change', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Clear parked location', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Show on map', exact: true }).click()
  await expect(page).toHaveURL(/lng=121.0308&lat=14.5653/)
})

test('denied location leaves parked location unsaved and shows recovery guidance', async ({
  page,
  context,
}) => {
  await context.clearPermissions()
  await context.grantPermissions([])
  await openMap(page)
  await page.getByRole('tab', { name: 'Saved', exact: true }).click()
  await page
    .getByRole('button', { name: 'Save where I parked', exact: true })
    .click()
  await expect(
    page.getByText(
      'Your location could not be saved. Check location access and try again.',
      { exact: true },
    ),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Clear parked location', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Save where I parked', exact: true }),
  ).toBeEnabled()
})
