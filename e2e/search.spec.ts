import { test, expect, destination, openMap } from './fixtures'

test('search selects a destination, persists recents, and supports clear and undo', async ({
  page,
}) => {
  await openMap(page)
  const query = page.getByTestId('destination-query')
  await query.fill('Poblacion')
  await expect(page.getByTestId('destination-result-0')).toContainText(
    'Poblacion Test Cafe',
  )
  await page.getByTestId('destination-result-0').click()
  await expect(query).toHaveValue('Poblacion Test Cafe')
  await expect(page).toHaveURL(/searchLng=121.0308/)
  await expect(page).not.toHaveURL(/search=1/)
  await page.reload()
  await expect(query).toHaveValue('Poblacion Test Cafe')
  await page
    .getByRole('button', { name: 'Clear destination search', exact: true })
    .click()
  await expect(page.getByTestId('destination-recent-0')).toContainText(
    'Poblacion Test Cafe',
  )
  await page
    .getByRole('button', { name: 'Clear recent searches', exact: true })
    .click()
  await expect(page.getByTestId('destination-recent-0')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Undo last change', exact: true })
    .click()
  await expect(page.getByTestId('destination-recent-0')).toContainText(
    'Poblacion Test Cafe',
  )
  await page
    .getByRole('button', { name: 'Close destination search', exact: true })
    .click()
  await expect(
    page.getByRole('tab', { name: 'Map', exact: true }),
  ).toBeVisible()
})

test('search reports no matches and recovers from a provider error', async ({
  page,
}) => {
  await page.route('https://e2e.parkey.test/search?**', (route) =>
    route.fulfill({ json: { features: [] } }),
  )
  await openMap(page)
  await page.getByTestId('destination-query').fill('Nowhere')
  await expect(
    page.getByRole('heading', { name: 'No places found', exact: true }),
  ).toBeVisible()
  await page.route('https://e2e.parkey.test/search?**', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  )
  await page.getByTestId('destination-query').fill('Poblacion')
  await expect(
    page.getByRole('heading', { name: 'Search couldn’t connect', exact: true }),
  ).toBeVisible()
  await page.route('https://e2e.parkey.test/search?**', (route) =>
    route.fulfill({ json: destination }),
  )
  await page.getByRole('button', { name: 'Retry search', exact: true }).click()
  await expect(page.getByTestId('destination-result-0')).toContainText(
    'Poblacion Test Cafe',
  )
})
