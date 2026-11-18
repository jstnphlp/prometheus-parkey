import {
  test,
  expect,
  expandResults,
  openMap,
  openSpot,
  spot,
} from './fixtures'

test('loads mapped parking, opens details, and returns with browser Back', async ({
  page,
}) => {
  await openMap(page)
  await expect(
    page.getByRole('tab', { name: 'Explore', exact: true }),
  ).toHaveText('Explore')
  await expect(
    page.getByRole('button', {
      name: 'Search parking or landmark',
      exact: true,
    }),
  ).toBeVisible()
  await expandResults(page)
  const parking = page.getByRole('button', {
    name: /^1210\..*Open parking details$/,
  })
  await parking.click()
  await expect(page.getByTestId('parking-detail-title')).toHaveText(spot.name)
  await expect(
    page.getByRole('button', { name: 'Save parking', exact: true }),
  ).toBeEnabled()
  await page
    .getByRole('button', { name: 'View Parking Details', exact: true })
    .click()
  await expect(page.getByTestId('parking-get-directions')).toBeDisabled()
  await expect(page.getByTestId('parking-navigation-warning')).toContainText(
    'confirmed entrance',
  )
  await expect(page).toHaveURL(/spot=osm%3Away%2F113539118/)
  await page.goBack()
  await expect(page.getByTestId('parking-preview')).toBeVisible()
  await page.goBack()
  await expect(page.getByTestId('parking-detail-title')).toHaveCount(0)
  await expect(
    page.getByRole('tab', { name: 'Explore', exact: true }),
  ).toHaveText('Explore')
})

for (const [label, filter, kind] of [
  ['Street', 'street', 'Street'],
  ['Garage', 'garage', 'Garage'],
] as const) {
  test(`${label} filter shows matching parking and survives reload`, async ({
    page,
  }) => {
    // The mobile viewport is narrower; center on a real bundled garage rather
    // than assuming one exists in every viewport around the pilot center.
    await openMap(
      page,
      filter === 'garage'
        ? '/?lng=121.02654994&lat=14.5606658'
        : '/?lng=121.0254457&lat=14.5609052',
    )
    await page
      .getByRole('button', { name: 'Filter parking', exact: true })
      .click()
    await page.getByRole('button', { name: label, exact: true }).click()
    await page
      .getByRole('button', { name: 'Apply Filters', exact: true })
      .click()
    await expect(page).toHaveURL(new RegExp(`filter=${filter}`))
    await expandResults(page)
    const rows = page.getByTestId(/^parking-row-/)
    await expect(rows.first()).toBeVisible()
    for (const row of await rows.all()) {
      await expect(row).toContainText(kind)
    }
    await page.reload()
    await expect(page.getByTestId('parking-list-page')).toBeVisible()
    await expect(rows.first()).toBeVisible()
    for (const row of await rows.all()) {
      await expect(row).toContainText(kind)
    }
  })
}

test('Free filter can be cleared to restore nearby parking', async ({
  page,
}) => {
  await openMap(page)
  await page
    .getByRole('button', { name: 'Filter parking', exact: true })
    .click()
  await page.getByRole('button', { name: 'No fee', exact: true }).click()
  await page.getByRole('button', { name: 'Apply Filters', exact: true }).click()
  await expect(page).toHaveURL(/fees=free/)
  await expect(
    page.getByRole('heading', { name: 'No parking found', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Clear Filters', exact: true }).click()
  await expect(page).not.toHaveURL(/fees=free/)
  await expandResults(page)
  await expect(
    page.getByRole('button', { name: /Open parking details$/ }).first(),
  ).toBeVisible()
})

test('selected parking survives a reload without starting directions', async ({
  page,
}) => {
  await openSpot(page)
  await page.reload()
  await expect(page.getByTestId('parking-detail-title')).toHaveText(spot.name)
  await expect(page.getByTestId('route-panel')).toHaveCount(0)
  await expect(
    page.getByRole('alertdialog', { name: 'Directions privacy' }),
  ).toHaveCount(0)
})

test('Map, Saved, and You tabs open the appropriate screens', async ({
  page,
}) => {
  await openMap(page)
  await page.getByRole('tab', { name: 'Saved', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: /^(Saved|Saved parking)$/ }),
  ).toBeVisible()
  await expect(page.getByRole('tablist')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Explore Parking', exact: true })
    .click()
  await page.getByRole('tab', { name: 'Profile', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Account', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('tab', { name: 'Profile', exact: true }),
  ).toHaveText('Profile')
  await page.getByRole('tab', { name: 'Saved', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: /^(Saved|Saved parking)$/ }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Explore Parking', exact: true })
    .click()
  await expect(
    page.getByRole('button', {
      name: 'Search parking or landmark',
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('tab', { name: 'Explore', exact: true }),
  ).toHaveText('Explore')
})

test('the Figma map/list actions preserve discovery state and search wording', async ({
  page,
}) => {
  await openMap(page)
  await expect(
    page.getByRole('button', {
      name: 'Search parking or landmark',
      exact: true,
    }),
  ).toContainText('Search parking or landmark')
  await page.getByRole('button', { name: 'Show parking list' }).first().click()
  await expect(page.getByTestId('parking-list-page')).toBeVisible()
  await page.getByRole('tab', { name: 'Map', exact: true }).click()
  await expect(page.getByTestId('parking-list-page')).toHaveCount(0)
  await expect(
    page.getByRole('tab', { name: 'Explore', exact: true }),
  ).toHaveAttribute('aria-selected', 'true')
})
