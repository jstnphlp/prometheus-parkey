import {
  test,
  expect,
  expandResults,
  openMap,
  openSpot,
  spot,
  spotAreaPath,
} from './fixtures'

test('loads mapped parking, opens details, and returns with browser Back', async ({
  page,
}) => {
  await openMap(page, spotAreaPath)
  await expect(page.getByRole('tab', { name: 'Map', exact: true })).toHaveText(
    'Map',
  )
  await expect(page.getByTestId('destination-query')).toBeVisible()
  await expandResults(page)
  const parking = page.getByRole('button', {
    name: /^1210\..*Open parking details$/,
  })
  await parking.click()
  await expect(page.getByTestId('parking-detail-title')).toHaveText(spot.name)
  await expect(
    page.getByRole('button', { name: 'Save parking', exact: true }),
  ).toBeEnabled()
  await expect(page.getByTestId('parking-get-directions')).toBeEnabled()
  await expect(page).toHaveURL(/spot=osm%3Away%2F113539118/)
  await page.goBack()
  await expect(page.getByTestId('parking-detail-title')).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'Map', exact: true })).toHaveText(
    'Map',
  )
})

for (const [label, filter, kind] of [
  ['Street', 'street', 'Street'],
  ['Garage', 'garage', 'Garage'],
] as const) {
  test(`${label} filter shows matching parking and survives reload`, async ({
    page,
  }) => {
    // The narrower phone viewport must actually contain a known garage.
    await openMap(
      page,
      filter === 'garage' ? '/?lng=121.02654994&lat=14.5606658' : '/',
    )
    await page
      .getByTestId('parking-filters')
      .getByRole('button', { name: label, exact: true })
      .click()
    await expect(page).toHaveURL(new RegExp(`filter=${filter}`))
    await expandResults(page)
    const rows = page.getByTestId(/^parking-row-/)
    await expect(rows.first()).toBeVisible()
    for (const row of await rows.all()) {
      await expect(row).toContainText(kind)
    }
    await page.reload()
    await expect(page.getByTestId('parking-sheet-handle')).toHaveAccessibleName(
      /Parking sheet: full/,
    )
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
    .getByTestId('parking-filters')
    .getByRole('button', { name: 'Free', exact: true })
    .click()
  await expect(page).toHaveURL(/fees=free/)
  await expect(
    page
      .getByText('No free spots in view', { exact: true })
      .filter({ visible: true }),
  ).toBeVisible()
  await page
    .getByTestId('parking-filters')
    .getByRole('button', { name: 'All', exact: true })
    .click()
  await expect(page).not.toHaveURL(/fees=free/)
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
    page.getByRole('heading', { name: 'Saved', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('tab', { name: 'Saved', exact: true }),
  ).toHaveText('Saved')
  await page.getByRole('tab', { name: 'You', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'You', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('tab', { name: 'You', exact: true })).toHaveText(
    'You',
  )
  await page.getByRole('tab', { name: 'Saved', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Saved', exact: true }),
  ).toBeVisible()
  await page.getByRole('tab', { name: 'Map', exact: true }).click()
  await expect(page.getByTestId('destination-query')).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Map', exact: true })).toHaveText(
    'Map',
  )
})
